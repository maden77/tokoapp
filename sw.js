const CACHE_VERSION = 'v3';
const STATIC_CACHE  = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './shared/style.css',
  './shared/ui.js',
  './shared/crypto.js',
  './shared/auth.js',
  './shared/components.js',
  './shared/router.js',
  './shared/dexie.min.js',
  './apps/home.js',
  './apps/catatan.js',
  './apps/kamera.js',
  './apps/kalkulator.js',
  './apps/pengaturan.js',
  './apps/pesan.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(
      fetch(request).then(res => {
        const clone = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
        return res;
      }).catch(() => caches.match(request).then(r => r || caches.match('./offline.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => caches.match('./offline.html'));
    })
  );
});