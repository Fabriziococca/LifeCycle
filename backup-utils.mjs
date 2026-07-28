import { normalizeActiveGymSession } from './gym-session-utils.mjs';
import {
    CUSTOM_TRACKER_FIELD,
    validateCustomTrackerRegistry
} from './custom-tracker-utils.mjs';
import { CLOUD_SYNC_KEYS } from './sync-config.mjs';

export const BACKUP_APP_NAME = 'LifeCycle';
export const BACKUP_FORMAT_VERSION = 2;
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

const MAX_JSON_DEPTH = 20;
const MAX_JSON_NODES = 50_000;
const MAX_COLLECTION_ENTRIES = 10_000;
const MAX_PROPERTY_NAME_LENGTH = 200;
const MAX_STRING_LENGTH = 24 * 1024 * 1024;
const MAX_LEGACY_ATTACHMENT_LENGTH = MAX_STRING_LENGTH;
const MAX_SCALAR_LENGTH = 200;

const FORBIDDEN_PROPERTY_NAMES = new Set([
    '__proto__',
    'prototype',
    'constructor'
]);

const JSON_ROOT_TYPES = Object.freeze({
    hygiene_tracker_data: 'object',
    groomingData_v2: 'object',
    lensesHistory: 'array',
    health_medical_data: 'object',
    health_blood_tests: 'array',
    vehicle_maintenance_log: 'array',
    vehicle_tracker_data: 'object',
    vehicle_issues: 'array',
    gym_records: 'array',
    gym_routine: 'array',
    gym_routine_focus: 'object',
    gym_sessions: 'array',
    gym_active_session: 'object',
    gym_meals: 'object',
    gym_general_meals: 'array',
    gym_supplements: 'object',
    gym_weight: 'array',
    projectPulseData: 'array',
    projectPulseHistory: 'array',
    projectPulseSubscription: 'object',
    alerts_config: 'object',
    finanzasData: 'object',
    tareas_list: 'array',
    tareas_categories: 'array',
    tareas_pinned_projects: 'array',
    tareas_pinned_project_ids: 'array',
    tareas_removed_project_ids: 'array'
});

const DATE_STORAGE_KEYS = new Set([
    'lensDate',
    'solutionDate',
    'caseDate',
    'systaneDate',
    'clothWashDate',
    'clothChangeDate'
]);

const NUMBER_STORAGE_KEYS = new Set([
    'lensStock',
    'vehicle_odometer'
]);

const LEGACY_HYGIENE_KEYS = new Set([
    'esponja_africana',
    'toalla_mano',
    'toalla_cuerpo',
    'sabanas',
    'funda_almohada',
    'cepillo_dientes',
    'celular',
    'computadora',
    'mouse',
    'auriculares',
    'pad_lavado',
    'compu_limpieza_int',
    'compu_pasta_termica',
    'botella_vidrio',
    'robot_cleaner'
]);

const CATEGORY_GROUPS = Object.freeze([
    { label: 'Higiene', keys: ['hygiene_tracker_data'] },
    { label: 'Cuidado corporal', keys: ['groomingData_v2'] },
    {
        label: 'Lentes de contacto',
        keys: [
            'lensesStartTime',
            'lensesHistory',
            'lensStock',
            'lensDate',
            'solutionDate',
            'caseDate',
            'systaneDate',
            'clothWashDate',
            'clothChangeDate'
        ]
    },
    { label: 'Salud', keys: ['health_medical_data', 'health_blood_tests'] },
    {
        label: 'Vehículo',
        keys: [
            'vehicle_odometer',
            'vehicle_maintenance_log',
            'vehicle_tracker_data',
            'vehicle_issues'
        ]
    },
    {
        label: 'Gimnasio',
        keys: [
            'gym_records',
            'gym_routine',
            'gym_routine_focus',
            'gym_sessions',
            'gym_active_session',
            'gym_meals',
            'gym_general_meals',
            'gym_supplements',
            'gym_weight'
        ]
    },
    {
        label: 'Proyectos',
        keys: [
            'projectPulseData',
            'projectPulseHistory',
            'projectPulseSubscription'
        ]
    },
    { label: 'Gestor de alertas', keys: ['alerts_config'] },
    { label: 'Finanzas', keys: ['finanzasData'] },
    {
        label: 'Tareas',
        keys: [
            'tareas_list',
            'tareas_categories',
            'tareas_pinned_projects',
            'tareas_pinned_project_ids',
            'tareas_removed_project_ids'
        ]
    }
]);

