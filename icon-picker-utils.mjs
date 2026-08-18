function getOptionLabel(select, value, labels) {
    const option = [...select.options].find(candidate => candidate.value === value);
    return labels[value] || option?.textContent?.trim() || value;
}

function createIconNode(documentRef, icon) {
    const glyph = documentRef.createElement('i');
    glyph.className = `ph ${icon}`;
    glyph.setAttribute('aria-hidden', 'true');
    return glyph;
}

export function createIconPicker(select, {
    labels = {},
    catalogLabel = 'Ver todos los iconos'
} = {}) {
    if (!select || select.dataset.iconPickerReady === 'true') return null;

    const documentRef = select.ownerDocument;
    const shell = documentRef.createElement('div');
    shell.className = 'icon-picker-shell';
    shell.dataset.iconPicker = '';

    const current = documentRef.createElement('div');
    current.className = 'icon-picker-current';
    current.setAttribute('aria-live', 'polite');

    const currentGlyph = documentRef.createElement('span');
    currentGlyph.className = 'icon-picker-current-glyph';
    const currentCopy = documentRef.createElement('span');
    currentCopy.className = 'icon-picker-current-copy';
    const currentEyebrow = documentRef.createElement('small');
    currentEyebrow.textContent = 'VISTA PREVIA';
    const currentLabel = documentRef.createElement('strong');
    currentCopy.append(currentEyebrow, currentLabel);
    current.append(currentGlyph, currentCopy);

    const catalog = documentRef.createElement('details');
    catalog.className = 'icon-picker-catalog';
    const summary = documentRef.createElement('summary');
    summary.append(createIconNode(documentRef, 'ph-squares-four'));
    summary.append(` ${catalogLabel}`);

    const grid = documentRef.createElement('div');
    grid.className = 'icon-picker-grid';
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', 'Iconos disponibles');

    const help = documentRef.createElement('small');
    help.className = 'icon-picker-help';
    help.textContent = 'Pasá el cursor, usá Tab o tocá un icono para previsualizarlo.';

    const values = [];
    const seen = new Set();
    [...select.options].forEach(option => {
        if (!option.value || seen.has(option.value)) return;
        seen.add(option.value);
        values.push(option.value);
    });

    const choices = values.map(value => {
        const label = getOptionLabel(select, value, labels);
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'icon-picker-choice';
        button.dataset.iconValue = value;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.append(createIconNode(documentRef, value));
        const name = documentRef.createElement('span');
        name.textContent = label;
        button.append(name);
        grid.append(button);
        return button;
    });

    const preview = value => {
        const safeValue = values.includes(value) ? value : values[0];
        if (!safeValue) return;
        currentGlyph.replaceChildren(createIconNode(documentRef, safeValue));
        currentLabel.textContent = getOptionLabel(select, safeValue, labels);
    };

    const refresh = () => {
        const selected = values.includes(select.value) ? select.value : values[0];
        preview(selected);
        choices.forEach(button => {
            const active = button.dataset.iconValue === selected;
            button.classList.toggle('is-selected', active);
            button.setAttribute('aria-selected', String(active));
        });
    };

    choices.forEach(button => {
        const value = button.dataset.iconValue;
        button.addEventListener('pointerenter', () => preview(value));
        button.addEventListener('focus', () => preview(value));
        button.addEventListener('pointerleave', refresh);
        button.addEventListener('blur', () => {
            queueMicrotask(() => {
                if (!grid.contains(documentRef.activeElement)) refresh();
            });
        });
        button.addEventListener('click', () => {
            select.value = value;
            const EventConstructor = documentRef.defaultView?.Event || Event;
            select.dispatchEvent(new EventConstructor('input', { bubbles: true }));
            select.dispatchEvent(new EventConstructor('change', { bubbles: true }));
            refresh();
        });
    });

    select.addEventListener('input', refresh);
    select.addEventListener('change', refresh);
    catalog.addEventListener('toggle', () => {
        if (!catalog.open) refresh();
    });

    catalog.append(summary, grid, help);
    shell.append(current, catalog);
    select.insertAdjacentElement('afterend', shell);
    select.dataset.iconPickerReady = 'true';
    refresh();

    return {
        refresh,
        preview,
        element: shell
    };
}
