const LEGACY_CACHE_PREFIX = 'lifecycle-cache-';

self.addEventListener('install', (e) => {
    console.log('[Service Worker] LifeCycle Push worker installed');
    e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] LifeCycle Push worker activated');
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key.startsWith(LEGACY_CACHE_PREFIX)) {
                        console.log('[Service Worker] Removing offline cache', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
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
        icon: '/icon-v2.png',
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