const SUPPORTED_KEY_SET = new Set(CLOUD_SYNC_KEYS);

export class BackupValidationError extends Error {
    constructor(message, options = {}) {
        super(message, options);
        this.name = 'BackupValidationError';
    }
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function getTextByteLength(value) {
    return new TextEncoder().encode(value).byteLength;
}

function isValidISODate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
        parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day
    );
}

function assertSafeJsonValue(value, path, state, depth = 0) {
    state.nodes += 1;
    if (state.nodes > MAX_JSON_NODES) {
        throw new BackupValidationError('El backup contiene demasiados elementos.');
    }
    if (depth > MAX_JSON_DEPTH) {
        throw new BackupValidationError(`La estructura de "${path}" es demasiado profunda.`);
    }

    if (value === null || typeof value === 'boolean') return;

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new BackupValidationError(`"${path}" contiene un número inválido.`);
        }
        return;
    }

    if (typeof value === 'string') {
        if (value.length > MAX_STRING_LENGTH) {
            throw new BackupValidationError(`El texto almacenado en "${path}" es demasiado grande.`);
        }
        return;
    }

    if (Array.isArray(value)) {
        if (value.length > MAX_COLLECTION_ENTRIES) {
            throw new BackupValidationError(`La lista "${path}" contiene demasiados elementos.`);
        }
        value.forEach((item, index) => {
            assertSafeJsonValue(item, `${path}[${index}]`, state, depth + 1);
        });
        return;
    }

    if (!isPlainObject(value)) {
        throw new BackupValidationError(`"${path}" contiene un valor no compatible con JSON.`);
    }

    const entries = Object.entries(value);
    if (entries.length > MAX_COLLECTION_ENTRIES) {
        throw new BackupValidationError(`El objeto "${path}" contiene demasiadas propiedades.`);
    }

    entries.forEach(([key, nestedValue]) => {
        if (key.length > MAX_PROPERTY_NAME_LENGTH) {
            throw new BackupValidationError(`"${path}" contiene un nombre de propiedad demasiado largo.`);
        }
        if (FORBIDDEN_PROPERTY_NAMES.has(key)) {
            throw new BackupValidationError(`"${path}" contiene la propiedad no permitida "${key}".`);
        }
        assertSafeJsonValue(nestedValue, `${path}.${key}`, state, depth + 1);
    });
}

function assertRecord(value, path) {
    if (!isPlainObject(value)) {
        throw new BackupValidationError(`"${path}" debería ser un objeto.`);
    }
}

function assertText(value, path, { optional = false, maxLength = 10_000 } = {}) {
    if ((value === null || value === undefined) && optional) return;
    if (typeof value !== 'string' || value.length > maxLength) {
        throw new BackupValidationError(`"${path}" debería contener texto válido.`);
    }
}

function assertOptionalTextFields(record, path, fields) {
    fields.forEach(field => {
        if (Object.hasOwn(record, field)) {
            assertText(record[field], `${path}.${field}`, { optional: true });
        }
    });
}

function assertOptionalNumberFields(record, path, fields) {
    fields.forEach(field => {
        if (!Object.hasOwn(record, field) || record[field] === null || record[field] === '') return;
        const numberValue = Number(record[field]);
        if (!Number.isFinite(numberValue)) {
            throw new BackupValidationError(`"${path}.${field}" debería ser un número válido.`);
        }
    });
}

