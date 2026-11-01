// Service Worker satisfying PWA installability criteria without offline caching
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through to network (caches nothing)
  event.respondWith(fetch(event.request));
});
