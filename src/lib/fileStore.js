// Blob storage for documents and photos, backed by IndexedDB so files
// survive reloads and aren't squeezed into localStorage's tiny quota.
// Metadata about each file lives in the main data store (lib/familyData.js);
// this module only maps fileId -> Blob.

const DB_NAME = 'treehouse-files'
const STORE = 'files'

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

export async function putFile(id, blob) {
  const db = await openDb()
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, id))
}

export async function getFile(id) {
  const db = await openDb()
  return requestToPromise(db.transaction(STORE).objectStore(STORE).get(id))
}

export async function deleteFile(id) {
  const db = await openDb()
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
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
