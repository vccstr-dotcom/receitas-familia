// Permite abrir a app sem internet.
// Ao alterar a app, aumente o número da versão para os telemóveis receberem a nova.
const VERSION = 'rf-v1.0.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/ctx.js', './js/ui.js', './js/util.js', './js/images.js', './js/docx.js', './js/ai.js',
  './js/config.js', './js/store-local.js', './js/store-cloud.js',
  './js/views/common.js', './js/views/home.js', './js/views/search.js', './js/views/recipe.js', './js/views/edit.js',
  './js/views/import.js', './js/views/cook.js', './js/views/settings.js', './js/views/login.js', './js/views/assistant.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Ficheiros da app: tenta a internet primeiro (versão mais recente), senão usa a cópia guardada.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  // Tipos de letra e bibliotecas do Firebase: usa a cópia guardada, senão vai buscar.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
