// Local privacy screen only: this verifier never belongs in cloud data/backups.
const ITERATIONS = 600_000;
const PREFIX = 'lifecycle_privacy_lock:';
const encoder = new TextEncoder();
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

export const privacyLockKey = ownerId => `${PREFIX}${ownerId}`;

export function parsePrivacyLock(raw) {
    if (raw === null) return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || value.iterations !== ITERATIONS || typeof value.locked !== 'boolean'
        || !/^[A-Za-z0-9+/]{22}==$/.test(value.salt || '')
        || !/^[A-Za-z0-9+/]{43}=$/.test(value.verifier || '')) {
        throw new Error('Configuración de bloqueo no válida.');
    }
    return value;
}

async function derive(ownerId, password, salt) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(`${ownerId}\0${password}`), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256',
        salt, iterations: ITERATIONS }, material, 256));
}

export async function createPrivacyLock(ownerId, password) {
    if (!ownerId || typeof password !== 'string' || password.length < 12 || password.length > 256) {
        throw new Error('Usá una clave de entre 12 y 256 caracteres.');
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { version: 1, iterations: ITERATIONS, salt: encode(salt),
        verifier: encode(await derive(ownerId, password, salt)), locked: false };
}

export async function verifyPrivacyLock(ownerId, password, record) {
    const valid = parsePrivacyLock(JSON.stringify(record));
    if (!ownerId || typeof password !== 'string' || password.length > 256) return false;
    const actual = await derive(ownerId, password, decode(valid.salt));
    const expected = decode(valid.verifier);
    let different = 0;
    for (let i = 0; i < expected.length; i++) different |= expected[i] ^ actual[i];
    return different === 0;
}
