// Service worker: guarda la app y las librerías para abrirla rápido y sin conexión.
// Los mapas (tiles) y las APIs externas siempre van por red. Sube V cuando cambies archivos.
const V = 'micros-v1';
const SHELL = ['./', 'index.html', 'rutas_micro_scz.geojson', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://cdn.jsdelivr.net/npm/@turf/turf@7.1.0/turf.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))));
  self.clients.claim();
});
const save = (req, res) => { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); return res; };
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || !(u.origin === location.origin || u.hostname === 'cdn.jsdelivr.net')) return;
  if (u.pathname.endsWith('.geojson')) {            // datos: red primero (para tener lo último), caché si no hay internet
    e.respondWith(fetch(r).then(res => save(r, res)).catch(() => caches.match(r)));
  } else {                                           // resto: caché primero
    e.respondWith(caches.match(r).then(c => c || fetch(r).then(res => save(r, res))));
  }
});
