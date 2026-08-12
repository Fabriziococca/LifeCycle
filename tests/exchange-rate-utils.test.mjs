import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getExchangeRateRetryDelay,
    parseExchangeRate,
    readCachedExchangeRate,
    writeCachedExchangeRate
} from '../exchange-rate-utils.mjs';

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        }
    };
}

test('exchange providers normalize only positive reference rates', () => {
    assert.equal(parseExchangeRate('criptoya-lemon', { bid: 1325.5 }), 1325.5);
    assert.equal(parseExchangeRate('dolarapi-cripto', { compra: 1310 }), 1310);
    assert.throws(
        () => parseExchangeRate('criptoya-lemon', { bid: 0 }),
        /inválida/
    );
});

test('rate cache distinguishes fresh, stale and expired values', () => {
    const now = Date.parse('2026-08-11T12:00:00.000Z');
    const storage = createStorage();
    writeCachedExchangeRate(storage, {
        rate: 1320,
        source: 'criptoya-lemon',
        timestamp: now - 45 * 60 * 1000
    });

    assert.deepEqual(readCachedExchangeRate(storage, { now }), {
        rate: 1320,
        source: 'criptoya-lemon',
        timestamp: now - 45 * 60 * 1000,
        ageMs: 45 * 60 * 1000,
        isFresh: false
    });
    assert.equal(readCachedExchangeRate(storage, {
        now: now + 8 * 24 * 60 * 60 * 1000
    }), null);
});

test('background retry delay grows and remains bounded', () => {
    assert.deepEqual(
        [0, 1, 2, 3, 99].map(getExchangeRateRetryDelay),
        [5_000, 30_000, 120_000, 300_000, 300_000]
    );
});