function assertOptionalBooleanFields(record, path, fields) {
    fields.forEach(field => {
        if (
            Object.hasOwn(record, field)
            && record[field] !== null
            && typeof record[field] !== 'boolean'
        ) {
            throw new BackupValidationError(`"${path}.${field}" debería ser verdadero o falso.`);
        }
    });
}

function assertOptionalId(record, path) {
    if (!Object.hasOwn(record, 'id')) return;
    const id = record.id;
    if (
        id === null
        || (
            typeof id !== 'string'
            && typeof id !== 'number'
        )
    ) {
        throw new BackupValidationError(`"${path}.id" no es un identificador válido.`);
    }
}

function assertArrayOfRecords(value, path, validator) {
    if (!Array.isArray(value)) {
        throw new BackupValidationError(`"${path}" debería ser una lista.`);
    }
    value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        assertRecord(item, itemPath);
        validator(item, itemPath);
    });
}

function assertArrayOfStrings(value, path) {
    if (!Array.isArray(value)) {
        throw new BackupValidationError(`"${path}" debería ser una lista.`);
    }
    value.forEach((item, index) => {
        assertText(item, `${path}[${index}]`);
    });
}

function validateTask(task, path) {
    assertOptionalId(task, path);
    assertText(task.text, `${path}.text`);
    assertOptionalTextFields(task, path, ['category', 'urgency']);
    assertOptionalBooleanFields(task, path, ['completed']);
}

function validateProject(project, path) {
    assertOptionalId(project, path);
    assertText(project.project, `${path}.project`);
    assertOptionalTextFields(project, path, [
        'client',
        'statusNote',
        'accepted',
        'deadline',
        'deliveredAt',
        'deliveredDate',
        'changesRequestedAt',
        'source',
        'feeType'
    ]);
    assertOptionalNumberFields(project, path, [
        'days',
        'budgetGross',
        'budgetNet',
        'manualPercent',
        'timeSpent'
    ]);
    assertOptionalBooleanFields(project, path, [
        'isArbitration',
        'hasChangesRequested',
        'isDelivered',
        'isDelegated',
        'isReceived',
        'isPinned'
    ]);
    if (Object.hasOwn(project, 'tasks')) {
        assertArrayOfRecords(project.tasks, `${path}.tasks`, validateTask);
    }
}

function validateFinanceItem(item, path) {
    assertOptionalId(item, path);
    assertOptionalTextFields(item, path, ['description', 'category', 'date', 'source']);
    assertOptionalNumberFields(item, path, ['amount']);
}

function validateMeal(meal, path) {
    assertOptionalId(meal, path);
    assertOptionalTextFields(meal, path, ['name', 'group', 'unit']);
    assertOptionalNumberFields(meal, path, [
        'qty',
        'kcal',
        'protein',
        'carbs',
        'fat',
        'sodium',
        'fiber'
    ]);
}

function validateGymSet(set, path) {
    assertOptionalNumberFields(set, path, ['weight', 'reps', 'rir']);
    assertOptionalBooleanFields(set, path, ['failed']);
}

function validateGymSession(session, path) {
    assertOptionalId(session, path);
    assertOptionalTextFields(session, path, ['date', 'day', 'startedAt', 'updatedAt', 'completedAt']);
    assertRecord(session.exercises, `${path}.exercises`);
    Object.entries(session.exercises).forEach(([exerciseName, sets]) => {
        assertText(exerciseName, `${path}.exercises.nombre`);
        assertArrayOfRecords(sets, `${path}.exercises.${exerciseName}`, validateGymSet);
    });
}

