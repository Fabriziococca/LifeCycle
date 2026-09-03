import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getStarterPresets,
    buildStarterItemsToApply,
    STARTER_PACK_PRESETS
} from '../starter-pack-utils.mjs';

test('Tanda 26: starter presets provide neutral templates with zero personal data', () => {
    const presets = getStarterPresets();
    assert.ok(presets.length >= 5);

    for (const p of presets) {
        assert.ok(p.id);
        assert.ok(p.title);
        assert.ok(p.periodDays > 0);
        assert.ok(p.category);
        // Asegurar que no contenga importes ni fechas reales
        assert.equal(p.cost, undefined);
        assert.equal(p.history, undefined);
        assert.equal(p.lastDate, undefined);
    }
});

test('Tanda 26: buildStarterItemsToApply builds clean items with empty history and deduplicates', () => {
    const selected = ['starter_cepillo', 'starter_pelo', 'starter_aceite_auto'];
    const existing = [
        { title: 'Corte de cabello' } // Ya existe uno con mismo nombre
    ];

    const items = buildStarterItemsToApply({
        selectedPresetIds: selected,
        existingItems: existing
    });

    // Debería omitir 'Corte de cabello' y solo crear los otros 2
    assert.equal(items.length, 2);
    assert.equal(items[0].title, 'Recambio de cepillo dental');
    assert.deepEqual(items[0].history, []);
    assert.equal(items[1].title, 'Cambio de aceite y filtro');
    assert.deepEqual(items[1].history, []);
});

test('Tanda 26: empty selection produces empty array safely', () => {
    const items = buildStarterItemsToApply({ selectedPresetIds: [] });
    assert.deepEqual(items, []);
});