export const RECURRING_REMINDERS_FIELD = '__recurring_reminders';
export const RECURRING_REMINDER_SCHEMA_VERSION = 2;

export const RECURRING_SCHEDULE_TYPES = Object.freeze([
    'weekly',
    'monthly',
    'yearly'
]);

export const RECURRING_REMINDER_CATEGORIES = Object.freeze([
    'higiene',
    'cuidado',
    'lentes',
    'salud',
    'vehiculo',
    'gym',
    'trading',
    'otros'
]);

export const DEFAULT_RECURRING_REMINDERS = Object.freeze([
    Object.freeze({
        id: 'laundry',
        name: 'Recordatorio Lavar Ropa (Lavarropas)',
        category: 'higiene',
        title: '🧺 Lavarropas',
        body: '¡No te olvides de poner a lavar la ropa en el lavarropas hoy!',
        defaultTime: '10:00',
        defaultDays: Object.freeze([1, 2, 3, 4, 5, 6, 0])
    }),
    Object.freeze({
        id: 'creatine',
        name: 'Creatina',
        category: 'gym',
        title: '💪 Creatina',
        body: '¡No te olvides de tomar la creatina de hoy!',
        defaultTime: '23:00',
        defaultDays: Object.freeze([1, 2, 3, 4, 5, 6, 0])
    }),
    Object.freeze({
        id: 'salmon',
        name: 'Salmón & Omega 3',
        category: 'gym',
        title: '🐟 Salmón & Omega 3',
        body: 'Recordá sacar el salmón para mañana lunes para comer Omega 3.',
        defaultTime: '17:00',
        defaultDays: Object.freeze([0])
    }),
    Object.freeze({
        id: 'neck',
        name: 'Entrenamiento de Cuello',
        category: 'gym',
        title: '💪 Entrenamiento de Cuello',
        body: 'Recordá entrenar el cuello hoy (1 vez por semana).',
        defaultTime: '23:30',
        defaultDays: Object.freeze([5, 6])
    }),
    Object.freeze({
        id: 'weigh_in',
        name: 'Recordatorio para Pesarme',
        category: 'gym',
        title: '⚖️ Control de Peso',
        body: '¡Buen día! No te olvides de pesarte hoy antes de desayunar.',
        defaultTime: '08:00',
        defaultDays: Object.freeze([1, 2, 3, 4, 5, 6, 0])
    }),
    Object.freeze({
        id: 'trading',
        name: 'Revisión Trading & Mercado',
        category: 'trading',
        title: '📈 Trading & Mercado',
        body: 'Recordá revisar el mercado y tus posiciones de trading de hoy.',
        defaultTime: '10:00',
        defaultDays: Object.freeze([1, 2, 3, 4, 5])
    })
]);

const CATEGORY_SET = new Set(RECURRING_REMINDER_CATEGORIES);
const SCHEDULE_TYPE_SET = new Set(RECURRING_SCHEDULE_TYPES);
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,95}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function cleanText(value, maxLength, fallback = '') {
    const result = String(value ?? '').replace(/\s+/g, ' ').trim();
    return (result || fallback).slice(0, maxLength);
}

function normalizeDays(value, fallback = []) {
    const source = Array.isArray(value) ? value : fallback;
    return [...new Set(source.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))];
}

function normalizeBoundedInteger(value, fallback, min, max) {
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max
        ? number
        : fallback;
}

export function normalizeRecurringSchedule(value, fallback = null) {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
    const fallbackSource = fallback && typeof fallback === 'object' && !Array.isArray(fallback)
        ? fallback
        : {};
    const typeCandidate = String(source.type || fallbackSource.type || 'weekly');
    const type = SCHEDULE_TYPE_SET.has(typeCandidate) ? typeCandidate : 'weekly';

    if (type === 'monthly') {
        return {
            type,
            day: normalizeBoundedInteger(
                source.day,
                normalizeBoundedInteger(fallbackSource.day, 1, 1, 31),
                1,
                31
            ),
            overflow: 'last-day'
        };
    }
    if (type === 'yearly') {
        return {
            type,
            month: normalizeBoundedInteger(
                source.month,
                normalizeBoundedInteger(fallbackSource.month, 1, 1, 12),
                1,
                12
            ),
            day: normalizeBoundedInteger(
                source.day,
                normalizeBoundedInteger(fallbackSource.day, 1, 1, 31),
                1,
                31
            ),
            overflow: 'last-day'
        };
    }
    return {
        type: 'weekly',
        days: normalizeDays(
            source.days,
            normalizeDays(fallbackSource.days, [1, 2, 3, 4, 5, 6, 0])
        )
    };
}