function validateBackupDataShape(key, value) {
    switch (key) {
        case 'hygiene_tracker_data':
            Object.entries(value).forEach(([itemKey, itemValue]) => {
                if (itemKey === CUSTOM_TRACKER_FIELD) {
                    try {
                        validateCustomTrackerRegistry(itemValue);
                    } catch (error) {
                        throw new BackupValidationError(
                            `Las tarjetas configurables no son válidas: ${error.message}`
                        );
                    }
                    return;
                }
                if (itemKey === 'robot_cleaner') {
                    assertRecord(itemValue, `${key}.${itemKey}`);
                    assertOptionalTextFields(itemValue, `${key}.${itemKey}`, [
                        'status',
                        'marked_dirty_at',
                        'last_notified_at'
                    ]);
                    return;
                }
                if (itemValue === null || typeof itemValue === 'string') return;
                assertArrayOfStrings(itemValue, `${key}.${itemKey}`);
            });
            break;
        case 'groomingData_v2':
            Object.entries(value).forEach(([zone, history]) => {
                assertArrayOfStrings(history, `${key}.${zone}`);
            });
            break;
        case 'lensesHistory':
            assertArrayOfRecords(value, key, (item, path) => {
                assertOptionalTextFields(item, path, ['date', 'duration', 'start', 'end']);
            });
            break;
        case 'health_medical_data':
            Object.entries(value).forEach(([control, data]) => {
                const path = `${key}.${control}`;
                assertRecord(data, path);
                assertOptionalTextFields(data, path, ['lastVisit']);
                assertOptionalNumberFields(data, path, ['frequencyMonths']);
                if (Object.hasOwn(data, 'history')) {
                    assertArrayOfStrings(data.history, `${path}.history`);
                }
            });
            break;
        case 'health_blood_tests':
            assertArrayOfRecords(value, key, (item, path) => {
                assertOptionalId(item, path);
                assertOptionalTextFields(item, path, [
                    'date',
                    'portalUrl',
                    'storagePath',
                    'fileName'
                ]);
                ['fileData', 'pdfUrl'].forEach(field => {
                    if (Object.hasOwn(item, field)) {
                        assertText(item[field], `${path}.${field}`, {
                            optional: true,
                            maxLength: MAX_LEGACY_ATTACHMENT_LENGTH
                        });
                    }
                });
            });
            break;
        case 'vehicle_maintenance_log':
            assertArrayOfRecords(value, key, (item, path) => {
                assertOptionalId(item, path);
                assertOptionalTextFields(item, path, ['type', 'date']);
                assertOptionalNumberFields(item, path, ['km']);
                if (Object.hasOwn(item, 'details')) assertRecord(item.details, `${path}.details`);
            });
            break;
        case 'vehicle_tracker_data':
            Object.entries(value).forEach(([field, fieldValue]) => {
                assertText(fieldValue, `${key}.${field}`, { optional: true });
            });
            break;
        case 'vehicle_issues':
            assertArrayOfRecords(value, key, (item, path) => {
                assertOptionalId(item, path);
                assertOptionalTextFields(item, path, ['title', 'urgency', 'createdAt', 'resolvedAt']);
            });
            break;
        case 'gym_records':
            assertArrayOfRecords(value, key, (item, path) => {
                assertOptionalId(item, path);
                assertOptionalTextFields(item, path, ['name', 'date']);
                assertOptionalNumberFields(item, path, ['weight', 'reps', 'rir']);
            });
            break;
        case 'gym_routine':
            assertArrayOfRecords(value, key, (item, path) => {
                assertOptionalId(item, path);
                assertOptionalTextFields(item, path, ['name', 'day', 'linkId']);
                assertOptionalNumberFields(item, path, ['weight', 'reps', 'series']);
            });
            break;
        case 'gym_routine_focus':
            Object.entries(value).forEach(([day, focus]) => {
                assertText(focus, `${key}.${day}`, { optional: true });
            });
            break;
        case 'gym_sessions':
            assertArrayOfRecords(value, key, validateGymSession);
            break;
        case 'gym_active_session':
            validateGymSession(value, key);
            break;
        case 'gym_meals':
            ['fixed', 'variable'].forEach(section => {
                if (Object.hasOwn(value, section)) {
                    assertArrayOfRecords(value[section], `${key}.${section}`, validateMeal);
                }
            });
            break;
        case 'gym_general_meals':
            assertArrayOfRecords(value, key, validateMeal);
            break;
        case 'gym_supplements':
            if (Object.hasOwn(value, 'vit_d_history')) {
                assertArrayOfRecords(value.vit_d_history, `${key}.vit_d_history`, (item, path) => {
                    assertOptionalId(item, path);
                    assertOptionalTextFields(item, path, ['date']);
                });
            }
            if (Object.hasOwn(value, 'painkillers_history')) {
                assertArrayOfRecords(value.painkillers_history, `${key}.painkillers_history`, (item, path) => {
                    assertOptionalId(item, path);
                    assertOptionalTextFields(item, path, ['date', 'type', 'note']);
                });
            }
            assertOptionalNumberFields(value, key, ['vit_d_days_interval']);
            break;
        case 'gym_weight':
            assertArrayOfRecords(value, key, (item, path) => {
                assertOptionalId(item, path);
                assertOptionalTextFields(item, path, ['date']);
                assertOptionalNumberFields(item, path, ['weight', 'fasting']);
            });
            break;
        case 'projectPulseData':
        case 'projectPulseHistory':
        case 'tareas_pinned_projects':
            assertArrayOfRecords(value, key, validateProject);
            break;
        case 'projectPulseSubscription':
            assertOptionalTextFields(value, key, ['plan', 'startDate']);
            assertOptionalNumberFields(value, key, ['cost', 'cycle']);
            break;
        case 'alerts_config':
            Object.entries(value).forEach(([alertKey, config]) => {
                const path = `${key}.${alertKey}`;
                assertRecord(config, path);
                assertOptionalTextFields(config, path, ['time']);
                assertOptionalNumberFields(config, path, ['interval_hours']);
                assertOptionalBooleanFields(config, path, ['enabled']);
                if (Object.hasOwn(config, 'days')) {
                    if (!Array.isArray(config.days) || config.days.some(day => !Number.isInteger(Number(day)))) {
                        throw new BackupValidationError(`"${path}.days" debería ser una lista de días.`);
                    }
                }
            });
            break;
        case 'finanzasData':
            ['entries', 'expenses'].forEach(section => {
                if (Object.hasOwn(value, section)) {
                    assertArrayOfRecords(value[section], `${key}.${section}`, validateFinanceItem);
                }
            });
            break;
        case 'tareas_list':
            assertArrayOfRecords(value, key, validateTask);
            break;
        case 'tareas_categories':
            assertArrayOfStrings(value, key);
            break;
        case 'tareas_pinned_project_ids':
        case 'tareas_removed_project_ids':
            value.forEach((id, index) => {
                if (typeof id !== 'string' && typeof id !== 'number') {
                    throw new BackupValidationError(`"${key}[${index}]" no es un identificador válido.`);
                }
            });
            break;
        default:
            break;
    }
}

