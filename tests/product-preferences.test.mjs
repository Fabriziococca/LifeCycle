import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_TODAY_QUICK_ACTIONS,
    normalizeTodayPreferences,
    TODAY_QUICK_ACTIONS
} from '../product-preferences.mjs';

test('Today preferences start with the useful daily actions', () => {
    const preferences = normalizeTodayPreferences();

    assert.deepEqual(
        preferences.quickActions,
        [...DEFAULT_TODAY_QUICK_ACTIONS]
    );
    assert.equal(preferences.quickActions.includes('new_tracker'), false);
});

test('Today preferences preserve order, remove duplicates and ignore unknown actions', () => {
    const preferences = normalizeTodayPreferences({
        quickActions: [
            'open_gym',
            'add_expense',
            'open_gym',
            'unknown_action',
            'new_project'
        ]
    });

    assert.deepEqual(preferences.quickActions, [
        'open_gym',
        'add_expense',
        'new_project'
    ]);
});

test('strict Today preferences reject unsupported actions', () => {
    assert.throws(
        () => normalizeTodayPreferences({
            quickActions: ['new_project', 'unknown_action']
        }, { strict: true }),
        /no es compatible/
    );
});

test('all Today quick actions expose the data needed by the UI', () => {
    Object.values(TODAY_QUICK_ACTIONS).forEach(action => {
        assert.equal(typeof action.label, 'string');
        assert.equal(typeof action.description, 'string');
        assert.match(action.icon, /^ph-/);
    });
});
