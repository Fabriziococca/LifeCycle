import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
    return readFile(path.join(ROOT, relativePath), 'utf8');
}

test('all user-facing creation paths consult the central resource policy', async () => {
    const sources = await Promise.all([
        'modules/TareasModule.js',
        'modules/ProjectsModule.js',
        'modules/FinanzasModule.js',
        'modules/TradingModule.js',
        'modules/GymModule.js',
        'modules/VehicleModule.js',
        'modules/HealthModule.js'
    ].map(read));
    const combined = sources.join('\n');

    for (const resourceKey of [
        'TASKS',
        'PROJECTS',
        'PROJECT_TEMPLATES',
        'FINANCE_TRANSACTIONS',
        'FINANCE_RECURRING_RULES',
        'TRADING_EVENTS',
        'GYM_ROUTINE_EXERCISES',
        'GYM_MEAL_TEMPLATES',
        'GYM_SUPPLEMENTS',
        'VEHICLE_ISSUES',
        'BLOOD_TEST_FILES'
    ]) {
        assert.match(combined, new RegExp(`RESOURCE_KEYS\\.${resourceKey}`));
    }
    for (const source of sources) {
        assert.match(source, /checkResourceCreationCapacity/);
    }
    assert.match(combined, /appendResourceCapacityNotice/);
});

test('template-created tasks and paired exercises reserve their full batch size', async () => {
    const projects = await read('modules/ProjectsModule.js');
    const gym = await read('modules/GymModule.js');

    assert.match(
        projects,
        /getTemplateTaskCapacity\([\s\S]{0,120}templatePayload\.tasks\.length/
    );
    assert.match(
        gym,
        /requestedCount = pairedDay \? 2 : 1[\s\S]{0,180}GYM_ROUTINE_EXERCISES/
    );
});

test('client rejects an oversized complete sync before invoking the database RPC', async () => {
    const authSync = await read('modules/AuthSyncModule.js');
    const capacityIndex = authSync.indexOf('assertSynchronizedDocumentCapacity({');
    const rpcIndex = authSync.indexOf("this.supabase.rpc('merge_user_data_keys'");

    assert.ok(capacityIndex >= 0);
    assert.ok(rpcIndex > capacityIndex);
    assert.match(authSync, /keys: CLOUD_SYNC_KEYS/);
    assert.match(authSync, /BLOOD_TEST_FILE_BYTES/);
});

test('server applies bounded rate limiters to registration, telemetry and Push mutations', async () => {
    const server = await read('server.js');

    assert.match(server, /createFixedWindowRateLimiter/);
    assert.match(server, /app\.set\('trust proxy', 1\)/);
    assert.match(server, /api\/auth\/register', registrationRateLimiter/);
    assert.match(server, /api\/push\/telemetry', telemetryRateLimiter/);
    assert.match(server, /api\/subscribe'[\s\S]{0,120}authenticatedMutationRateLimiter/);
    assert.match(server, /devices\/:id\/test'[\s\S]{0,120}pushTestRateLimiter/);
    assert.match(server, /api\/test-push'[\s\S]{0,120}pushTestRateLimiter/);
    assert.match(server, /resource_key=push_devices/);
});

test('medical attachment cleanup prevents orphaned uploads after a local save failure', async () => {
    const health = await read('modules/HealthModule.js');

    assert.match(health, /let uploadedPath = null/);
    assert.match(health, /uploadedPath = await this\.controller\.auth\.uploadMedicalFile/);
    assert.match(
        health,
        /catch \(error\)[\s\S]{0,260}deleteMedicalFile\(uploadedPath\)/
    );
});
