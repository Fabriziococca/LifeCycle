import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getSearchScore,
    normalizeSearchText,
    searchLifeCycleItems
} from '../search-utils.mjs';

const ITEMS = [
    {
        id: 'tracker:1',
        title: 'Cepillo de Dientes',
        subtitle: 'Higiene · Cuidado personal',
        keywords: ['Registrar cambio']
    },
    {
        id: 'task:1',
        title: 'Comprar jabón blanco',
        subtitle: 'Personal · Pendiente',
        keywords: ['Urgente']
    },
    {
        id: 'project:1',
        title: 'José Pérez — Sitio médico',
        subtitle: 'Proyecto activo',
        keywords: ['Workana']
    }
];

test('normalizes accents, punctuation and repeated spaces', () => {
    assert.equal(
        normalizeSearchText('  José — MÉDICO / 2026 '),
        'jose medico 2026'
    );
});

test('finds items by title, subtitle and keyword without accent sensitivity', () => {
    assert.equal(searchLifeCycleItems(ITEMS, 'cepillo')[0].id, 'tracker:1');
    assert.equal(searchLifeCycleItems(ITEMS, 'higiene')[0].id, 'tracker:1');
    assert.equal(searchLifeCycleItems(ITEMS, 'medico')[0].id, 'project:1');
    assert.equal(searchLifeCycleItems(ITEMS, 'urgente')[0].id, 'task:1');
});

test('requires every query token but allows them across different fields', () => {
    assert.equal(
        searchLifeCycleItems(ITEMS, 'jose activo')[0].id,
        'project:1'
    );
    assert.deepEqual(searchLifeCycleItems(ITEMS, 'jose higiene'), []);
});

test('prioritizes exact and title matches before metadata matches', () => {
    const candidates = [
        { id: 'metadata', title: 'Otro', subtitle: 'Cepillo' },
        { id: 'prefix', title: 'Cepillo dental', subtitle: '' },
        { id: 'exact', title: 'Cepillo', subtitle: '' }
    ];
    assert.deepEqual(
        searchLifeCycleItems(candidates, 'cepillo').map(item => item.id),
        ['exact', 'prefix', 'metadata']
    );
    assert.ok(
        getSearchScore(candidates[2], 'cepillo')
        < getSearchScore(candidates[0], 'cepillo')
    );
});

test('returns no results for an empty query and respects the limit', () => {
    assert.deepEqual(searchLifeCycleItems(ITEMS, '   '), []);
    assert.equal(searchLifeCycleItems(ITEMS, 'a', { limit: 2 }).length, 2);
    assert.deepEqual(searchLifeCycleItems(ITEMS, 'a', { limit: 0 }), []);
});
