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
        badge: '/badge.png',
        vibrate: [100, 50, 100],
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
