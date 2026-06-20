/* Marg service worker — installability + fast repeat loads, without stale-bundle risk.
 *
 * Strategy:
 *  - HTML / navigations: NETWORK-FIRST (always get the latest build's asset refs;
 *    fall back to a cached shell only when offline).
 *  - Hashed static assets (Vite emits content-hashed filenames, so they're
 *    immutable): CACHE-FIRST.
 *  - Everything cross-origin (tiles, CDN, the backend API): passthrough — never
 *    cached, so live data and CORS behave exactly as without a SW.
 */
const CACHE = 'marg-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/favicon.svg']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Only manage our own origin; let tiles / CDN / backend API go straight to network.
  if (url.origin !== self.location.origin) return

  // Navigations → network-first with an offline shell fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/index.html', res.clone())).catch(() => {})
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // Hashed build assets → cache-first (safe: a new build changes the filename).
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/models/') || url.pathname.startsWith('/tflite/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            return res
          }),
      ),
    )
  }
})
