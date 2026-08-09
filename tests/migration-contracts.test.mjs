import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLOUD_SYNC_KEYS } from '../sync-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOUNDATION_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260809060236_tanda_8_data_foundation.sql'
);
const TRADING_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260809060251_tanda_8_trading_projection.sql'
);

test('the latest client sync migration allows every cloud-owned key', async () => {
    const migration = await readFile(FOUNDATION_MIGRATION, 'utf8');

    for (const key of CLOUD_SYNC_KEYS) {
        assert.match(migration, new RegExp(`'${key}'`), `missing ${key} in database allowlist`);
    }
    assert.doesNotMatch(migration, /'alerts_sent_log'/);
    assert.doesNotMatch(migration, /'very_urgent_last_notified_at'/);
});

test('Tanda 8 sync foundation uses revisioning and least privilege', async () => {
    const migration = await readFile(FOUNDATION_MIGRATION, 'utf8');
    const authSync = await readFile(path.join(ROOT, 'modules', 'AuthSyncModule.js'), 'utf8');

    assert.match(migration, /add column if not exists revision bigint not null default 1/i);
    assert.match(migration, /user_data_revision_before_update/i);
    assert.match(migration, /foreign key \(user_id\) references auth\.users\(id\) on delete cascade/i);
    assert.match(migration, /revoke all on table public\.user_data from anon, authenticated/i);
    assert.match(migration, /grant select on table public\.user_data to authenticated/i);
    assert.match(migration, /create policy "Users can read their own data"[\s\S]+to authenticated/i);
    assert.match(migration, /merge_user_data_keys[\s\S]+security definer[\s\S]+set search_path = pg_catalog, pg_temp/i);
    assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
    assert.match(migration, /grant execute on function public\.merge_user_data_keys[\s\S]+to authenticated/i);
    assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*public\.user_data[^;]*authenticated/i);
    assert.match(authSync, /rpc\('merge_user_data_keys'/);
    assert.doesNotMatch(authSync, /from\('user_data'\)[\s\S]{0,120}\.insert\(/);
});

test('Tanda 8 Trading persistence is additive, isolated and idempotent', async () => {
    const migration = await readFile(TRADING_MIGRATION, 'utf8');

    assert.match(migration, /create table if not exists public\.trading_events/i);
    assert.match(migration, /primary key \(user_id, id\)/i);
    assert.match(migration, /alter table public\.trading_events enable row level security/i);
    assert.match(migration, /create policy "Users can read their own trading events"[\s\S]+to authenticated/i);
    assert.match(migration, /grant select on table public\.trading_events to authenticated, service_role/i);
    assert.match(migration, /trading_events_active_schedule_idx/i);
    assert.match(migration, /create trigger user_data_sync_trading_events/i);
    assert.match(migration, /create table if not exists private\.trading_notification_dispatches/i);
    assert.match(migration, /force row level security/i);
    assert.match(migration, /claim_trading_notification_dispatch/i);
    assert.match(migration, /complete_trading_notification_dispatch/i);
    assert.match(migration, /grant execute[\s\S]+to service_role/i);
    assert.doesNotMatch(migration, /drop table/i);
    assert.doesNotMatch(migration, /delete from public\.user_data/i);
    assert.doesNotMatch(migration, /tradingEvents'\s*,\s*null|tradingEvents'\s*-/i);
});

test('private safety snapshots enforce RLS without client grants', async () => {
    const migration = await readFile(path.join(
        ROOT,
        'supabase',
        'migrations',
        '20260801062115_harden_private_snapshots_and_sync_schema.sql'
    ), 'utf8');

    assert.match(migration, /user_data_snapshots enable row level security/i);
    assert.match(migration, /user_data_snapshots force row level security/i);
    assert.match(migration, /revoke all on table private\.user_data_snapshots from public, anon, authenticated/i);
});

test('notification history distinguishes provider acceptance, missing devices and manual confirmation', async () => {
    const migration = await readFile(path.join(
        ROOT,
        'supabase',
        'migrations',
        '20260801193348_complete_push_diagnostics_and_retention.sql'
    ), 'utf8');

    assert.match(migration, /endpoint_fingerprint drop not null/i);
    assert.match(migration, /confirmed_at timestamptz/i);
    assert.match(migration, /'no_devices'/);
    assert.match(migration, /notification_delivery_log_retention_idx/i);
});

test('the production verification script is read-only and checks every new contract', async () => {
    const verification = await readFile(path.join(
        ROOT,
        'supabase',
        'verification',
        '20260801_operation_security_check.sql'
    ), 'utf8');

    assert.doesNotMatch(
        verification,
        /^\s*(insert|update|delete|alter|create|drop|grant|revoke)\b/im
    );
    for (const checkName of [
        'push_subscription_columns',
        'notification_history_rls',
        'private_snapshot_rls',
        'notification_history_client_privileges',
        'notification_history_semantics',
        'project_templates_sync_allowlist'
    ]) {
        assert.match(verification, new RegExp(`'${checkName}'`));
    }
});

test('the Tanda 8 verification script is read-only and covers security plus parity', async () => {
    const verification = await readFile(path.join(
        ROOT,
        'supabase',
        'verification',
        '20260809_tanda_8_security_check.sql'
    ), 'utf8');

    assert.doesNotMatch(
        verification,
        /^\s*(insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/im
    );
    for (const checkName of [
        'tanda_8_recovery_snapshot',
        'user_data_revision_contract',
        'user_data_client_privileges',
        'user_data_rpc_security',
        'owned_rows_cascade',
        'trading_events_security',
        'trading_projection_parity',
        'trading_dispatch_security',
        'trading_dispatch_rpc_security'
    ]) {
        assert.match(verification, new RegExp(`'${checkName}'`));
    }
});
