import {
    createDefaultTodayPreferences,
    normalizeTodayPreferences
} from './product-preferences.mjs';

export const CUSTOM_TRACKER_FIELD = '__trackers_v2';
export const LEGACY_CUSTOM_TRACKER_FIELD = '__custom_trackers_v1';
export const CUSTOM_TRACKER_SCHEMA_VERSION = 3;
export const CUSTOM_ALERT_PREFIX = 'custom_tracker:';
export const DEFAULT_ROBOT_TRACKER_ID = 'trk_hygiene_robot_cleaner';
export const DEFAULT_BLOOD_STUDY_TRACKER_ID = 'trk_health_blood_analysis';
export const MAX_CUSTOM_MODULES = 30;

export const CUSTOM_MODULE_COLORS = Object.freeze({
    blue: '#3b82f6',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    green: '#22c55e',
    amber: '#f59e0b',
    orange: '#f97316',
    rose: '#f43f5e',
    violet: '#8b5cf6'
});

export const CUSTOM_MODULE_ICONS = Object.freeze([
    'ph-paw-print',
    'ph-plant',
    'ph-house',
    'ph-book-open',
    'ph-briefcase',
    'ph-calendar-check',
    'ph-heart',
    'ph-star',
    'ph-package',
    'ph-airplane-tilt',
    'ph-game-controller',
    'ph-music-notes',
    'ph-camera',
    'ph-bicycle',
    'ph-check-circle',
    'ph-sparkle'
]);

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
    }),
    'medical-study': Object.freeze({
        label: 'Estudio médico con archivos',
        description: 'Estudios periódicos que permiten guardar un archivo y un enlace por registro.',
        cadenceUnit: 'days'
    }),
    'state-reminder': Object.freeze({
        label: 'Aviso hasta resolver',
        description: 'Activa avisos repetitivos al marcar algo como pendiente y los detiene al resolverlo.',
        cadenceUnit: 'days'
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
    'hoy-section': Object.freeze({ label: 'Hoy', icon: 'ph-house-line' }),
    'higiene-section': Object.freeze({ label: 'Higiene', icon: 'ph-sparkle' }),
    'cuidado-section': Object.freeze({ label: 'Cuidado', icon: 'ph-scissors' }),
    'lentes-section': Object.freeze({ label: 'Lentes', icon: 'ph-eye' }),
    'salud-section': Object.freeze({ label: 'Salud', icon: 'ph-heartbeat' }),
    'vehiculo-section': Object.freeze({ label: 'Vehículo', icon: 'ph-car' }),
    'gym-section': Object.freeze({ label: 'Gimnasio', icon: 'ph-barbell' }),
    'projects-section': Object.freeze({ label: 'Proyectos', icon: 'ph-briefcase' }),
    'finanzas-section': Object.freeze({ label: 'Finanzas', icon: 'ph-wallet' }),
    'trading-section': Object.freeze({ label: 'Trading', icon: 'ph-chart-line-up' }),
    'tareas-section': Object.freeze({ label: 'Tareas', icon: 'ph-check-square' })
});

export function getCustomModuleSectionId(moduleId) {
    return `${moduleId}-section`;
}

export function getCustomModuleHostId(moduleId) {
    return `${moduleId}-trackers`;
}

export function getCustomTrackerSections(customModules = []) {
    const sections = { ...CUSTOM_TRACKER_SECTIONS };
    customModules.forEach(module => {
        if (!module) return;
        sections[module.id] = Object.freeze({
            label: module.name,
            mainSectionId: getCustomModuleSectionId(module.id),
            alertCategory: 'otros',
            defaultAction: 'Registrar',
            defaultIcon: module.icon,
            defaultTemplate: 'routine',
            defaultSubsection: 'general',
            customModule: true,
            archived: module.archived === true,
            color: CUSTOM_MODULE_COLORS[module.color] || CUSTOM_MODULE_COLORS.blue,
            subsections: Object.freeze({
                general: Object.freeze({
                    label: 'Tarjetas',
                    hostId: getCustomModuleHostId(module.id)
                })
            })
        });
    });
    return sections;
}