function parseJsonStorageValue(key, value) {
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch {
            throw new BackupValidationError(`La sección "${key}" no contiene JSON válido.`);
        }
    }

    if (key === 'gym_active_session') {
        parsed = normalizeActiveGymSession(parsed);
        if (!parsed) {
            throw new BackupValidationError('La sesión activa de gimnasio no tiene un formato válido.');
        }
    }

    const expectedType = JSON_ROOT_TYPES[key];
    if (expectedType === 'array' && !Array.isArray(parsed)) {
        throw new BackupValidationError(`La sección "${key}" debería ser una lista.`);
    }
    if (expectedType === 'object' && !isPlainObject(parsed)) {
        throw new BackupValidationError(`La sección "${key}" debería ser un objeto.`);
    }

    validateBackupDataShape(key, parsed);
    assertSafeJsonValue(parsed, key, { nodes: 0 });
    return {
        portableValue: parsed,
        storageValue: JSON.stringify(parsed)
    };
}

function parseScalarStorageValue(key, value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new BackupValidationError(`La sección "${key}" debería contener un valor simple.`);
    }

    const text = String(value).trim();
    if (text.length > MAX_SCALAR_LENGTH) {
        throw new BackupValidationError(`La sección "${key}" contiene un valor inválido.`);
    }

    // Los campos de fecha y stock se pueden vaciar desde la interfaz. En el
    // almacenamiento actual una cadena vacía equivale a "sin dato", por lo que
    // el backup la normaliza a null en lugar de impedir la exportación.
    if (!text && (key === 'lensesStartTime' || DATE_STORAGE_KEYS.has(key))) {
        return { portableValue: null, storageValue: null };
    }
    if (!text && key === 'lensStock') {
        return { portableValue: 0, storageValue: '0' };
    }
    if (!text) {
        throw new BackupValidationError(`La sección "${key}" contiene un valor inválido.`);
    }

    if (key === 'lensesStartTime') {
        if (!Number.isFinite(Date.parse(text))) {
            throw new BackupValidationError('La hora de colocación de lentes no es válida.');
        }
        const normalized = new Date(text).toISOString();
        return { portableValue: normalized, storageValue: normalized };
    }

    if (DATE_STORAGE_KEYS.has(key)) {
        if (!isValidISODate(text)) {
            throw new BackupValidationError(`La fecha guardada en "${key}" no es válida.`);
        }
        return { portableValue: text, storageValue: text };
    }

    if (NUMBER_STORAGE_KEYS.has(key)) {
        const numberValue = Number(text);
        if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 1_000_000_000) {
            throw new BackupValidationError(`El valor numérico de "${key}" no es válido.`);
        }
        const normalized = key === 'lensStock'
            ? String(Math.trunc(numberValue))
            : String(numberValue);
        return {
            portableValue: Number(normalized),
            storageValue: normalized
        };
    }

    throw new BackupValidationError(`La clave "${key}" no es compatible con este backup.`);
}

