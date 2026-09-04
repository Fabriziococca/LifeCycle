import {
    TRANSCRIPTION_CACHE_DB,
    TRANSCRIPTION_CACHE_VERSION
} from './transcription-utils.mjs';

const SESSION_STORE = 'sessions';
const CHUNK_STORE = 'chunks';

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Falló IndexedDB.'));
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Falló la transacción local.'));
        transaction.onabort = () => reject(transaction.error || new Error('La transacción local fue cancelada.'));
    });
}

export class TranscriptionCache {
    constructor(indexedDb = globalThis.indexedDB) {
        this.indexedDb = indexedDb;
        this.databasePromise = null;
    }

    isSupported() {
        return Boolean(this.indexedDb);
    }

    async open() {
        if (!this.isSupported()) throw new Error('Este navegador no ofrece almacenamiento local recuperable.');
        if (this.databasePromise) return this.databasePromise;
        this.databasePromise = new Promise((resolve, reject) => {
            const request = this.indexedDb.open(TRANSCRIPTION_CACHE_DB, TRANSCRIPTION_CACHE_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(SESSION_STORE)) {
                    database.createObjectStore(SESSION_STORE, { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains(CHUNK_STORE)) {
                    const chunks = database.createObjectStore(CHUNK_STORE, { keyPath: 'key' });
                    chunks.createIndex('sessionId', 'sessionId', { unique: false });
                    chunks.createIndex('uploadStatus', 'uploadStatus', { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                this.databasePromise = null;
                reject(request.error || new Error('No se pudo abrir el almacenamiento de audio.'));
            };
            request.onblocked = () => {
                this.databasePromise = null;
                reject(new Error('Otra pestaña está bloqueando la actualización del almacenamiento de audio.'));
            };
        });
        return this.databasePromise;
    }

    async putSession(session) {
        const database = await this.open();
        const transaction = database.transaction(SESSION_STORE, 'readwrite');
        transaction.objectStore(SESSION_STORE).put({
            ...session,
            updatedAt: new Date().toISOString()
        });
        await transactionDone(transaction);
    }

    async getSession(sessionId) {
        const database = await this.open();
        const transaction = database.transaction(SESSION_STORE, 'readonly');
        return requestResult(transaction.objectStore(SESSION_STORE).get(sessionId));
    }

    async updateSession(sessionId, updates) {
        const current = await this.getSession(sessionId);
        if (!current) return null;
        const next = { ...current, ...updates, id: sessionId };
        await this.putSession(next);
        return next;
    }

    async listSessions() {
        const database = await this.open();
        const transaction = database.transaction(SESSION_STORE, 'readonly');
        const sessions = await requestResult(transaction.objectStore(SESSION_STORE).getAll());
        return sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }

    async putChunk({
        sessionId,
        sequenceNumber,
        blob,
        durationMs = 0,
        mimeType = '',
        mediaRole = 'recorded',
        sha256 = null,
        nativePath = null,
        uploadStatus = 'pending'
    }) {
        if (!sessionId || !Number.isInteger(sequenceNumber) || sequenceNumber < 0) {
            throw new TypeError('El fragmento local no tiene una identidad válida.');
        }
        if (!blob && !nativePath) throw new TypeError('El fragmento local no contiene audio.');
        const database = await this.open();
        const transaction = database.transaction(CHUNK_STORE, 'readwrite');
        transaction.objectStore(CHUNK_STORE).put({
            key: `${sessionId}:${sequenceNumber}`,
            sessionId,
            sequenceNumber,
            blob: blob || null,
            nativePath,
            durationMs: Math.max(0, Math.trunc(Number(durationMs) || 0)),
            mimeType: String(mimeType || blob?.type || ''),
            mediaRole: mediaRole === 'import_source' ? 'import_source' : 'recorded',
            byteSize: Math.max(0, Number(blob?.size) || 0),
            sha256,
            uploadStatus,
            updatedAt: new Date().toISOString()
        });
        await transactionDone(transaction);
    }

    async listChunks(sessionId) {
        const database = await this.open();
        const transaction = database.transaction(CHUNK_STORE, 'readonly');
        const index = transaction.objectStore(CHUNK_STORE).index('sessionId');
        const chunks = await requestResult(index.getAll(sessionId));
        return chunks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    }

    async markChunkUploaded(sessionId, sequenceNumber, cloudChunkId, storagePath) {
        const database = await this.open();
        const transaction = database.transaction(CHUNK_STORE, 'readwrite');
        const store = transaction.objectStore(CHUNK_STORE);
        const key = `${sessionId}:${sequenceNumber}`;
        const current = await requestResult(store.get(key));
        if (current) {
            store.put({
                ...current,
                cloudChunkId,
                storagePath,
                uploadStatus: 'uploaded',
                updatedAt: new Date().toISOString()
            });
        }
        await transactionDone(transaction);
    }

    async deleteSession(sessionId) {
        const database = await this.open();
        const transaction = database.transaction([SESSION_STORE, CHUNK_STORE], 'readwrite');
        transaction.objectStore(SESSION_STORE).delete(sessionId);
        const chunkStore = transaction.objectStore(CHUNK_STORE);
        const index = chunkStore.index('sessionId');
        const keys = await requestResult(index.getAllKeys(sessionId));
        keys.forEach(key => chunkStore.delete(key));
        await transactionDone(transaction);
    }

    async getPendingBytes() {
        const database = await this.open();
        const transaction = database.transaction(CHUNK_STORE, 'readonly');
        const chunks = await requestResult(transaction.objectStore(CHUNK_STORE).getAll());
        return chunks
            .filter(chunk => chunk.uploadStatus !== 'uploaded')
            .reduce((sum, chunk) => sum + Math.max(0, Number(chunk.byteSize) || 0), 0);
    }
}
