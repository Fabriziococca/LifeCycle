'use strict';

const SERVER_MANAGED_USER_DATA_KEYS = new Set([
    'alerts_sent_log',
    'robot_last_notified_at',
    'very_urgent_last_notified_at'
]);
const CUSTOM_TRACKER_FIELD = '__custom_trackers_v1';
const CUSTOM_ALERT_PREFIX = 'custom_tracker:';

function parseJsonValue(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function normalizeIntervalHours(value, fallbackHours) {
    const parsed = Number.parseInt(value, 10);
    const fallback = Number.parseInt(fallbackHours, 10);
    const safeFallback = Number.isFinite(fallback) ? fallback : 4;
    const safeValue = Number.isFinite(parsed) ? parsed : safeFallback;
    return Math.min(48, Math.max(1, safeValue));
}

function isIntervalReminderDue({
    now = new Date(),
    lastNotifiedAt = null,
    intervalHours = 4,
    force = false
} = {}) {
    if (force) return true;

    const nowTime = new Date(now).getTime();
    if (!Number.isFinite(nowTime)) return false;

    const lastTime = lastNotifiedAt
        ? new Date(lastNotifiedAt).getTime()
        : Number.NaN;
    if (!Number.isFinite(lastTime)) return true;

    // A future timestamp can only come from clock drift or corrupt state.
    // It must not silence an important reminder indefinitely.
    if (lastTime > nowTime) return true;

    const safeInterval = normalizeIntervalHours(intervalHours, 4);
    return nowTime - lastTime >= safeInterval * 60 * 60 * 1000;
}

function getLatestValidDate(values = []) {
    const timestamps = values
        .filter(value => value !== null && value !== undefined && value !== '')
        .map(value => new Date(value).getTime())
        .filter(Number.isFinite);

    return timestamps.length > 0
        ? new Date(Math.max(...timestamps))
        : null;
}

function getPendingVeryUrgentTasks(snapshot = {}) {
    const generalTasks = parseJsonValue(snapshot.tareas_list, []);
    const projects = parseJsonValue(snapshot.projectPulseData, []);

    const safeGeneralTasks = Array.isArray(generalTasks) ? generalTasks : [];
    const safeProjects = Array.isArray(projects) ? projects : [];
    const projectTasks = safeProjects.flatMap(project => (
        Array.isArray(project?.tasks) ? project.tasks : []
    ));

    return [...safeGeneralTasks, ...projectTasks]
        .filter(task => task && !task.completed && task.urgency === 'muy_urgente');
}

function groupSubscriptionsByUser(rows = []) {
    const groups = {};

    rows.forEach(row => {
        const userId = row?.user_id;
        const endpoint = row?.subscription?.endpoint;
        const rowId = row?.id;
        if (!userId || !endpoint || !rowId) return;

        if (!groups[userId]) groups[userId] = [];

        const createdAt = Date.parse(row.created_at || '') || 0;
        const existing = groups[userId].find(item => item.endpoint === endpoint);

        if (!existing) {
            groups[userId].push({
                endpoint,
                subscription: row.subscription,
                activeRowId: rowId,
                activeCreatedAt: createdAt,
                rowIds: [rowId],
                duplicateRowIds: []
            });
            return;
        }

        existing.rowIds.push(rowId);

        if (createdAt >= existing.activeCreatedAt) {
            existing.duplicateRowIds.push(existing.activeRowId);
            existing.subscription = row.subscription;
            existing.activeRowId = rowId;
            existing.activeCreatedAt = createdAt;
        } else {
            existing.duplicateRowIds.push(rowId);
        }
    });

    return groups;
}

function getDuplicateSubscriptionRowIds(groups = {}) {
    return [...new Set(
        Object.values(groups)
            .flat()
            .flatMap(item => item.duplicateRowIds || [])
            .filter(Boolean)
    )];
}

function isExpiredPushError(error) {
    const statusCode = Number(error?.statusCode ?? error?.status);
    return statusCode === 404 || statusCode === 410;
}

function assertServerManagedUserDataPatch(updates) {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        throw new TypeError('La actualización interna de user_data no es válida.');
    }

    const invalidKey = Object.keys(updates)
        .find(key => !SERVER_MANAGED_USER_DATA_KEYS.has(key));
    if (invalidKey) {
        throw new Error(`El backend intentó modificar una clave no permitida: ${invalidKey}`);
    }
}

function formatExpiryStatus(subject, daysUntil) {
    if (!Number.isFinite(daysUntil)) return null;

    if (daysUntil < 0) {
        const elapsed = Math.abs(daysUntil);
        return `${subject} venció hace ${elapsed} ${elapsed === 1 ? 'día' : 'días'}`;
    }
    if (daysUntil === 0) return `${subject} vence hoy`;
    if (daysUntil === 1) return `${subject} vence mañana`;
    return `${subject} vence en ${daysUntil} días`;
}

function buildVehicleDocumentNotification(tracker = {}, getDaysUntil) {
    if (typeof getDaysUntil !== 'function') return null;

    const definitions = [
        { key: 'dniExpDate', subject: 'El DNI', thresholdDays: 30 },
        { key: 'licenseExpDate', subject: 'El registro', thresholdDays: 30 },
        { key: 'insuranceExpDate', subject: 'El seguro', thresholdDays: 7 },
        { key: 'vtvExpDate', subject: 'La VTV', thresholdDays: 30 }
    ];

    const reminders = definitions.flatMap(definition => {
        const value = tracker?.[definition.key];
        if (!value) return [];

        const daysUntil = getDaysUntil(value);
        if (!Number.isFinite(daysUntil) || daysUntil > definition.thresholdDays) return [];

        const status = formatExpiryStatus(definition.subject, daysUntil);
        return status ? [`${status} (${value})`] : [];
    });

    if (reminders.length === 0) return null;
    return {
        title: '📄 Documentación del vehículo',
        body: reminders.join(' · ')
    };
}

