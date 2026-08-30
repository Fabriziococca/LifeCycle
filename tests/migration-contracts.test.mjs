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
    '20260809062547_tanda_8_data_foundation.sql'
);
const TRADING_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260809062605_tanda_8_trading_projection.sql'
);
const TRADING_CAPACITY_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260829201218_expand_trading_projection_capacity.sql'
);
const RESOURCE_POLICY_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260827192821_user_resource_policy_foundation.sql'
);
const RESOURCE_POLICY_ENFORCEMENT_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260827211500_enforce_user_document_policy.sql'
);
const TRACKER_RESOURCE_ENFORCEMENT_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260829193500_enforce_tracker_resource_limits.sql'
);
const ALL_RESOURCE_ENFORCEMENT_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260829213000_enforce_all_resource_limits.sql'
);
const OPERATIONAL_LIMITS_MIGRATION = path.join(
    ROOT,
    'supabase',
    'migrations',
    '20260829214500_harden_storage_and_push_limits.sql'
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

test('Trading projection capacity expands safely and rebuilds existing rows', async () => {
    const migration = await readFile(TRADING_CAPACITY_MIGRATION, 'utf8');

    assert.match(migration, /create or replace function private\.sync_trading_events_for_user/i);
    assert.match(migration, /security definer[\s\S]+set search_path = pg_catalog, pg_temp/i);
    assert.match(migration, /candidate\.position <= 10000/i);
    assert.match(migration, /on conflict \(user_id, id\) do nothing/i);
    assert.match(migration, /revoke all on function private\.sync_trading_events_for_user[\s\S]+authenticated/i);
    assert.match(migration, /select private\.sync_trading_events_for_user\(user_id, data\)[\s\S]+from public\.user_data/i);
    assert.doesNotMatch(migration, /delete from public\.user_data/i);

    const verification = await readFile(path.join(
        ROOT,
        'supabase',
        'verification',
        '20260809_tanda_8_security_check.sql'
    ), 'utf8');
    assert.match(verification, /trading_projection_capacity/i);
    assert.match(verification, /candidate\.position <= 10000/i);
});

test('Trading scheduler reads every projection page in deterministic order', async () => {
    const serverSource = await readFile(path.join(ROOT, 'server.js'), 'utf8');

    assert.match(serverSource, /collectSupabaseRangePages/);
    assert.match(
        serverSource,
        /from\('trading_events'\)[\s\S]{0,500}order\('user_id',[\s\S]{0,150}order\('id',[\s\S]{0,150}range\(from, to\)/
    );
    assert.match(serverSource, /collectSupabaseRangePages[\s\S]{0,900}\{ pageSize: 500 \}/);
});

test('resource policy is private, owner-safe and exposed only through an authenticated RPC', async () => {
    const migration = await readFile(RESOURCE_POLICY_MIGRATION, 'utf8');
    const authSync = await readFile(path.join(ROOT, 'modules', 'AuthSyncModule.js'), 'utf8');

    assert.match(migration, /create table if not exists private\.lifecycle_access_profiles/i);
    assert.match(migration, /user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
    assert.match(migration, /create table if not exists private\.lifecycle_resource_limits/i);
    assert.match(migration, /force row level security/i);
    assert.match(migration, /revoke all on table private\.lifecycle_access_profiles[\s\S]+authenticated/i);
    assert.match(migration, /get_my_resource_policy[\s\S]+security definer[\s\S]+set search_path = pg_catalog, pg_temp/i);
    assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
    assert.match(migration, /coalesce\(v_access_tier, 'friend'\)/i);
    assert.match(migration, /grant execute on function public\.get_my_resource_policy\(\)[\s\S]+to authenticated/i);
    assert.doesNotMatch(migration, /contactofabrizioo|3534e80f/i);
    assert.match(authSync, /rpc\('get_my_resource_policy'\)/);
    assert.match(authSync, /createFallbackResourcePolicy/);
});

test('synchronized document limits are enforced privately without cross-user input', async () => {
    const migration = await readFile(RESOURCE_POLICY_ENFORCEMENT_MIGRATION, 'utf8');
    const authSync = await readFile(path.join(ROOT, 'modules', 'AuthSyncModule.js'), 'utf8');

    assert.match(migration, /private\.enforce_lifecycle_user_document_limit\(\)/i);
    assert.match(migration, /security definer[\s\S]+set search_path = pg_catalog, pg_temp/i);
    assert.match(migration, /where profile\.user_id = new\.user_id/i);
    assert.match(migration, /resource_key = 'synced_document_bytes'/i);
    assert.match(migration, /v_access_tier = 'owner'[\s\S]+return new/i);
    assert.match(migration, /octet_length[\s\S]+convert_to/i);
    assert.match(migration, /errcode = '54000'/i);
    assert.match(migration, /revoke all on function private\.enforce_lifecycle_user_document_limit\(\)[\s\S]+authenticated/i);
    assert.match(migration, /create trigger user_data_enforce_resource_policy_before_write/i);
    assert.doesNotMatch(migration, /contactofabrizioo|soyfabriziococca/i);
    assert.match(authSync, /isPermanentSyncPolicyError/);
    assert.match(authSync, /shouldSchedulePendingSync/);
});

test('module, tracker and reminder limits are enforced at the synchronized document boundary', async () => {
    const migration = await readFile(TRACKER_RESOURCE_ENFORCEMENT_MIGRATION, 'utf8');
    const verification = await readFile(path.join(
        ROOT,
        'supabase',
        'verification',
        '20260827_resource_policy_security_check.sql'
    ), 'utf8');

    assert.match(migration, /private\.enforce_lifecycle_user_document_limit\(\)/i);
    assert.match(migration, /security definer[\s\S]+set search_path = pg_catalog, pg_temp/i);
    assert.match(migration, /where profile\.user_id = new\.user_id/i);
    assert.match(migration, /v_access_tier = 'owner'[\s\S]+return new/i);
    assert.match(migration, /resource_key = 'custom_modules'/i);
    assert.match(migration, /resource_key = 'tracker_cards'/i);
    assert.match(migration, /resource_key = 'reminders'/i);
    assert.match(migration, /new\.data -> 'hygiene_tracker_data'/i);
    assert.match(migration, /new\.data -> 'alerts_config'/i);
    assert.match(migration, /v_hygiene_stored #>> '\{\}'[\s\S]+::jsonb/i);
    assert.match(migration, /v_alerts_stored #>> '\{\}'[\s\S]+::jsonb/i);
    assert.match(migration, /jsonb_array_length\(v_custom_modules\)/i);
    assert.match(migration, /jsonb_array_length\(v_tracker_cards\)/i);
    assert.match(migration, /jsonb_array_length\(v_reminders\)/i);
    assert.doesNotMatch(
        migration,
        /if v_hygiene_stored is null[\s\S]{0,180}return new/i,
        'missing tracker data must not bypass reminder enforcement'
    );
    assert.match(migration, /errcode = '54000'/i);
    assert.match(migration, /revoke all on function private\.enforce_lifecycle_user_document_limit\(\)[\s\S]+authenticated/i);
    assert.doesNotMatch(migration, /contactofabrizioo|soyfabriziococca/i);
    assert.match(verification, /tracker_resource_limits/i);
    assert.match(verification, /pg_get_functiondef\(procedures\.oid\)\s*~\s*'''custom_modules'''/i);
    assert.match(verification, /pg_get_functiondef\(procedures\.oid\)\s*~\s*'''tracker_cards'''/i);
    assert.match(verification, /pg_get_functiondef\(procedures\.oid\)\s*~\s*'''reminders'''/i);
});

test('every synchronized collection is counted by the authoritative policy trigger', async () => {
    const migration = await readFile(ALL_RESOURCE_ENFORCEMENT_MIGRATION, 'utf8');
    const verification = await readFile(path.join(
        ROOT,
        'supabase',
        'verification',
        '20260827_resource_policy_security_check.sql'
    ), 'utf8');

    assert.match(migration, /private\.lifecycle_stored_json/i);
    assert.match(migration, /private\.lifecycle_json_array/i);
    assert.match(migration, /security definer[\s\S]+set search_path = pg_catalog, pg_temp/i);
    assert.match(migration, /where profile\.user_id = new\.user_id/i);
    assert.match(migration, /v_access_tier = 'owner'[\s\S]+return new/i);
    for (const resourceKey of [
        'custom_modules',
        'tracker_cards',
        'reminders',
        'tasks',
        'projects',
        'project_templates',
        'finance_transactions',
        'finance_recurring_rules',
        'trading_events',
        'gym_routine_exercises',
        'gym_meal_templates',
        'gym_supplements',
        'vehicle_issues',
        'blood_test_files'
    ]) {
        assert.match(migration, new RegExp(`'${resourceKey}'`));
    }
    for (const storageKey of [
        'tareas_list',
        'projectPulseData',
        'projectPulseHistory',
        'projectPulseTemplates',
        'finanzasData',
        'gym_routine',
        'gym_meals',
        'gym_general_meals',
        'gym_supplements',
        'vehicle_issues',
        'health_blood_tests'
    ]) {
        assert.match(migration, new RegExp(`'${storageKey}'`));
    }
    assert.match(migration, /project tasks are invalid/i);
    assert.match(migration, /tracker\.value ->> 'deleted'/i);
    assert.match(migration, /errcode = '54000'/i);
    assert.match(migration, /revoke all on function private\.enforce_lifecycle_user_document_limit/i);
    assert.doesNotMatch(migration, /contactofabrizioo|soyfabriziococca/i);
    assert.match(verification, /all_resource_limits/i);
});

test('Storage and Push quotas are isolated, race-safe and owner-aware', async () => {
    const migration = await readFile(OPERATIONAL_LIMITS_MIGRATION, 'utf8');

    assert.match(migration, /update storage\.buckets[\s\S]+public = false/i);
    assert.match(migration, /file_size_limit = 15728640/i);
    assert.match(migration, /public\.can_upload_lifecycle_medical_file/i);
    assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
    assert.doesNotMatch(migration, /p_user_id/i);
    assert.match(migration, /split_part\(p_object_name, '\/', 1\) <> v_user_id::text/i);
    assert.match(migration, /resource_key = 'blood_test_files'/i);
    assert.match(migration, /pg_advisory_xact_lock/i);
    assert.match(migration, /grant execute on function public\.can_upload_lifecycle_medical_file\(text\)[\s\S]+to authenticated/i);
    assert.match(migration, /create policy "Users can insert their own blood tests"[\s\S]+can_upload_lifecycle_medical_file\(name\)/i);
    assert.match(migration, /private\.enforce_lifecycle_push_subscription_limit/i);
    assert.match(migration, /v_limit constant bigint := 20/i);
    assert.match(migration, /access_tier[\s\S]+owner[\s\S]+return new/i);
    assert.match(migration, /before insert on public\.push_subscriptions/i);
    assert.doesNotMatch(migration, /contactofabrizioo|soyfabriziococca/i);
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

test('notification delivery migration records freshness and automatic device telemetry safely', async () => {
    const migration = await readFile(path.join(
        ROOT,
        'supabase',
        'migrations',
        '20260821040806_notification_delivery_freshness_and_telemetry.sql'
    ), 'utf8');

    for (const column of [
        'scheduled_at',
        'expires_at',
        'received_at',
        'displayed_at',
        'discarded_at',
        'receipt_token_hash'
    ]) {
        assert.match(migration, new RegExp(`add column if not exists ${column}`));
    }
    assert.match(migration, /'pending'/);
    assert.match(migration, /'unknown'/);
    assert.match(migration, /receipt_token_hash\)\s+where receipt_token_hash is not null/i);
    assert.match(migration, /notification_delivery_log_dispatch_once_idx/i);
    assert.match(migration, /where status in \('pending', 'accepted'\)/i);
    assert.match(migration, /revoke all on table public\.notification_delivery_log from public, anon, authenticated/i);
    assert.doesNotMatch(migration, /security definer/i);
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
        'notification_delivery_telemetry',
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
        'trading_projection_capacity',
        'trading_projection_parity',
        'trading_dispatch_security',
        'trading_dispatch_rpc_security'
    ]) {
        assert.match(verification, new RegExp(`'${checkName}'`));
    }
});
