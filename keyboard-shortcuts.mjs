export const KEYBOARD_SHORTCUT_GROUPS = Object.freeze({
    global: 'Acciones globales',
    palette: 'Buscador y acciones',
    forms: 'Formularios y edición',
    ordering: 'Orden de tarjetas'
});

export const KEYBOARD_SHORTCUTS = Object.freeze([
    Object.freeze({
        id: 'command-palette',
        group: 'global',
        label: 'Buscar o ejecutar una acción',
        description: 'Abre la búsqueda global desde cualquier módulo.',
        keys: Object.freeze(['Ctrl', 'K']),
        macKeys: Object.freeze(['⌘', 'K'])
    }),
    Object.freeze({
        id: 'quick-task',
        group: 'global',
        label: 'Crear una tarea rápida',
        description: 'Abre el formulario de tarea sin abandonar la pantalla actual.',
        keys: Object.freeze(['Alt', 'N'])
    }),
    Object.freeze({
        id: 'palette-next',
        group: 'palette',
        label: 'Recorrer resultados',
        description: 'Mueve la selección dentro de Ctrl+K.',
        keys: Object.freeze(['↑', '↓'])
    }),
    Object.freeze({
        id: 'palette-activate',
        group: 'palette',
        label: 'Abrir resultado o ejecutar acción',
        description: 'Activa el elemento seleccionado.',
        keys: Object.freeze(['Enter'])
    }),
    Object.freeze({
        id: 'close-layer',
        group: 'forms',
        label: 'Cerrar diálogo o buscador',
        description: 'Cancela la capa activa sin guardar cambios.',
        keys: Object.freeze(['Esc'])
    }),
    Object.freeze({
        id: 'save-form',
        group: 'forms',
        label: 'Guardar formulario activo',
        description: 'Disponible en formularios que admiten guardado rápido.',
        keys: Object.freeze(['Ctrl', 'Enter']),
        macKeys: Object.freeze(['⌘', 'Enter'])
    }),
    Object.freeze({
        id: 'inline-confirm',
        group: 'forms',
        label: 'Confirmar edición en línea',
        description: 'Guarda el texto que se está editando.',
        keys: Object.freeze(['Enter'])
    }),
    Object.freeze({
        id: 'inline-cancel',
        group: 'forms',
        label: 'Cancelar edición en línea',
        description: 'Restaura el valor anterior.',
        keys: Object.freeze(['Esc'])
    }),
    Object.freeze({
        id: 'reorder-item',
        group: 'ordering',
        label: 'Mover tarjeta con teclado',
        description: 'En modo Ordenar, mueve la tarjeta enfocada dentro de su categoría.',
        keys: Object.freeze(['↑', '↓'])
    })
]);

const SHORTCUTS_BY_ID = new Map(
    KEYBOARD_SHORTCUTS.map(shortcut => [shortcut.id, shortcut])
);

function normalizedKey(value) {
    const key = String(value || '').toLowerCase();
    if (key === 'escape') return 'esc';
    if (key === 'arrowup') return '↑';
    if (key === 'arrowdown') return '↓';
    return key;
}

export function matchesKeyboardShortcut(event, shortcutId) {
    const shortcut = SHORTCUTS_BY_ID.get(shortcutId);
    if (!shortcut || !event) return false;
    const keys = shortcut.keys.map(normalizedKey);
    const key = normalizedKey(event.key);
    const expectsCtrl = keys.includes('ctrl');
    const expectsMeta = Boolean(shortcut.macKeys?.includes('⌘'));
    const expectsAlt = keys.includes('alt');
    const expectsShift = keys.includes('shift');
    const primaryKeys = keys.filter(candidate => !['ctrl', 'alt', 'shift'].includes(candidate));

    if (expectsCtrl || expectsMeta) {
        if (!event.ctrlKey && !event.metaKey) return false;
    } else if (event.ctrlKey || event.metaKey) {
        return false;
    }
    if (Boolean(event.altKey) !== expectsAlt) return false;
    if (Boolean(event.shiftKey) !== expectsShift) return false;
    return primaryKeys.includes(key);
}

export function getShortcutDisplayKeys(shortcut, platform = globalThis.navigator?.platform || '') {
    const isMac = /mac/i.test(String(platform));
    return [...(isMac && shortcut.macKeys ? shortcut.macKeys : shortcut.keys)];
}