function buildVehicleMaintenanceNotification(
    tracker = {},
    rules = {},
    getDaysElapsed,
    getDaysUntil
) {
    if (typeof getDaysElapsed !== 'function' || typeof getDaysUntil !== 'function') {
        return null;
    }

    const fluidRules = rules?.vehicle?.fluids || {};
    const reminders = [];

    const elapsedDefinitions = [
        {
            key: 'refrigeranteDate',
            label: 'Refrigerante',
            limitDays: fluidRules.refrigerante?.days || 90
        },
        {
            key: 'sapitoDate',
            label: 'Líquido limpiavidrios',
            limitDays: fluidRules.sapito?.days || 45
        },
        {
            key: 'escobillasDate',
            label: 'Escobillas',
            limitDays: fluidRules.escobillas?.days_orange || 240
        }
    ];

    elapsedDefinitions.forEach(definition => {
        const value = tracker?.[definition.key];
        if (!value) return;

        const elapsedDays = getDaysElapsed(value);
        if (Number.isFinite(elapsedDays) && elapsedDays >= definition.limitDays) {
            reminders.push(`${definition.label}: ${elapsedDays} días desde el último control`);
        }
    });

    if (tracker?.extintorDate) {
        const thresholdDays = fluidRules.extintor?.days_until_expiry || 30;
        const daysUntil = getDaysUntil(tracker.extintorDate);
        if (Number.isFinite(daysUntil) && daysUntil <= thresholdDays) {
            const status = formatExpiryStatus('El matafuegos', daysUntil);
            if (status) reminders.push(`${status} (${tracker.extintorDate})`);
        }
    }

    if (reminders.length === 0) return null;
    return {
        title: '🚗 Mantenimiento del vehículo',
        body: reminders.join(' · ')
    };
}

function getCustomTrackerRegistry(hygieneData = {}) {
    const registry = hygieneData?.[CUSTOM_TRACKER_FIELD];
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return null;
    if (!Array.isArray(registry.trackers)) return null;
    if (!registry.histories || typeof registry.histories !== 'object' || Array.isArray(registry.histories)) {
        return null;
    }
    return registry;
}

function ensureCustomTrackerAlertConfigs(alertsConfig, hygieneData = {}) {
    const registry = getCustomTrackerRegistry(hygieneData);
    if (!registry || !alertsConfig || typeof alertsConfig !== 'object') return false;

    let changed = false;
    registry.trackers.forEach(tracker => {
        if (
            !tracker
            || tracker.archived
            || typeof tracker.id !== 'string'
            || !/^ct_[a-z0-9_-]{6,64}$/.test(tracker.id)
        ) {
            return;
        }

        const key = `${CUSTOM_ALERT_PREFIX}${tracker.id}`;
        if (!alertsConfig[key]) {
            const time = typeof tracker.alert?.time === 'string'
                && /^([01]\d|2[0-3]):([0-5]\d)$/.test(tracker.alert.time)
                ? tracker.alert.time
                : '23:00';
            alertsConfig[key] = {
                enabled: tracker.alert?.enabled === true,
                time,
                days: []
            };
            changed = true;
        }
    });
    return changed;
}

function buildCustomTrackerNotification(
    alertKey,
    hygieneData = {},
    getDaysElapsed
) {
    if (
        typeof alertKey !== 'string'
        || !alertKey.startsWith(CUSTOM_ALERT_PREFIX)
        || typeof getDaysElapsed !== 'function'
    ) {
        return null;
    }

    const registry = getCustomTrackerRegistry(hygieneData);
    if (!registry) return null;

    const trackerId = alertKey.slice(CUSTOM_ALERT_PREFIX.length);
    const tracker = registry.trackers.find(item => item?.id === trackerId);
    if (!tracker || tracker.archived) return null;

    const name = typeof tracker.name === 'string'
        ? tracker.name.replace(/\s+/g, ' ').trim().slice(0, 80)
        : '';
    const intervalDays = Number.parseInt(tracker.intervalDays, 10);
    const history = Array.isArray(registry.histories[trackerId])
        ? registry.histories[trackerId]
        : [];
    const lastEntry = history.find(value => (
        typeof value === 'string' && Number.isFinite(Date.parse(value))
    ));
    if (!name || !Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650 || !lastEntry) {
        return null;
    }

    const elapsedDays = getDaysElapsed(lastEntry);
    if (!Number.isFinite(elapsedDays) || elapsedDays < intervalDays) return null;

    return {
        title: `📅 ${name}`,
        body: `El seguimiento está vencido: pasaron ${elapsedDays} de ${intervalDays} días.`
    };
}

module.exports = {
    assertServerManagedUserDataPatch,
    buildCustomTrackerNotification,
    buildVehicleDocumentNotification,
    buildVehicleMaintenanceNotification,
    ensureCustomTrackerAlertConfigs,
    formatExpiryStatus,
    getDuplicateSubscriptionRowIds,
    getLatestValidDate,
    getPendingVeryUrgentTasks,
    groupSubscriptionsByUser,
    isExpiredPushError,
    isIntervalReminderDue,
    normalizeIntervalHours,
    parseJsonValue
};
