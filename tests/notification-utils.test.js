'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getDuplicateSubscriptionRowIds,
    getPendingVeryUrgentTasks,
    groupSubscriptionsByUser,
    isExpiredPushError,
    normalizeIntervalHours,
    parseJsonValue
} = require('../notification-utils');

test('parseJsonValue accepts native values and JSON strings', () => {
    assert.deepEqual(parseJsonValue('[1,2]', []), [1, 2]);
    assert.deepEqual(parseJsonValue({ enabled: true }, {}), { enabled: true });
    assert.deepEqual(parseJsonValue('not-json', []), []);
});

test('getPendingVeryUrgentTasks reads the real cloud keys', () => {
    const snapshot = {
        tareas_list: JSON.stringify([
            { id: 'general-1', urgency: 'muy_urgente', completed: false },
            { id: 'general-2', urgency: 'urgente', completed: false },
            { id: 'general-3', urgency: 'muy_urgente', completed: true }
        ]),
        projectPulseData: [
            {
                id: 'project-1',
                tasks: [
                    { id: 'project-task-1', urgency: 'muy_urgente', completed: false }
                ]
            }
        ]
    };

    assert.deepEqual(
        getPendingVeryUrgentTasks(snapshot).map(task => task.id),
        ['general-1', 'project-task-1']
    );
});

test('getPendingVeryUrgentTasks ignores obsolete key names', () => {
    const snapshot = {
        tareas_tasks: [{ id: 'legacy-general', urgency: 'muy_urgente', completed: false }],
        project_pulse_data: [{
            tasks: [{ id: 'legacy-project', urgency: 'muy_urgente', completed: false }]
        }]
    };

    assert.deepEqual(getPendingVeryUrgentTasks(snapshot), []);
});

test('groupSubscriptionsByUser keeps the newest row for each endpoint', () => {
    const groups = groupSubscriptionsByUser([
        {
            id: 'old-phone',
            user_id: 'user-1',
            created_at: '2026-07-20T10:00:00Z',
            subscription: { endpoint: 'https://push.example/phone', keys: { auth: 'old' } }
        },
        {
            id: 'desktop',
            user_id: 'user-1',
            created_at: '2026-07-20T11:00:00Z',
            subscription: { endpoint: 'https://push.example/desktop' }
        },
        {
            id: 'new-phone',
            user_id: 'user-1',
            created_at: '2026-07-21T10:00:00Z',
            subscription: { endpoint: 'https://push.example/phone', keys: { auth: 'new' } }
        }
    ]);

    assert.equal(groups['user-1'].length, 2);

    const phone = groups['user-1'].find(item => item.endpoint.endsWith('/phone'));
    assert.equal(phone.activeRowId, 'new-phone');
    assert.equal(phone.subscription.keys.auth, 'new');
    assert.deepEqual(phone.duplicateRowIds, ['old-phone']);
    assert.deepEqual(getDuplicateSubscriptionRowIds(groups), ['old-phone']);
});

test('groupSubscriptionsByUser ignores malformed rows', () => {
    const groups = groupSubscriptionsByUser([
        { id: 'missing-subscription', user_id: 'user-1' },
        { id: 'missing-user', subscription: { endpoint: 'https://push.example/x' } }
    ]);

    assert.deepEqual(groups, {});
});

test('normalizeIntervalHours enforces the supported range', () => {
    assert.equal(normalizeIntervalHours('4', 6), 4);
    assert.equal(normalizeIntervalHours('0', 6), 1);
    assert.equal(normalizeIntervalHours('80', 6), 48);
    assert.equal(normalizeIntervalHours('invalid', 6), 6);
    assert.equal(normalizeIntervalHours('invalid', 'invalid'), 4);
});

test('isExpiredPushError recognizes gone push endpoints', () => {
    assert.equal(isExpiredPushError({ statusCode: 404 }), true);
    assert.equal(isExpiredPushError({ statusCode: 410 }), true);
    assert.equal(isExpiredPushError({ statusCode: 500 }), false);
});
