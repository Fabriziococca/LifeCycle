export const CUSTOM_TRACKER_FIELD = '__custom_trackers_v1';
export const CUSTOM_TRACKER_SCHEMA_VERSION = 1;
export const CUSTOM_ALERT_PREFIX = 'custom_tracker:';

export const CUSTOM_TRACKER_SECTIONS = Object.freeze({
    hygiene: Object.freeze({
        label: 'Higiene',
        mainSectionId: 'higiene-section',
        alertCategory: 'higiene',
        defaultAction: 'Registrar limpieza',
        defaultIcon: 'ph-sparkle'
    }),
    grooming: Object.freeze({
        label: 'Cuidado',
        mainSectionId: 'cuidado-section',
        alertCategory: 'cuidado',
        defaultAction: 'Registrar cuidado',
        defaultIcon: 'ph-scissors'
    }),
    lenses: Object.freeze({
        label: 'Lentes',
        mainSectionId: 'lentes-section',
        alertCategory: 'lentes',
        defaultAction: 'Registrar cambio',
        defaultIcon: 'ph-eye'
    }),
    health: Object.freeze({
        label: 'Salud',
        mainSectionId: 'salud-section',
        alertCategory: 'salud',
        defaultAction: 'Registrar control',
        defaultIcon: 'ph-heartbeat'
    })
});

export const CUSTOM_TRACKER_ICONS = Object.freeze([
    'ph-sparkle',
    'ph-check-circle',
    'ph-drop',
    'ph-scissors',
    'ph-eye',
    'ph-heartbeat',
    'ph-tooth',
    'ph-first-aid',
    'ph-calendar-check',
    'ph-package'
]);

const SECTION_KEYS = new Set(Object.keys(CUSTOM_TRACKER_SECTIONS));
const ICON_KEYS = new Set(CUSTOM_TRACKER_ICONS);
const TRACKER_ID_PATTERN = /^ct_[a-z0-9_-]{6,64}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_TRACKERS = 200;
const MAX_HISTORY_ENTRIES = 100;

export class CustomTrackerValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CustomTrackerValidationError';
    }
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
    if (!condition) throw new CustomTrackerValidationError(message);
}

function normalizeText(value, { field, maxLength, required = false, strict }) {
    if (value === null || value === undefined) {
        if (required && strict) {
            throw new CustomTrackerValidationError(`Falta el campo "${field}".`);
        }
        return '';
    }
    if (typeof value !== 'string') {
        if (strict) {
            throw new CustomTrackerValidationError(`"${field}" debe ser texto.`);
        }
        return '';
    }

    const normalized = value.trim();
    if (required && !normalized) {
        throw new CustomTrackerValidationError(`"${field}" no puede estar vacío.`);
    }
    if (normalized.length > maxLength) {
        throw new CustomTrackerValidationError(
            `"${field}" supera el máximo de ${maxLength} caracteres.`
        );
    }
    return normalized;
}

function normalizePositiveInteger(value, { field, min, max, fallback, strict }) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        if (strict) {
            throw new CustomTrackerValidationError(
                `"${field}" debe ser un entero entre ${min} y ${max}.`
            );
        }
        return fallback;
    }
    return number;
}

function normalizeIsoTimestamp(value, { field, fallback = null, strict = false } = {}) {
    if (!value) return fallback;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
        if (strict) {
            throw new CustomTrackerValidationError(`"${field}" no es una fecha válida.`);
        }
        return fallback;
    }
    return new Date(timestamp).toISOString();
}

