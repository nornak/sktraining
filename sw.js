const CACHE = 'sktraining-offline-v3';
const ASSETS = [
  './',
  './index.html',
  './dokun.html',
  './practice.html',
  './practice-data.js',
  './study.js',
  './study.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];
const ASSET_URLS = new Set(ASSETS.map((asset) => new URL(asset, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key === 'dokun-offline-v1' ||
      (key.startsWith('sktraining-offline-') && key !== CACHE))
      .map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  url.search = '';
  if (request.method !== 'GET' || !ASSET_URLS.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(url.href, response.clone()).catch(() => {});
      return response;
    } catch {
      return (await cache.match(url.href)) || Response.error();
    }
  })());
});
