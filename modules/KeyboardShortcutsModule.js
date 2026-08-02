import {
    getShortcutDisplayKeys,
    KEYBOARD_SHORTCUT_GROUPS,
    KEYBOARD_SHORTCUTS
} from '../keyboard-shortcuts.mjs?v=20260801-shortcuts';

export class KeyboardShortcutsModule {
    constructor(appController) {
        this.app = appController;
        this.root = document.getElementById('keyboard-shortcuts-list');
        this.render();
    }

    render() {
        if (!this.root) return;
        this.root.innerHTML = '';

        Object.entries(KEYBOARD_SHORTCUT_GROUPS).forEach(([groupId, groupLabel]) => {
            const shortcuts = KEYBOARD_SHORTCUTS.filter(shortcut => shortcut.group === groupId);
            if (shortcuts.length === 0) return;

            const section = document.createElement('section');
            section.className = 'keyboard-shortcut-group';
            const heading = document.createElement('h4');
            heading.textContent = groupLabel;
            section.appendChild(heading);

            shortcuts.forEach(shortcut => {
                const row = document.createElement('div');
                row.className = 'keyboard-shortcut-row';
                const copy = document.createElement('div');
                copy.className = 'keyboard-shortcut-copy';
                const label = document.createElement('strong');
                label.textContent = shortcut.label;
                const description = document.createElement('span');
                description.textContent = shortcut.description;
                copy.append(label, description);

                const keys = document.createElement('div');
                keys.className = 'keyboard-shortcut-keys';
                keys.setAttribute('aria-label', getShortcutDisplayKeys(shortcut).join(' más '));
                getShortcutDisplayKeys(shortcut).forEach(key => {
                    const keycap = document.createElement('kbd');
                    keycap.textContent = key;
                    keys.appendChild(keycap);
                });
                row.append(copy, keys);
                section.appendChild(row);
            });
            this.root.appendChild(section);
        });
    }
}
