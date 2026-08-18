const CACHE = 'cyn-v23';
const SHELL = ['./index.html', './manifest.json', './premium-dropdown.js?v=23'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
    .then(() => self.clients.claim())
    // Reload existing tabs once when this build takes control. This replaces a
    // stale cached document without asking the user to clear browser storage.
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(clients => Promise.all(clients.map(client =>
      typeof client.navigate === 'function'
        ? client.navigate(client.url).catch(() => null)
        : Promise.resolve(null)
    )))
  );
});

self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests; let Firebase/CDN requests pass through
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
