/* One Drop — service worker
   App-shell cache first, network-first for navigation (so new deploys
   are picked up), runtime cache for the Firebase CDN modules. */

const VERSION = 'onedrop-v1.5.0';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const APP_SHELL = [
  './',
  'index.html',
  'donors.html',
  'register.html',
  'emergency.html',
  'about.html',
  'faq.html',
  'privacy.html',
  'admin.html',
  'my-donor.html',
  'offline.html',
  'assets/css/main.css',
  'assets/js/config.js',
  'assets/js/firebase.js',
  'assets/js/data.js',
  'assets/js/ui.js',
  'assets/js/blood.js',
  'assets/js/geo.js',
  'assets/js/stats.js',
  'assets/js/donors-board.js',
  'assets/js/emergency.js',
  'assets/js/register.js',
  'assets/js/admin.js',
  'assets/js/analytics.js',
  'assets/js/app.js',
  'favicon.ico',
  'assets/icons/favicon-32.png',
  'assets/icons/apple-touch-icon.png',
  'assets/img/logo-drop.png',
  'assets/img/logo-full.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => { /* partial is fine */ }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase SDK + Google APIs: network first, cache fallback (offline reads work).
  if (url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseapp.com')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Navigations: fresh HTML when online, cached page when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('offline.html')) || Response.error())
    );
    return;
  }

  // Same-origin assets: cache first, then network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('offline.html')))
    );
  }
});