function normalizeTracker(rawTracker, { strict = false } = {}) {
    assert(isRecord(rawTracker), 'Cada tarjeta configurable debe ser un objeto.');

    const id = normalizeText(rawTracker.id, {
        field: 'id',
        maxLength: 67,
        required: true,
        strict
    });
    assert(TRACKER_ID_PATTERN.test(id), `El identificador "${id}" no es válido.`);

    const section = normalizeText(rawTracker.section, {
        field: 'section',
        maxLength: 20,
        required: true,
        strict
    });
    assert(SECTION_KEYS.has(section), `La sección "${section}" no es compatible.`);

    const name = normalizeText(rawTracker.name, {
        field: 'name',
        maxLength: 80,
        required: true,
        strict
    });
    const actionLabel = normalizeText(rawTracker.actionLabel, {
        field: 'actionLabel',
        maxLength: 60,
        required: true,
        strict
    });
    const instructions = normalizeText(rawTracker.instructions, {
        field: 'instructions',
        maxLength: 2000,
        strict
    });

    const intervalDays = normalizePositiveInteger(rawTracker.intervalDays, {
        field: 'intervalDays',
        min: 1,
        max: 3650,
        fallback: 30,
        strict
    });
    const order = normalizePositiveInteger(rawTracker.order, {
        field: 'order',
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
        fallback: 0,
        strict
    });

    const icon = typeof rawTracker.icon === 'string' && ICON_KEYS.has(rawTracker.icon)
        ? rawTracker.icon
        : CUSTOM_TRACKER_SECTIONS[section].defaultIcon;
    if (strict && rawTracker.icon !== undefined && !ICON_KEYS.has(rawTracker.icon)) {
        throw new CustomTrackerValidationError(`El icono de "${name}" no es válido.`);
    }

    const alertCandidate = isRecord(rawTracker.alert) ? rawTracker.alert : {};
    if (strict && rawTracker.alert !== undefined && !isRecord(rawTracker.alert)) {
        throw new CustomTrackerValidationError(`La alerta de "${name}" no es válida.`);
    }
    if (
        strict
        && alertCandidate.enabled !== undefined
        && typeof alertCandidate.enabled !== 'boolean'
    ) {
        throw new CustomTrackerValidationError(
            `La activación de la alerta de "${name}" no es válida.`
        );
    }
    if (
        strict
        && rawTracker.archived !== undefined
        && typeof rawTracker.archived !== 'boolean'
    ) {
        throw new CustomTrackerValidationError(
            `El estado de archivo de "${name}" no es válido.`
        );
    }
    const alertTime = typeof alertCandidate.time === 'string'
        && TIME_PATTERN.test(alertCandidate.time)
        ? alertCandidate.time
        : '23:00';
    if (
        strict
        && alertCandidate.time !== undefined
        && !TIME_PATTERN.test(alertCandidate.time)
    ) {
        throw new CustomTrackerValidationError(`La hora de alerta de "${name}" no es válida.`);
    }

    return {
        id,
        section,
        name,
        actionLabel,
        intervalDays,
        icon,
        instructions,
        archived: rawTracker.archived === true,
        order,
        createdAt: normalizeIsoTimestamp(rawTracker.createdAt, {
            field: 'createdAt',
            strict
        }),
        updatedAt: normalizeIsoTimestamp(rawTracker.updatedAt, {
            field: 'updatedAt',
            strict
        }),
        alert: {
            enabled: alertCandidate.enabled === true,
            time: alertTime
        }
    };
}

function normalizeHistory(history, { trackerId, strict = false } = {}) {
    if (!Array.isArray(history)) {
        if (strict) {
            throw new CustomTrackerValidationError(
                `El historial de "${trackerId}" debe ser una lista.`
            );
        }
        return [];
    }
    if (history.length > MAX_HISTORY_ENTRIES && strict) {
        throw new CustomTrackerValidationError(
            `El historial de "${trackerId}" supera ${MAX_HISTORY_ENTRIES} registros.`
        );
    }

    const normalized = [];
    for (const value of history.slice(0, MAX_HISTORY_ENTRIES)) {
        const date = normalizeIsoTimestamp(value, {
            field: `histories.${trackerId}`,
            strict
        });
        if (date && !normalized.includes(date)) normalized.push(date);
    }
    normalized.sort((a, b) => Date.parse(b) - Date.parse(a));
    return normalized;
}

export function createEmptyCustomTrackerRegistry() {
    return {
        version: CUSTOM_TRACKER_SCHEMA_VERSION,
        trackers: [],
        histories: {}
    };
}

