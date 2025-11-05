/**
 * Service Worker for Las Piñas Traffic Management System
 * Provides offline support and caching
 */

const CACHE_NAME = 'lp-traffic-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[Service Worker] Cache failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API calls (always fetch fresh)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseToCache = response.clone();

        // Cache the fetched response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((response) => {
          if (response) {
            console.log('[Service Worker] Serving from cache:', event.request.url);
            return response;
          }

          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Background sync for offline incident reports
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-incidents') {
    console.log('[Service Worker] Syncing incidents...');
    event.waitUntil(syncIncidents());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Traffic Alert';
  const options = {
    body: data.body || 'New traffic incident reported',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: [
      {
        action: 'view',
        title: 'View Details'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});

// Helper function to sync incidents
async function syncIncidents() {
  try {
    // Get pending incidents from IndexedDB
    const db = await openDB();
    const pendingIncidents = await getPendingIncidents(db);

    // Send each incident to the server
    for (const incident of pendingIncidents) {
      try {
        const response = await fetch('/api/incidents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(incident)
        });

        if (response.ok) {
          // Remove from pending queue
          await removePendingIncident(db, incident.id);
          console.log('[Service Worker] Synced incident:', incident.id);
        }
      } catch (error) {
        console.error('[Service Worker] Failed to sync incident:', error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// IndexedDB helpers (simplified)
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lp-traffic-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingIncidents')) {
        db.createObjectStore('pendingIncidents', { keyPath: 'id' });
      }
    };
  });
}

function getPendingIncidents(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingIncidents'], 'readonly');
    const store = transaction.objectStore('pendingIncidents');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removePendingIncident(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingIncidents'], 'readwrite');
    const store = transaction.objectStore('pendingIncidents');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
