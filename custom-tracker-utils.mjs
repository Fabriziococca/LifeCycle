export const CUSTOM_TRACKER_FIELD = '__trackers_v2';
export const LEGACY_CUSTOM_TRACKER_FIELD = '__custom_trackers_v1';
export const CUSTOM_TRACKER_SCHEMA_VERSION = 2;
export const CUSTOM_ALERT_PREFIX = 'custom_tracker:';

export const CUSTOM_TRACKER_TEMPLATES = Object.freeze({
    routine: Object.freeze({
        label: 'Seguimiento por días',
        description: 'Limpiezas, cambios y tareas que vencen después de cierta cantidad de días.',
        cadenceUnit: 'days'
    }),
    grooming: Object.freeze({
        label: 'Cuidado personal',
        description: 'Cortes, afeitado, depilación y otros cuidados recurrentes.',
        cadenceUnit: 'days'
    }),
    consumable: Object.freeze({
        label: 'Insumo o reemplazo',
        description: 'Productos que se abren, cambian o reemplazan después de cierto tiempo.',
        cadenceUnit: 'days'
    }),
    medical: Object.freeze({
        label: 'Control médico',
        description: 'Consultas y controles cuya frecuencia se expresa en meses.',
        cadenceUnit: 'months'
    })
});

export const CUSTOM_TRACKER_SECTIONS = Object.freeze({
    hygiene: Object.freeze({
        label: 'Higiene',
        mainSectionId: 'higiene-section',
        alertCategory: 'higiene',
        defaultAction: 'Registrar limpieza',
        defaultIcon: 'ph-sparkle',
        defaultTemplate: 'routine',
        defaultSubsection: 'tecnologia',
        subsections: Object.freeze({
            tecnologia: Object.freeze({
                label: 'Tecnología',
                hostId: 'tracker-container'
            }),
            dormitorio_bano: Object.freeze({
                label: 'Dormitorio y baño',
                hostId: 'tracker-container'
            }),
            cuidado_personal: Object.freeze({
                label: 'Cuidado personal',
                hostId: 'tracker-container'
            })
        })
    }),
    grooming: Object.freeze({
        label: 'Cuidado',
        mainSectionId: 'cuidado-section',
        alertCategory: 'cuidado',
        defaultAction: 'Registrar cuidado',
        defaultIcon: 'ph-scissors',
        defaultTemplate: 'grooming',
        defaultSubsection: 'mantenimiento',
        subsections: Object.freeze({
            mantenimiento: Object.freeze({
                label: 'Mantenimiento corporal',
                hostId: 'cuidado-grid-section'
            }),
            herramientas: Object.freeze({
                label: 'Herramientas',
                hostId: 'cuidado-tools-section'
            })
        })
    }),
    lenses: Object.freeze({
        label: 'Lentes',
        mainSectionId: 'lentes-section',
        alertCategory: 'lentes',
        defaultAction: 'Registrar cambio',
        defaultIcon: 'ph-eye',
        defaultTemplate: 'consumable',
        defaultSubsection: 'insumos',
        subsections: Object.freeze({
            insumos: Object.freeze({
                label: 'Insumos y reemplazos',
                hostId: 'lenses-cards-container'
            })
        })
    }),
    health: Object.freeze({
        label: 'Salud',
        mainSectionId: 'salud-section',
        alertCategory: 'salud',
        defaultAction: 'Registrar control',
        defaultIcon: 'ph-heartbeat',
        defaultTemplate: 'medical',
        defaultSubsection: 'controles',
        subsections: Object.freeze({
            controles: Object.freeze({
                label: 'Controles médicos',
                hostId: 'salud-grid-section'
            })
        })
    })
});

