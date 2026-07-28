import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    applyBackupEntries,
    BACKUP_FORMAT_VERSION,
    BackupValidationError,
    createBackupPayload,
    normalizeBackupStorageEntry,
    parseAndValidateBackupText
} from '../backup-utils.mjs';
import { CLOUD_SYNC_KEYS } from '../sync-config.mjs';

const readFixture = fileName => readFileSync(
    new URL(`./fixtures/${fileName}`, import.meta.url),
    'utf8'
);

class MemoryStorage {
    constructor(initialValues = {}, failOnceForKey = null) {
        this.values = new Map(
            Object.entries(initialValues).map(([key, value]) => [key, String(value)])
        );
        this.failOnceForKey = failOnceForKey;
        this.didFail = false;
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        if (key === this.failOnceForKey && !this.didFail) {
            this.didFail = true;
            throw new Error('Simulated storage failure');
        }
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

test('versioned backups round-trip every cloud-owned key', () => {
    const storedValues = new Map([
        ['tareas_list', JSON.stringify([{ id: 1, text: 'Comprar jabón' }])],
        ['vehicle_odometer', '12345'],
        ['lensDate', '2026-07-27']
    ]);
    const now = new Date('2026-07-27T12:00:00.000Z');

    const payload = createBackupPayload(
        key => storedValues.get(key) ?? null,
        now
    );
    const plan = parseAndValidateBackupText(JSON.stringify(payload));

    assert.equal(payload.backupVersion, BACKUP_FORMAT_VERSION);
    assert.equal(payload.exportDate, now.toISOString());
    assert.deepEqual(Object.keys(payload.data), CLOUD_SYNC_KEYS);
    assert.equal(plan.mode, 'full');
    assert.equal(plan.entries.length, CLOUD_SYNC_KEYS.length);
    assert.equal(
        plan.entries.find(([key]) => key === 'tareas_list')[1],
        storedValues.get('tareas_list')
    );
    assert.equal(
        plan.entries.find(([key]) => key === 'gym_active_session')[1],
        null
    );
});

test('legacy unified backups update only their present sections', () => {
    const plan = parseAndValidateBackupText(JSON.stringify({
        appName: 'LifeCycle',
        tareas_list: [{ id: 2, text: 'Tarea anterior' }],
        vehicle_odometer: '50000',
        gym_sessions: null
    }));

    assert.equal(plan.mode, 'legacy');
    assert.deepEqual(
        plan.entries.map(([key]) => key),
        ['vehicle_odometer', 'tareas_list']
    );
});

test('legacy hygiene-only backups remain compatible', () => {
    const plan = parseAndValidateBackupText(JSON.stringify({
        toalla_mano: '2026-07-20',
        robot_cleaner: {
            status: 'clean',
            marked_dirty_at: null
        }
    }));

    assert.equal(plan.mode, 'legacy');
    assert.deepEqual(plan.entries.map(([key]) => key), ['hygiene_tracker_data']);
});

test('backup validation rejects invalid roots, dates and application names', () => {
    assert.throws(
        () => parseAndValidateBackupText('[]'),
        BackupValidationError
    );
    assert.throws(
        () => parseAndValidateBackupText(JSON.stringify({
            appName: 'AnotherApp',
            tareas_list: []
        })),
        /otra aplicación/
    );
    assert.throws(
        () => parseAndValidateBackupText(JSON.stringify({
            appName: 'LifeCycle',
            lensDate: '2026-02-31'
        })),
        /fecha/
    );
});

test('backup validation rejects unsafe nested property names', () => {
    assert.throws(
        () => parseAndValidateBackupText(
            '{"appName":"LifeCycle","finanzasData":{"constructor":{"polluted":true}}}'
        ),
        /propiedad no permitida/
    );
});

test('versioned backups must be complete and contain only known keys', () => {
    assert.throws(
        () => parseAndValidateBackupText(JSON.stringify({
            appName: 'LifeCycle',
            backupVersion: BACKUP_FORMAT_VERSION,
            data: { tareas_list: [] }
        })),
        /incompleto/
    );

    const payload = createBackupPayload(() => null);
    payload.data.unexpected = true;
    assert.throws(
        () => parseAndValidateBackupText(JSON.stringify(payload)),
        /clave desconocida/
    );
});

test('atomic restore rolls all changes back when storage fails', () => {
    const storage = new MemoryStorage(
        {
            tareas_list: '[{"id":1}]',
            vehicle_odometer: '1000'
        },
        'vehicle_odometer'
    );

    assert.throws(
        () => applyBackupEntries(storage, [
            ['tareas_list', '[{"id":2}]'],
            ['vehicle_odometer', '2000']
        ]),
        /datos anteriores fueron recuperados/
    );
    assert.equal(storage.getItem('tareas_list'), '[{"id":1}]');
    assert.equal(storage.getItem('vehicle_odometer'), '1000');
});

test('full restore can deliberately clear keys represented as null', () => {
    const storage = new MemoryStorage({
        gym_active_session: '{"id":1}',
        tareas_list: '[]'
    });

    const changedKeys = applyBackupEntries(storage, [
        ['gym_active_session', null],
        ['tareas_list', '[]']
    ]);

    assert.deepEqual(changedKeys, ['gym_active_session']);
    assert.equal(storage.getItem('gym_active_session'), null);
    assert.equal(storage.getItem('tareas_list'), '[]');
});

test('empty optional lens fields are normalized instead of blocking an export', () => {
    assert.deepEqual(
        normalizeBackupStorageEntry('lensDate', ''),
        { portableValue: null, storageValue: null }
    );
    assert.deepEqual(
        normalizeBackupStorageEntry('lensesStartTime', '   '),
        { portableValue: null, storageValue: null }
    );
    assert.deepEqual(
        normalizeBackupStorageEntry('lensStock', ''),
        { portableValue: 0, storageValue: '0' }
    );
});

test('semantic validation rejects malformed nested module data', () => {
    assert.throws(
        () => parseAndValidateBackupText(JSON.stringify({
            appName: 'LifeCycle',
            tareas_list: [{ id: 1, text: { unexpected: true } }]
        })),
        /texto/
    );
    assert.throws(
        () => parseAndValidateBackupText(JSON.stringify({
            appName: 'LifeCycle',
            vehicle_issues: [{ id: 1, title: 'Freno', resolvedAt: { invalid: true } }]
        })),
        /resolvedAt/
    );
});

test('legacy embedded medical attachments remain compatible', () => {
    const legacyAttachment = `data:application/pdf;base64,${'A'.repeat(20_000)}`;
    const plan = parseAndValidateBackupText(JSON.stringify({
        appName: 'LifeCycle',
        health_blood_tests: [{
            id: 'blood_1',
            date: '2026-07-27',
            fileName: 'estudio.pdf',
            fileData: legacyAttachment
        }]
    }));

    assert.equal(plan.mode, 'legacy');
    assert.match(
        plan.entries.find(([key]) => key === 'health_blood_tests')[1],
        /data:application\/pdf/
    );
});

test('browser restore fixtures stay representative and valid', () => {
    assert.throws(
        () => parseAndValidateBackupText(readFixture('backup-invalid.json')),
        BackupValidationError
    );

    const legacyPlan = parseAndValidateBackupText(
        readFixture('backup-legacy-valid.json')
    );
    assert.equal(legacyPlan.mode, 'legacy');
    assert.deepEqual(
        legacyPlan.entries.map(([key]) => key),
        ['tareas_list']
    );

    const fullPlan = parseAndValidateBackupText(
        readFixture('backup-v2-full.json')
    );
    assert.equal(fullPlan.mode, 'full');
    assert.equal(fullPlan.entries.length, CLOUD_SYNC_KEYS.length);
    assert.equal(
        fullPlan.entries.find(([key]) => key === 'hygiene_tracker_data')[1],
        null
    );
});