export function getAppModules(customModules = [], { includeArchived = false } = {}) {
    const modules = { ...APP_MODULES };
    customModules.forEach(module => {
        if (!module || (!includeArchived && module.archived === true)) return;
        const sectionId = getCustomModuleSectionId(module.id);
        modules[sectionId] = Object.freeze({
            label: module.name,
            icon: module.icon,
            color: CUSTOM_MODULE_COLORS[module.color] || CUSTOM_MODULE_COLORS.blue,
            custom: true,
            customModuleId: module.id,
            order: module.order
        });
    });
    return modules;
}

export const DEFAULT_NAVIGATION_FAVORITES = Object.freeze([
    'hoy-section',
    'projects-section',
    'tareas-section',
    'finanzas-section'
]);

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
    'ph-arrows-clockwise',
    'ph-robot',
    'ph-test-tube',
    ...CUSTOM_MODULE_ICONS
]);

const TEMPLATE_KEYS = new Set(Object.keys(CUSTOM_TRACKER_TEMPLATES));
const ICON_KEYS = new Set(CUSTOM_TRACKER_ICONS);
const TRACKER_ID_PATTERN = /^(?:ct|trk)_[a-z0-9_-]{3,96}$/;
const CUSTOM_MODULE_ID_PATTERN = /^cm_[a-z0-9_-]{3,64}$/;
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

export function isSupportedCustomTrackerSchemaVersion(version) {
    return (
        Number.isInteger(version)
        && version >= 2
        && version <= CUSTOM_TRACKER_SCHEMA_VERSION
    );
}

