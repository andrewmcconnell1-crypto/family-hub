import { useCallback, useEffect, useState } from 'react'
import { emptyData, loadData, saveData } from '../lib/familyData.js'
import { deleteFile, putFile, releaseFileUrl } from '../lib/fileStore.js'
import { makeId } from '../utils/id.js'

// The single data store: children, events, documents and photos, persisted to
// localStorage (metadata) + IndexedDB (file blobs). Cloud sync will slot in
// here later without the screens having to change.
export function useFamilyStore() {
  const [data, setData] = useState(() =>
    typeof window === 'undefined' ? emptyData() : loadData(),
  )

  useEffect(() => {
    saveData(data)
  }, [data])

  const addChild = useCallback((child) => {
    const id = makeId('child')
    setData((d) => ({ ...d, children: [...d.children, { dob: '', colorId: 'meadow', ...child, id }] }))
    return id
  }, [])

  const updateChild = useCallback((id, patch) => {
    setData((d) => ({
      ...d,
      children: d.children.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }, [])

  // Removing a child keeps their events/documents/photos but untags them,
  // so nothing is silently lost.
  const removeChild = useCallback((id) => {
    const untag = (list) =>
      list.map((item) =>
        item.childIds.includes(id)
          ? { ...item, childIds: item.childIds.filter((c) => c !== id) }
          : item,
      )
    setData((d) => ({
      children: d.children.filter((c) => c.id !== id),
      events: untag(d.events),
      documents: untag(d.documents),
      photos: untag(d.photos),
    }))
  }, [])

  const addEvent = useCallback((event) => {
    const id = makeId('event')
    setData((d) => ({
      ...d,
      events: [...d.events, { time: '', category: 'other', notes: '', childIds: [], ...event, id }],
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
    addChild,
    updateChild,
    removeChild,
    addEvent,
    updateEvent,
    removeEvent,
    addDocument,
    removeDocument,
    addPhotos,
    removePhoto,
  }
}
