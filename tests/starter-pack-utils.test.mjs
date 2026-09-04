import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyStarterPack,
    getStarterPresets,
    planStarterPackApplication
} from '../starter-pack-utils.mjs';
import { normalizeCustomTrackerRegistry } from '../custom-tracker-utils.mjs';

const NOW = new Date('2026-09-04T12:00:00.000Z');
const deterministicId = (preset, index) => `ct_starter_test_${index}_${preset.id.replace('starter_', '')}`;

test('starter presets are neutral valid tracker definitions without personal state', () => {
    const presets = getStarterPresets();
    assert.ok(presets.length >= 5);
    for (const preset of presets) {
        assert.ok(preset.id.startsWith('starter_'));
        assert.ok(preset.title);
        assert.ok(preset.tracker.name);
        assert.ok(preset.tracker.intervalDays > 0);
        assert.equal(preset.cost, undefined);
        assert.equal(preset.history, undefined);
        assert.equal(preset.lastDate, undefined);
    }

    const result = applyStarterPack({
        selectedPresetIds: presets.map(item => item.id),
        registry: normalizeCustomTrackerRegistry(),
        now: NOW,
        idFactory: deterministicId
    });
    assert.equal(result.created.length, presets.length);
    for (const { tracker } of result.created) {
        assert.deepEqual(result.registry.histories[tracker.id], []);
        assert.equal(tracker.createdAt, NOW.toISOString());
        assert.equal(tracker.alert.enabled, false);
    }
});

test('starter application deduplicates by section and normalized tracker name', () => {
    const first = applyStarterPack({
        selectedPresetIds: ['starter_haircut'],
        registry: normalizeCustomTrackerRegistry(),
        now: NOW,
        idFactory: deterministicId
    });
    const plan = planStarterPackApplication({
        selectedPresetIds: ['starter_haircut', 'starter_phone_cleaning'],
        registry: first.registry
    });
    assert.deepEqual(plan.planned.map(item => item.id), ['starter_phone_cleaning']);
    assert.deepEqual(plan.skipped.map(item => item.reason), ['duplicate']);
});

test('starter pack enforces quota atomically before creating anything', () => {
    const registry = normalizeCustomTrackerRegistry();
    assert.throws(() => applyStarterPack({
        selectedPresetIds: ['starter_haircut', 'starter_phone_cleaning'],
        registry,
        now: NOW,
        idFactory: deterministicId,
        availableSlots: 1
    }), /supera el límite disponible/);
    assert.equal(registry.trackers.length, 0);
});

test('empty starter selection is a no-op', () => {
    const registry = normalizeCustomTrackerRegistry();
    const result = applyStarterPack({ selectedPresetIds: [], registry, now: NOW });
    assert.equal(result.created.length, 0);
    assert.equal(result.registry.trackers.length, 0);
});
