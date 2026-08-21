'use strict';

const SERVER_MANAGED_USER_DATA_KEYS = new Set([
    'alerts_sent_log',
    'robot_last_notified_at',
    'very_urgent_last_notified_at'
]);
const CUSTOM_TRACKER_FIELD = '__trackers_v2';
const LEGACY_CUSTOM_TRACKER_FIELD = '__custom_trackers_v1';
const CUSTOM_ALERT_PREFIX = 'custom_tracker:';
const VEHICLE_CATALOG_FIELD = 'vehicleCatalog';
const VEHICLE_ALERT_PREFIX = 'vehicle_card:';
const DEPRECATED_VEHICLE_ALERT_KEYS = new Set([
    'vehicle_oil',
    'vehicle_align',
    'vehicle_rot',
    'vehicle_replace',
    'vehicle_docs_check',
    'vehicle_fluids_check'
]);
const ARGENTINA_UTC_OFFSET = '-03:00';
const TIMED_NOTIFICATION_GRACE_MINUTES = 15;
const DEFAULT_PUSH_TTL_SECONDS = TIMED_NOTIFICATION_GRACE_MINUTES * 60;
const MAX_WEB_PUSH_TTL_SECONDS = 28 * 24 * 60 * 60;
const WEB_PUSH_URGENCIES = new Set(['very-low', 'low', 'normal', 'high']);

function parseDateOnly(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);
    if (
        parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== day
    ) {
        return null;
    }
    return parsed;
}

function normalizeNotificationTime(value, fallback = '23:00') {
    const candidate = /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ''))
        ? String(value)
        : String(fallback || '');
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(candidate)
        ? candidate
        : '23:00';
}

function getCalendarDayDifference(startValue, endValue) {
    const start = parseDateOnly(String(startValue || '').split('T')[0]);
    const end = parseDateOnly(String(endValue || '').split('T')[0]);
    if (!start || !end) return null;
    return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function createTimedNotificationWindow({
    dateStr,
    time = '23:00',
    now = new Date(),
    graceMinutes = TIMED_NOTIFICATION_GRACE_MINUTES,
    force = false
} = {}) {
    if (!parseDateOnly(dateStr)) return null;

    const safeTime = normalizeNotificationTime(time);
    const scheduledAt = new Date(`${dateStr}T${safeTime}:00${ARGENTINA_UTC_OFFSET}`);
    const nowDate = new Date(now);
    if (!Number.isFinite(scheduledAt.getTime()) || !Number.isFinite(nowDate.getTime())) {
        return null;
    }

    const parsedGrace = Number.parseInt(graceMinutes, 10);
    const safeGrace = Number.isInteger(parsedGrace)
        ? Math.min(60, Math.max(1, parsedGrace))
        : TIMED_NOTIFICATION_GRACE_MINUTES;
    const expiresAt = new Date(scheduledAt.getTime() + safeGrace * 60 * 1000);
    const nowTime = nowDate.getTime();

    return {
        scheduledAt: scheduledAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        due: force || (
            nowTime >= scheduledAt.getTime()
            && nowTime <= expiresAt.getTime()
        ),
        expired: nowTime > expiresAt.getTime()
    };
}

function createPushDeliveryPolicy({
    scheduledAt = null,
    expiresAt = null,
    now = new Date(),
    ttlSeconds = DEFAULT_PUSH_TTL_SECONDS,
    urgency = 'normal'
} = {}) {
    const nowDate = new Date(now);
    if (!Number.isFinite(nowDate.getTime())) return null;

    const parsedTtl = Number.parseInt(ttlSeconds, 10);
    const safeTtl = Number.isInteger(parsedTtl)
        ? Math.min(MAX_WEB_PUSH_TTL_SECONDS, Math.max(1, parsedTtl))
        : DEFAULT_PUSH_TTL_SECONDS;
    const scheduledDate = new Date(scheduledAt || nowDate);
    const safeScheduledDate = Number.isFinite(scheduledDate.getTime())
        ? scheduledDate
        : nowDate;
    const expiresDate = new Date(expiresAt || '');
    const safeExpiresDate = Number.isFinite(expiresDate.getTime())
        && expiresDate.getTime() > safeScheduledDate.getTime()
        ? expiresDate
        : new Date(safeScheduledDate.getTime() + safeTtl * 1000);
    const remainingMs = safeExpiresDate.getTime() - nowDate.getTime();

    return {
        scheduledAt: safeScheduledDate.toISOString(),
        expiresAt: safeExpiresDate.toISOString(),
        TTL: Math.min(
            MAX_WEB_PUSH_TTL_SECONDS,
            Math.max(1, Math.ceil(remainingMs / 1000))
        ),
        urgency: WEB_PUSH_URGENCIES.has(urgency) ? urgency : 'normal',
        expired: remainingMs < 0
    };
}

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
                deviceName: row.device_name || null,
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
            existing.deviceName = row.device_name || null;
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

function getVehicleCatalog(trackerData = {}) {
    const catalog = trackerData?.[VEHICLE_CATALOG_FIELD];
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) return null;
    if (!Array.isArray(catalog.cards)) return null;
    if (!catalog.records || typeof catalog.records !== 'object' || Array.isArray(catalog.records)) {
        return null;
    }
    return catalog;
}

