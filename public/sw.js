/* Studify service worker.
 *
 * Request handling lives in sw-routes.js (shared with the tests). In short:
 * the API and other origins are never cached, page loads are network-first
 * with the cached app shell as the offline fallback, and content-hashed files
 * are cache-first. BUILD_ID is stamped in at build time (vite.config.ts), so
 * every deploy installs a new worker, which then drops the old caches.
 */
importScripts('/sw-routes.js');

const BUILD_ID = '__BUILD_ID__';
const SHELL_CACHE = `studify-shell-${BUILD_ID}`;
// Content-hashed avatar models and the Basis transcoder: kept across deploys,
// capped, oldest entries evicted first.
const AVATAR_CACHE = 'studify-avatar-assets-v2';
const AVATAR_CACHE_MAX_ENTRIES = 80;
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== AVATAR_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const strategy = self.studifyStrategyFor(new URL(request.url), request.mode, request.method, self.location.origin);
  switch (strategy) {
    case 'network':
      return; // the browser handles it; nothing is cached
    case 'gemini':
      event.respondWith(fetch(request).catch(() => offlineJson()));
      return;
    case 'navigate':
      event.respondWith(networkFirst(request, SHELL_CACHE, '/index.html'));
      return;
    case 'fresh':
      event.respondWith(networkFirst(request, AVATAR_CACHE));
      return;
    case 'immutable':
      event.respondWith(cacheFirst(request, SHELL_CACHE));
      return;
    case 'avatar':
      event.respondWith(cacheFirst(request, AVATAR_CACHE, AVATAR_CACHE_MAX_ENTRIES));
      return;
    default:
      event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackUrl || request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(fallbackUrl || request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    if (maxEntries) {
      const keys = await cache.keys();
      for (const old of keys.slice(0, Math.max(0, keys.length - maxEntries))) {
        if (!old.url.endsWith('/avatar/manifest.json')) await cache.delete(old);
      }
    }
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

function offlineJson() {
  return new Response(
    JSON.stringify({
      error: 'Network connection unavailable. Studify is running in offline mode. Active recall, FSRS reviews, and Starter Catalog remain fully functional.',
    }),
    { headers: { 'Content-Type': 'application/json' }, status: 503 }
  );
}

// Push: Handle incoming Web Push notifications from cloud server
self.addEventListener('push', (event) => {
  let data = {
    title: 'Studify Study Reminder 🎯',
    body: 'Time for your daily 3-minute study practice! Keep your streak alive! 🔥',
    url: '/?launch=quick_sprint'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'studify-push-streak',
    data: { url: data.url || '/' },
    actions: [
      { action: 'study', title: 'Start Practice ⚡' },
      { action: 'dismiss', title: 'Later' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click: Open or focus application window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If no tab open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
