'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    endpointFingerprint,
    isMissingPushManagementSchema,
    normalizeDeviceMetadata,
    normalizeHistoryLimit,
    normalizeHistoryStatus,
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
    assert.equal(normalizeHistoryStatus('failed'), 'failed');
    assert.equal(normalizeHistoryStatus('unknown'), '');
    assert.equal(normalizeHistoryLimit('999'), 100);
    assert.deepEqual(parsePushPayload(JSON.stringify({
        title: '  Aviso   importante ',
        body: 'Detalle'
    })), { title: 'Aviso importante', body: 'Detalle' });
});

test('missing migration errors are recognized without hiding unrelated failures', () => {
    assert.equal(isMissingPushManagementSchema({ code: '42P01' }), true);
    assert.equal(isMissingPushManagementSchema({ message: 'column device_name does not exist' }), true);
    assert.equal(isMissingPushManagementSchema({ code: '23505' }), false);
});
