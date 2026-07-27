'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    extractBearerToken,
    isBlockedStaticPath,
    isValidPushSubscription,
    safeEqualStrings
} = require('../security-utils');

test('extractBearerToken accepts only a well-formed Bearer header', () => {
    assert.equal(extractBearerToken('Bearer session-token'), 'session-token');
    assert.equal(extractBearerToken('bearer session-token'), 'session-token');
    assert.equal(extractBearerToken('Basic session-token'), null);
    assert.equal(extractBearerToken('Bearer token with spaces'), null);
    assert.equal(extractBearerToken(undefined), null);
});

test('isValidPushSubscription requires a secure endpoint and both keys', () => {
    assert.equal(isValidPushSubscription({
        endpoint: 'https://push.example/subscription',
        keys: { auth: 'auth-value', p256dh: 'public-key' }
    }), true);

    assert.equal(isValidPushSubscription({
        endpoint: 'http://push.example/subscription',
        keys: { auth: 'auth-value', p256dh: 'public-key' }
    }), false);
    assert.equal(isValidPushSubscription({
        endpoint: 'https://push.example/subscription',
        keys: { auth: 'auth-value' }
    }), false);
});

test('isBlockedStaticPath denies backend and secret-bearing paths', () => {
    assert.equal(isBlockedStaticPath('/server.js'), true);
    assert.equal(isBlockedStaticPath('/%73erver.js'), true);
    assert.equal(isBlockedStaticPath('/%2eenv'), true);
    assert.equal(isBlockedStaticPath('/%E0%A4%A'), true);
    assert.equal(isBlockedStaticPath('/.env.production'), true);
    assert.equal(isBlockedStaticPath('/node_modules/example/index.js'), true);
    assert.equal(isBlockedStaticPath('/tests/security-utils.test.js'), true);
    assert.equal(isBlockedStaticPath('/modules/AuthSyncModule.js'), false);
    assert.equal(isBlockedStaticPath('/shared_rules.json'), false);
});

test('safeEqualStrings compares secrets without accepting invalid values', () => {
    assert.equal(safeEqualStrings('same-secret', 'same-secret'), true);
    assert.equal(safeEqualStrings('same-secret', 'other-secret'), false);
    assert.equal(safeEqualStrings('short', 'much-longer'), false);
    assert.equal(safeEqualStrings(null, 'same-secret'), false);
});
