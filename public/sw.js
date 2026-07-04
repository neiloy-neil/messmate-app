const CACHE_NAME = 'messmate-cache-v1';
const urlsToCache = [
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stale-while-revalidate fetch strategy for generic requests
self.addEventListener('fetch', event => {
  // Only cache GET requests that are not navigating to /api or supabase
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase.co') ||
    !(event.request.url.startsWith('http:') || event.request.url.startsWith('https:'))
  ) {
    return; // default browser behavior
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for offline mode if we don't have it cached
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
