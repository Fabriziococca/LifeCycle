export const UI_STATE_STORAGE_KEY = 'lifecycle_ui_state_v1';

export const DEFAULT_UI_STATE = Object.freeze({
    section: 'hoy-section',
    profileTab: 'cuenta',
    hygieneCategory: 'tecnologia',
    financeTab: 'income',
    financeMonth: '',
    gymTab: 'records',
    vehicleTab: 'maint',
    tasksCategory: '',
    tasksProjectId: '',
    alertsCategory: 'higiene',
    trackerManagerFilter: 'all'
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

const VALID_FINANCE_TABS = new Set(['income', 'expense']);
const VALID_GYM_TABS = new Set([
    'records',
    'routine',
    'sessions',
    'nutrition',
    'general-meals'
]);
const VALID_VEHICLE_TABS = new Set(['maint', 'docs', 'issues']);
const VALID_ALERT_CATEGORIES = new Set([
    'higiene',
    'cuidado',
    'lentes',
    'salud',
    'vehiculo',
    'gym',
    'otros'
]);
const VALID_TRACKER_MANAGER_FILTERS = new Set([
    'all',
    'hygiene',
    'grooming',
    'lenses',
    'health'
]);
const UNSAFE_DYNAMIC_VALUES = new Set(['__proto__', 'prototype', 'constructor']);

function normalizeFinanceMonth(value) {
    const month = typeof value === 'string' ? value.trim() : '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return '';
    return month;
}

function normalizeTaskCategory(value) {
    const category = typeof value === 'string' ? value.trim() : '';
    if (
        !category
        || category.length > 120
        || UNSAFE_DYNAMIC_VALUES.has(category.toLowerCase())
    ) {
        return '';
    }
    return category;
}

function normalizeTaskProjectId(value) {
    const id = typeof value === 'number'
        ? String(value)
        : (typeof value === 'string' ? value.trim() : '');
    return /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : '';
}

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
            : DEFAULT_UI_STATE.hygieneCategory,
        financeTab: VALID_FINANCE_TABS.has(candidate.financeTab)
            ? candidate.financeTab
            : DEFAULT_UI_STATE.financeTab,
        financeMonth: normalizeFinanceMonth(candidate.financeMonth),
        gymTab: VALID_GYM_TABS.has(candidate.gymTab)
            ? candidate.gymTab
            : DEFAULT_UI_STATE.gymTab,
        vehicleTab: VALID_VEHICLE_TABS.has(candidate.vehicleTab)
            ? candidate.vehicleTab
            : DEFAULT_UI_STATE.vehicleTab,
        tasksCategory: normalizeTaskCategory(candidate.tasksCategory),
        tasksProjectId: normalizeTaskProjectId(candidate.tasksProjectId),
        alertsCategory: VALID_ALERT_CATEGORIES.has(candidate.alertsCategory)
            ? candidate.alertsCategory
            : DEFAULT_UI_STATE.alertsCategory,
        trackerManagerFilter: VALID_TRACKER_MANAGER_FILTERS.has(
            candidate.trackerManagerFilter
        )
            ? candidate.trackerManagerFilter
            : DEFAULT_UI_STATE.trackerManagerFilter
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