export const APP_MODULES = Object.freeze({
    'higiene-section': Object.freeze({ label: 'Higiene', icon: 'ph-sparkle' }),
    'cuidado-section': Object.freeze({ label: 'Cuidado', icon: 'ph-scissors' }),
    'lentes-section': Object.freeze({ label: 'Lentes', icon: 'ph-eye' }),
    'salud-section': Object.freeze({ label: 'Salud', icon: 'ph-heartbeat' }),
    'vehiculo-section': Object.freeze({ label: 'Vehículo', icon: 'ph-car' }),
    'gym-section': Object.freeze({ label: 'Gimnasio', icon: 'ph-barbell' }),
    'projects-section': Object.freeze({ label: 'Proyectos', icon: 'ph-briefcase' }),
    'finanzas-section': Object.freeze({ label: 'Finanzas', icon: 'ph-wallet' }),
    'tareas-section': Object.freeze({ label: 'Tareas', icon: 'ph-check-square' })
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
    'ph-first-aid-kit',
    'ph-calendar-check',
    'ph-package',
    'ph-phone',
    'ph-mouse',
    'ph-headphones',
    'ph-paint-brush',
    'ph-hand-palm',
    'ph-bed',
    'ph-moon',
    'ph-laptop',
    'ph-wrench',
    'ph-archive',
    'ph-eyedropper',
    'ph-spray',
    'ph-spray-bottle',
    'ph-drop-half',
    'ph-user',
    'ph-user-focus',
    'ph-arrows-clockwise'
]);

const SECTION_KEYS = new Set(Object.keys(CUSTOM_TRACKER_SECTIONS));
const TEMPLATE_KEYS = new Set(Object.keys(CUSTOM_TRACKER_TEMPLATES));
const ICON_KEYS = new Set(CUSTOM_TRACKER_ICONS);
const MODULE_KEYS = new Set(Object.keys(APP_MODULES));
const TRACKER_ID_PATTERN = /^(?:ct|trk)_[a-z0-9_-]{3,96}$/;
const ALERT_KEY_PATTERN = /^[a-z0-9:_-]{3,120}$/;
const LEGACY_KEY_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_TRACKERS = 500;
const MAX_HISTORY_ENTRIES = 1000;

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

