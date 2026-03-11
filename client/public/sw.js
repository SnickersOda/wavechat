const CACHE = 'wavechat-v2'
const STATIC = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/api/') || e.request.url.includes('/socket.io/')) return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  const { title, body, icon, data } = e.data.json()
  e.waitUntil(
    self.registration.showNotification(title || 'WaveChat', {
      body, icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: data || {},
      actions: [{ action: 'open', title: 'Открыть' }]
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => {
    const c = cs.find(x => x.url.includes(self.location.origin))
    return c ? c.focus() : clients.openWindow('/')
  }))
})
