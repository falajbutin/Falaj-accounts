/* عامل الخدمة: يجعل التطبيق قابلاً للتثبيت ويعمل بدون إنترنت.
   عند نشر نسخة جديدة من التطبيق غيّر رقم الإصدار أدناه ليصل التحديث للمستخدمين. */
const VERSION = 'v1.0.0';
const APP_CACHE = `falaj-app-${VERSION}`;
const RUNTIME_CACHE = 'falaj-runtime-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

// المكتبات الخارجية (الخطوط، Tailwind، الأيقونات، الرسوم، PDF، Excel)
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'cdn.sheetjs.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('falaj-app-') && k !== APP_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // صفحة التطبيق: الشبكة أولاً (لأخذ آخر نسخة)، ثم النسخة المحفوظة عند انقطاع الاتصال
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(APP_CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // ملفات التطبيق والمكتبات الخارجية: من المحفوظ فوراً مع تحديثها في الخلفية
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin || CDN_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cacheName = sameOrigin ? APP_CACHE : RUNTIME_CACHE;
      const cache = await caches.open(cacheName);
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const network = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return (await network) || Response.error();
    })());
  }
});
