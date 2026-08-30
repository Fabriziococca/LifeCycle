'use strict';

function sanitizeKeyPart(value) {
    return String(value || '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, 160) || 'unknown';
}

function normalizeClientAddress(req) {
    const forwarded = Array.isArray(req?.headers?.['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : String(req?.headers?.['x-forwarded-for'] || '').split(',')[0];
    return sanitizeKeyPart(
        req?.ip
        || req?.socket?.remoteAddress
        || forwarded
        || 'unknown'
    );
}

function createFixedWindowRateLimiter({
    windowMs,
    max,
    maxEntries = 5_000,
    scope = 'api',
    keyGenerator = normalizeClientAddress,
    message = 'Demasiadas solicitudes. Intentá de nuevo más tarde.',
    now = () => Date.now()
}) {
    if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
        throw new TypeError('windowMs must be a positive integer');
    }
    if (!Number.isSafeInteger(max) || max <= 0) {
        throw new TypeError('max must be a positive integer');
    }
    if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0) {
        throw new TypeError('maxEntries must be a positive integer');
    }
    if (typeof keyGenerator !== 'function') {
        throw new TypeError('keyGenerator must be a function');
    }

    const entries = new Map();

    function purgeExpired(currentTime) {
        for (const [key, entry] of entries) {
            if (entry.resetAt <= currentTime) entries.delete(key);
        }
    }

    function ensureBounded(currentTime) {
        purgeExpired(currentTime);
        while (entries.size >= maxEntries) {
            let oldestKey = null;
            let oldestReset = Number.POSITIVE_INFINITY;
            for (const [key, entry] of entries) {
                if (entry.resetAt < oldestReset) {
                    oldestKey = key;
                    oldestReset = entry.resetAt;
                }
            }
            if (oldestKey === null) break;
            entries.delete(oldestKey);
        }
    }

    const middleware = (req, res, next) => {
        const currentTime = now();
        const rawKey = keyGenerator(req);
        const key = `${sanitizeKeyPart(scope)}:${sanitizeKeyPart(rawKey)}`;
        let entry = entries.get(key);
        if (!entry || entry.resetAt <= currentTime) {
            ensureBounded(currentTime);
            entry = { count: 0, resetAt: currentTime + windowMs };
        }

        entry.count += 1;
        entries.set(key, entry);
        const remaining = Math.max(0, max - entry.count);
        const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000));
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

        if (entry.count > max) {
            res.setHeader('Retry-After', String(resetSeconds));
            const errorMessage = typeof message === 'function'
                ? message(req)
                : message;
            return res.status(429).json({ error: errorMessage });
        }
        return next();
    };

    middleware.reset = () => entries.clear();
    middleware.getStoreSize = () => entries.size;
    return middleware;
}

module.exports = {
    createFixedWindowRateLimiter,
    normalizeClientAddress
};
