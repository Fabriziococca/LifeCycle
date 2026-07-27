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

module.exports = {
    assertServerManagedUserDataPatch,
    getDuplicateSubscriptionRowIds,
    getLatestValidDate,
    getPendingVeryUrgentTasks,
    groupSubscriptionsByUser,
    isExpiredPushError,
    normalizeIntervalHours,
    parseJsonValue
};
