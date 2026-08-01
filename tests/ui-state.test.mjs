import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_UI_STATE,
    normalizeUiState,
    readUiState,
    UI_STATE_STORAGE_KEY,
    writeUiState
} from '../ui-state.mjs';

class MemoryStorage {
    constructor(rawValue = null) {
        this.rawValue = rawValue;
    }

    getItem(key) {
        return key === UI_STATE_STORAGE_KEY ? this.rawValue : null;
    }

    setItem(key, value) {
        if (key === UI_STATE_STORAGE_KEY) this.rawValue = value;
    }
}

test('UI state accepts only known navigation values', () => {
    assert.deepEqual(
        normalizeUiState({
            section: 'projects-section',
            profileTab: 'backup',
            hygieneCategory: 'cuidado_personal',
            financeTab: 'expense',
            financeMonth: '2026-07',
            gymTab: 'sessions',
            vehicleTab: 'issues',
            tasksCategory: 'LifeCycle',
            tasksProjectId: '12345',
            alertsCategory: 'otros',
            trackerManagerFilter: 'grooming'
        }),
        {
            section: 'projects-section',
            profileTab: 'backup',
            hygieneCategory: 'cuidado_personal',
            financeTab: 'expense',
            financeMonth: '2026-07',
            gymTab: 'sessions',
            vehicleTab: 'issues',
            tasksCategory: 'LifeCycle',
            tasksProjectId: '12345',
            alertsCategory: 'otros',
            trackerManagerFilter: 'grooming'
        }
    );

    assert.deepEqual(
        normalizeUiState({
            section: 'unknown',
            profileTab: '__proto__',
            hygieneCategory: 'invalid',
            financeTab: 'balance',
            financeMonth: '2026-13',
            gymTab: 'unknown',
            vehicleTab: 'unknown',
            tasksCategory: '__proto__',
            tasksProjectId: '../../secret',
            alertsCategory: 'unknown'
        }),
        DEFAULT_UI_STATE
    );

    assert.equal(
        normalizeUiState({ profileTab: 'seguimientos' }).profileTab,
        'seguimientos'
    );
    assert.equal(
        normalizeUiState({ profileTab: 'modulos' }).profileTab,
        'modulos'
    );
    assert.equal(
        normalizeUiState({ section: 'hoy-section' }).section,
        'hoy-section'
    );
});

test('UI state survives malformed storage without blocking startup', () => {
    const storage = new MemoryStorage('{invalid');
    assert.deepEqual(readUiState(storage), DEFAULT_UI_STATE);
});

test('UI state updates one preference without losing the others', () => {
    const storage = new MemoryStorage();
    const current = {
        section: 'finanzas-section',
        profileTab: 'cuenta',
        hygieneCategory: 'tecnologia',
        financeTab: 'expense',
        financeMonth: '2026-06',
        gymTab: 'nutrition',
        vehicleTab: 'docs',
        tasksCategory: 'Personal',
        tasksProjectId: '',
        alertsCategory: 'salud',
        trackerManagerFilter: 'health'
    };

    const next = writeUiState(storage, current, { profileTab: 'alertas' });
    assert.deepEqual(next, {
        section: 'finanzas-section',
        profileTab: 'alertas',
        hygieneCategory: 'tecnologia',
        financeTab: 'expense',
        financeMonth: '2026-06',
        gymTab: 'nutrition',
        vehicleTab: 'docs',
        tasksCategory: 'Personal',
        tasksProjectId: '',
        alertsCategory: 'salud',
        trackerManagerFilter: 'health'
    });
    assert.deepEqual(JSON.parse(storage.rawValue), next);
});