export function normalizeBackupStorageEntry(key, value) {
    if (!SUPPORTED_KEY_SET.has(key)) {
        throw new BackupValidationError(`La clave "${key}" no pertenece a LifeCycle.`);
    }
    if (value === null || value === undefined) {
        return { portableValue: null, storageValue: null };
    }
    if (Object.hasOwn(JSON_ROOT_TYPES, key)) {
        return parseJsonStorageValue(key, value);
    }
    return parseScalarStorageValue(key, value);
}

export function getBackupCategories(keys) {
    const keySet = new Set(keys);
    return CATEGORY_GROUPS
        .filter(group => group.keys.some(key => keySet.has(key)))
        .map(group => group.label);
}

export function createBackupPayload(readStorageValue, now = new Date()) {
    if (typeof readStorageValue !== 'function') {
        throw new TypeError('Se necesita una función para leer el almacenamiento.');
    }

    const safeNow = Number.isFinite(now?.getTime?.()) ? new Date(now.getTime()) : new Date();
    const data = {};

    CLOUD_SYNC_KEYS.forEach(key => {
        const rawValue = readStorageValue(key);
        data[key] = normalizeBackupStorageEntry(key, rawValue).portableValue;
    });

    return {
        appName: BACKUP_APP_NAME,
        backupVersion: BACKUP_FORMAT_VERSION,
        exportDate: safeNow.toISOString(),
        data
    };
}

function getLegacyHygieneEntry(root) {
    const rootKeys = Object.keys(root);
    if (!rootKeys.some(key => LEGACY_HYGIENE_KEYS.has(key))) return null;

    const normalized = normalizeBackupStorageEntry('hygiene_tracker_data', root);
    return ['hygiene_tracker_data', normalized.storageValue];
}

