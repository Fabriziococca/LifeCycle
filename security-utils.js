'use strict';

const crypto = require('crypto');

const BLOCKED_STATIC_FILES = new Set([
    '/notification-utils.js',
    '/package-lock.json',
    '/package.json',
    '/registration-utils.js',
    '/security-utils.js',
    '/server.js',
    '/vapid-keys.json'
]);

const BLOCKED_STATIC_PREFIXES = [
    '/.agents/',
    '/.codex/',
    '/.git/',
    '/node_modules/',
    '/supabase/',
    '/tests/'
];

function extractBearerToken(authorizationHeader) {
    if (typeof authorizationHeader !== 'string') return null;

    const match = authorizationHeader.trim().match(/^Bearer\s+([^\s]+)$/i);
    return match ? match[1] : null;
}

function isValidPushSubscription(subscription) {
    return Boolean(
        subscription
        && typeof subscription === 'object'
        && typeof subscription.endpoint === 'string'
        && subscription.endpoint.startsWith('https://')
        && subscription.keys
        && typeof subscription.keys.auth === 'string'
        && subscription.keys.auth.length > 0
        && typeof subscription.keys.p256dh === 'string'
        && subscription.keys.p256dh.length > 0
    );
}

function isBlockedStaticPath(requestPath) {
    if (typeof requestPath !== 'string') return true;

    let decodedPath;
    try {
        decodedPath = decodeURIComponent(requestPath);
    } catch {
        return true;
    }

    const normalized = `/${decodedPath.replace(/\\/g, '/').replace(/^\/+/, '')}`.toLowerCase();
    const fileName = normalized.split('/').pop() || '';

    if (fileName === '.env' || fileName.startsWith('.env.')) return true;
    if (BLOCKED_STATIC_FILES.has(normalized)) return true;
    return BLOCKED_STATIC_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

function safeEqualStrings(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') return false;

    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
    extractBearerToken,
    isBlockedStaticPath,
    isValidPushSubscription,
    safeEqualStrings
};
