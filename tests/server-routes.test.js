'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PORT = '0';
process.env.ADMIN_TOKEN = 'server-route-test-token';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;

const {
    getLastIntervalDelivery,
    httpServer,
    notificationRuntimeState,
    rememberIntervalDelivery,
    rememberSentForDate,
    wasSentForDate
} = require('../server');

let baseUrl;

test.before(async () => {
    if (!httpServer.listening) {
        await new Promise(resolve => httpServer.once('listening', resolve));
    }
    const address = httpServer.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
    if (httpServer.listening) {
        await new Promise((resolve, reject) => {
            httpServer.close(error => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
});

test('health exposes commit and non-sensitive notification state', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.status, 'ok');
    assert.equal(result.commit, 'local');
    assert.equal(result.notifications.configured, false);
    assert.equal(Object.hasOwn(result.notifications, 'lastSuccessAt'), true);
    assert.equal(JSON.stringify(result).includes('PRIVATE_KEY'), false);
    assert.equal(
        response.headers.get('strict-transport-security'),
        'max-age=31536000; includeSubDomains'
    );
});

test('notification diagnostics require the admin token', async () => {
    const unauthorized = await fetch(`${baseUrl}/api/admin/notification-status`);
    assert.equal(unauthorized.status, 401);

    const response = await fetch(`${baseUrl}/api/admin/notification-status`, {
        headers: {
            'X-Admin-Token': process.env.ADMIN_TOKEN
        }
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.configured.supabase, false);
    assert.equal(result.database.uniqueEndpoints, null);
});

test('successful deliveries remain throttled in memory if database logging fails', () => {
    rememberSentForDate('user-1', 'alert-1', '2026-07-28');
    assert.equal(wasSentForDate('user-1', 'alert-1', '2026-07-28'), true);
    assert.equal(wasSentForDate('user-1', 'alert-1', '2026-07-29'), false);

    rememberIntervalDelivery(
        'user-1',
        'very_urgent_tasks',
        '2026-07-28T12:00:00.000Z'
    );
    assert.equal(
        getLastIntervalDelivery('user-1', 'very_urgent_tasks'),
        '2026-07-28T12:00:00.000Z'
    );
});

test('forced notification checks fail visibly when infrastructure is unavailable', async () => {
    const response = await fetch(`${baseUrl}/api/check-reminders`, {
        headers: {
            'X-Admin-Token': process.env.ADMIN_TOKEN
        }
    });
    const result = await response.json();

    assert.equal(response.status, 500);
    assert.equal(result.success, false);
    assert.equal(notificationRuntimeState.consecutiveFailures, 1);
    assert.equal(notificationRuntimeState.engines.recurring.ok, false);
    assert.equal(notificationRuntimeState.engines.configured.ok, false);
});
