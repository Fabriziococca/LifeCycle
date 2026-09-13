const test = require('node:test');
const assert = require('node:assert/strict');
const { SchedulerDocumentCache } = require('../scheduler-document-cache');

function fixture(options) {
    const state = { rows: [
        { user_id: 'a', revision: 1, data: { tasks: ['one'], padding: 'x'.repeat(1000) } },
        { user_id: 'b', revision: 2, data: { tasks: ['two'] } }
    ], reads: [], error: null, beforeFull: null };
    class Query {
        select(columns) { this.columns = columns; return this; }
        order() { return this; }
        range(start, end) { this.bounds = [start, end + 1]; return this; }
        in(key, ids) { this.ids = ids; return this; }
        abortSignal(signal) { this.signal = signal; return this; }
        async then(resolve, reject) {
            try {
                this.signal?.throwIfAborted();
                state.reads.push(this.columns);
                if (state.error) return resolve({ error: state.error });
                if (this.ids && state.beforeFull) await state.beforeFull();
                let rows = state.rows.filter(row => !this.ids || this.ids.includes(row.user_id));
                if (this.bounds) rows = rows.slice(...this.bounds);
                return resolve({ data: structuredClone(rows.map(row => this.ids ? row : { user_id: row.user_id, revision: row.revision })), error: null });
            } catch (error) { return reject(error); }
        }
    }
    const cache = new SchedulerDocumentCache({ from: () => new Query() }, options);
    return { cache, state };
}

test('scheduler verifies every revision but downloads unchanged JSON only once', async () => {
    const { cache, state } = fixture();
    assert.deepEqual(await cache.load(), state.rows);
    const firstBytes = cache.snapshot().decodedDocumentBytesFetched;
    for (let i = 0; i < 3; i++) assert.deepEqual(await cache.load(), state.rows);
    assert.equal(state.reads.filter(read => read.includes('data')).length, 1);
    assert.equal(cache.snapshot().metadataReads, 4);
    assert.equal(cache.snapshot().cacheHits, 6);
    assert.equal(cache.snapshot().decodedDocumentBytesFetched, firstBytes);
});

test('a changed revision refreshes immediately and caller mutation cannot poison the cache', async () => {
    const { cache, state } = fixture();
    const rows = await cache.load();
    rows[0].data.tasks.push('caller-mutation');
    assert.deepEqual((await cache.load())[0].data.tasks, ['one']);
    state.rows[0].data.tasks = ['fresh'];
    state.rows[0].revision++;
    assert.deepEqual((await cache.load())[0].data.tasks, ['fresh']);
    assert.equal(cache.snapshot().fullRowsFetched, 3);
});

test('no stale fallback is returned when metadata fails or the scheduler is aborted', async () => {
    const { cache, state } = fixture();
    await cache.load();
    state.error = new Error('DB unavailable');
    await assert.rejects(cache.load(), /DB unavailable/);
    state.error = null;
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(cache.load({ signal: abort.signal }), /abort/i);
});

test('removed users and deletions during refresh cannot survive in cached output', async () => {
    const { cache, state } = fixture();
    await cache.load();
    state.rows = [state.rows[0]];
    assert.equal((await cache.load()).length, 1);
    assert.equal(cache.snapshot().cachedRows, 1);
    state.rows[0].revision++;
    state.beforeFull = () => { state.rows = []; };
    assert.deepEqual(await cache.load(), []);
    assert.equal(cache.snapshot().cachedRows, 0);
});

test('the memory cap never truncates returned documents, including oversized single rows', async () => {
    const { cache, state } = fixture({ maxBytes: 50 });
    assert.deepEqual(await cache.load(), state.rows);
    assert.deepEqual(await cache.load(), state.rows);
    assert.ok(cache.snapshot().cacheBytes <= 50);
    assert.equal(cache.snapshot().fullRowsFetched, 4);
});

test('scheduler metadata pagination includes accounts beyond the API page size', async () => {
    const { cache, state } = fixture();
    state.rows = Array.from({ length: 501 }, (_, i) => ({ user_id: `user-${i}`, revision: 1, data: {} }));
    assert.equal((await cache.load()).length, 501);
    assert.equal(state.reads.filter(read => read === 'user_id, revision').length, 2);
    assert.equal(cache.snapshot().fullRowsFetched, 501);
});
