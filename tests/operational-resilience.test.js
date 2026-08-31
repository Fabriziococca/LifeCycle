'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    OperationTimeoutError,
    createTimeoutFetch,
    normalizeApiRoute,
    runWithTimeout,
    waitForDelay
} = require('../operational-resilience');

test('Supabase fetches receive a bounded timeout signal', async () => {
    const boundedFetch = createTimeoutFetch((_input, init) => (
        new Promise((resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        })
    ), 20);

    await assert.rejects(
        boundedFetch('https://example.test'),
        error => error?.name === 'TimeoutError'
    );
});

test('scheduler watchdog aborts and reports a typed timeout', async () => {
    let aborted = false;

    await assert.rejects(
        runWithTimeout(signal => new Promise(resolve => {
            signal.addEventListener('abort', () => {
                aborted = signal.aborted;
                resolve();
            }, { once: true });
        }), 20, 'Motor de prueba'),
        error => error instanceof OperationTimeoutError
            && error.code === 'OPERATION_TIMEOUT'
    );
    assert.equal(aborted, true);
});

test('abortable delays do not keep a timed-out scheduler loop alive', async () => {
    await assert.rejects(
        runWithTimeout(signal => waitForDelay(5_000, signal), 20, 'Demora de prueba'),
        error => error instanceof OperationTimeoutError
    );
});

test('HTTP logs keep route templates and hide unmatched path values', () => {
    assert.equal(
        normalizeApiRoute({ route: { path: '/api/push/devices/:id/test' } }),
        '/api/push/devices/:id/test'
    );
    assert.equal(
        normalizeApiRoute({ path: '/push/devices/private-value/test' }),
        '/api/<unmatched>'
    );
});
