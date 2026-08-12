export const EXCHANGE_RATE_CACHE_TTL_MS = 30 * 60 * 1000;
export const EXCHANGE_RATE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export const EXCHANGE_RATE_PROVIDERS = Object.freeze([
    Object.freeze({
        key: 'criptoya-lemon',
        label: 'Lemon Cash vía CriptoYa',
        url: 'https://criptoya.com/api/lemoncash/usdt/ars/1'
    }),
    Object.freeze({
        key: 'dolarapi-cripto',
        label: 'dólar cripto vía DolarApi',
        url: 'https://dolarapi.com/v1/dolares/cripto'
    })
]);

const RETRY_DELAYS_MS = Object.freeze([
    5_000,
    30_000,
    120_000,
    300_000
]);

export function parseExchangeRate(providerKey, payload) {
    const candidate = providerKey === 'criptoya-lemon'
        ? payload?.bid
        : (providerKey === 'dolarapi-cripto' ? payload?.compra : null);
    const rate = Number(candidate);
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new TypeError(`La fuente ${providerKey} devolvió una cotización inválida.`);
    }
    return rate;
}

export function getExchangeRateRetryDelay(attempt) {
    const index = Math.max(0, Math.min(
        RETRY_DELAYS_MS.length - 1,
        Number.parseInt(attempt, 10) || 0
    ));
    return RETRY_DELAYS_MS[index];
}

export function readCachedExchangeRate(storage, {
    now = Date.now(),
    maxAgeMs = EXCHANGE_RATE_CACHE_TTL_MS,
    maxStaleMs = EXCHANGE_RATE_MAX_STALE_MS
} = {}) {
    if (!storage?.getItem) return null;
    const rate = Number(storage.getItem('lemon_usdt_ars_rate'));
    const timestamp = Number(storage.getItem('lemon_usdt_ars_time'));
    if (
        !Number.isFinite(rate)
        || rate <= 0
        || !Number.isFinite(timestamp)
        || timestamp <= 0
        || timestamp > now + 60_000
    ) {
        return null;
    }

    const ageMs = Math.max(0, now - timestamp);
    if (ageMs > maxStaleMs) return null;
    return {
        rate,
        timestamp,
        source: storage.getItem('lemon_usdt_ars_source') || 'cache',
        ageMs,
        isFresh: ageMs < maxAgeMs
    };
}

export function writeCachedExchangeRate(storage, {
    rate,
    source,
    timestamp = Date.now()
}) {
    const normalizedRate = Number(rate);
    if (
        !storage?.setItem
        || !Number.isFinite(normalizedRate)
        || normalizedRate <= 0
        || !Number.isFinite(timestamp)
        || timestamp <= 0
    ) {
        throw new TypeError('No se puede guardar una cotización inválida.');
    }
    storage.setItem('lemon_usdt_ars_rate', String(normalizedRate));
    storage.setItem('lemon_usdt_ars_time', String(timestamp));
    storage.setItem('lemon_usdt_ars_source', String(source || 'desconocida'));
    return normalizedRate;
}
