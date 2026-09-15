/* ============================================================
   Service Worker — Cache strategi per-resource
   ============================================================ */
'use strict';

const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './offline.html',
  './manifest.json',
  './assets/style.css',
  './assets/ui.js',
  './assets/crypto.js',
  './assets/home.js',
  './assets/app.js',
  './assets/dexie.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ---- Install: pre-cache semua asset statis ----
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: hapus cache lama ----
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ---- Fetch ----
self.addEventListener('fetch', (e) => {
  const { request } = e;

  // Hanya handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Hanya same-origin
  if (url.origin !== location.origin) return;

  // HTML / navigate → Network-first (agar update cepat)
  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then(r => r || caches.match('./offline.html'))
        )
    );
    return;
  }

  // Asset statis → Cache-first (offline-ready)
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(res => {
          if (res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match('./offline.html'));
    })
  );
});

// ---- Pesan dari client (untuk skipWaiting manual) ----
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});