export function isUnifiedCustomTrackerRegistry(value) {
    return (
        isRecord(value)
        && isSupportedCustomTrackerSchemaVersion(value.version)
        && Array.isArray(value.trackers)
        && isRecord(value.histories)
    );
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

export function normalizeCustomModules(value, { strict = false } = {}) {
    if (!Array.isArray(value)) {
        if (strict && value !== undefined) {
            throw new CustomTrackerValidationError('"customModules" debe ser una lista.');
        }
        return [];
    }
    if (strict && value.length > MAX_CUSTOM_MODULES) {
        throw new CustomTrackerValidationError(
            `No se pueden importar más de ${MAX_CUSTOM_MODULES} módulos personalizados.`
        );
    }

    const modules = [];
    const ids = new Set();
    for (const candidate of value.slice(0, MAX_CUSTOM_MODULES)) {
        try {
            assert(isRecord(candidate), 'Cada módulo personalizado debe ser un objeto.');
            const id = normalizeText(candidate.id, {
                field: 'customModules.id',
                maxLength: 70,
                required: true,
                strict
            });
            assert(CUSTOM_MODULE_ID_PATTERN.test(id), `El identificador de módulo "${id}" no es válido.`);
            if (ids.has(id)) {
                throw new CustomTrackerValidationError(`El módulo "${id}" está duplicado.`);
            }
            const name = normalizeText(candidate.name, {
                field: 'customModules.name',
                maxLength: 48,
                required: true,
                strict
            });
            const description = normalizeText(candidate.description, {
                field: 'customModules.description',
                maxLength: 180,
                strict
            });
            const icon = typeof candidate.icon === 'string'
                && CUSTOM_MODULE_ICONS.includes(candidate.icon)
                ? candidate.icon
                : CUSTOM_MODULE_ICONS[0];
            if (strict && candidate.icon !== undefined && !CUSTOM_MODULE_ICONS.includes(candidate.icon)) {
                throw new CustomTrackerValidationError(`El icono del módulo "${name}" no es válido.`);
            }
            const color = typeof candidate.color === 'string'
                && Object.hasOwn(CUSTOM_MODULE_COLORS, candidate.color)
                ? candidate.color
                : 'blue';
            if (strict && candidate.color !== undefined && !Object.hasOwn(CUSTOM_MODULE_COLORS, candidate.color)) {
                throw new CustomTrackerValidationError(`El color del módulo "${name}" no es válido.`);
            }
            if (strict && candidate.archived !== undefined && typeof candidate.archived !== 'boolean') {
                throw new CustomTrackerValidationError(`El estado del módulo "${name}" no es válido.`);
            }

            ids.add(id);
            modules.push({
                id,
                name,
                description,
                icon,
                color,
                order: normalizeInteger(candidate.order, {
                    field: 'customModules.order',
                    min: 0,
                    max: Number.MAX_SAFE_INTEGER,
                    fallback: modules.length,
                    strict
                }),
                archived: candidate.archived === true,
                createdAt: normalizeIsoTimestamp(candidate.createdAt, {
                    field: 'customModules.createdAt',
                    strict
                }),
                updatedAt: normalizeIsoTimestamp(candidate.updatedAt, {
                    field: 'customModules.updatedAt',
                    strict
                })
            });
        } catch (error) {
            if (strict) throw error;
        }
    }

    return modules.sort((a, b) => (
        a.order - b.order || a.name.localeCompare(b.name, 'es')
    ));
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
    if (value.startActionLabel !== undefined) {
        result.startActionLabel = normalizeText(value.startActionLabel, {
            field: 'behavior.startActionLabel',
            maxLength: 60,
            required: true,
            strict
        });
    }
    if (value.intervalHours !== undefined) {
        result.intervalHours = normalizeInteger(value.intervalHours, {
            field: 'behavior.intervalHours',
            min: 1,
            max: 48,
            fallback: 6,
            strict
        });
    }
    return result;
}

function normalizeTrackerState(value, { template, strict = false } = {}) {
    if (template !== 'state-reminder') return null;
    if (strict && value !== undefined && !isRecord(value)) {
        throw new CustomTrackerValidationError('"state" debe ser un objeto.');
    }

    const candidate = isRecord(value) ? value : {};
    if (
        strict
        && candidate.active !== undefined
        && typeof candidate.active !== 'boolean'
    ) {
        throw new CustomTrackerValidationError('"state.active" debe ser verdadero o falso.');
    }

    const active = candidate.active === true;
    const activatedAt = normalizeIsoTimestamp(candidate.activatedAt, {
        field: 'state.activatedAt',
        strict
    });
    if (strict && active && !activatedAt) {
        throw new CustomTrackerValidationError(
            'Un aviso activo debe conservar la fecha en que comenzó.'
        );
    }

    return {
        active,
        activatedAt: active ? activatedAt : null
    };
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

function normalizeTracker(rawTracker, {
    strict = false,
    sections = CUSTOM_TRACKER_SECTIONS
} = {}) {
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
        maxLength: 70,
        required: true,
        strict
    });
    assert(Object.hasOwn(sections, section), `La sección "${section}" no es compatible.`);
    const sectionConfig = sections[section];

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
    const behavior = normalizeBehavior(rawTracker.behavior, { strict });
    if (template === 'state-reminder') {
        behavior.startActionLabel ||= 'Marcar como pendiente';
        behavior.intervalHours ||= 6;
    }

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
        behavior,
        state: normalizeTrackerState(rawTracker.state, { template, strict }),
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

export function createDefaultModulePreferences(customModules = []) {
    return Object.fromEntries(
        Object.keys(getAppModules(customModules, { includeArchived: true }))
            .map(moduleId => [moduleId, { visible: true }])
    );
}

export function createDefaultFeaturedPreferences(customModules = []) {
    return Object.fromEntries(
        Object.keys(getCustomTrackerSections(customModules))
            .map(sectionKey => [sectionKey, null])
    );
}

function normalizeFeaturedBySection(value, trackers, {
    strict = false,
    customModules = []
} = {}) {
    if (strict && value !== undefined && !isRecord(value)) {
        throw new CustomTrackerValidationError(
            '"featuredBySection" debe ser un objeto.'
        );
    }

    const candidate = isRecord(value) ? value : {};
    const sections = getCustomTrackerSections(customModules);
    const result = createDefaultFeaturedPreferences(customModules);
    Object.keys(candidate).forEach(sectionKey => {
        if (!Object.hasOwn(sections, sectionKey)) {
            if (strict) {
                throw new CustomTrackerValidationError(
                    `La sección destacada "${sectionKey}" no es compatible.`
                );
            }
            return;
        }

        const trackerId = candidate[sectionKey];
        if (trackerId === null || trackerId === undefined || trackerId === '') return;
        if (strict && typeof trackerId !== 'string') {
            throw new CustomTrackerValidationError(
                `La tarjeta destacada de "${sectionKey}" no es válida.`
            );
        }
        const tracker = trackers.find(item => item.id === trackerId);
        if (
            !tracker
            || tracker.section !== sectionKey
            || tracker.archived
            || tracker.deleted
        ) {
            if (strict) {
                throw new CustomTrackerValidationError(
                    `La tarjeta destacada de "${sectionKey}" no está activa en esa sección.`
                );
            }
            return;
        }
        result[sectionKey] = tracker.id;
    });
    return result;
}

function normalizeModulePreferences(value, {
    strict = false,
    customModules = []
} = {}) {
    if (strict && value !== undefined && !isRecord(value)) {
        throw new CustomTrackerValidationError(
            '"modulePreferences" debe ser un objeto.'
        );
    }
    const candidate = isRecord(value) ? value : {};
    const modules = getAppModules(customModules, { includeArchived: true });
    const result = createDefaultModulePreferences(customModules);

    Object.entries(candidate).forEach(([moduleId, preference]) => {
        if (!Object.hasOwn(modules, moduleId)) {
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

export function createDefaultNavigationPreferences() {
    return {
        favoriteModules: [...DEFAULT_NAVIGATION_FAVORITES]
    };
}

export function normalizeNavigationPreferences(value, {
    strict = false,
    customModules = []
} = {}) {
    if (strict && value !== undefined && !isRecord(value)) {
        throw new CustomTrackerValidationError(
            '"navigationPreferences" debe ser un objeto.'
        );
    }
    const candidate = isRecord(value) ? value : {};
    if (strict && candidate.favoriteModules !== undefined && !Array.isArray(candidate.favoriteModules)) {
        throw new CustomTrackerValidationError(
            '"navigationPreferences.favoriteModules" debe ser una lista.'
        );
    }
    const requested = Array.isArray(candidate.favoriteModules)
        ? candidate.favoriteModules
        : DEFAULT_NAVIGATION_FAVORITES;
    const modules = getAppModules(customModules, { includeArchived: true });
    const favoriteModules = [...new Set(requested)]
        .filter(moduleId => Object.hasOwn(modules, moduleId))
        .slice(0, 4);
    return {
        favoriteModules: favoriteModules.length > 0
            ? favoriteModules
            : [...DEFAULT_NAVIGATION_FAVORITES]
    };
}

export function createEmptyCustomTrackerRegistry() {
    return {
        version: CUSTOM_TRACKER_SCHEMA_VERSION,
        customModules: [],
        trackers: [],
        histories: {},
        featuredBySection: createDefaultFeaturedPreferences(),
        modulePreferences: createDefaultModulePreferences(),
        navigationPreferences: createDefaultNavigationPreferences(),
        todayPreferences: createDefaultTodayPreferences(),
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
    if (strict && !isSupportedCustomTrackerSchemaVersion(value.version)) {
        throw new CustomTrackerValidationError(
            `La versión de tarjetas configurables "${value.version}" no es compatible.`
        );
    }

    const customModules = normalizeCustomModules(value.customModules, { strict });
    const sections = getCustomTrackerSections(customModules);

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
            const tracker = normalizeTracker(candidate, { strict, sections });
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
        customModules,
        trackers,
        histories,
        featuredBySection: normalizeFeaturedBySection(
            value.featuredBySection,
            trackers,
            { strict, customModules }
        ),
        modulePreferences: normalizeModulePreferences(value.modulePreferences, {
            strict,
            customModules
        }),
        navigationPreferences: normalizeNavigationPreferences(value.navigationPreferences, {
            strict,
            customModules
        }),
        todayPreferences: normalizeTodayPreferences(value.todayPreferences, { strict }),
        migration: normalizeMigrationMeta(value.migration)
    };
}

export function validateCustomTrackerRegistry(value) {
    return normalizeCustomTrackerRegistry(value, { strict: true });
}

export function appendCustomTrackerRecords(
    registryValue,
    trackerIds,
    when = new Date()
) {
    const date = when instanceof Date ? new Date(when) : new Date(when);
    assert(!Number.isNaN(date.getTime()), 'La fecha del registro no es válida.');

    const registry = normalizeCustomTrackerRegistry(registryValue);
    const requestedIds = Array.isArray(trackerIds)
        ? [...new Set(trackerIds.filter(id => typeof id === 'string'))]
        : [];
    const trackerById = new Map(
        registry.trackers.map(tracker => [tracker.id, tracker])
    );
    const timestamp = date.toISOString();
    const recordedIds = [];

    requestedIds.forEach(trackerId => {
        const tracker = trackerById.get(trackerId);
        if (!tracker || tracker.archived || tracker.deleted) return;

        registry.histories[trackerId] = normalizeHistory(
            [timestamp, ...(registry.histories[trackerId] || [])],
            { trackerId }
        );
        recordedIds.push(trackerId);
    });

    return {
        registry,
        recordedIds,
        timestamp
    };
}

export function createCustomTracker(input, {
    id,
    now = new Date(),
    order = 0,
    customModules = []
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
    }, {
        strict: true,
        sections: getCustomTrackerSections(customModules)
    });
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

export function isMedicalStudyTracker(tracker) {
    return tracker?.template === 'medical-study';
}

export function isStateReminderTracker(tracker) {
    return tracker?.template === 'state-reminder';
}

export function buildCustomAlertDefinitions(registryValue) {
    const registry = normalizeCustomTrackerRegistry(registryValue);
    const sections = getCustomTrackerSections(registry.customModules);
    return registry.trackers
        .filter(tracker => (
            !tracker.archived
            && !tracker.deleted
            && sections[tracker.section]?.archived !== true
        ))
        .map(tracker => ({
            key: getCustomAlertKey(tracker),
            name: tracker.name,
            category: sections[tracker.section]?.alertCategory || 'otros',
            type: 'interval',
            defaultEnabled: tracker.alert.enabled === true,
            defaultTime: tracker.alert.time,
            defaultDays: [],
            ...(isStateReminderTracker(tracker)
                ? {
                    repeatWhileActive: true,
                    intervalHours: tracker.behavior.intervalHours
                }
                : {})
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
    if (isStateReminderTracker(tracker)) {
        const reference = now instanceof Date ? new Date(now) : new Date(now);
        const active = tracker?.state?.active === true;
        const activatedAt = active && tracker?.state?.activatedAt
            ? new Date(tracker.state.activatedAt)
            : null;
        const hasValidActivation = activatedAt && !Number.isNaN(activatedAt.getTime());
        const elapsedHours = hasValidActivation && !Number.isNaN(reference.getTime())
            ? Math.max(0, Math.floor((reference - activatedAt) / 3_600_000))
            : 0;
        return {
            latest: normalizedHistory[0] || null,
            elapsedDays: Math.floor(elapsedHours / 24),
            elapsedHours,
            nextDate: null,
            status: active ? 'red' : 'green',
            progress: active ? 100 : 0,
            cadence: { unit: 'days', value: 1 },
            dueValue: 1,
            dueUnit: 'days',
            remainingDays: null,
            active,
            activatedAt: hasValidActivation ? activatedAt.toISOString() : null
        };
    }
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