export function describeRecurringSchedule(value) {
    const schedule = normalizeRecurringSchedule(value);
    if (schedule.type === 'monthly') {
        return `Mensual · día ${schedule.day} (o último día válido)`;
    }
    if (schedule.type === 'yearly') {
        const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long' })
            .format(new Date(2024, schedule.month - 1, 1));
        return `Anual · ${schedule.day} de ${monthName}`;
    }
    const labels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    return `Semanal · ${schedule.days.map(day => labels[day]).join(', ')}`;
}

export function matchesRecurringSchedule(value, candidate) {
    const schedule = normalizeRecurringSchedule(value);
    const year = Number(candidate?.year);
    const month = Number(candidate?.month);
    const day = Number(candidate?.day);
    const dayOfWeek = Number(candidate?.dayOfWeek);
    if (
        !Number.isInteger(year)
        || !Number.isInteger(month)
        || month < 1
        || month > 12
        || !Number.isInteger(day)
        || day < 1
        || day > 31
    ) return false;

    if (schedule.type === 'weekly') {
        return Number.isInteger(dayOfWeek) && schedule.days.includes(dayOfWeek);
    }
    if (schedule.type === 'yearly' && month !== schedule.month) return false;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day === Math.min(schedule.day, lastDay);
}

export function normalizeRecurringReminder(reminder, fallback = {}) {
    const idCandidate = cleanText(reminder?.id, 96, fallback.id).toLowerCase();
    if (!ID_PATTERN.test(idCandidate)) return null;
    const categoryCandidate = cleanText(reminder?.category, 24, fallback.category);
    const defaultTimeCandidate = cleanText(reminder?.defaultTime, 5, fallback.defaultTime || '09:00');

    const defaultSchedule = normalizeRecurringSchedule(
        reminder?.defaultSchedule || reminder?.schedule || (
            Array.isArray(reminder?.defaultDays)
                ? { type: 'weekly', days: reminder.defaultDays }
                : null
        ),
        fallback.defaultSchedule || fallback.schedule || (
            Array.isArray(fallback.defaultDays)
                ? { type: 'weekly', days: fallback.defaultDays }
                : null
        )
    );

    return {
        id: idCandidate,
        name: cleanText(reminder?.name, 90, fallback.name || 'Recordatorio'),
        category: CATEGORY_SET.has(categoryCandidate) ? categoryCandidate : 'otros',
        title: cleanText(reminder?.title, 100, fallback.title || reminder?.name || 'Recordatorio'),
        body: cleanText(reminder?.body, 240, fallback.body || 'Tenés un recordatorio pendiente.'),
        defaultTime: TIME_PATTERN.test(defaultTimeCandidate) ? defaultTimeCandidate : '09:00',
        defaultSchedule,
        defaultDays: defaultSchedule.type === 'weekly' ? [...defaultSchedule.days] : [],
        createdAt: cleanText(reminder?.createdAt, 40, fallback.createdAt),
        updatedAt: cleanText(reminder?.updatedAt, 40, fallback.updatedAt)
    };
}

function cloneDefaultReminders() {
    return DEFAULT_RECURRING_REMINDERS.map(reminder => normalizeRecurringReminder(reminder));
}

export function normalizeRecurringReminderRegistry(value, { useDefaultsWhenMissing = true } = {}) {
    const hasStoredRegistry = value && typeof value === 'object' && !Array.isArray(value);
    const candidates = hasStoredRegistry && Array.isArray(value.reminders)
        ? value.reminders
        : (useDefaultsWhenMissing ? cloneDefaultReminders() : []);
    const reminders = [];
    const ids = new Set();

    candidates.slice(0, 200).forEach(candidate => {
        const migratedCandidate = Number(value?.version || 1) < 2
            && candidate?.id === 'trading'
            && candidate?.category === 'gym'
            ? { ...candidate, category: 'trading' }
            : candidate;
        const normalized = normalizeRecurringReminder(migratedCandidate);
        if (!normalized || ids.has(normalized.id)) return;
        ids.add(normalized.id);
        reminders.push(normalized);
    });

    return {
        version: RECURRING_REMINDER_SCHEMA_VERSION,
        reminders
    };
}

