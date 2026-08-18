import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeTheme,
    SUPPORTED_THEMES,
    THEME_STORAGE_KEY
} from '../modules/ThemeModule.js';

test('theme preferences are deliberately local and fall back to dark', () => {
    assert.equal(THEME_STORAGE_KEY, 'lifecycle_theme_preference');
    assert.deepEqual(SUPPORTED_THEMES, ['dark', 'light']);
    assert.equal(normalizeTheme('light'), 'light');
    assert.equal(normalizeTheme('dark'), 'dark');
    assert.equal(normalizeTheme('system'), 'dark');
    assert.equal(normalizeTheme(null), 'dark');
});
