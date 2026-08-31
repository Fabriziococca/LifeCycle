'use strict';

class OperationTimeoutError extends Error {
    constructor(label, timeoutMs) {
        super(`${label} superó el límite operativo de ${timeoutMs} ms.`);
        this.name = 'OperationTimeoutError';
        this.code = 'OPERATION_TIMEOUT';
        this.timeoutMs = timeoutMs;
    }
}

function assertTimeout(timeoutMs) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new TypeError('El límite de tiempo debe ser un número positivo.');
    }
}

function combineAbortSignals(signals) {
    const validSignals = signals.filter(signal => signal && typeof signal === 'object');
    if (validSignals.length === 0) return undefined;
    if (validSignals.length === 1) return validSignals[0];
    return AbortSignal.any(validSignals);
}

function createTimeoutFetch(fetchImplementation, timeoutMs, getAdditionalSignal = null) {
    if (typeof fetchImplementation !== 'function') {
        throw new TypeError('Se requiere una implementación de fetch.');
    }
    assertTimeout(timeoutMs);

    return (input, init = {}) => {
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        const additionalSignal = typeof getAdditionalSignal === 'function'
            ? getAdditionalSignal()
            : null;
        const signal = combineAbortSignals([
            init.signal,
            additionalSignal,
            timeoutSignal
        ]);
        return fetchImplementation(input, { ...init, signal });
    };
}

function throwIfAborted(signal) {
    if (!signal?.aborted) return;
    if (signal.reason instanceof Error) throw signal.reason;
    throw new Error('La operación fue cancelada.');
}

async function runWithTimeout(run, timeoutMs, label = 'La operación') {
    if (typeof run !== 'function') {
        throw new TypeError('Se requiere una operación ejecutable.');
    }
    assertTimeout(timeoutMs);

    const controller = new AbortController();
    const timeoutError = new OperationTimeoutError(label, timeoutMs);
    let rejectTimeout;
    const timeoutPromise = new Promise((_resolve, reject) => {
        rejectTimeout = reject;
    });
    const timer = setTimeout(() => {
        rejectTimeout(timeoutError);
        controller.abort(timeoutError);
    }, timeoutMs);

    try {
        return await Promise.race([
            Promise.resolve().then(() => run(controller.signal)),
            timeoutPromise
        ]);
    } finally {
        clearTimeout(timer);
    }
}

function waitForDelay(delayMs, signal = null) {
    if (!Number.isFinite(delayMs) || delayMs <= 0) return Promise.resolve();
    throwIfAborted(signal);

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener?.('abort', onAbort);
            resolve();
        }, delayMs);

        function onAbort() {
            clearTimeout(timer);
            try {
                throwIfAborted(signal);
            } catch (error) {
                reject(error);
            }
        }

        signal?.addEventListener?.('abort', onAbort, { once: true });
    });
}

function normalizeApiRoute(request = {}) {
    const routePath = request.route?.path;
    if (typeof routePath === 'string' && routePath.startsWith('/api/')) {
        return routePath;
    }
    return '/api/<unmatched>';
}

module.exports = {
    OperationTimeoutError,
    createTimeoutFetch,
    normalizeApiRoute,
    runWithTimeout,
    throwIfAborted,
    waitForDelay
};
