const CACHE_NAME = 'lifecycle-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    console.log('[Service Worker] LifeCycle Installed');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Pre-caching static assets');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('[Service Worker] Pre-cache failed for some assets, continuing anyway:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] LifeCycle Activated');
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    
    // Evitar interceptar Supabase, llamadas de API, o métodos que no sean GET
    if (
        url.hostname.includes('supabase') || 
        url.pathname.includes('/api/') || 
        e.request.method !== 'GET'
    ) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            const fetchPromise = fetch(e.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                return cachedResponse;
            });

            return cachedResponse || fetchPromise;
        })
    );
});

// Escuchar notificaciones Push
self.addEventListener('push', (event) => {
    let data = { title: 'LifeCycle', body: 'Nueva notificación' };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'LifeCycle', body: event.data.text() };
        }
    }

    const options = {
        body: data.body,
        icon: '/icon.png',
        badge: '/badge.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Manejar clic en la notificación
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    let url = '/';
    if (event.notification.data && event.notification.data.url) {
        url = event.notification.data.url;
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// Forzar la activación del service worker cuando el cliente lo solicite
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});