export function parseAndValidateBackupText(text) {
    if (typeof text !== 'string' || text.trim() === '') {
        throw new BackupValidationError('El archivo de backup está vacío.');
    }
    if (getTextByteLength(text) > MAX_BACKUP_BYTES) {
        throw new BackupValidationError('El backup supera el límite permitido de 8 MB.');
    }

    let root;
    try {
        root = JSON.parse(text);
    } catch {
        throw new BackupValidationError('El archivo no contiene JSON válido.');
    }

    if (!isPlainObject(root)) {
        throw new BackupValidationError('El backup debe contener un objeto JSON.');
    }
    if (root.appName !== undefined && root.appName !== BACKUP_APP_NAME) {
        throw new BackupValidationError('El archivo pertenece a otra aplicación.');
    }

    if (root.backupVersion !== undefined) {
        if (root.backupVersion !== BACKUP_FORMAT_VERSION) {
            throw new BackupValidationError(`La versión ${root.backupVersion} del backup no es compatible.`);
        }
        if (!isPlainObject(root.data)) {
            throw new BackupValidationError('El backup versionado no contiene su bloque de datos.');
        }

        const unknownKeys = Object.keys(root.data).filter(key => !SUPPORTED_KEY_SET.has(key));
        if (unknownKeys.length > 0) {
            throw new BackupValidationError(`El backup contiene una clave desconocida: "${unknownKeys[0]}".`);
        }

        const missingKeys = CLOUD_SYNC_KEYS.filter(key => !Object.hasOwn(root.data, key));
        if (missingKeys.length > 0) {
            throw new BackupValidationError(`El backup está incompleto: falta la sección "${missingKeys[0]}".`);
        }

        const entries = CLOUD_SYNC_KEYS.map(key => {
            const normalized = normalizeBackupStorageEntry(key, root.data[key]);
            return [key, normalized.storageValue];
        });

        return {
            mode: 'full',
            version: BACKUP_FORMAT_VERSION,
            entries,
            categories: getBackupCategories(CLOUD_SYNC_KEYS)
        };
    }

    const entries = [];
    CLOUD_SYNC_KEYS.forEach(key => {
        if (!Object.hasOwn(root, key) || root[key] === null || root[key] === undefined) return;
        const normalized = normalizeBackupStorageEntry(key, root[key]);
        entries.push([key, normalized.storageValue]);
    });

    if (entries.length === 0 && root.appName === undefined) {
        const legacyHygieneEntry = getLegacyHygieneEntry(root);
        if (legacyHygieneEntry) entries.push(legacyHygieneEntry);
    }

    if (entries.length === 0) {
        throw new BackupValidationError('El JSON no contiene datos compatibles de LifeCycle.');
    }

    const keys = entries.map(([key]) => key);
    return {
        mode: 'legacy',
        version: 1,
        entries,
        categories: getBackupCategories(keys)
    };
}

export function applyBackupEntries(storage, entries) {
    if (
        !storage
        || typeof storage.getItem !== 'function'
        || typeof storage.setItem !== 'function'
        || typeof storage.removeItem !== 'function'
    ) {
        throw new TypeError('El almacenamiento indicado no es compatible.');
    }
    if (!Array.isArray(entries)) {
        throw new TypeError('Las entradas del backup no son válidas.');
    }

    const changes = entries
        .map(([key, value]) => {
            if (!SUPPORTED_KEY_SET.has(key)) {
                throw new BackupValidationError(`La clave "${key}" no puede restaurarse.`);
            }
            if (value !== null && typeof value !== 'string') {
                throw new BackupValidationError(`El valor preparado para "${key}" no es válido.`);
            }
            return {
                key,
                previousValue: storage.getItem(key),
                nextValue: value
            };
        })
        .filter(change => change.previousValue !== change.nextValue);

    try {
        changes.forEach(change => {
            if (change.nextValue === null) {
                storage.removeItem(change.key);
            } else {
                storage.setItem(change.key, change.nextValue);
            }
        });
    } catch (error) {
        let rollbackFailed = false;
        [...changes].reverse().forEach(change => {
            try {
                if (change.previousValue === null) {
                    storage.removeItem(change.key);
                } else {
                    storage.setItem(change.key, change.previousValue);
                }
            } catch {
                rollbackFailed = true;
            }
        });

        throw new BackupValidationError(
            rollbackFailed
                ? 'La restauración falló y no pudo revertirse por completo. No cierres LifeCycle y recuperá el backup anterior.'
                : 'La restauración no pudo completarse y los datos anteriores fueron recuperados.',
            { cause: error }
        );
    }

    return changes.map(change => change.key);
}
