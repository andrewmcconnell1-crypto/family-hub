// Blob storage for documents and photos. IndexedDB is always the local cache
// (files survive reloads without touching localStorage's tiny quota); when a
// user is signed in, blobs are also uploaded to a private Supabase Storage
// bucket so they reach the cloud and other devices. Metadata about each file
// lives in the main data store (lib/familyData.js); this module only maps
// fileId -> Blob.

import { supabase } from './supabase.js'

const DB_NAME = 'treehouse-files'
const STORE = 'files'
const BUCKET = 'family-files'

// The signed-in user's id (or null). Set by useFamilyStore when auth changes;
// files are stored under `${userId}/${fileId}` in the bucket, which is what
// the storage RLS policies key on.
let cloudUserId = null

export function setCloudFileContext(userId) {
  cloudUserId = userId
}

let dbPromise = null

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbPut(id, blob) {
  const db = await openDb()
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, id))
}

async function idbGet(id) {
  const db = await openDb()
  return requestToPromise(db.transaction(STORE).objectStore(STORE).get(id))
}

async function idbDelete(id) {
  const db = await openDb()
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
}

// Store a file locally and, when signed in, in the cloud. Throws if the cloud
// upload fails so the caller can tell the user the file didn't reach the cloud.
export async function putFile(id, blob) {
  await idbPut(id, blob)
  if (cloudUserId && supabase) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${cloudUserId}/${id}`, blob, { upsert: true, contentType: blob.type || undefined })
    if (error) throw error
  }
}

// Local cache first; fall back to downloading from the cloud (a file added on
// another device), caching it locally for next time.
export async function getFile(id) {
  const local = await idbGet(id).catch(() => null)
  if (local) return local
  if (cloudUserId && supabase) {
    const { data, error } = await supabase.storage.from(BUCKET).download(`${cloudUserId}/${id}`)
    if (!error && data) {
      idbPut(id, data).catch(() => {})
      return data
    }
  }
  return null
}

export async function deleteFile(id) {
  await idbDelete(id).catch(() => {})
  if (cloudUserId && supabase) {
    await supabase.storage.from(BUCKET).remove([`${cloudUserId}/${id}`])
  }
}

// First sign-in with existing local data: push every local blob referenced by
// the data up to the bucket. Per-file failures are collected, not fatal — the
// local copy still exists and a later save can retry.
export async function uploadLocalFiles(fileIds) {
  const failed = []
  for (const fileId of fileIds) {
    try {
      const blob = await idbGet(fileId)
      if (!blob) continue
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(`${cloudUserId}/${fileId}`, blob, { upsert: true, contentType: blob.type || undefined })
      if (error) throw error
    } catch (error) {
      console.error(`Failed to upload file ${fileId} to cloud`, error)
      failed.push(fileId)
    }
  }
  return failed
}

// Object URLs are cached for the life of the page: thumbnails re-render a lot
// and revoking/recreating them per component would thrash the DOM.
const urlCache = new Map()

export async function getFileUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id)
  const blob = await getFile(id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

export function releaseFileUrl(id) {
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(id)
  }
}