function getVehicleCardAlertKey(card) {
    if (
        typeof card?.alertKey === 'string'
        && /^[a-z0-9:_-]{3,120}$/.test(card.alertKey)
    ) {
        return card.alertKey;
    }
    return typeof card?.id === 'string'
        ? `${VEHICLE_ALERT_PREFIX}${card.id}`
        : '';
}

function ensureVehicleCatalogAlertConfigs(alertsConfig, trackerData = {}) {
    const catalog = getVehicleCatalog(trackerData);
    if (!catalog || !alertsConfig || typeof alertsConfig !== 'object') return false;
    let changed = false;
    catalog.cards.forEach(card => {
        if (!card || card.deleted || card.archived || typeof card.id !== 'string') return;
        const key = getVehicleCardAlertKey(card);
        if (!key || alertsConfig[key]) return;
        const legacyConfig = typeof card.legacyAlertGroup === 'string'
            ? alertsConfig[card.legacyAlertGroup]
            : null;
        const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(card.alert?.time || '')
            ? card.alert.time
            : (card.section === 'documents' ? '09:00' : '23:00');
        alertsConfig[key] = {
            enabled: legacyConfig?.enabled ?? (card.alert?.enabled === true),
            time: legacyConfig?.time || time,
            days: Array.isArray(legacyConfig?.days) ? legacyConfig.days : []
        };
        changed = true;
    });
    return changed;
}

function getLatestVehicleRecord(card, records) {
    const values = Array.isArray(records) ? records.filter(Boolean) : [];
    return [...values].sort((a, b) => {
        if (card.type === 'maintenance') {
            return (Number(b.km) || 0) - (Number(a.km) || 0)
                || String(b.date || '').localeCompare(String(a.date || ''));
        }
        return String(b.date || '').localeCompare(String(a.date || ''));
    })[0] || null;
}

