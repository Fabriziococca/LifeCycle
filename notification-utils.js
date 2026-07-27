'use strict';

const SERVER_MANAGED_USER_DATA_KEYS = new Set([
    'alerts_sent_log',
    'robot_last_notified_at',
    'very_urgent_last_notified_at'
]);

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

module.exports = {
    assertServerManagedUserDataPatch,
    buildVehicleDocumentNotification,
    buildVehicleMaintenanceNotification,
    formatExpiryStatus,
    getDuplicateSubscriptionRowIds,
    getLatestValidDate,
    getPendingVeryUrgentTasks,
    groupSubscriptionsByUser,
    isExpiredPushError,
    normalizeIntervalHours,
    parseJsonValue
};
