import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function createWorkerHarness() {
    const source = await readFile(path.join(ROOT, 'sw.js'), 'utf8');
    const listeners = new Map();
    const notifications = [];
    const telemetry = [];
    const self = {
        addEventListener(type, listener) {
            listeners.set(type, listener);
        },
        skipWaiting: async () => {},
        clients: { claim: async () => {} },
        registration: {
            async showNotification(title, options) {
                notifications.push({ title, options });
            }
        }
    };
    const context = {
        self,
        caches: { keys: async () => [], delete: async () => true },
        clients: { matchAll: async () => [], openWindow: async () => {} },
        console: { log() {}, warn() {}, error() {} },
        fetch: async (url, options) => {
            telemetry.push({ url, body: JSON.parse(options.body) });
            return { ok: true };
        },
        Date,
        JSON,
        Number,
        Promise,
        RegExp,
        String
    };
    vm.runInNewContext(source, context, { filename: 'sw.js' });

    return {
        notifications,
        telemetry,
        async dispatchPush(payload) {
            let completion;
            listeners.get('push')({
                data: { json: () => payload },
                waitUntil(promise) {
                    completion = promise;
                }
            });
            await completion;
        }
    };
}

function delivery(expiresAt) {
    return {
        id: '42',
        receiptToken: 'a'.repeat(43),
        scheduledAt: '2026-08-21T01:00:00.000Z',
        expiresAt
    };
}

test('the service worker discards an expired notification and reports why', async () => {
    const harness = await createWorkerHarness();
    await harness.dispatchPush({
        title: 'Aviso viejo',
        body: 'No debe aparecer',
        delivery: delivery('2000-01-01T00:00:00.000Z')
    });

    assert.equal(harness.notifications.length, 0);
    assert.deepEqual(
        harness.telemetry.map(item => item.body.event),
        ['received', 'discarded_expired']
    );
});

test('the service worker displays a fresh notification and reports the display', async () => {
    const harness = await createWorkerHarness();
    await harness.dispatchPush({
        title: 'Aviso fresco',
        body: 'Debe aparecer',
        notificationTag: 'lifecycle-safe-topic',
        delivery: delivery('2999-01-01T00:00:00.000Z')
    });

    assert.equal(harness.notifications.length, 1);
    assert.equal(harness.notifications[0].title, 'Aviso fresco');
    assert.equal(harness.notifications[0].options.tag, 'lifecycle-safe-topic');
    assert.equal(harness.notifications[0].options.renotify, false);
    assert.deepEqual(
        harness.telemetry.map(item => item.body.event),
        ['received', 'displayed']
    );
});
