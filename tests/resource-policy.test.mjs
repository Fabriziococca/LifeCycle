import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FALLBACK_FRIEND_LIMITS,
    RESOURCE_KEYS,
    createFallbackResourcePolicy,
    evaluateResourceCapacity,
    getBloodTestResourceUsage,
    getFinanceResourceUsage,
    getGymResourceUsage,
    getProjectResourceUsage,
    getResourceCapacityNotice,
    getResourceLimitMessage,
    getResourceLimit,
    getRecurringReminderRegistryResourceUsage,
    getSynchronizedResourceUsage,
    getTaskResourceUsage,
    getTrackerRegistryResourceUsage,
    getVehicleResourceUsage,
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

test('cross-module resource usage counts every persisted collection exactly once', () => {
    assert.deepEqual(getTaskResourceUsage({
        standaloneTasks: [{ id: 1 }],
        projects: [{ tasks: [{ id: 2 }, { id: 3 }] }],
        projectHistory: [{ tasks: [{ id: 4 }] }]
    }), { tasks: 4 });
    assert.deepEqual(getProjectResourceUsage({
        projects: [{ id: 1 }],
        projectHistory: [{ id: 2 }, { id: 3 }],
        templateRegistry: { templates: [{ id: 4 }] }
    }), { projects: 3, project_templates: 1 });
    assert.deepEqual(getFinanceResourceUsage({
        entries: [{ id: 1 }],
        expenses: [{ id: 2 }, { id: 3 }],
        recurringRules: [{ id: 4 }],
        tradingEvents: [{ id: 5 }]
    }), {
        finance_transactions: 3,
        finance_recurring_rules: 1,
        trading_events: 1
    });
    assert.deepEqual(getGymResourceUsage({
        routine: [{ id: 1 }, { id: 2 }],
        meals: { fixed: [{ id: 3 }] },
        generalMeals: [{ id: 4 }],
        supplements: {
            vit_d_history: [{ id: 5 }],
            painkillers_history: [{ id: 6 }, { id: 7 }]
        }
    }), {
        gym_routine_exercises: 2,
        gym_meal_templates: 2,
        gym_supplements: 3
    });
    assert.deepEqual(getVehicleResourceUsage([{ id: 1 }]), { vehicle_issues: 1 });
    assert.deepEqual(getBloodTestResourceUsage([
        { storagePath: 'user/first.pdf' },
        { fileData: 'data:application/pdf;base64,abc' },
        { pdfUrl: 'data:application/pdf;base64,def' },
        { portalUrl: 'https://example.com' }
    ]), { blood_test_files: 3 });
});

test('synchronized usage accepts the serialized localStorage representation', () => {
    const usage = getSynchronizedResourceUsage({
        tareas_list: JSON.stringify([{ id: 'task-1' }]),
        projectPulseData: JSON.stringify([{ id: 'p-1', tasks: [{ id: 'task-2' }] }]),
        projectPulseHistory: JSON.stringify([{ id: 'p-2', tasks: [] }]),
        projectPulseTemplates: JSON.stringify({ templates: [{ id: 'tpl-1' }] }),
        finanzasData: JSON.stringify({
            entries: [{ id: 'income-1' }],
            expenses: [{ id: 'expense-1' }],
            recurringRules: [{ id: 'rule-1' }],
            tradingEvents: [{ id: 'event-1' }]
        }),
        gym_routine: JSON.stringify([{ id: 'exercise-1' }]),
        gym_meals: JSON.stringify({ fixed: [{ id: 'meal-1' }] }),
        gym_general_meals: JSON.stringify([{ id: 'meal-2' }]),
        gym_supplements: JSON.stringify({ vit_d_history: [{ id: 'supplement-1' }] }),
        vehicle_issues: JSON.stringify([{ id: 'issue-1' }]),
        health_blood_tests: JSON.stringify([{ storagePath: 'user/result.pdf' }])
    });

    assert.equal(usage.tasks, 2);
    assert.equal(usage.projects, 2);
    assert.equal(usage.project_templates, 1);
    assert.equal(usage.finance_transactions, 2);
    assert.equal(usage.finance_recurring_rules, 1);
    assert.equal(usage.trading_events, 1);
    assert.equal(usage.gym_routine_exercises, 1);
    assert.equal(usage.gym_meal_templates, 2);
    assert.equal(usage.gym_supplements, 1);
    assert.equal(usage.vehicle_issues, 1);
    assert.equal(usage.blood_test_files, 1);
});

test('limit copy explains the blocked action and near-limit notices stay sparse', () => {
    assert.match(
        getResourceLimitMessage(RESOURCE_KEYS.PROJECTS, 500),
        /límite de proyectos: 500.*Eliminá un proyecto/i
    );
    assert.equal(getResourceCapacityNotice(
        RESOURCE_KEYS.TASKS,
        { allowed: true, limit: 5000, remaining: 11 }
    ), 'Te quedan 10 tareas antes del límite de esta cuenta.');
    assert.equal(getResourceCapacityNotice(
        RESOURCE_KEYS.TASKS,
        { allowed: true, limit: 5000, remaining: 53 }
    ), '');
    assert.equal(getResourceCapacityNotice(
        RESOURCE_KEYS.TASKS,
        { allowed: true, limit: null, remaining: null }
    ), '');
});
