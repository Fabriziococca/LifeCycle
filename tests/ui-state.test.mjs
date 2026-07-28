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
            hygieneCategory: 'cuidado_personal'
        }),
        {
            section: 'projects-section',
            profileTab: 'backup',
            hygieneCategory: 'cuidado_personal'
        }
    );

    assert.deepEqual(
        normalizeUiState({
            section: 'unknown',
            profileTab: '__proto__',
            hygieneCategory: 'invalid'
        }),
        DEFAULT_UI_STATE
    );

    assert.equal(
        normalizeUiState({ profileTab: 'seguimientos' }).profileTab,
        'seguimientos'
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
        hygieneCategory: 'tecnologia'
    };

    const next = writeUiState(storage, current, { profileTab: 'alertas' });
    assert.deepEqual(next, {
        section: 'finanzas-section',
        profileTab: 'alertas',
        hygieneCategory: 'tecnologia'
    });
    assert.deepEqual(JSON.parse(storage.rawValue), next);
});
