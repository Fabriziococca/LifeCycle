'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    attachPushDeliveryMetadata,
    createPushReceiptCredential,
    createPushTopic,
    endpointFingerprint,
    hashPushReceiptToken,
    isDuplicatePushDispatchError,
    isMissingPushManagementSchema,
    isMissingPushTelemetrySchema,
    normalizeDeviceMetadata,
    normalizeHistoryLimit,
    normalizeHistoryStatus,
    normalizeProviderStatus,
    normalizePushTelemetryEvent,
    parsePushPayload,
    preserveDeviceName,
    toPublicPushDevice
} = require('../push-management');

test('push endpoints expose only a stable fingerprint', () => {
    const endpoint = 'https://push.example.test/send/secret-device-token';
    const fingerprint = endpointFingerprint(endpoint);

    assert.equal(fingerprint.length, 20);
    assert.equal(fingerprint, endpointFingerprint(endpoint));
    assert.equal(fingerprint.includes('secret-device-token'), false);
});

test('device metadata gets safe useful defaults from the user agent', () => {
    const metadata = normalizeDeviceMetadata({}, 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0');

    assert.equal(metadata.platform, 'Windows');
    assert.equal(metadata.browser, 'Chrome');
    assert.equal(metadata.name, 'Windows · Chrome');
});

test('passive device refreshes preserve a user-defined name', () => {
    const automatic = {
        device_name: 'Android · Chrome',
        platform: 'Android',
        browser: 'Chrome'
    };

    assert.equal(
        preserveDeviceName(automatic, { device_name: 'Celular principal' }).device_name,
        'Celular principal'
    );
    assert.equal(preserveDeviceName(automatic, {}).device_name, 'Android · Chrome');
});

test('public devices never expose subscriptions or user agents', () => {
    const device = toPublicPushDevice({
        id: 12,
        subscription: { endpoint: 'https://push.example.test/secret' },
        device_name: 'Mi celular',
        user_agent: 'private-agent',
        last_success_at: '2026-08-01T10:00:00.000Z',
        last_failure_at: '2026-07-31T10:00:00.000Z'
    });

    assert.equal(device.id, '12');
    assert.equal(device.name, 'Mi celular');
    assert.equal(device.lastStatus, 'accepted');
    assert.equal(Object.hasOwn(device, 'subscription'), false);
    assert.equal(Object.hasOwn(device, 'userAgent'), false);
});

test('history filters and payloads are bounded', () => {
    assert.equal(normalizeHistoryStatus('pending'), 'pending');
    assert.equal(normalizeHistoryStatus('failed'), 'failed');
    assert.equal(normalizeHistoryStatus('unknown'), 'unknown');
    assert.equal(normalizeHistoryStatus('no_devices'), 'no_devices');
    assert.equal(normalizeHistoryStatus('invalid'), '');
    assert.equal(normalizeHistoryLimit('999'), 100);
    assert.deepEqual(parsePushPayload(JSON.stringify({
        title: '  Aviso   importante ',
        body: 'Detalle'
    })), { title: 'Aviso importante', body: 'Detalle' });
});

test('delivery receipts are random capabilities stored only as hashes', () => {
    const credential = createPushReceiptCredential();

    assert.match(credential.token, /^[A-Za-z0-9_-]{32,128}$/);
    assert.match(credential.tokenHash, /^[a-f0-9]{64}$/);
    assert.equal(credential.tokenHash, hashPushReceiptToken(credential.token));
    assert.equal(credential.tokenHash.includes(credential.token), false);
    assert.equal(hashPushReceiptToken('short'), '');
});

test('endpoint-specific payloads carry freshness and receipt metadata', () => {
    const credential = createPushReceiptCredential();
    const payload = attachPushDeliveryMetadata(JSON.stringify({
        title: 'Aviso',
        body: 'Detalle',
        url: '/'
    }), {
        id: '42',
        receiptToken: credential.token,
        scheduledAt: '2026-08-21T01:00:00.000Z',
        expiresAt: '2026-08-21T01:15:00.000Z',
        notificationTag: 'lifecycle-safe-topic'
    });
    const parsed = JSON.parse(payload);

    assert.equal(parsed.delivery.id, '42');
    assert.equal(parsed.delivery.receiptToken, credential.token);
    assert.equal(parsed.delivery.expiresAt, '2026-08-21T01:15:00.000Z');
    assert.equal(parsed.notificationTag, 'lifecycle-safe-topic');
    assert.deepEqual(parsePushPayload(payload), { title: 'Aviso', body: 'Detalle' });
});

test('Push topics are stable, provider-safe and scoped to one scheduled alert', () => {
    const first = createPushTopic('control_logs', '2026-08-31T01:00:00.000Z');
    const same = createPushTopic('control_logs', '2026-08-31T01:00:00.000Z');
    const other = createPushTopic('control_logs', '2026-09-07T01:00:00.000Z');

    assert.match(first, /^[A-Za-z0-9_-]{32}$/);
    assert.equal(first, same);
    assert.notEqual(first, other);
    assert.equal(createPushTopic('', '2026-08-31T01:00:00.000Z'), '');
});

test('telemetry accepts only known service-worker events', () => {
    assert.equal(normalizePushTelemetryEvent('received'), 'received');
    assert.equal(normalizePushTelemetryEvent('displayed'), 'displayed');
    assert.equal(normalizePushTelemetryEvent('discarded_expired'), 'discarded_expired');
    assert.equal(normalizePushTelemetryEvent('read'), '');
});

test('provider status keeps real HTTP codes and leaves accepted sends empty', () => {
    assert.equal(normalizeProviderStatus(null), null);
    assert.equal(normalizeProviderStatus(''), null);
    assert.equal(normalizeProviderStatus('sin estado'), null);
    assert.equal(normalizeProviderStatus(0), null);
    assert.equal(normalizeProviderStatus(201), 201);
    assert.equal(normalizeProviderStatus('410'), 410);
});

test('missing migration errors are recognized without hiding unrelated failures', () => {
    assert.equal(isMissingPushManagementSchema({ code: '42P01' }), true);
    assert.equal(isMissingPushManagementSchema({ message: 'column device_name does not exist' }), true);
    assert.equal(isMissingPushManagementSchema({ code: '23505' }), false);
    assert.equal(isMissingPushTelemetrySchema({ message: 'column received_at does not exist' }), true);
    assert.equal(isMissingPushTelemetrySchema({ code: '23505' }), false);
    assert.equal(isDuplicatePushDispatchError({
        code: '23505',
        message: 'duplicate key violates notification_delivery_log_dispatch_once_idx'
    }), true);
    assert.equal(isDuplicatePushDispatchError({ code: '23505', message: 'other_index' }), false);
});
