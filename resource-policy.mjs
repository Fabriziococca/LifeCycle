export const RESOURCE_KEYS = Object.freeze({
    CUSTOM_MODULES: 'custom_modules',
    TRACKER_CARDS: 'tracker_cards',
    REMINDERS: 'reminders',
    TASKS: 'tasks',
    PROJECTS: 'projects',
    PROJECT_TEMPLATES: 'project_templates',
    FINANCE_TRANSACTIONS: 'finance_transactions',
    FINANCE_RECURRING_RULES: 'finance_recurring_rules',
    TRADING_EVENTS: 'trading_events',
    GYM_ROUTINE_EXERCISES: 'gym_routine_exercises',
    GYM_MEAL_TEMPLATES: 'gym_meal_templates',
    GYM_SUPPLEMENTS: 'gym_supplements',
    VEHICLE_ISSUES: 'vehicle_issues',
    BLOOD_TEST_FILES: 'blood_test_files',
    SYNCED_DOCUMENT_BYTES: 'synced_document_bytes',
    BLOOD_TEST_FILE_BYTES: 'blood_test_file_bytes'
});

export const FALLBACK_FRIEND_LIMITS = Object.freeze({
    [RESOURCE_KEYS.CUSTOM_MODULES]: 30,
    [RESOURCE_KEYS.TRACKER_CARDS]: 500,
    [RESOURCE_KEYS.REMINDERS]: 500,
    [RESOURCE_KEYS.TASKS]: 5_000,
    [RESOURCE_KEYS.PROJECTS]: 500,
    [RESOURCE_KEYS.PROJECT_TEMPLATES]: 100,
    [RESOURCE_KEYS.FINANCE_TRANSACTIONS]: 25_000,
    [RESOURCE_KEYS.FINANCE_RECURRING_RULES]: 500,
    [RESOURCE_KEYS.TRADING_EVENTS]: 1_000,
    [RESOURCE_KEYS.GYM_ROUTINE_EXERCISES]: 1_000,
    [RESOURCE_KEYS.GYM_MEAL_TEMPLATES]: 1_000,
    [RESOURCE_KEYS.GYM_SUPPLEMENTS]: 500,
    [RESOURCE_KEYS.VEHICLE_ISSUES]: 2_000,
    [RESOURCE_KEYS.BLOOD_TEST_FILES]: 1_000,
    [RESOURCE_KEYS.SYNCED_DOCUMENT_BYTES]: 5_242_880,
    [RESOURCE_KEYS.BLOOD_TEST_FILE_BYTES]: 15_728_640
});

const RESOURCE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

const RESOURCE_LABELS = Object.freeze({
    [RESOURCE_KEYS.CUSTOM_MODULES]: 'módulos personalizados',
    [RESOURCE_KEYS.TRACKER_CARDS]: 'tarjetas configurables',
    [RESOURCE_KEYS.REMINDERS]: 'recordatorios',
    [RESOURCE_KEYS.TASKS]: 'tareas',
    [RESOURCE_KEYS.PROJECTS]: 'proyectos',
    [RESOURCE_KEYS.PROJECT_TEMPLATES]: 'plantillas de proyectos',
    [RESOURCE_KEYS.FINANCE_TRANSACTIONS]: 'movimientos financieros',
    [RESOURCE_KEYS.FINANCE_RECURRING_RULES]: 'movimientos recurrentes',
    [RESOURCE_KEYS.TRADING_EVENTS]: 'eventos de Trading',
    [RESOURCE_KEYS.GYM_ROUTINE_EXERCISES]: 'ejercicios de rutina',
    [RESOURCE_KEYS.GYM_MEAL_TEMPLATES]: 'comidas guardadas',
    [RESOURCE_KEYS.GYM_SUPPLEMENTS]: 'registros de suplementos',
    [RESOURCE_KEYS.VEHICLE_ISSUES]: 'fallas de vehículo',
    [RESOURCE_KEYS.BLOOD_TEST_FILES]: 'adjuntos de análisis',
    [RESOURCE_KEYS.SYNCED_DOCUMENT_BYTES]: 'datos sincronizados',
    [RESOURCE_KEYS.BLOOD_TEST_FILE_BYTES]: 'bytes por adjunto'
});

