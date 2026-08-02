import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getShortcutDisplayKeys,
    KEYBOARD_SHORTCUTS,
    matchesKeyboardShortcut
} from '../keyboard-shortcuts.mjs';

test('command palette accepts Ctrl+K and Cmd+K without matching modified variants', () => {
    assert.equal(matchesKeyboardShortcut({ key: 'k', ctrlKey: true }, 'command-palette'), true);
    assert.equal(matchesKeyboardShortcut({ key: 'K', metaKey: true }, 'command-palette'), true);
    assert.equal(
        matchesKeyboardShortcut({ key: 'k', ctrlKey: true, shiftKey: true }, 'command-palette'),
        false
    );
});

test('quick task requires exactly Alt+N', () => {
    assert.equal(matchesKeyboardShortcut({ key: 'n', altKey: true }, 'quick-task'), true);
    assert.equal(matchesKeyboardShortcut({ key: 'n' }, 'quick-task'), false);
    assert.equal(
        matchesKeyboardShortcut({ key: 'n', altKey: true, ctrlKey: true }, 'quick-task'),
        false
    );
});

test('shortcut reference uses the Mac-specific keycaps when appropriate', () => {
    const palette = KEYBOARD_SHORTCUTS.find(shortcut => shortcut.id === 'command-palette');
    assert.deepEqual(getShortcutDisplayKeys(palette, 'Win32'), ['Ctrl', 'K']);
    assert.deepEqual(getShortcutDisplayKeys(palette, 'MacIntel'), ['⌘', 'K']);
});