function normalizeText(value, { field, maxLength, required = false, strict = false }) {
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

function normalizeInteger(value, {
    field,
    min,
    max,
    fallback,
    strict = false
}) {
    if (value === undefined || value === null) return fallback;
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

function normalizeIsoTimestamp(value, {
    field,
    fallback = null,
    strict = false
} = {}) {
    if (!value) return fallback;

    let candidate = value;
    if (typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
        // Mediodía UTC conserva el día calendario en Argentina y evita el desfase
        // que produce interpretar una fecha sin hora como medianoche UTC.
        candidate = `${candidate}T12:00:00.000Z`;
    }

    const timestamp = Date.parse(candidate);
    if (!Number.isFinite(timestamp)) {
        if (strict) {
            throw new CustomTrackerValidationError(`"${field}" no es una fecha válida.`);
        }
        return fallback;
    }
    return new Date(timestamp).toISOString();
}

function normalizeCadence(rawTracker, template, { strict = false } = {}) {
    const cadenceCandidate = isRecord(rawTracker.cadence)
        ? rawTracker.cadence
        : {};
    const fallbackUnit = CUSTOM_TRACKER_TEMPLATES[template].cadenceUnit;
    const unit = cadenceCandidate.unit === 'months' || cadenceCandidate.unit === 'days'
        ? cadenceCandidate.unit
        : fallbackUnit;
    if (
        strict
        && cadenceCandidate.unit !== undefined
        && cadenceCandidate.unit !== 'days'
        && cadenceCandidate.unit !== 'months'
    ) {
        throw new CustomTrackerValidationError('"cadence.unit" no es compatible.');
    }

    const rawValue = cadenceCandidate.value
        ?? rawTracker.intervalMonths
        ?? rawTracker.intervalDays;
    const value = normalizeInteger(rawValue, {
        field: unit === 'months' ? 'intervalMonths' : 'intervalDays',
        min: 1,
        max: unit === 'months' ? 120 : 3650,
        fallback: unit === 'months' ? 6 : 30,
        strict
    });

    if (
        strict
        && rawTracker.intervalDays !== undefined
        && (
            !Number.isInteger(Number(rawTracker.intervalDays))
            || Number(rawTracker.intervalDays) < 1
            || Number(rawTracker.intervalDays) > 3650
        )
    ) {
        throw new CustomTrackerValidationError(
            '"intervalDays" debe ser un entero entre 1 y 3650.'
        );
    }

    return { unit, value };
}

function normalizeThresholds(rawThresholds, cadence, { strict = false } = {}) {
    const thresholdsCandidate = isRecord(rawThresholds) ? rawThresholds : {};
    if (strict && rawThresholds !== undefined && !isRecord(rawThresholds)) {
        throw new CustomTrackerValidationError('"thresholds" debe ser un objeto.');
    }

    if (cadence.unit === 'months') {
        return {
            warningDays: normalizeInteger(thresholdsCandidate.warningDays, {
                field: 'thresholds.warningDays',
                min: 1,
                max: 365,
                fallback: 30,
                strict
            })
        };
    }

    const red = normalizeInteger(thresholdsCandidate.red, {
        field: 'thresholds.red',
        min: 1,
        max: 3650,
        fallback: cadence.value,
        strict
    });
    const defaultYellow = Math.max(1, Math.floor(red * 0.7));
    const yellow = normalizeInteger(thresholdsCandidate.yellow, {
        field: 'thresholds.yellow',
        min: 1,
        max: red,
        fallback: defaultYellow,
        strict
    });
    const defaultOrange = Math.max(yellow, Math.floor(red * 0.85));
    const orange = normalizeInteger(thresholdsCandidate.orange, {
        field: 'thresholds.orange',
        min: yellow,
        max: red,
        fallback: defaultOrange,
        strict
    });

    return { yellow, orange, red };
}

function normalizeLegacySource(value, { strict = false } = {}) {
    if (!value) return null;
    if (!isRecord(value)) {
        if (strict) {
            throw new CustomTrackerValidationError('"legacySource" debe ser un objeto.');
        }
        return null;
    }

    const kind = ['hygiene', 'grooming', 'lens', 'health'].includes(value.kind)
        ? value.kind
        : '';
    const key = typeof value.key === 'string' && LEGACY_KEY_PATTERN.test(value.key)
        ? value.key
        : '';
    const mode = ['single', 'history', 'medical'].includes(value.mode)
        ? value.mode
        : 'history';
    if (!kind || !key) {
        if (strict) {
            throw new CustomTrackerValidationError(
                'La referencia al dato anterior no es válida.'
            );
        }
        return null;
    }
    return { kind, key, mode };
}

function normalizeBehavior(value, { strict = false } = {}) {
    if (!value) return {};
    if (!isRecord(value)) {
        if (strict) {
            throw new CustomTrackerValidationError('"behavior" debe ser un objeto.');
        }
        return {};
    }

    const result = {};
    if (value.prediction === 'beard') result.prediction = 'beard';
    if (value.stockKey === 'lensStock') result.stockKey = 'lensStock';
    if (value.decrementStock === true) result.decrementStock = true;
    return result;
}

function normalizeMigrationMeta(value) {
    if (!isRecord(value)) return null;
    const migratedAt = normalizeIsoTimestamp(value.migratedAt, {
        field: 'migration.migratedAt'
    });
    const sourceVersion = normalizeInteger(value.sourceVersion, {
        field: 'migration.sourceVersion',
        min: 0,
        max: 10,
        fallback: 0
    });
    const migratedTrackerCount = normalizeInteger(value.migratedTrackerCount, {
        field: 'migration.migratedTrackerCount',
        min: 0,
        max: MAX_TRACKERS,
        fallback: 0
    });
    return {
        migratedAt,
        sourceVersion,
        migratedTrackerCount
    };
}

function normalizeTracker(rawTracker, { strict = false } = {}) {
    assert(isRecord(rawTracker), 'Cada tarjeta configurable debe ser un objeto.');

    const id = normalizeText(rawTracker.id, {
        field: 'id',
        maxLength: 100,
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
    const sectionConfig = CUSTOM_TRACKER_SECTIONS[section];

    const subsectionKeys = new Set(Object.keys(sectionConfig.subsections));
    const subsectionCandidate = typeof rawTracker.subsection === 'string'
        ? rawTracker.subsection.trim()
        : '';
    const subsection = subsectionKeys.has(subsectionCandidate)
        ? subsectionCandidate
        : sectionConfig.defaultSubsection;
    if (
        strict
        && rawTracker.subsection !== undefined
        && !subsectionKeys.has(subsectionCandidate)
    ) {
        throw new CustomTrackerValidationError(
            `La ubicación "${subsectionCandidate}" no pertenece a la sección "${section}".`
        );
    }

    const templateCandidate = typeof rawTracker.template === 'string'
        ? rawTracker.template.trim()
        : sectionConfig.defaultTemplate;
    const template = TEMPLATE_KEYS.has(templateCandidate)
        ? templateCandidate
        : sectionConfig.defaultTemplate;
    if (
        strict
        && rawTracker.template !== undefined
        && !TEMPLATE_KEYS.has(templateCandidate)
    ) {
        throw new CustomTrackerValidationError(
            `El tipo de tarjeta "${templateCandidate}" no es compatible.`
        );
    }

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
        maxLength: 5000,
        strict
    });
    const cadence = normalizeCadence(rawTracker, template, { strict });
    const thresholds = normalizeThresholds(rawTracker.thresholds, cadence, { strict });
    const intervalDays = cadence.unit === 'days'
        ? thresholds.red
        : Math.max(1, Math.round(cadence.value * 30.5));
    const order = normalizeInteger(rawTracker.order, {
        field: 'order',
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
        fallback: 0,
        strict
    });

    const icon = typeof rawTracker.icon === 'string' && ICON_KEYS.has(rawTracker.icon)
        ? rawTracker.icon
        : sectionConfig.defaultIcon;
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
    if (
        strict
        && rawTracker.deleted !== undefined
        && typeof rawTracker.deleted !== 'boolean'
    ) {
        throw new CustomTrackerValidationError(
            `El estado de borrado de "${name}" no es válido.`
        );
    }
    const deleted = rawTracker.deleted === true;
    if (strict && deleted && rawTracker.archived !== true) {
        throw new CustomTrackerValidationError(
            `La tarjeta borrada "${name}" también debe estar archivada.`
        );
    }
    const deletedAt = normalizeIsoTimestamp(rawTracker.deletedAt, {
        field: 'deletedAt',
        strict
    });
    if (strict && deleted && !deletedAt) {
        throw new CustomTrackerValidationError(
            `La tarjeta borrada "${name}" no tiene fecha de borrado.`
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

    const defaultAlertKey = `${CUSTOM_ALERT_PREFIX}${id}`;
    const alertKey = typeof rawTracker.alertKey === 'string'
        && ALERT_KEY_PATTERN.test(rawTracker.alertKey)
        ? rawTracker.alertKey
        : defaultAlertKey;
    if (
        strict
        && rawTracker.alertKey !== undefined
        && !ALERT_KEY_PATTERN.test(rawTracker.alertKey)
    ) {
        throw new CustomTrackerValidationError(`La clave de alerta de "${name}" no es válida.`);
    }

    const groupCandidate = isRecord(rawTracker.group) ? rawTracker.group : {};
    const groupId = normalizeText(groupCandidate.id, {
        field: 'group.id',
        maxLength: 80
    });
    const group = groupId
        ? {
            id: groupId,
            name: normalizeText(groupCandidate.name, {
                field: 'group.name',
                maxLength: 80
            }),
            icon: typeof groupCandidate.icon === 'string' && ICON_KEYS.has(groupCandidate.icon)
                ? groupCandidate.icon
                : icon
        }
        : null;

    return {
        id,
        section,
        subsection,
        template,
        name,
        actionLabel,
        cadence,
        intervalDays,
        thresholds,
        icon,
        instructions,
        group,
        behavior: normalizeBehavior(rawTracker.behavior, { strict }),
        legacySource: normalizeLegacySource(rawTracker.legacySource, { strict }),
        alertKey,
        archived: deleted || rawTracker.archived === true,
        deleted,
        deletedAt,
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
            enabled: !deleted && alertCandidate.enabled === true,
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

export function createDefaultModulePreferences() {
    return Object.fromEntries(
        Object.keys(APP_MODULES).map(moduleId => [moduleId, { visible: true }])
    );
}

function normalizeModulePreferences(value, { strict = false } = {}) {
    if (strict && value !== undefined && !isRecord(value)) {
        throw new CustomTrackerValidationError(
            '"modulePreferences" debe ser un objeto.'
        );
    }
    const candidate = isRecord(value) ? value : {};
    const result = createDefaultModulePreferences();

    Object.entries(candidate).forEach(([moduleId, preference]) => {
        if (!MODULE_KEYS.has(moduleId)) {
            if (strict) {
                throw new CustomTrackerValidationError(
                    `El módulo "${moduleId}" no es compatible.`
                );
            }
            return;
        }
        if (strict && !isRecord(preference)) {
            throw new CustomTrackerValidationError(
                `La preferencia de "${moduleId}" debe ser un objeto.`
            );
        }
        result[moduleId] = {
            visible: preference?.visible !== false
        };
    });
    return result;
}

export function createEmptyCustomTrackerRegistry() {
    return {
        version: CUSTOM_TRACKER_SCHEMA_VERSION,
        trackers: [],
        histories: {},
        modulePreferences: createDefaultModulePreferences(),
        migration: null
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
    if (strict && value.version !== CUSTOM_TRACKER_SCHEMA_VERSION) {
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
    const alertKeys = new Set();
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
            if (alertKeys.has(tracker.alertKey)) {
                if (strict) {
                    throw new CustomTrackerValidationError(
                        `La alerta "${tracker.alertKey}" está duplicada.`
                    );
                }
                tracker.alertKey = `${CUSTOM_ALERT_PREFIX}${tracker.id}`;
            }
            ids.add(tracker.id);
            alertKeys.add(tracker.alertKey);
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
        const normalizedHistory = normalizeHistory(rawHistories[tracker.id] || [], {
            trackerId: tracker.id,
            strict
        });
        if (strict && tracker.deleted && normalizedHistory.length > 0) {
            throw new CustomTrackerValidationError(
                `La tarjeta borrada "${tracker.name}" no puede conservar historial.`
            );
        }
        histories[tracker.id] = tracker.deleted ? [] : normalizedHistory;
    }
    if (strict) {
        Object.keys(rawHistories).forEach(trackerId => {
            assert(ids.has(trackerId), `El historial "${trackerId}" no pertenece a ninguna tarjeta.`);
        });
    }

    return {
        version: CUSTOM_TRACKER_SCHEMA_VERSION,
        trackers,
        histories,
        modulePreferences: normalizeModulePreferences(value.modulePreferences, { strict }),
        migration: normalizeMigrationMeta(value.migration)
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
        deleted: false,
        deletedAt: null,
        createdAt: input?.createdAt || timestamp.toISOString(),
        updatedAt: timestamp.toISOString()
    }, { strict: true });
}

export function getCustomAlertKey(trackerOrId) {
    if (
        trackerOrId
        && typeof trackerOrId === 'object'
        && typeof trackerOrId.alertKey === 'string'
        && ALERT_KEY_PATTERN.test(trackerOrId.alertKey)
    ) {
        return trackerOrId.alertKey;
    }
    const trackerId = typeof trackerOrId === 'string' ? trackerOrId : '';
    return `${CUSTOM_ALERT_PREFIX}${trackerId}`;
}

export function buildCustomAlertDefinitions(registryValue) {
    const registry = normalizeCustomTrackerRegistry(registryValue);
    return registry.trackers
        .filter(tracker => !tracker.archived && !tracker.deleted)
        .map(tracker => ({
            key: getCustomAlertKey(tracker),
            name: tracker.name,
            category: CUSTOM_TRACKER_SECTIONS[tracker.section].alertCategory,
            type: 'interval',
            defaultEnabled: tracker.alert.enabled === true,
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

function getCalendarDaysUntilAt(dateValue, now = new Date()) {
    const target = new Date(dateValue);
    const reference = now instanceof Date ? new Date(now) : new Date(now);
    if (Number.isNaN(target.getTime()) || Number.isNaN(reference.getTime())) return null;

    target.setHours(0, 0, 0, 0);
    reference.setHours(0, 0, 0, 0);
    return Math.ceil((target - reference) / 86_400_000);
}

export function getCustomTrackerState(tracker, history, now = new Date()) {
    const normalizedHistory = normalizeHistory(history, {
        trackerId: tracker?.id || 'desconocido'
    });
    const latest = normalizedHistory[0] || null;
    const elapsedDays = latest ? getCalendarDaysElapsedAt(latest, now) : null;
    const cadence = tracker?.cadence?.unit === 'months'
        ? {
            unit: 'months',
            value: Math.max(1, Number(tracker?.cadence?.value) || 1)
        }
        : {
            unit: 'days',
            value: Math.max(1, Number(tracker?.cadence?.value || tracker?.intervalDays) || 1)
        };

    let nextDate = null;
    let status = 'new';
    let progress = 0;
    let dueValue = cadence.value;
    let dueUnit = cadence.unit;
    let remainingDays = null;

    if (latest) {
        const date = new Date(latest);
        if (cadence.unit === 'months') {
            date.setMonth(date.getMonth() + cadence.value);
            nextDate = date.toISOString();
            remainingDays = getCalendarDaysUntilAt(nextDate, now);
            const warningDays = Math.max(1, Number(tracker?.thresholds?.warningDays) || 30);
            if (remainingDays <= 0) status = 'red';
            else if (remainingDays <= warningDays) status = 'orange';
            else if (remainingDays <= warningDays * 2) status = 'yellow';
            else status = 'green';

            const totalDays = Math.max(
                1,
                Math.round((Date.parse(nextDate) - Date.parse(latest)) / 86_400_000)
            );
            progress = elapsedDays === null
                ? 0
                : Math.min(100, (elapsedDays / totalDays) * 100);
        } else {
            const red = Math.max(
                1,
                Number(tracker?.thresholds?.red || tracker?.intervalDays || cadence.value) || 1
            );
            const yellow = Math.max(
                1,
                Number(tracker?.thresholds?.yellow) || Math.floor(red * 0.7)
            );
            const orange = Math.max(
                yellow,
                Number(tracker?.thresholds?.orange) || Math.floor(red * 0.85)
            );
            date.setDate(date.getDate() + red);
            nextDate = date.toISOString();
            dueValue = red;
            dueUnit = 'days';
            remainingDays = red - elapsedDays;

            if (elapsedDays >= red) status = 'red';
            else if (elapsedDays >= orange) status = 'orange';
            else if (elapsedDays >= yellow) status = 'yellow';
            else status = 'green';
            progress = Math.min(100, (elapsedDays / red) * 100);
        }
    }

    return {
        latest,
        elapsedDays,
        nextDate,
        status,
        progress,
        cadence,
        dueValue,
        dueUnit,
        remainingDays
    };
}
