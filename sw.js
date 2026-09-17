const CACHE = 'memorial-traces-v4';
const PREFIXES = ['mt-', 'memorial-traces-'];
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Limit cleanup to this application's scope. GitHub Pages shares an origin.
  const ownPath = new URL(self.registration.scope).pathname;
  for (const name of await caches.keys()) if (name !== CACHE && PREFIXES.some(p => name.startsWith(p))) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) if (new URL(request.url).pathname.startsWith(ownPath)) await cache.delete(request);
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.pathname.startsWith(new URL(self.registration.scope).pathname) || url.searchParams.has('debug')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        try { await cache.put(event.request, response.clone()); } catch { /* Storage quota must not break a live response. */ }
      }
      return response;
    } catch {
      return await cache.match(event.request) || new Response('目前離線，請連線後重新載入。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
