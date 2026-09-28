const LEGACY_CACHE_PREFIX = 'lifecycle-cache-';
const RECOVERY_CACHE = 'lifecycle-recovery-shell-v1';
const RECOVERY_ASSETS = ['/recovery.html', '/recovery.css', '/recovery-viewer.mjs', '/recovery-vault.mjs'];

self.addEventListener('install', (e) => {
    console.log('[Service Worker] LifeCycle Push worker installed');
    // Only the read-only emergency shell is cached, never authenticated API
    // responses, the mutable main app, passwords, or plaintext user data.
    e.waitUntil(caches.open(RECOVERY_CACHE).then(cache => cache.addAll(RECOVERY_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (RECOVERY_ASSETS.includes(url.pathname)) {
        event.respondWith(fetch(event.request).then(response => {
            if (!response.ok) throw new Error('Recovery asset unavailable');
            return response;
        }).catch(async () => {
            const cached = await caches.match(url.pathname, { cacheName: RECOVERY_CACHE });
            return cached || Response.error();
        }));
    } else if (event.request.mode === 'navigate' && url.pathname === '/') {
        event.respondWith(fetch(event.request).then(response => {
            if (response.status >= 500) throw new Error('Application unavailable');
            return response;
        }).catch(async () => {
            const cached = await caches.match('/recovery.html', { cacheName: RECOVERY_CACHE });
            return cached || Response.error();
        }));
    }
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

function getPushDeliveryMetadata(data) {
    const delivery = data?.delivery;
    if (!delivery || typeof delivery !== 'object') return null;

    const id = String(delivery.id || '');
    const receiptToken = String(delivery.receiptToken || '');
    const expiresAt = new Date(delivery.expiresAt || '');
    if (
        !/^\d+$/.test(id)
        || !/^[A-Za-z0-9_-]{32,128}$/.test(receiptToken)
        || !Number.isFinite(expiresAt.getTime())
    ) {
        return null;
    }
    return {
        id,
        receiptToken,
        expiresAt: expiresAt.toISOString()
    };
}

function isPushDeliveryExpired(delivery, now = Date.now()) {
    if (!delivery) return false;
    const expiresAt = Date.parse(delivery.expiresAt || '');
    return Number.isFinite(expiresAt) && now > expiresAt;
}

async function reportPushTelemetry(delivery, eventName) {
    if (!delivery) return false;
    try {
        const response = await fetch('/api/push/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deliveryId: delivery.id,
                receiptToken: delivery.receiptToken,
                event: eventName
            }),
            cache: 'no-store',
            credentials: 'omit'
        });
        return response.ok;
    } catch (error) {
        console.warn('[Service Worker] Push telemetry could not be reported', error);
        return false;
    }
}

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

    const delivery = getPushDeliveryMetadata(data);
    const options = {
        body: data.body,
        icon: '/icon-v2.png',
        badge: '/icon-v2.png',
        vibrate: [100, 50, 100],
        ...(typeof data.notificationTag === 'string'
            && /^[A-Za-z0-9_-]{1,80}$/.test(data.notificationTag)
            ? {
                tag: data.notificationTag,
                renotify: false
            }
            : {}),
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil((async () => {
        const receivedReport = reportPushTelemetry(delivery, 'received');
        if (isPushDeliveryExpired(delivery)) {
            await receivedReport;
            await reportPushTelemetry(delivery, 'discarded_expired');
            console.warn(`[Service Worker] Discarded expired Push delivery ${delivery.id}`);
            return;
        }

        await self.registration.showNotification(data.title, options);
        await receivedReport;
        await reportPushTelemetry(delivery, 'displayed');
    })());
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