function buildVehicleCatalogNotification(
    alertKey,
    trackerData = {},
    currentOdo = 0,
    getDaysElapsed,
    getDaysUntil
) {
    const catalog = getVehicleCatalog(trackerData);
    if (!catalog) return null;
    const cardId = typeof alertKey === 'string' && alertKey.startsWith(VEHICLE_ALERT_PREFIX)
        ? alertKey.slice(VEHICLE_ALERT_PREFIX.length)
        : null;
    const card = catalog.cards.find(item => (
        getVehicleCardAlertKey(item) === alertKey
        || (cardId && item?.id === cardId)
    ));
    if (!card && DEPRECATED_VEHICLE_ALERT_KEYS.has(alertKey)) {
        return { handled: true, shouldNotify: false };
    }
    if (!card) return null;
    if (card.archived || card.deleted) {
        return { handled: true, shouldNotify: false };
    }
    const record = getLatestVehicleRecord(card, catalog.records[card.id]);
    const name = typeof card.name === 'string'
        ? card.name.replace(/\s+/g, ' ').trim().slice(0, 80)
        : '';
    if (!record?.date || !name) {
        return { handled: true, shouldNotify: false };
    }

    if (card.type === 'document') {
        if (typeof getDaysUntil !== 'function') return null;
        const daysUntil = getDaysUntil(record.date);
        const warningDays = Number.parseInt(card.warningDays, 10) || 30;
        if (!Number.isFinite(daysUntil) || daysUntil > warningDays) {
            return { handled: true, shouldNotify: false };
        }
        const status = formatExpiryStatus(name, daysUntil);
        return {
            handled: true,
            shouldNotify: Boolean(status),
            title: `🚗 ${name}`,
            body: status || ''
        };
    }

    if (typeof getDaysElapsed !== 'function') return null;
    const intervalDays = Number.parseInt(card.intervalDays, 10) || null;
    const elapsedDays = getDaysElapsed(record.date);
    const dueByDays = intervalDays && Number.isFinite(elapsedDays)
        ? elapsedDays >= intervalDays
        : false;
    const intervalKm = Number.parseInt(card.intervalKm, 10) || null;
    const dueByKm = card.type === 'maintenance' && intervalKm
        ? (Number(record.km) || 0) + intervalKm - (Number(currentOdo) || 0) <= 0
        : false;
    if (!dueByDays && !dueByKm) {
        return { handled: true, shouldNotify: false };
    }
    const reasons = [];
    if (dueByKm) reasons.push('alcanzó el kilometraje configurado');
    if (dueByDays) reasons.push(`pasaron ${elapsedDays} días`);
    return {
        handled: true,
        shouldNotify: true,
        title: `🚗 ${name}`,
        body: `${name} requiere atención: ${reasons.join(' y ')}.`
    };
}

function getCustomTrackerRegistry(hygieneData = {}) {
    const registry = hygieneData?.[CUSTOM_TRACKER_FIELD]
        || hygieneData?.[LEGACY_CUSTOM_TRACKER_FIELD];
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return null;
    if (!Array.isArray(registry.trackers)) return null;
    if (!registry.histories || typeof registry.histories !== 'object' || Array.isArray(registry.histories)) {
        return null;
    }
    return registry;
}

function getCustomTrackerAlertKey(tracker) {
    return typeof tracker?.alertKey === 'string'
        && /^[a-z0-9:_-]{3,120}$/.test(tracker.alertKey)
        ? tracker.alertKey
        : `${CUSTOM_ALERT_PREFIX}${tracker?.id || ''}`;
}

function getStateReminderEntries(hygieneData = {}) {
    const registry = getCustomTrackerRegistry(hygieneData);
    if (!registry) return [];

    return registry.trackers
        .filter(tracker => (
            tracker
            && !tracker.archived
            && !tracker.deleted
            && tracker.template === 'state-reminder'
            && typeof tracker.id === 'string'
            && /^(?:ct|trk)_[a-z0-9_-]{3,96}$/.test(tracker.id)
        ))
        .map(tracker => {
            const activatedAt = tracker.state?.active === true
                && Number.isFinite(Date.parse(tracker.state?.activatedAt))
                ? new Date(tracker.state.activatedAt).toISOString()
                : null;
            return {
                trackerId: tracker.id,
                alertKey: getCustomTrackerAlertKey(tracker),
                name: typeof tracker.name === 'string'
                    ? tracker.name.replace(/\s+/g, ' ').trim().slice(0, 80)
                    : 'Recordatorio',
                active: Boolean(activatedAt),
                activatedAt,
                intervalHours: normalizeIntervalHours(
                    tracker.behavior?.intervalHours,
                    6
                )
            };
        });
}