export function normalizeCustomTrackerRegistry(value, { strict = false } = {}) {
    if (!isRecord(value)) {
        if (strict) {
            throw new CustomTrackerValidationError(
                'El registro de tarjetas configurables debe ser un objeto.'
            );
        }
        return createEmptyCustomTrackerRegistry();
    }
    if (
        strict
        && value.version !== CUSTOM_TRACKER_SCHEMA_VERSION
    ) {
        throw new CustomTrackerValidationError(
            `La versión de tarjetas configurables "${value.version}" no es compatible.`
        );
    }

    const trackerCandidates = Array.isArray(value.trackers) ? value.trackers : [];
    if (strict && !Array.isArray(value.trackers)) {
        throw new CustomTrackerValidationError('"trackers" debe ser una lista.');
    }
    if (strict && trackerCandidates.length > MAX_TRACKERS) {
        throw new CustomTrackerValidationError(
            `No se pueden importar más de ${MAX_TRACKERS} tarjetas configurables.`
        );
    }

    const trackers = [];
    const ids = new Set();
    for (const candidate of trackerCandidates.slice(0, MAX_TRACKERS)) {
        try {
            const tracker = normalizeTracker(candidate, { strict });
            if (ids.has(tracker.id)) {
                if (strict) {
                    throw new CustomTrackerValidationError(
                        `La tarjeta "${tracker.id}" está duplicada.`
                    );
                }
                continue;
            }
            ids.add(tracker.id);
            trackers.push(tracker);
        } catch (error) {
            if (strict) throw error;
        }
    }
    trackers.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));

    const rawHistories = isRecord(value.histories) ? value.histories : {};
    if (strict && !isRecord(value.histories)) {
        throw new CustomTrackerValidationError('"histories" debe ser un objeto.');
    }

    const histories = {};
    for (const tracker of trackers) {
        histories[tracker.id] = normalizeHistory(rawHistories[tracker.id] || [], {
            trackerId: tracker.id,
            strict
        });
    }
    if (strict) {
        Object.keys(rawHistories).forEach(trackerId => {
            assert(ids.has(trackerId), `El historial "${trackerId}" no pertenece a ninguna tarjeta.`);
        });
    }

    return {
        version: CUSTOM_TRACKER_SCHEMA_VERSION,
        trackers,
        histories
    };
}

export function validateCustomTrackerRegistry(value) {
    return normalizeCustomTrackerRegistry(value, { strict: true });
}

export function createCustomTracker(input, {
    id,
    now = new Date(),
    order = 0
} = {}) {
    const timestamp = now instanceof Date ? now : new Date(now);
    assert(!Number.isNaN(timestamp.getTime()), 'La fecha de creación no es válida.');

    return normalizeTracker({
        ...input,
        id,
        order,
        archived: false,
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString()
    }, { strict: true });
}

export function getCustomAlertKey(trackerId) {
    return `${CUSTOM_ALERT_PREFIX}${trackerId}`;
}

export function buildCustomAlertDefinitions(registryValue) {
    const registry = normalizeCustomTrackerRegistry(registryValue);
    return registry.trackers
        .filter(tracker => !tracker.archived)
        .map(tracker => ({
            key: getCustomAlertKey(tracker.id),
            name: tracker.name,
            category: CUSTOM_TRACKER_SECTIONS[tracker.section].alertCategory,
            type: 'interval',
            defaultTime: tracker.alert.time,
            defaultDays: []
        }));
}

function getCalendarDaysElapsedAt(dateValue, now = new Date()) {
    const start = new Date(dateValue);
    const reference = now instanceof Date ? new Date(now) : new Date(now);
    if (Number.isNaN(start.getTime()) || Number.isNaN(reference.getTime())) return null;

    start.setHours(0, 0, 0, 0);
    reference.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((reference - start) / 86_400_000));
}

export function getCustomTrackerState(tracker, history, now = new Date()) {
    const normalizedHistory = normalizeHistory(history, {
        trackerId: tracker?.id || 'desconocido'
    });
    const latest = normalizedHistory[0] || null;
    const elapsedDays = latest ? getCalendarDaysElapsedAt(latest, now) : null;
    const intervalDays = Math.max(1, Number(tracker?.intervalDays) || 1);
    const yellowAt = Math.max(1, Math.floor(intervalDays * 0.7));
    const orangeAt = Math.max(yellowAt, Math.floor(intervalDays * 0.85));

    let status = 'new';
    if (elapsedDays !== null) {
        if (elapsedDays >= intervalDays) status = 'red';
        else if (elapsedDays >= orangeAt) status = 'orange';
        else if (elapsedDays >= yellowAt) status = 'yellow';
        else status = 'green';
    }

    let nextDate = null;
    if (latest) {
        const date = new Date(latest);
        date.setDate(date.getDate() + intervalDays);
        nextDate = date.toISOString();
    }

    return {
        latest,
        elapsedDays,
        nextDate,
        status,
        progress: elapsedDays === null
            ? 0
            : Math.min(100, (elapsedDays / intervalDays) * 100)
    };
}
