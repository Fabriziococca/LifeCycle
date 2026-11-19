import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '../.tmp-sb/pglite/node_modules/@electric-sql/pglite/dist/index.js';

const migrations = new URL('../supabase/migrations/', import.meta.url);
const sql = name => readFile(new URL(name, migrations), 'utf8');
const db = new PGlite();
try {
    await db.exec(`create role authenticated; create role anon; create role service_role;
        create schema private; create schema auth;
        create function auth.uid() returns uuid language sql as $$select current_setting('request.jwt.claim.sub')::uuid$$;
        create table public.user_data(user_id uuid primary key,data jsonb default '{}',updated_at timestamptz default now(),revision bigint default 1);
        create function private.bump() returns trigger language plpgsql as $$begin new.revision=old.revision+1; return new; end;$$;
        create trigger bump before update on public.user_data for each row execute function private.bump();`);
    const existing = await sql('20261020164626_client_maintenance_and_health_appointments.sql');
    await db.exec(existing.match(/CREATE OR REPLACE FUNCTION public\.merge_user_data_keys[^]*?\$function\$\s*;/i)[0]);
    await db.exec(await sql('20261018053000_financial_sync_revision_guard.sql'));
    await db.exec(await sql((await readdir(migrations)).find(name => name.endsWith('_guard_task_list_writes.sql'))));
    await db.exec("set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; set role authenticated;");
    const write = (updates, deletes = []) => db.query('select public.merge_user_data_keys($1, $2)', [updates, deletes]);
    const guarded = (updates, revision) => db.query('select public.merge_user_data_at_revision($1, $2, $3) as receipt',[updates, [], revision]);
    const first = '[{"id":"phone"}]', both = '[{"id":"phone"},{"id":"pc"}]';
    await write({ tareas_list:first, __expected_task_list:null });
    await assert.rejects(write({ tareas_list:'[]' }), /Actualizá/);
    await assert.rejects(write({}, ['tareas_list']), /Actualizá/);
    await assert.rejects(write({ tareas_list:'[]', __expected_task_list:null }), /cambiaron/);
    await assert.rejects(write({ tareas_list:'[]', __task_revision:1 }), /cambiaron/);
    const saved = await guarded({ tareas_list:both, __task_revision:2 },2);
    assert.equal(saved.rows[0].receipt.revision,3);
    await assert.rejects(guarded({ tareas_list:'[]', __expected_task_list:first },2), /conflict/);
    await write({ tareas_list:both }); // old client, no-op
    await assert.rejects(write({ unknown_key:'x' }), /Unsupported/);
    await assert.rejects(db.query("select private.merge_user_data_keys('{}','{}')"), /permission denied/);
    await db.exec('reset role');
    assert.deepEqual((await db.query('select data from public.user_data')).rows[0].data, { tareas_list:both });
    await db.exec('set role authenticated');
    await write({ __expected_task_list:both }, ['tareas_list']);
    await db.exec('reset role');
    assert.deepEqual((await db.query('select data from public.user_data')).rows[0].data, {});
    console.log('OK: versioned writes, stale clients, restore precondition, no-ops, grants and allowlist');
} finally { await db.close(); }
