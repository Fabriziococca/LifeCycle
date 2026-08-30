import {
    RESOURCE_KEYS,
    getResourceLimit,
    getResourceLimitMessage
} from './resource-policy.mjs';

export const SYNC_DOCUMENT_SERVER_RESERVE_BYTES = 64 * 1024;

export function getUtf8ByteLength(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return new TextEncoder().encode(text || '').byteLength;
}

export function estimateSynchronizedDocumentBytes(keys, readStoredValue) {
    if (!Array.isArray(keys)) throw new TypeError('keys must be an array');
    if (typeof readStoredValue !== 'function') {
        throw new TypeError('readStoredValue must be a function');
    }
    const document = {};
    [...new Set(keys)].forEach(key => {
        const value = readStoredValue(key);
        if (value !== null && value !== undefined) document[key] = value;
    });
    return getUtf8ByteLength(document);
}

export function assertSynchronizedDocumentCapacity({
    policy,
    keys,
    readStoredValue,
    reserveBytes = SYNC_DOCUMENT_SERVER_RESERVE_BYTES
}) {
    const limit = getResourceLimit(policy, RESOURCE_KEYS.SYNCED_DOCUMENT_BYTES);
    const estimatedBytes = estimateSynchronizedDocumentBytes(keys, readStoredValue);
    if (limit === null) {
        return { allowed: true, limit: null, estimatedBytes, effectiveLimit: null };
    }

    const safeReserve = Math.max(0, Number.isFinite(Number(reserveBytes))
        ? Math.trunc(Number(reserveBytes))
        : 0);
    const effectiveLimit = Math.max(0, limit - safeReserve);
    if (estimatedBytes > effectiveLimit) {
        const error = new Error('LifeCycle synchronized data limit exceeded');
        error.code = '54000';
        error.details = `resource_key=${RESOURCE_KEYS.SYNCED_DOCUMENT_BYTES} current=${estimatedBytes} limit=${limit}`;
        error.hint = 'Reduce synchronized content before trying again.';
        throw error;
    }

    return { allowed: true, limit, estimatedBytes, effectiveLimit };
}

export function areStoredValuesEqual(firstValue, secondValue) {
    if (firstValue === secondValue) return true;
    if (!firstValue && !secondValue) return true;
    if (!firstValue || !secondValue) return false;

    try {
        const firstParsed = typeof firstValue === 'object'
            ? firstValue
            : JSON.parse(firstValue);
        const secondParsed = typeof secondValue === 'object'
            ? secondValue
            : JSON.parse(secondValue);
        return JSON.stringify(firstParsed) === JSON.stringify(secondParsed);
    } catch {
        return String(firstValue).trim() === String(secondValue).trim();
    }
}

export function buildCloudPatch(keys, readStoredValue) {
    if (!Array.isArray(keys)) {
        throw new TypeError('keys must be an array');
    }
    if (typeof readStoredValue !== 'function') {
        throw new TypeError('readStoredValue must be a function');
    }

    const updates = {};
    const deleteKeys = [];

    [...new Set(keys)].forEach(key => {
        const value = readStoredValue(key);
        if (value === null) {
            deleteKeys.push(key);
        } else {
            updates[key] = value;
        }
    });

    return { updates, deleteKeys };
}

export function isPermanentSyncPolicyError(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    return code === '54000'
        || message.includes('lifecycle synchronized data limit exceeded')
        || message.includes('lifecycle resource limit exceeded');
}

export function getSyncPolicyErrorMessage(error) {
    if (!isPermanentSyncPolicyError(error)) {
        return String(error?.message || 'No se pudieron guardar los cambios.');
    }

    const details = String(error?.details || '').toLowerCase();
    const resourceMatch = details.match(/resource_key=([a-z0-9_]+)/);
    const limitMatch = details.match(/limit=(\d+)/);
    const resourceKey = resourceMatch?.[1];
    const limit = limitMatch ? Number(limitMatch[1]) : null;
    if (resourceKey && resourceKey !== RESOURCE_KEYS.SYNCED_DOCUMENT_BYTES) {
        return getResourceLimitMessage(resourceKey, limit);
    }
    return 'Tu información supera el límite seguro de sincronización. '
        + 'Los cambios quedan pendientes para que puedas reducir contenido antes de reintentar.';
}
