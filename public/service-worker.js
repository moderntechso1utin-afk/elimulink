// Service Worker for ElimuLink PWA
const CACHE_NAME = 'elimulink-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/src/index.css',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/maskable_icon.svg'
];

// Install service worker and cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)).catch((err) => console.log('Cache failed:', err))
  );
  self.skipWaiting();
});

// Fetch event - try cache, then network, with navigation fallback to offline page
self.addEventListener('fetch', (event) => {
  // Only handle same-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Navigation requests: prefer network then fallback to cached offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache for navigations
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // For other requests, serve from cache then network and cache new resources
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => {
          // If request is for an image, return a simple placeholder
          if (event.request.destination === 'image') {
            return new Response('', { status: 404 });
          }
          return new Response('Offline - resource unavailable', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        });
    })
  );
});

// Activate and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((cacheName) => (cacheName !== CACHE_NAME ? caches.delete(cacheName) : null)))
    )
  );
  self.clients.claim();
});
