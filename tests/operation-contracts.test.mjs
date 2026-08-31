import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('production and CI stay on the same bounded Node LTS major', async () => {
    const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
    const packageLock = JSON.parse(await readFile(path.join(ROOT, 'package-lock.json'), 'utf8'));
    const workflow = await readFile(path.join(ROOT, '.github', 'workflows', 'validate.yml'), 'utf8');

    assert.equal(packageJson.engines.node, '>=24.0.0 <25.0.0');
    assert.equal(packageLock.packages[''].engines.node, packageJson.engines.node);
    assert.match(workflow, /node-version:\s*24\b/);
});

test('the environment template documents every runtime secret without values', async () => {
    const template = await readFile(path.join(ROOT, '.env.example'), 'utf8');

    for (const key of [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'VAPID_PUBLIC_KEY',
        'VAPID_PRIVATE_KEY',
        'ADMIN_TOKEN'
    ]) {
        assert.match(template, new RegExp(`^${key}=$`, 'm'));
    }
    assert.doesNotMatch(template, /^(SUPABASE_SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY|ADMIN_TOKEN)=.+$/m);
});

test('notification operations enforce freshness and emit auditable request logs', async () => {
    const server = await readFile(path.join(ROOT, 'server.js'), 'utf8');

    assert.match(server, /TIMED_NOTIFICATION_GRACE_MINUTES/);
    assert.match(server, /TTL:\s*policy\.TTL/);
    assert.match(server, /urgency:\s*policy\.urgency/);
    assert.match(server, /\[Notification Dispatch\]/);
    assert.doesNotMatch(server, /\[Alert Engine\] Enviando/);
    assert.doesNotMatch(server, /6\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    assert.match(server, /PENDING_DELIVERY_RECOVERY_MS\s*=\s*2\s*\*\s*60\s*\*\s*1000/);
    assert.match(server, /PENDING_DELIVERY_RECOVERY_INTERVAL_MS\s*=\s*60\s*\*\s*1000/);
    assert.match(server, /SUPABASE_REQUEST_TIMEOUT_MS\s*=\s*15000/);
    assert.match(server, /PUSH_RETRY_AFTER_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
    assert.match(server, /claim_notification_delivery_retry/);
    assert.match(server, /\.\.\.\(topic \? \{ topic \} : \{\}\)/);
    assert.match(server, /telemetryRequested[\s\S]*isMissingPushTelemetrySchema[\s\S]*buildHistoryQuery\(baseColumns\)/);
    assert.match(server, /\[HTTP\].*status=.*duration_ms=/);
    assert.match(server, /normalizeApiRoute\(req\)/);
    assert.doesNotMatch(server, /`\$\{req\.baseUrl\}\$\{req\.path\}`/);
});