export function migrateRecurringReminderConfigs(alertConfigs, { legacyGymReminders = {} } = {}) {
    const result = alertConfigs && typeof alertConfigs === 'object' && !Array.isArray(alertConfigs)
        ? { ...alertConfigs }
        : {};
    const registry = normalizeRecurringReminderRegistry(result[RECURRING_REMINDERS_FIELD]);
    result[RECURRING_REMINDERS_FIELD] = registry;

    registry.reminders.forEach(reminder => {
        const current = result[reminder.id] && typeof result[reminder.id] === 'object'
            ? result[reminder.id]
            : {};
        const legacy = legacyGymReminders?.[reminder.id] || {};
        const schedule = normalizeRecurringSchedule(
            current.schedule || (
                Array.isArray(current.days) ? { type: 'weekly', days: current.days } : null
            ),
            legacy.schedule || (
                Array.isArray(legacy.days)
                    ? { type: 'weekly', days: legacy.days }
                    : reminder.defaultSchedule
            )
        );
        result[reminder.id] = {
            enabled: current.enabled ?? legacy.enabled ?? true,
            time: TIME_PATTERN.test(current.time || '')
                ? current.time
                : (TIME_PATTERN.test(legacy.time || '') ? legacy.time : reminder.defaultTime),
            schedule,
            days: schedule.type === 'weekly' ? [...schedule.days] : []
        };
    });
    return result;
}

export function buildRecurringReminderDefinitions(alertConfigs) {
    const registry = normalizeRecurringReminderRegistry(
        alertConfigs?.[RECURRING_REMINDERS_FIELD]
    );
    return registry.reminders.map(reminder => ({
        key: reminder.id,
        name: reminder.name,
        category: reminder.category,
        type: 'recurring',
        defaultEnabled: true,
        defaultTime: reminder.defaultTime,
        defaultDays: [...reminder.defaultDays],
        defaultSchedule: normalizeRecurringSchedule(reminder.defaultSchedule),
        recurringReminder: true
    }));
}

export function upsertRecurringReminder(alertConfigs, reminderInput, { now = new Date() } = {}) {
    const result = migrateRecurringReminderConfigs(alertConfigs);
    const registry = normalizeRecurringReminderRegistry(result[RECURRING_REMINDERS_FIELD]);
    const timestamp = (now instanceof Date ? now : new Date(now)).toISOString();
    const existingIndex = registry.reminders.findIndex(reminder => reminder.id === reminderInput?.id);
    const existing = existingIndex >= 0 ? registry.reminders[existingIndex] : {};
    const normalized = normalizeRecurringReminder({
        ...existing,
        ...reminderInput,
        defaultTime: reminderInput?.defaultTime
            || reminderInput?.time
            || existing.defaultTime,
        defaultDays: reminderInput?.defaultDays
            || reminderInput?.days
            || existing.defaultDays,
        defaultSchedule: reminderInput?.schedule
            || reminderInput?.defaultSchedule
            || existing.defaultSchedule,
        createdAt: existing.createdAt || timestamp,
        updatedAt: timestamp
    });
    if (!normalized) throw new TypeError('El identificador del recordatorio no es válido.');

    if (existingIndex >= 0) registry.reminders[existingIndex] = normalized;
    else registry.reminders.push(normalized);
    result[RECURRING_REMINDERS_FIELD] = registry;

    const previousConfig = result[normalized.id] || {};
    const schedule = normalizeRecurringSchedule(
        reminderInput?.schedule || previousConfig.schedule || normalized.defaultSchedule,
        normalized.defaultSchedule
    );
    result[normalized.id] = {
        enabled: previousConfig.enabled ?? true,
        time: reminderInput?.time || previousConfig.time || normalized.defaultTime,
        schedule,
        days: schedule.type === 'weekly' ? [...schedule.days] : []
    };
    return result;
}

export function removeRecurringReminder(alertConfigs, reminderId) {
    const result = migrateRecurringReminderConfigs(alertConfigs);
    const registry = normalizeRecurringReminderRegistry(result[RECURRING_REMINDERS_FIELD]);
    registry.reminders = registry.reminders.filter(reminder => reminder.id !== reminderId);
    result[RECURRING_REMINDERS_FIELD] = registry;
    delete result[reminderId];
    return result;
}

export function createRecurringReminderId(name, existingIds = []) {
    const base = cleanText(name, 60, 'recordatorio')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'recordatorio';
    const used = new Set(existingIds.map(String));
    let suffix = 1;
    let candidate = `reminder_${base}`;
    while (used.has(candidate)) {
        suffix += 1;
        candidate = `reminder_${base}_${suffix}`;
    }
    return candidate;
}