function ensureCustomTrackerAlertConfigs(alertsConfig, hygieneData = {}) {
    const registry = getCustomTrackerRegistry(hygieneData);
    if (!registry || !alertsConfig || typeof alertsConfig !== 'object') return false;

    let changed = false;
    registry.trackers.forEach(tracker => {
        if (
            !tracker
            || tracker.archived
            || tracker.deleted
            || typeof tracker.id !== 'string'
            || !/^(?:ct|trk)_[a-z0-9_-]{3,96}$/.test(tracker.id)
        ) {
            return;
        }

        const key = getCustomTrackerAlertKey(tracker);
        const isStateReminder = tracker.template === 'state-reminder';
        const intervalHours = isStateReminder
            ? normalizeIntervalHours(tracker.behavior?.intervalHours, 6)
            : null;
        if (!alertsConfig[key]) {
            const time = typeof tracker.alert?.time === 'string'
                && /^([01]\d|2[0-3]):([0-5]\d)$/.test(tracker.alert.time)
                ? tracker.alert.time
                : '23:00';
            alertsConfig[key] = {
                enabled: tracker.alert?.enabled === true,
                time,
                days: [],
                ...(isStateReminder ? { interval_hours: intervalHours } : {})
            };
            changed = true;
        } else if (
            isStateReminder
            && alertsConfig[key].interval_hours !== intervalHours
        ) {
            alertsConfig[key].interval_hours = intervalHours;
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
        || typeof getDaysElapsed !== 'function'
    ) {
        return null;
    }

    const registry = getCustomTrackerRegistry(hygieneData);
    if (!registry) return null;

    const trackerId = alertKey.startsWith(CUSTOM_ALERT_PREFIX)
        ? alertKey.slice(CUSTOM_ALERT_PREFIX.length)
        : null;
    const tracker = registry.trackers.find(item => (
        item?.alertKey === alertKey
        || (trackerId && item?.id === trackerId)
    ));
    if (!tracker) return null;
    if (tracker.archived || tracker.deleted) {
        return {
            handled: true,
            shouldNotify: false
        };
    }
    if (tracker.template === 'state-reminder') {
        return {
            handled: true,
            shouldNotify: false
        };
    }

    const name = typeof tracker.name === 'string'
        ? tracker.name.replace(/\s+/g, ' ').trim().slice(0, 80)
        : '';
    const cadenceMonths = tracker.cadence?.unit === 'months'
        ? Number.parseInt(tracker.cadence.value, 10)
        : null;
    const intervalDays = Number.parseInt(
        tracker.thresholds?.red
        ?? tracker.intervalDays
        ?? (
            cadenceMonths
                ? Math.round(cadenceMonths * 30.5)
                : tracker.cadence?.value
        ),
        10
    );
    const history = Array.isArray(registry.histories[tracker.id])
        ? registry.histories[tracker.id]
        : [];
    const lastEntry = history.find(value => (
        typeof value === 'string' && Number.isFinite(Date.parse(value))
    ));
    if (!name || !Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650 || !lastEntry) {
        return {
            handled: true,
            shouldNotify: false
        };
    }

    const elapsedDays = getDaysElapsed(lastEntry);
    if (!Number.isFinite(elapsedDays) || elapsedDays < intervalDays) {
        return {
            handled: true,
            shouldNotify: false
        };
    }

    return {
        handled: true,
        shouldNotify: true,
        title: `📅 ${name}`,
        body: `El seguimiento está vencido: pasaron ${elapsedDays} de ${intervalDays} días.`
    };
}

module.exports = {
    DEFAULT_PUSH_TTL_SECONDS,
    TIMED_NOTIFICATION_GRACE_MINUTES,
    assertServerManagedUserDataPatch,
    buildCustomTrackerNotification,
    buildVehicleDocumentNotification,
    buildVehicleMaintenanceNotification,
    buildVehicleCatalogNotification,
    createPushDeliveryPolicy,
    createTimedNotificationWindow,
    ensureCustomTrackerAlertConfigs,
    ensureVehicleCatalogAlertConfigs,
    formatExpiryStatus,
    getCalendarDayDifference,
    getDuplicateSubscriptionRowIds,
    getStateReminderEntries,
    getLatestValidDate,
    getPendingVeryUrgentTasks,
    groupSubscriptionsByUser,
    isExpiredPushError,
    isIntervalReminderDue,
    normalizeNotificationTime,
    normalizeIntervalHours,
    parseJsonValue
};
