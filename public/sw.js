// --- SERVICE WORKER: JUGAR SIN CONEXIÓN ---
// · Al instalarse guarda la página y los recursos básicos.
// · Recursos con huella (/_next/static, fuentes, sonidos, iconos): primero la caché.
// · Página: primero la red (para recibir versiones nuevas) y, sin conexión, la caché.
// Al cambiar VERSION se descartan las cachés antiguas.
const VERSION = 'mp-v3';
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png',
  '/sounds/shuffle.mp3'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const isStatic = url => url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/sounds/') || url.pathname.startsWith('/icons/')
  || /\.(woff2?|png|svg|ico|mp3)$/.test(url.pathname);

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Las analíticas van siempre a la red, sin caché
  if (url.pathname.startsWith('/ingest')) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Páginas y demás: red primero, caché si no hay conexión
  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('/')))
  );
});
