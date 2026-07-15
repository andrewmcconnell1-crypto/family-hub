import { useCallback, useEffect, useRef, useState } from 'react'
import {
  emptyData,
  fetchCloudData,
  hasContent,
  loadData,
  normalizeData,
  reorderTodo,
  saveCloudData,
  saveData,
} from '../lib/familyData.js'
import {
  deleteFile,
  putFile,
  releaseFileUrl,
  setCloudFileContext,
  uploadLocalFiles,
} from '../lib/fileStore.js'
import { supabase } from '../lib/supabase.js'
import { makeId } from '../utils/id.js'

const CLOUD_SAVE_DEBOUNCE_MS = 800

// Timestamps cross the wire in varying formats ('…Z' vs '…+00:00'); compare
// them as epoch milliseconds, never as strings.
function toEpoch(timestamp) {
  const ms = Date.parse(timestamp)
  return Number.isFinite(ms) ? ms : null
}

// The single data store: children, events, documents and photos. Always
// persisted on-device (localStorage + IndexedDB for blobs); when a user is
// signed in it also syncs to Supabase — cloud rows for metadata, a private
// storage bucket for files, and realtime updates from other devices.
//
// `ownerId` is whose cloud data this account reads/writes: their own id when
// solo, the household owner's id when they've joined a shared hub (see
// useHousehold). Null while the household is still resolving — cloud work
// waits so we never load one owner's data and then switch to another's.
//
// syncState: 'local' (no cloud), 'syncing', 'synced', or 'error'.
export function useFamilyStore(user, ownerId) {
  const [data, setData] = useState(() =>
    typeof window === 'undefined' ? emptyData() : loadData(),
  )
  // Cloud sync progress while signed in; signed out, the state is simply
  // 'local', derived below rather than set from effects.
  const [cloudState, setCloudState] = useState('syncing')
  const userId = user?.id ?? null
  const syncState = userId && supabase ? cloudState : 'local'

  // True once the initial cloud load/migration for this user finished, so we
  // never overwrite the cloud with stale local state.
  const cloudReadyRef = useRef(false)
  // Epoch ms of our last cloud write, and the JSON we last exchanged with the
  // cloud (in either direction). Together they stop our own realtime echo from
  // being re-adopted and re-saved in an endless loop.
  const lastSavedAtRef = useRef(null)
  const lastCloudJsonRef = useRef(null)
  const saveTimerRef = useRef(null)

  // Files are stored under the data owner's folder in the bucket.
  useEffect(() => {
    setCloudFileContext(ownerId)
    return () => setCloudFileContext(null)
  }, [ownerId])

  // On sign-in (or joining/leaving a household): adopt the owner's cloud
  // copy, or — first sign-in with existing local data — migrate the local
  // copy (including file blobs) up to the cloud.
  useEffect(() => {
    if (!userId || !supabase || !ownerId) {
      cloudReadyRef.current = false
      return undefined
    }

    let active = true
    lastCloudJsonRef.current = null
    ;(async () => {
      setCloudState('syncing')
      try {
        const cloud = await fetchCloudData(supabase, ownerId)
        if (!active) return
        if (cloud) {
          const normalized = normalizeData(cloud)
          lastCloudJsonRef.current = JSON.stringify(normalized)
          setData(normalized)
        } else {
          const local = loadData()
          if (hasContent(local)) {
            const fileIds = [...local.documents, ...local.photos].map((item) => item.fileId)
            await uploadLocalFiles(fileIds)
          }
          lastSavedAtRef.current = toEpoch(await saveCloudData(supabase, ownerId, local))
          if (!active) return
          lastCloudJsonRef.current = JSON.stringify(local)
          setData(local)
        }
        cloudReadyRef.current = true
        setCloudState('synced')
      } catch (error) {
        console.error('Cloud load failed', error)
        if (active) setCloudState('error')
      }
    })()

    return () => {
      active = false
      cloudReadyRef.current = false
    }
  }, [userId, ownerId])

  // Persist on every change: locally right away, to the cloud debounced.
  useEffect(() => {
    saveData(data)
    if (!userId || !supabase || !ownerId || !cloudReadyRef.current) return undefined

    // Nothing to push if this state is what we last loaded from / saved to the
    // cloud (e.g. we just adopted a realtime update).
    const json = JSON.stringify(data)
    if (json === lastCloudJsonRef.current) return undefined

    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setCloudState('syncing')
      try {
        lastSavedAtRef.current = toEpoch(await saveCloudData(supabase, ownerId, data))
        lastCloudJsonRef.current = json
        setCloudState('synced')
      } catch (error) {
        console.error('Cloud save failed', error)
        setCloudState('error')
      }
    }, CLOUD_SAVE_DEBOUNCE_MS)

    return () => clearTimeout(saveTimerRef.current)
  }, [data, userId, ownerId])

  // Live cross-device updates. Our own writes echo back through this channel
  // too; the timestamp and JSON guards drop them so they can't feed back into
  // the save effect.
  useEffect(() => {
    if (!userId || !supabase || !ownerId) return undefined

    const channel = supabase
      .channel(`family_data:${ownerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_data', filter: `user_id=eq.${ownerId}` },
        (payload) => {
          const row = payload.new
          if (!row) return
          if (toEpoch(row.updated_at) === lastSavedAtRef.current) return
          const incoming = normalizeData(row.data)
          const json = JSON.stringify(incoming)
          if (json === lastCloudJsonRef.current) return
          lastCloudJsonRef.current = json
          setData(incoming)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, ownerId])

  const addChild = useCallback((child) => {
    const id = makeId('child')
    setData((d) => ({
      ...d,
      children: [...d.children, { dob: '', colorId: 'meadow', avatarFileId: '', ...child, id }],
    }))
    return id
  }, [])

  const updateChild = useCallback((id, patch) => {
    setData((d) => ({
      ...d,
      children: d.children.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }, [])

  // Removing a member keeps their events/documents/photos but untags them,
  // so nothing is silently lost. Their avatar image, though, goes with them.
  const removeChild = useCallback((id) => {
    const untag = (list) =>
      list.map((item) =>
        item.childIds.includes(id)
          ? { ...item, childIds: item.childIds.filter((c) => c !== id) }
          : item,
      )
    setData((d) => {
      const member = d.children.find((c) => c.id === id)
      if (member?.avatarFileId) {
        releaseFileUrl(member.avatarFileId)
        deleteFile(member.avatarFileId).catch(() => {})
      }
      return {
        ...d,
        children: d.children.filter((c) => c.id !== id),
        todos: untag(d.todos),
        events: untag(d.events),
        documents: untag(d.documents),
        photos: untag(d.photos),
      }
    })
  }, [])

  const addTodo = useCallback((todo) => {
    const id = makeId('todo')
    setData((d) => ({
      ...d,
      todos: [
        ...d.todos,
        { done: false, doneAt: '', dueDate: '', notes: '', childIds: [], ...todo, id },
      ],
    }))
    return id
  }, [])

  const updateTodo = useCallback((id, patch) => {
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }, [])

  const toggleTodo = useCallback((id) => {
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) =>
        t.id === id
          ? { ...t, done: !t.done, doneAt: t.done ? '' : new Date().toISOString() }
          : t,
      ),
    }))
  }, [])

  const moveTodo = useCallback((id, delta) => {
    setData((d) => ({ ...d, todos: reorderTodo(d.todos, id, delta) }))
  }, [])

  const removeTodo = useCallback((id) => {
    setData((d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }))
  }, [])

  const clearDoneTodos = useCallback(() => {
    setData((d) => ({ ...d, todos: d.todos.filter((t) => !t.done) }))
  }, [])

  const addEvent = useCallback((event) => {
    const id = makeId('event')
    setData((d) => ({
      ...d,
      events: [
        ...d.events,
        {
          time: '',
          category: 'other',
          notes: '',
          childIds: [],
          repeat: 'none',
          weekdays: [],
          endDate: '',
          exceptions: [],
          ...event,
          id,
        },
      ],
    }))
    return id
  }, [])

  const updateEvent = useCallback((id, patch) => {
    setData((d) => ({
      ...d,
      events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
  }, [])

  const removeEvent = useCallback((id) => {
    setData((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) }))
  }, [])

  // "Delete just this day" on a recurring event: the occurrence date joins the
  // series' exception list.
  const skipEventOccurrence = useCallback((id, dateKey) => {
    setData((d) => ({
      ...d,
      events: d.events.map((e) =>
        e.id === id && !e.exceptions.includes(dateKey)
          ? { ...e, exceptions: [...e.exceptions, dateKey] }
          : e,
      ),
    }))
  }, [])

  const addDocument = useCallback(async ({ file, title, category, childIds, notes }) => {
    const fileId = makeId('file')
    await putFile(fileId, file)
    const id = makeId('doc')
    setData((d) => ({
      ...d,
      documents: [
        {
          id,
          title: title || file.name,
          category: category || 'other',
          childIds: childIds || [],
          notes: notes || '',
          fileId,
          fileName: file.name,
          fileType: file.type,
          size: file.size,
          addedAt: new Date().toISOString(),
        },
        ...d.documents,
      ],
    }))
    return id
  }, [])

  const removeDocument = useCallback((id) => {
    setData((d) => {
      const doc = d.documents.find((x) => x.id === id)
      if (doc) {
        releaseFileUrl(doc.fileId)
        deleteFile(doc.fileId).catch(() => {})
      }
      return { ...d, documents: d.documents.filter((x) => x.id !== id) }
    })
  }, [])

  const addPhotos = useCallback(async ({ files, childIds, caption }) => {
    const entries = []
    for (const file of files) {
      const fileId = makeId('file')
      await putFile(fileId, file)
      entries.push({
        id: makeId('photo'),
        caption: caption || '',
        childIds: childIds || [],
        fileId,
        fileType: file.type,
        addedAt: new Date().toISOString(),
      })
    }
    setData((d) => ({ ...d, photos: [...entries, ...d.photos] }))
  }, [])

  const removePhoto = useCallback((id) => {
    setData((d) => {
      const photo = d.photos.find((x) => x.id === id)
      if (photo) {
        releaseFileUrl(photo.fileId)
        deleteFile(photo.fileId).catch(() => {})
      }
      return { ...d, photos: d.photos.filter((x) => x.id !== id) }
    })
  }, [])

  return {
    data,
    syncState,
    addChild,
    updateChild,
    removeChild,
    addTodo,
    updateTodo,
    toggleTodo,
    moveTodo,
    removeTodo,
    clearDoneTodos,
    addEvent,
    updateEvent,
    removeEvent,
    skipEventOccurrence,
    addDocument,
    removeDocument,
    addPhotos,
    removePhoto,
  }
}
