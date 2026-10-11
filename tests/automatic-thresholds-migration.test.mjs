import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const migrationPath = new URL('../supabase/migrations/20261011054822_owner_automatic_day_thresholds.sql', import.meta.url);
const pglitePath = new URL('../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url);

// PGlite is an optional scratch dependency. The real SQL regression is also run
// explicitly before applying this data-only migration; CI always checks contract.
test('the scoped data migration preserves due dates and installs no recurring enforcement', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    assert.match(sql, /for update/i);
    assert.match(sql, /v_owner_count <> 1/);
    assert.match(sql, /v_updated#>'\{thresholds,red\}' is distinct from v_card#>'\{thresholds,red\}'/);
    assert.doesNotMatch(sql, /create\s+(?:or replace\s+)?(?:function|trigger|table)|delete\s+from|drop\s/i);
});

test('SQL conversion is owner-only, lossless, idempotent and safe for fresh installations', async t => {
    // The suite deliberately shares a process and installs a browser window
    // fixture. Run the WASM database in a clean child so browser detection cannot
    // mistake that fixture for a real window/location.
    if (process.env.LIFECYCLE_SQL_TEST_CHILD !== '1') {
        try { await access(pglitePath); } catch (error) {
            if (error.code === 'ENOENT') { t.skip('Optional local SQL runtime is not installed'); return; }
            throw error;
        }
        const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=SQL conversion is owner-only', fileURLToPath(import.meta.url)], {
            env: { ...process.env, LIFECYCLE_SQL_TEST_CHILD: '1' }, encoding: 'utf8',
            timeout: 30000, windowsHide: true
        });
        assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
        return;
    }
    let PGlite;
    try { ({ PGlite } = await import(pglitePath)); } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND') { t.skip('Optional local SQL runtime is not installed'); return; }
        throw error;
    }
    const db = new PGlite();
    try {
        const sql = await readFile(migrationPath, 'utf8');
        await db.exec(`create schema private;
            create table private.lifecycle_access_profiles(user_id uuid primary key, access_tier text);
            create table public.user_data(user_id uuid primary key, data jsonb, updated_at timestamptz default now());`);
        await db.exec(sql); // No owner yet: installation remains usable.
        const owner = '11111111-1111-4111-8111-111111111111';
        const friend = '22222222-2222-4222-8222-222222222222';
        const cards = [
            { id: 'ct_long', template: 'routine', cadence: { unit: 'days', value: 400 }, intervalDays: 400, thresholds: { red: 400, yellow: 180, orange: 270, mode: 'manual' }, alert: { times: ['10:00', '22:00'] }, paused: true, updatedAt: '2026-10-01' },
            { id: 'ct_short', cadence: { unit: 'days', value: 1 }, thresholds: { red: 1, yellow: 1, orange: 1 }, archived: true },
            { id: 'ct_months', template: 'medical', cadence: { unit: 'months', value: 6 }, thresholds: { warningDays: 30 } },
            { id: 'ct_state', template: 'state-reminder', cadence: { unit: 'days', value: 1 }, thresholds: { red: 1, yellow: 1, orange: 1 }, state: { active: true } },
            { id: 'ct_deleted', deleted: true, cadence: { unit: 'days', value: 10 }, thresholds: { red: 10, yellow: 2, orange: 4 } }
        ];
        const hygiene = { retainedLegacyValue: 'fixture', __trackers_v2: { version: 3, trackers: cards, histories: { ct_long: ['2026-10-01'] }, navigationPreferences: { favorites: [] } } };
        const document = { hygiene_tracker_data: JSON.stringify(hygiene), unrelated: { retained: true } };
        await db.query('insert into private.lifecycle_access_profiles values ($1,$2),($3,$4)', [owner, 'owner', friend, 'friend']);
        await db.query('insert into public.user_data(user_id,data) values ($1,$2),($3,$4)', [owner, document, friend, document]);
        await db.exec(sql);
        const after = (await db.query('select data from public.user_data where user_id=$1', [owner])).rows[0].data;
        const result = JSON.parse(after.hygiene_tracker_data);
        assert.deepEqual(result.__trackers_v2.trackers[0].thresholds, { red: 400, yellow: 280, orange: 340, mode: 'automatic' });
        assert.equal(result.__trackers_v2.trackers[1].thresholds.mode, 'automatic');
        assert.deepEqual(result.__trackers_v2.trackers.slice(2), cards.slice(2));
        assert.deepEqual(result.__trackers_v2.histories, hygiene.__trackers_v2.histories);
        assert.deepEqual(after.unrelated, document.unrelated);
        assert.deepEqual(result.__trackers_v2.trackers[0].alert, cards[0].alert);
        assert.equal(result.__trackers_v2.trackers[0].paused, true);
        const friendData = (await db.query('select data from public.user_data where user_id=$1', [friend])).rows[0].data;
        assert.deepEqual(friendData, document);
        await db.exec(sql);
        assert.deepEqual((await db.query('select data from public.user_data where user_id=$1', [owner])).rows[0].data, after);
        // Unrelated subsequent writes remain supported; this migration creates no trigger.
        await db.exec(`insert into private.lifecycle_access_profiles values ('33333333-3333-4333-8333-333333333333','owner')`);
        await assert.rejects(db.exec(sql), /Expected one owner account/);
    } finally { await db.close(); }
});
