import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLOUD_SYNC_KEYS } from '../sync-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the latest client sync migration allows every cloud-owned key', async () => {
    const migration = await readFile(path.join(
        ROOT,
        'supabase',
        'migrations',
        '20260801100000_harden_private_snapshots_and_sync_schema.sql'
    ), 'utf8');

    for (const key of CLOUD_SYNC_KEYS) {
        assert.match(migration, new RegExp(`'${key}'`), `missing ${key} in database allowlist`);
    }
    assert.doesNotMatch(migration, /'alerts_sent_log'/);
    assert.doesNotMatch(migration, /'very_urgent_last_notified_at'/);
});

test('private safety snapshots enforce RLS without client grants', async () => {
    const migration = await readFile(path.join(
        ROOT,
        'supabase',
        'migrations',
        '20260801100000_harden_private_snapshots_and_sync_schema.sql'
    ), 'utf8');

    assert.match(migration, /user_data_snapshots enable row level security/i);
    assert.match(migration, /user_data_snapshots force row level security/i);
    assert.match(migration, /revoke all on table private\.user_data_snapshots from public, anon, authenticated/i);
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
        'project_templates_sync_allowlist'
    ]) {
        assert.match(verification, new RegExp(`'${checkName}'`));
    }
});
