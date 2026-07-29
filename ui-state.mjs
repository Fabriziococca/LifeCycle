export const UI_STATE_STORAGE_KEY = 'lifecycle_ui_state_v1';

export const DEFAULT_UI_STATE = Object.freeze({
    section: 'hoy-section',
    profileTab: 'cuenta',
    hygieneCategory: 'tecnologia'
});

const VALID_SECTIONS = new Set([
    'hoy-section',
    'higiene-section',
    'cuidado-section',
    'lentes-section',
    'salud-section',
    'vehiculo-section',
    'gym-section',
    'projects-section',
    'finanzas-section',
    'tareas-section'
]);

const VALID_PROFILE_TABS = new Set([
    'cuenta',
    'notificaciones',
    'instalacion',
    'backup',
    'seguimientos',
    'modulos',
    'alertas'
]);

const VALID_HYGIENE_CATEGORIES = new Set([
    'tecnologia',
    'dormitorio_bano',
    'cuidado_personal'
]);

export function normalizeUiState(value) {
    const candidate = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};

    return {
        section: VALID_SECTIONS.has(candidate.section)
            ? candidate.section
            : DEFAULT_UI_STATE.section,
        profileTab: VALID_PROFILE_TABS.has(candidate.profileTab)
            ? candidate.profileTab
            : DEFAULT_UI_STATE.profileTab,
        hygieneCategory: VALID_HYGIENE_CATEGORIES.has(candidate.hygieneCategory)
            ? candidate.hygieneCategory
            : DEFAULT_UI_STATE.hygieneCategory
    };
}

export function readUiState(storage) {
    try {
        const raw = storage?.getItem?.(UI_STATE_STORAGE_KEY);
        return normalizeUiState(raw ? JSON.parse(raw) : null);
    } catch {
        return { ...DEFAULT_UI_STATE };
    }
}

export function writeUiState(storage, currentState, patch) {
    const nextState = normalizeUiState({
        ...normalizeUiState(currentState),
        ...(patch && typeof patch === 'object' ? patch : {})
    });

    try {
        storage?.setItem?.(UI_STATE_STORAGE_KEY, JSON.stringify(nextState));
    } catch {
        // UI preferences are optional and must never block the application.
    }

    return nextState;
}
