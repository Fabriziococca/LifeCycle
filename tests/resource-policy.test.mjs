import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FALLBACK_FRIEND_LIMITS,
    RESOURCE_KEYS,
    createFallbackResourcePolicy,
    evaluateResourceCapacity,
    getResourceLimit,
    getRecurringReminderRegistryResourceUsage,
    getTrackerRegistryResourceUsage,
    normalizeResourcePolicy
} from '../resource-policy.mjs';

test('missing or malformed server policy falls back to bounded friend limits', () => {
    assert.deepEqual(normalizeResourcePolicy(null), createFallbackResourcePolicy());
    assert.equal(
        getResourceLimit(normalizeResourcePolicy({ limits: { tasks: -1 } }), RESOURCE_KEYS.TASKS),
        FALLBACK_FRIEND_LIMITS.tasks
    );
});

test('only an explicit owner policy becomes unlimited', () => {
    assert.equal(normalizeResourcePolicy({ tier: 'owner', unlimited: true }).unlimited, true);
    assert.equal(normalizeResourcePolicy({ tier: 'owner', unlimited: false }).unlimited, false);
    assert.equal(normalizeResourcePolicy({ tier: 'friend', unlimited: true }).unlimited, false);
});

test('server limits override safe defaults and capacity reports the boundary', () => {
    const policy = normalizeResourcePolicy({
        tier: 'friend',
        unlimited: false,
        limits: { custom_modules: 2 }
    });

    assert.deepEqual(evaluateResourceCapacity(policy, RESOURCE_KEYS.CUSTOM_MODULES, 1), {
        allowed: true,
        limit: 2,
        remaining: 1
    });
    assert.equal(
        evaluateResourceCapacity(policy, RESOURCE_KEYS.CUSTOM_MODULES, 2).allowed,
        false
    );
});

test('owner capacity stays unlimited regardless of current usage', () => {
    const policy = normalizeResourcePolicy({ tier: 'owner', unlimited: true });
    assert.deepEqual(evaluateResourceCapacity(policy, RESOURCE_KEYS.TASKS, 999999), {
        allowed: true,
        limit: null,
        remaining: null
    });
});

test('tracker registry usage counts archived resources but excludes deleted card tombstones', () => {
    assert.deepEqual(getTrackerRegistryResourceUsage({
        customModules: [
            { id: 'cm_active', archived: false },
            { id: 'cm_archived', archived: true }
        ],
        trackers: [
            { id: 'ct_active', deleted: false },
            { id: 'ct_archived', archived: true, deleted: false },
            { id: 'ct_deleted', deleted: true }
        ]
    }), {
        custom_modules: 2,
        tracker_cards: 2
    });
});

test('recurring reminder registry usage counts every persisted reminder', () => {
    assert.deepEqual(getRecurringReminderRegistryResourceUsage({
        reminders: [
            { id: 'reminder_first' },
            { id: 'reminder_second' }
        ]
    }), {
        reminders: 2
    });
    assert.deepEqual(getRecurringReminderRegistryResourceUsage(null), {
        reminders: 0
    });
});
