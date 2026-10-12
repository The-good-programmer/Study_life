const CACHE_NAME = 'studify-v2-pwa-offline';
// Avatar models and textures are large and content-hashed, so they get their
// own cache: cache-first, capped, oldest entries evicted first.
const AVATAR_CACHE = 'studify-avatar-assets-v1';
const AVATAR_CACHE_MAX_ENTRIES = 80;
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg',
];

// Install: Pre-cache essential app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Evict outdated cache namespaces
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== AVATAR_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Multi-tier offline caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Google Gemini / External AI APIs: Network-first with offline JSON fallback
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('generativelanguage')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ 
            error: 'Network connection unavailable. Studify is running in offline mode. Active recall, FSRS reviews, and Starter Catalog remain fully functional.' 
          }), 
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
          }
        );
      })
    );
    return;
  }

  // 2. Google Fonts & CDN assets: Cache-First
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkRes;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3. Avatar assets. The manifest is network-first so new asset versions show
  // up; the files it points at never change under the same URL.
  if (url.origin === self.location.origin && (url.pathname.startsWith('/avatar/') || url.pathname.startsWith('/basis/'))) {
    if (url.pathname === '/avatar/manifest.json') {
      event.respondWith(
        fetch(event.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(AVATAR_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        }).catch(() => caches.match(event.request))
      );
    } else {
      event.respondWith(avatarAsset(event.request));
    }
    return;
  }

  // 4. Application chunks & static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (event.request.method === 'GET')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to root index.html if navigating offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || cachedResponse;
        }
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

async function avatarAsset(request) {
  const cache = await caches.open(AVATAR_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && request.method === 'GET') {
    await cache.put(request, res.clone());
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - AVATAR_CACHE_MAX_ENTRIES))) {
      if (!old.url.endsWith('/avatar/manifest.json')) await cache.delete(old);
    }
  }
  return res;
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
    icon: '/favicon.svg',
    badge: '/favicon.svg',
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
