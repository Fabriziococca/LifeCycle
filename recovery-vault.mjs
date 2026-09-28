// Only encrypted recovery copies live here. This store is deliberately separate
// from cloud sync, logout cleanup and the normal application's mutable data.
const VERSION = 1;
const ITERATIONS = 600_000;
const MAX_BYTES = 16 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytes = size => crypto.getRandomValues(new Uint8Array(size));
const encode = value => {
    const data = new Uint8Array(value);
    let binary = '';
    for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
    return btoa(binary);
};
const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const context = ownerId => encoder.encode(`LifeCycle recovery v${VERSION}:${ownerId}`);

async function passwordKey(password, salt) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function createRecoveryVault(ownerId, password) {
    if (!ownerId || typeof password !== 'string' || password.length < 12 || password.length > 256) {
        throw new Error('Usá una clave local de entre 12 y 256 caracteres.');
    }
    const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
    const salt = bytes(16), iv = bytes(12);
    const privateBytes = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const key = await passwordKey(password, salt);
    const protectedKey = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context(ownerId) }, key, privateBytes);
    return { version: VERSION, ownerId,
        publicKey: encode(await crypto.subtle.exportKey('spki', pair.publicKey)),
        protectedKey: { salt: encode(salt), iv: encode(iv), value: encode(protectedKey) }, snapshots: [] };
}

export async function encryptRecoverySnapshot(vault, payload) {
    const plaintext = encoder.encode(JSON.stringify(payload));
    if (plaintext.byteLength > MAX_BYTES) throw new Error('La copia de consulta excede 16 MB. Conservá el backup unificado descargado.');
    const publicKey = await crypto.subtle.importKey('spki', decode(vault.publicKey), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = bytes(12);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context(vault.ownerId) }, key, plaintext);
    const wrappedKey = await crypto.subtle.encrypt('RSA-OAEP', publicKey, await crypto.subtle.exportKey('raw', key));
    return { createdAt: payload.exportDate, iv: encode(iv), key: encode(wrappedKey), value: encode(ciphertext) };
}

export async function decryptRecoverySnapshot(vault, password, index = 0) {
    if (vault?.version !== VERSION || !vault.snapshots?.[index]) throw new Error('No hay una copia compatible.');
    const snapshot = vault.snapshots[index];
    if (snapshot.value.length > MAX_BYTES * 1.4) throw new Error('Copia demasiado grande.');
    try {
        const key = await passwordKey(password, decode(vault.protectedKey.salt));
        const privateBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(vault.protectedKey.iv), additionalData: context(vault.ownerId) }, key, decode(vault.protectedKey.value));
        const privateKey = await crypto.subtle.importKey('pkcs8', privateBytes, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
        const rawKey = await crypto.subtle.decrypt('RSA-OAEP', privateKey, decode(snapshot.key));
        const dataKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(snapshot.iv), additionalData: context(vault.ownerId) }, dataKey, decode(snapshot.value));
        const payload = JSON.parse(decoder.decode(plain));
        if (payload.appName !== 'LifeCycle' || !payload.data || payload.ownerId !== vault.ownerId) throw new Error();
        return payload;
    } catch {
        throw new Error('Clave incorrecta o copia dañada. Probá la copia anterior si está disponible.');
    }
}

function database() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('lifecycle-recovery-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('vaults', { keyPath: 'ownerId' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function readRecoveryVault(ownerId) {
    const db = await database();
    try {
        return await new Promise((resolve, reject) => {
            const request = db.transaction('vaults', 'readonly').objectStore('vaults').get(ownerId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } finally { db.close(); }
}

export async function listRecoveryVaults() {
    const db = await database();
    try {
        return await new Promise((resolve, reject) => {
            const request = db.transaction('vaults', 'readonly').objectStore('vaults').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } finally { db.close(); }
}

// Atomic compare/update: another tab cannot overwrite a newer copy or a new key.
export async function saveRecoveryVault(vault, snapshot, { initial = false } = {}) {
    const db = await database();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction('vaults', 'readwrite');
            const store = tx.objectStore('vaults');
            const read = store.get(vault.ownerId);
            read.onsuccess = () => {
                const current = read.result;
                if ((initial && current) || (!initial && (!current || current.publicKey !== vault.publicKey))) {
                    tx.abort(); return;
                }
                if (current?.snapshots[0]?.createdAt > snapshot.createdAt) return;
                store.put({ ...(current || vault), snapshots: [snapshot, ...(current?.snapshots || [])].slice(0, 3) });
            };
            tx.oncomplete = () => resolve();
            tx.onabort = tx.onerror = () => reject(tx.error || new Error('La copia cambió en otra pestaña. Reintentá.'));
        });
    } finally { db.close(); }
}
