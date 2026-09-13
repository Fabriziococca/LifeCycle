'use strict';

const { collectSupabaseRangePages } = require('./supabase-pagination-utils');
const { throwIfAborted } = require('./operational-resilience');

// Verify revisions on EVERY scheduler read. There is no TTL or delayed refresh:
// only unchanged JSON is reused. Fail closed on DB errors, never send from stale
// fallback state. Memory is bounded and callers receive independent copies.
class SchedulerDocumentCache {
    constructor(supabase, { maxBytes = 16 * 1024 * 1024 } = {}) {
        this.supabase = supabase;
        this.maxBytes = maxBytes;
        this.entries = new Map();
        this.bytes = 0;
        this.metrics = { metadataReads: 0, fullRowsFetched: 0, cacheHits: 0, decodedDocumentBytesFetched: 0 };
    }

    snapshot() {
        return { ...this.metrics, cachedRows: this.entries.size, cacheBytes: this.bytes };
    }

    forget(userId) {
        const entry = this.entries.get(userId);
        if (entry) this.bytes -= entry.bytes;
        this.entries.delete(userId);
    }

    remember(row) {
        this.forget(row.user_id);
        if (!Number.isSafeInteger(row.revision) || row.revision < 1) return;
        const bytes = Buffer.byteLength(JSON.stringify(row));
        if (bytes > this.maxBytes) return;
        while (this.bytes + bytes > this.maxBytes && this.entries.size) {
            this.forget(this.entries.keys().next().value);
        }
        this.entries.set(row.user_id, { row: structuredClone(row), bytes });
        this.bytes += bytes;
    }

    async load({ signal = null } = {}) {
        const execute = async query => {
            throwIfAborted(signal);
            const result = await (signal ? query.abortSignal(signal) : query);
            throwIfAborted(signal);
            if (result.error) throw result.error;
            if (!Array.isArray(result.data)) throw new Error('No se pudo verificar el inventario de usuarios.');
            return result.data;
        };
        const { data: metadata, error } = await collectSupabaseRangePages(async ({ from, to }) => ({
            data: await execute(this.supabase.from('user_data').select('user_id, revision')
                .order('user_id', { ascending: true }).range(from, to))
        }));
        if (error) throw error;
        this.metrics.metadataReads += 1;
        const currentIds = new Set(metadata.map(row => row.user_id));
        for (const userId of this.entries.keys()) if (!currentIds.has(userId)) this.forget(userId);
        const result = new Map();
        const changed = [];
        for (const row of metadata) {
            const cached = this.entries.get(row.user_id);
            if (cached && cached.row.revision === row.revision) {
                result.set(row.user_id, structuredClone(cached.row));
                this.metrics.cacheHits += 1;
            } else {
                changed.push(row.user_id);
            }
        }
        for (let index = 0; index < changed.length; index += 100) {
            const ids = changed.slice(index, index + 100);
            const rows = await execute(this.supabase.from('user_data')
                .select('user_id, revision, data').in('user_id', ids));
            const requestedIds = new Set(ids);
            for (const row of rows) {
                if (!requestedIds.has(row.user_id)) throw new Error('Respuesta de usuarios fuera de alcance.');
                this.remember(row);
                result.set(row.user_id, structuredClone(row));
                this.metrics.fullRowsFetched += 1;
                this.metrics.decodedDocumentBytesFetched += Buffer.byteLength(JSON.stringify(row));
            }
            // A user deleted between the inventory and snapshot must not remain
            // in cache. The next tick also rechecks the complete inventory.
            for (const id of ids) if (!result.has(id)) this.forget(id);
        }
        return metadata.flatMap(row => result.has(row.user_id) ? [result.get(row.user_id)] : []);
    }
}

module.exports = { SchedulerDocumentCache };
