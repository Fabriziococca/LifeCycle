import test from 'node:test';
import assert from 'node:assert/strict';

import {
    areStoredValuesEqual,
    buildCloudPatch
} from '../sync-utils.mjs';
import {
    CLOUD_LOCAL_CLEAR_KEYS,
    CLOUD_RESTORE_KEYS,
    CLOUD_SERVER_MANAGED_KEYS,
    CLOUD_SYNC_KEYS
} from '../sync-config.mjs';

test('areStoredValuesEqual compares serialized JSON by value', () => {
    assert.equal(areStoredValuesEqual('{"enabled":true}', { enabled: true }), true);
    assert.equal(areStoredValuesEqual('[1,2]', [1, 2]), true);
    assert.equal(areStoredValuesEqual('  plain text ', 'plain text'), true);
    assert.equal(areStoredValuesEqual('{"enabled":true}', '{"enabled":false}'), false);
});

test('areStoredValuesEqual treats empty cache values consistently', () => {
    assert.equal(areStoredValuesEqual(null, undefined), true);
    assert.equal(areStoredValuesEqual('', null), true);
    assert.equal(areStoredValuesEqual('0', null), false);
});

test('buildCloudPatch separates updates from deleted keys', () => {
    const values = new Map([
        ['tareas_list', '[{"id":"task-1"}]'],
        ['finanzasData', null]
    ]);

    assert.deepEqual(
        buildCloudPatch(
            ['tareas_list', 'finanzasData'],
            key => values.get(key)
        ),
        {
            updates: {
                tareas_list: '[{"id":"task-1"}]'
            },
            deleteKeys: ['finanzasData']
        }
    );
});

test('buildCloudPatch sends only requested unique keys', () => {
    const reads = [];
    const result = buildCloudPatch(
        ['projectPulseData', 'projectPulseData'],
        key => {
            reads.push(key);
            return '[]';
        }
    );

    assert.deepEqual(reads, ['projectPulseData']);
    assert.deepEqual(result, {
        updates: { projectPulseData: '[]' },
        deleteKeys: []
    });
    assert.equal('alerts_sent_log' in result.updates, false);
});

test('cloud configuration keeps server-managed keys read-only', () => {
    assert.equal(CLOUD_SYNC_KEYS.includes('alerts_sent_log'), false);
    assert.equal(CLOUD_SYNC_KEYS.includes('robot_last_notified_at'), false);
    assert.equal(CLOUD_SYNC_KEYS.includes('very_urgent_last_notified_at'), false);
    assert.equal(CLOUD_SERVER_MANAGED_KEYS.includes('alerts_sent_log'), true);
    assert.equal(CLOUD_SERVER_MANAGED_KEYS.includes('robot_last_notified_at'), true);
    assert.equal(CLOUD_SERVER_MANAGED_KEYS.includes('very_urgent_last_notified_at'), true);
    assert.deepEqual(
        CLOUD_RESTORE_KEYS,
        [...CLOUD_SYNC_KEYS]
    );
    assert.deepEqual(
        CLOUD_LOCAL_CLEAR_KEYS,
        [...CLOUD_SYNC_KEYS, ...CLOUD_SERVER_MANAGED_KEYS]
    );
});
