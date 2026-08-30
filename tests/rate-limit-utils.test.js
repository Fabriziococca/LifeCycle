const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createFixedWindowRateLimiter,
    normalizeClientAddress
} = require('../rate-limit-utils');

function createResponse() {
    const headers = new Map();
    return {
        statusCode: 200,
        body: null,
        setHeader(name, value) {
            headers.set(String(name).toLowerCase(), String(value));
        },
        getHeader(name) {
            return headers.get(String(name).toLowerCase());
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(value) {
            this.body = value;
            return this;
        }
    };
}

test('fixed-window limiter emits quota headers and blocks only after the allowance', () => {
    let currentTime = 1_000;
    const limiter = createFixedWindowRateLimiter({
        windowMs: 10_000,
        max: 2,
        now: () => currentTime
    });
    const request = { ip: '203.0.113.5', headers: {}, socket: {} };

    for (let index = 0; index < 2; index += 1) {
        const response = createResponse();
        let continued = false;
        limiter(request, response, () => { continued = true; });
        assert.equal(continued, true);
        assert.equal(response.getHeader('ratelimit-limit'), '2');
        assert.equal(response.statusCode, 200);
    }

    const blocked = createResponse();
    let continued = false;
    limiter(request, blocked, () => { continued = true; });
    assert.equal(continued, false);
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.getHeader('retry-after'), '10');
    assert.match(blocked.body.error, /demasiadas solicitudes/i);

    currentTime = 11_001;
    const afterReset = createResponse();
    limiter(request, afterReset, () => { continued = true; });
    assert.equal(afterReset.statusCode, 200);
});

test('limiter storage stays bounded and expired identities are discarded lazily', () => {
    let currentTime = 0;
    const limiter = createFixedWindowRateLimiter({
        windowMs: 1_000,
        max: 2,
        maxEntries: 2,
        now: () => currentTime
    });
    const invoke = ip => limiter(
        { ip, headers: {}, socket: {} },
        createResponse(),
        () => {}
    );

    invoke('one');
    invoke('two');
    invoke('three');
    assert.equal(limiter.getStoreSize(), 2);

    currentTime = 2_000;
    invoke('four');
    assert.equal(limiter.getStoreSize(), 1);
    limiter.reset();
    assert.equal(limiter.getStoreSize(), 0);
});

test('client address normalization prefers Express trusted-proxy resolution', () => {
    assert.equal(normalizeClientAddress({
        ip: '198.51.100.8',
        headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
        socket: { remoteAddress: '10.0.0.2' }
    }), '198.51.100.8');
    assert.equal(normalizeClientAddress({
        headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
        socket: {}
    }), '203.0.113.9');
});
