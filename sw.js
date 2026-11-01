// Service worker: NETWORK-FIRST untuk halaman & skrip agar setiap
// pembaruan langsung sampai ke siswa; cache hanya cadangan saat offline.
// API tidak pernah di-cache.
const CACHE = 'cbt-spenda-v4.6';
const SHELL = ['/', '/logo-sekolah.png', '/icon-192.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
    self.skipWaiting();
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return;
    e.respondWith(
        fetch(e.request).then(res => {
            if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
            return res;
        }).catch(() => caches.match(e.request).then(r => r || caches.match('/')))
    );
});
