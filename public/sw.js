// Treehouse service worker: network-first with cache fallback for same-origin
// GET requests. Online, every request hits the network (so deploys arrive
// immediately and the in-app update prompt keeps working); each good response
// refreshes the cache. Offline, the cached copy serves — the app shell and
// assets open with no signal, and the on-device data does the rest.

const CACHE = 'treehouse-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // version.json must never be served stale — the update prompt polls it.
  // Offline it simply fails, which the app treats as "no update news".
  if (url.pathname.endsWith('/version.json')) return

  event.respondWith(networkFirst(request))
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) cache.put(request, fresh.clone())
    return fresh
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' })
    if (cached) return cached
    throw error
  }
}