const RESOURCE_DELETE_HINTS = Object.freeze({
    [RESOURCE_KEYS.CUSTOM_MODULES]: 'Eliminá definitivamente un módulo archivado antes de crear otro.',
    [RESOURCE_KEYS.TRACKER_CARDS]: 'Eliminá definitivamente una tarjeta archivada antes de crear otra.',
    [RESOURCE_KEYS.REMINDERS]: 'Eliminá un recordatorio antes de crear otro.',
    [RESOURCE_KEYS.TASKS]: 'Completá o eliminá tareas que ya no necesites antes de crear otra.',
    [RESOURCE_KEYS.PROJECTS]: 'Eliminá un proyecto que ya no necesites antes de crear otro.',
    [RESOURCE_KEYS.PROJECT_TEMPLATES]: 'Eliminá una plantilla antes de crear otra.',
    [RESOURCE_KEYS.FINANCE_TRANSACTIONS]: 'Eliminá movimientos que ya no necesites antes de registrar otro.',
    [RESOURCE_KEYS.FINANCE_RECURRING_RULES]: 'Eliminá una regla recurrente antes de crear otra.',
    [RESOURCE_KEYS.TRADING_EVENTS]: 'Eliminá un evento de Trading antes de crear otro.',
    [RESOURCE_KEYS.GYM_ROUTINE_EXERCISES]: 'Eliminá un ejercicio de la rutina antes de agregar otro.',
    [RESOURCE_KEYS.GYM_MEAL_TEMPLATES]: 'Eliminá una comida guardada antes de agregar otra.',
    [RESOURCE_KEYS.GYM_SUPPLEMENTS]: 'Eliminá registros antiguos antes de agregar otro.',
    [RESOURCE_KEYS.VEHICLE_ISSUES]: 'Resolvé o eliminá una falla antes de registrar otra.',
    [RESOURCE_KEYS.BLOOD_TEST_FILES]: 'Eliminá un adjunto anterior antes de subir otro.'
});

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function parseStoredJson(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function countProjectTasks(projects) {
    return asArray(projects).reduce(
        (total, project) => total + asArray(project?.tasks).length,
        0
    );
}

function hasBloodTestAttachment(entry) {
    return Boolean(
        entry?.storagePath
        || entry?.fileData
        || entry?.pdfUrl
    );
}

function normalizePositiveInteger(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function createFallbackResourcePolicy() {
    return {
        tier: 'friend',
        unlimited: false,
        limits: { ...FALLBACK_FRIEND_LIMITS }
    };
}

export function normalizeResourcePolicy(value) {
    const candidate = Array.isArray(value) ? value[0] : value;
    if (!candidate || typeof candidate !== 'object') {
        return createFallbackResourcePolicy();
    }

    const tier = candidate.tier === 'owner' ? 'owner' : 'friend';
    const serverLimits = candidate.limits && typeof candidate.limits === 'object'
        ? candidate.limits
        : {};
    const limits = { ...FALLBACK_FRIEND_LIMITS };

    Object.entries(serverLimits).forEach(([key, rawLimit]) => {
        const limit = normalizePositiveInteger(rawLimit);
        if (RESOURCE_KEY_PATTERN.test(key) && limit !== null) {
            limits[key] = limit;
        }
    });

    return {
        tier,
        unlimited: tier === 'owner' && candidate.unlimited === true,
        limits
    };
}

export function getResourceLimit(policy, resourceKey) {
    if (policy?.unlimited === true) return null;
    return normalizePositiveInteger(policy?.limits?.[resourceKey]);
}

export function evaluateResourceCapacity(
    policy,
    resourceKey,
    currentCount,
    requestedCount = 1
) {
    const current = Math.max(0, Number.isFinite(Number(currentCount))
        ? Math.trunc(Number(currentCount))
        : 0);
    const requested = Math.max(1, Number.isFinite(Number(requestedCount))
        ? Math.trunc(Number(requestedCount))
        : 1);

    if (policy?.unlimited === true) {
        return { allowed: true, limit: null, remaining: null };
    }

    const limit = getResourceLimit(policy, resourceKey);
    if (limit === null) {
        return { allowed: true, limit: null, remaining: null };
    }

    return {
        allowed: current + requested <= limit,
        limit,
        remaining: Math.max(0, limit - current)
    };
}

export function getTrackerRegistryResourceUsage(registry) {
    const customModules = Array.isArray(registry?.customModules)
        ? registry.customModules
        : [];
    const trackerCards = Array.isArray(registry?.trackers)
        ? registry.trackers.filter(tracker => tracker?.deleted !== true)
        : [];

    return {
        [RESOURCE_KEYS.CUSTOM_MODULES]: customModules.length,
        [RESOURCE_KEYS.TRACKER_CARDS]: trackerCards.length
    };
}

export function getRecurringReminderRegistryResourceUsage(registry) {
    const reminders = Array.isArray(registry?.reminders)
        ? registry.reminders
        : [];

    return {
        [RESOURCE_KEYS.REMINDERS]: reminders.length
    };
}

export function getTaskResourceUsage({
    standaloneTasks,
    projects,
    projectHistory
} = {}) {
    return {
        [RESOURCE_KEYS.TASKS]: asArray(standaloneTasks).length
            + countProjectTasks(projects)
            + countProjectTasks(projectHistory)
    };
}

export function getProjectResourceUsage({
    projects,
    projectHistory,
    templateRegistry
} = {}) {
    return {
        [RESOURCE_KEYS.PROJECTS]: asArray(projects).length
            + asArray(projectHistory).length,
        [RESOURCE_KEYS.PROJECT_TEMPLATES]: asArray(templateRegistry?.templates).length
    };
}

export function getFinanceResourceUsage(financeData) {
    const data = financeData && typeof financeData === 'object'
        ? financeData
        : {};
    return {
        [RESOURCE_KEYS.FINANCE_TRANSACTIONS]: asArray(data.entries).length
            + asArray(data.expenses).length,
        [RESOURCE_KEYS.FINANCE_RECURRING_RULES]: asArray(data.recurringRules).length,
        [RESOURCE_KEYS.TRADING_EVENTS]: asArray(data.tradingEvents).length
    };
}

export function getGymResourceUsage({
    routine,
    meals,
    generalMeals,
    supplements
} = {}) {
    return {
        [RESOURCE_KEYS.GYM_ROUTINE_EXERCISES]: asArray(routine).length,
        [RESOURCE_KEYS.GYM_MEAL_TEMPLATES]: asArray(meals?.fixed).length
            + asArray(generalMeals).length,
        [RESOURCE_KEYS.GYM_SUPPLEMENTS]: asArray(supplements?.vit_d_history).length
            + asArray(supplements?.painkillers_history).length
    };
}

export function getVehicleResourceUsage(issues) {
    return {
        [RESOURCE_KEYS.VEHICLE_ISSUES]: asArray(issues).length
    };
}

export function getBloodTestResourceUsage(bloodTests) {
    return {
        [RESOURCE_KEYS.BLOOD_TEST_FILES]: asArray(bloodTests)
            .filter(hasBloodTestAttachment)
            .length
    };
}

export function getSynchronizedResourceUsage(storedValues = {}) {
    const read = key => parseStoredJson(storedValues?.[key], null);
    const hygieneData = read('hygiene_tracker_data') || {};
    const alertsData = read('alerts_config') || {};
    const projects = read('projectPulseData');
    const projectHistory = read('projectPulseHistory');
    const templateRegistry = read('projectPulseTemplates');
    const financeData = read('finanzasData');

    return {
        ...getTrackerRegistryResourceUsage(hygieneData.__trackers_v2),
        ...getRecurringReminderRegistryResourceUsage(alertsData.__recurring_reminders),
        ...getTaskResourceUsage({
            standaloneTasks: read('tareas_list'),
            projects,
            projectHistory
        }),
        ...getProjectResourceUsage({
            projects,
            projectHistory,
            templateRegistry
        }),
        ...getFinanceResourceUsage(financeData),
        ...getGymResourceUsage({
            routine: read('gym_routine'),
            meals: read('gym_meals'),
            generalMeals: read('gym_general_meals'),
            supplements: read('gym_supplements')
        }),
        ...getVehicleResourceUsage(read('vehicle_issues')),
        ...getBloodTestResourceUsage(read('health_blood_tests'))
    };
}

export function getAppResourceCapacity(
    app,
    resourceKey,
    currentCount,
    requestedCount = 1
) {
    if (typeof app?.auth?.canCreateResource === 'function') {
        return app.auth.canCreateResource(
            resourceKey,
            currentCount,
            requestedCount
        );
    }
    return evaluateResourceCapacity(
        createFallbackResourcePolicy(),
        resourceKey,
        currentCount,
        requestedCount
    );
}

export function getResourceLimitMessage(resourceKey, limit) {
    if (!Number.isSafeInteger(limit)) {
        return 'No se pudo validar la capacidad disponible de esta cuenta.';
    }
    const label = RESOURCE_LABELS[resourceKey] || 'elementos de este tipo';
    const hint = RESOURCE_DELETE_HINTS[resourceKey]
        || 'Reducí el contenido guardado antes de volver a intentarlo.';
    return `Esta cuenta alcanzó el límite de ${label}: ${limit}. ${hint}`;
}

export function getResourceCapacityNotice(
    resourceKey,
    capacity,
    requestedCount = 1
) {
    if (!capacity?.allowed || capacity.limit === null || capacity.remaining === null) {
        return '';
    }
    const remainingAfter = Math.max(0, capacity.remaining - requestedCount);
    if (![10, 5, 1, 0].includes(remainingAfter)) return '';
    const label = RESOURCE_LABELS[resourceKey] || 'elementos';
    if (remainingAfter === 0) {
        return `Alcanzaste el máximo de ${label} para esta cuenta.`;
    }
    return `Te ${remainingAfter === 1 ? 'queda' : 'quedan'} ${remainingAfter} ${label} antes del límite de esta cuenta.`;
}
