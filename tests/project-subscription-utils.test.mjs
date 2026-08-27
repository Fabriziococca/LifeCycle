import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeProjectSubscription } from '../project-subscription-utils.mjs';

test('fresh accounts do not inherit a fabricated platform subscription', () => {
    assert.equal(normalizeProjectSubscription(null), null);
    assert.equal(normalizeProjectSubscription('null'), null);
    assert.equal(normalizeProjectSubscription('{broken'), null);
});

test('valid saved subscriptions keep their user-defined values', () => {
    assert.deepEqual(normalizeProjectSubscription({
        plan: 'Explorer',
        cost: '37.18',
        cycle: '3',
        startDate: '2026-08-26'
    }), {
        plan: 'Explorer',
        cost: 37.18,
        cycle: 3,
        startDate: '2026-08-26'
    });
});

test('invalid subscription fields fail closed instead of producing alerts', () => {
    assert.equal(normalizeProjectSubscription({ plan: '', cost: 10, cycle: 3, startDate: '2026-08-26' }), null);
    assert.equal(normalizeProjectSubscription({ plan: 'Pro', cost: -1, cycle: 3, startDate: '2026-08-26' }), null);
    assert.equal(normalizeProjectSubscription({ plan: 'Pro', cost: 10, cycle: 0, startDate: '2026-08-26' }), null);
    assert.equal(normalizeProjectSubscription({ plan: 'Pro', cost: 10, cycle: 3, startDate: '26/08/2026' }), null);
});
