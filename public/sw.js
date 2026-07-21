// Nest service worker: network-first with cache fallback for same-origin
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

// Web-push reminders: show the digest sent by the send-reminders edge
// function, and focus (or open) the app when the notification is tapped.
self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nest', {
      body: data.body || '',
      icon: './icon-512.png',
      badge: './icon-512.png',
      data: { url: data.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Where to land. Resolve against this worker's scope so it's always an
  // absolute Nest URL, never another app's.
  const scope = self.registration.scope
  const target = new URL((event.notification.data && event.notification.data.url) || scope, scope).href
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientList) {
        // Only re-use a window that's actually THIS app. Both Nest and the
        // meal-planner live on the same github.io origin, so without the scope
        // check we'd focus whichever tab happened to be open.
        if (client.url.startsWith(scope) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    })(),
  )
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
