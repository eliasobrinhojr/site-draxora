// Minha semana · teste: guarda as telas para abrir sem internet. Eventos (api) nunca passam pelo cache.
const CACHE = 'minha-semana-v2';
const ARQS = ['./', 'index.html', 'app.css?v=2', 'app.js?v=2', 'manifest.json', 'icone-192.png', '../assets/fonts/figtree.woff2', '../assets/fonts/newsreader.woff2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // Página: rede primeiro (pega versão nova), cache se estiver sem internet. Resto: cache primeiro.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
