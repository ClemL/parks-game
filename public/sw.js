/*
 * Offline play. The shell and the park art are cached as they are fetched, so
 * the hashed bundle names never need listing at build time.
 *
 * - navigations: network first, falling back to the cached shell
 * - same-origin assets: cache first, refreshed in the background
 * - the table routes: never touched — a cached answer would hand a phone a
 *   stale board, and the poll would never see the table move
 * - everything else (the Wikipedia art lookup): straight to the network
 */
const CACHE = 'trailside-v2';
const SHELL = './';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SHELL]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Table state is live and per-seat: it must never be served from a cache.
  if (url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(CACHE).then((cache) => cache.put(SHELL, response.clone()));
          return response;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());
      return cached ?? network;
    }),
  );
});
