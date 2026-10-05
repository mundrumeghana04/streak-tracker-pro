// Streak Tracker Pro - Service Worker (sw.js)
// Version 1.1.0 - Full Offline PWA & Background Push Support

const CACHE_NAME = 'streak-tracker-pro-v1.1.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/script.js',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/badge-72.png',
  '/assets/icons/maskable-512.png',
  '/assets/icons/icon.svg',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap'
];

// ================= INSTALL =================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use catch for individual assets so external network hiccups don't block install
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Pre-caching asset failed: ${url}`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ================= ACTIVATE =================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[SW] Removing obsolete cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ================= FETCH =================
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass cache completely for API / Netlify Functions
  if (requestUrl.pathname.startsWith('/.netlify/')) {
    return event.respondWith(fetch(event.request));
  }

  // Non-GET requests should always go to network
  if (event.request.method !== 'GET') {
    return event.respondWith(fetch(event.request));
  }

  // Stale-While-Revalidate strategy for static app shell
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (requestUrl.origin === location.origin ||
              requestUrl.hostname.includes('fonts.gstatic.com'))
          ) {
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          // If offline and this is a page navigation,
          // return the cached app shell.
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html').then((response) => {
              return response || caches.match('/');
            });
          }

          // IMPORTANT:
          // Never return undefined from respondWith().
          return cachedResponse || Response.error();
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// ================= PUSH EVENT =================
// Wakes up in the background even when browser tab is closed!
self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: "🔥 Streak Tracker Pro",
        body: event.data.text()
      };
    }
  }

  const title = payload.title || "🔥 Don't break your streak!";
  const body = payload.body || "Complete today's goal to keep your streak alive.";
  const icon = payload.icon || "/assets/icons/icon-192.png";
  const badge = payload.badge || "/assets/icons/badge-72.png";
  const tag = payload.tag || ("streak-" + Date.now());
  const data = payload.data || { url: "/" };

  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data,
    actions: [
      {
        action: 'open-app',
        title: '🚀 Open Streak Tracker'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// ================= NOTIFICATION CLICK =================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a Streak Tracker Pro window/tab is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
