import { normalizeAlertTimes } from './alert-schedule-utils.mjs';

export const SUBSCRIPTION_SCHEMA_VERSION = 2;
export const SUBSCRIPTION_STORAGE_KEY = 'lifecycle_subscriptions';

export const SUBSCRIPTION_CATEGORIES = Object.freeze([
    'trabajo', 'software', 'streaming', 'servicios', 'otros'
]);

export const SUBSCRIPTION_CATEGORY_LABELS = Object.freeze({
    trabajo: 'Trabajo y freelance',
    software: 'Software y herramientas',
    streaming: 'Entretenimiento y streaming',
    servicios: 'Servicios y utilidades',
    otros: 'Otros'
});

export const SUBSCRIPTION_STATUSES = Object.freeze(['active', 'paused', 'canceled']);
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SUBSCRIPTION_ID_PATTERN = /^sub_[a-z0-9][a-z0-9_-]{2,95}$/;

function formatDateOnly(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

export function parseSubscriptionDate(value) {
    const match = DATE_ONLY_PATTERN.exec(String(value || ''));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
        parsed.getFullYear() !== year
        || parsed.getMonth() !== month - 1
        || parsed.getDate() !== day
    ) return null;
    return parsed;
}

function normalizeIsoTimestamp(value, fallback) {
    return Number.isFinite(Date.parse(value))
        ? new Date(value).toISOString()
        : fallback;
}

function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function slugify(value) {
    return String(value || 'suscripcion')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'suscripcion';
}

export function createSubscriptionId(existingIds = []) {
    const used = new Set(existingIds.map(String));
    const randomPart = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 20)
        || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    let candidate = `sub_${randomPart.toLowerCase()}`;
    let suffix = 2;
    while (used.has(candidate)) candidate = `sub_${randomPart}_${suffix++}`;
    return candidate;
}

export function addMonthsToDate(dateInput, monthsToAdd) {
    const baseDate = dateInput instanceof Date
        ? new Date(dateInput)
        : parseSubscriptionDate(dateInput);
    if (!baseDate || Number.isNaN(baseDate.getTime())) return null;
    const monthDelta = Number.isInteger(Number(monthsToAdd)) ? Number(monthsToAdd) : 0;
    const anchorDay = baseDate.getDate();
    const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthDelta, 1, 12);
    const finalDay = Math.min(
        anchorDay,
        new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    );
    target.setDate(finalDay);
    return formatDateOnly(target);
}

function addMonthsWithBillingAnchor(dateInput, monthsToAdd, anchorDay, anchorIsMonthEnd) {
    const baseDate = dateInput instanceof Date
        ? new Date(dateInput)
        : parseSubscriptionDate(dateInput);
    if (!baseDate || Number.isNaN(baseDate.getTime())) return null;
    const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthsToAdd, 1, 12);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(anchorIsMonthEnd ? lastDay : Math.min(anchorDay, lastDay));
    return formatDateOnly(target);
}

export function calculateNextRenewalDate(startDate, periodMonths, referenceDate = new Date()) {
    if (!parseSubscriptionDate(startDate)) return null;
    const period = Math.min(120, Math.max(1, Math.trunc(Number(periodMonths) || 1)));
    const reference = new Date(referenceDate);
    reference.setHours(0, 0, 0, 0);
    // Every occurrence is calculated from the original billing anchor. Chaining
    // Jan 31 -> Feb 28 -> Mar 28 would otherwise drift away from month-end.
    for (let occurrence = 1; occurrence <= 1200; occurrence += 1) {
        const next = addMonthsToDate(startDate, period * occurrence);
        const parsed = parseSubscriptionDate(next);
        if (parsed && parsed >= reference) return next;
    }
    return null;
}

export function getDaysUntilRenewal(renewalDate, referenceDate = new Date()) {
    const target = parseSubscriptionDate(renewalDate);
    if (!target) return null;
    const reference = new Date(referenceDate);
    reference.setHours(12, 0, 0, 0);
    return Math.round((target - reference) / 86_400_000);
}

export function calculateMonthlyEquivalent(cost, periodMonths) {
    const amount = Math.max(0, Number(cost) || 0);
    const period = Math.min(120, Math.max(1, Math.trunc(Number(periodMonths) || 1)));
    return Math.round((amount / period) * 100) / 100;
}

function normalizeHistory(history, fallbackCost, fallbackCurrency) {
    if (!Array.isArray(history)) return [];
    return history.slice(-5000).flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const occurredAt = normalizeIsoTimestamp(
            item.occurredAt || (parseSubscriptionDate(item.date) ? `${item.date}T12:00:00.000Z` : null),
            null
        );
        if (!occurredAt) return [];
        const type = ['created', 'updated', 'renewed', 'expense-recorded', 'paused', 'canceled', 'reactivated']
            .includes(item.type) ? item.type : 'renewed';
        return [{
            id: String(item.id || `subevt_${stableHash(`${occurredAt}:${type}:${index}`)}`).slice(0, 120),
            type,
            occurredAt,
            effectiveDate: parseSubscriptionDate(item.effectiveDate || item.date)
                ? (item.effectiveDate || item.date)
                : occurredAt.slice(0, 10),
            cost: Math.max(0, Number(item.cost) || fallbackCost),
            currency: item.currency === 'ARS' ? 'ARS' : fallbackCurrency,
            occurrenceKey: String(item.occurrenceKey || '').slice(0, 180) || null,
            note: String(item.note || '').trim().slice(0, 500)
        }];
    });
}

export function normalizeSubscription(raw, now = new Date()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const nowDate = new Date(now);
    const safeNow = Number.isNaN(nowDate.getTime()) ? new Date() : nowDate;
    const nowIso = safeNow.toISOString();
    const today = formatDateOnly(safeNow);
    const name = String(raw.name || '').replace(/\s+/g, ' ').trim().slice(0, 120)
        || 'Suscripción sin nombre';
    const startDate = parseSubscriptionDate(raw.startDate) ? raw.startDate : today;
    const periodMonths = Math.min(120, Math.max(1, Math.trunc(Number(raw.periodMonths || raw.cycle) || 1)));
    const nextRenewalDate = parseSubscriptionDate(raw.nextRenewalDate)
        ? raw.nextRenewalDate
        : calculateNextRenewalDate(startDate, periodMonths, safeNow);
    const anchorSource = parseSubscriptionDate(raw.nextRenewalDate)
        || parseSubscriptionDate(startDate);
    const requestedAnchorDay = Number(raw.billingAnchorDay);
    const billingAnchorDay = Number.isInteger(requestedAnchorDay)
        ? Math.min(31, Math.max(1, requestedAnchorDay))
        : anchorSource.getDate();
    const sourceLastDay = new Date(
        anchorSource.getFullYear(),
        anchorSource.getMonth() + 1,
        0
    ).getDate();
    const billingAnchorIsMonthEnd = raw.billingAnchorIsMonthEnd === true
        || (raw.billingAnchorIsMonthEnd !== false && anchorSource.getDate() === sourceLastDay);
    const cost = Math.round(Math.max(0, Number(raw.cost) || 0) * 100) / 100;
    const currency = raw.currency === 'ARS' || raw.currency === 'ARS$' ? 'ARS' : 'USD';
    const rawId = String(raw.id || '').toLowerCase();
    const id = SUBSCRIPTION_ID_PATTERN.test(rawId)
        ? rawId
        : `sub_${slugify(name)}_${stableHash(`${name}|${startDate}|${cost}|${currency}`)}`;
    const createdAt = normalizeIsoTimestamp(raw.createdAt, nowIso);
    const updatedAt = normalizeIsoTimestamp(raw.updatedAt, createdAt);
    const status = SUBSCRIPTION_STATUSES.includes(raw.status) ? raw.status : 'active';
    const alert = normalizeAlertTimes(raw.alert?.times || raw.alert?.time || '09:00', '09:00');

    const requestedDaysBefore = Number(raw.alert?.daysBefore);

    return {
        id,
        name,
        category: SUBSCRIPTION_CATEGORIES.includes(raw.category) ? raw.category : 'otros',
        cost,
        currency,
        periodMonths,
        startDate,
        nextRenewalDate,
        billingAnchorDay,
        billingAnchorIsMonthEnd,
        autoRenew: raw.autoRenew !== false,
        status,
        statusChangedAt: normalizeIsoTimestamp(raw.statusChangedAt, updatedAt),
        paymentMethod: String(raw.paymentMethod || 'Tarjeta').replace(/\s+/g, ' ').trim().slice(0, 80),
        notes: String(raw.notes || '').trim().slice(0, 2000),
        autoRecordExpense: raw.autoRecordExpense === true,
        lastExpenseRecordedPeriod: String(raw.lastExpenseRecordedPeriod || '').slice(0, 180) || null,
        alert: {
            enabled: raw.alert?.enabled !== false,
            time: alert.time,
            times: alert.times,
            daysBefore: Number.isFinite(requestedDaysBefore)
                ? Math.min(30, Math.max(0, Math.trunc(requestedDaysBefore)))
                : 3
        },
        history: normalizeHistory(raw.history, cost, currency),
        createdAt,
        updatedAt
    };
}

export function normalizeSubscriptionRegistry(value) {
    let parsed = value;
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }
    const rawList = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.subscriptions) ? parsed.subscriptions : []);
    const subscriptions = [];
    const seen = new Set();
    rawList.forEach(raw => {
        const subscription = normalizeSubscription(raw);
        if (!subscription || seen.has(subscription.id)) return;
        seen.add(subscription.id);
        subscriptions.push(subscription);
    });
    return { version: SUBSCRIPTION_SCHEMA_VERSION, subscriptions };
}

export function extractLegacySubscriptionRegistry(value) {
    let parsed = value;
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { return null; }
    }
    return parsed?._subscriptionsRegistry
        ? normalizeSubscriptionRegistry(parsed._subscriptionsRegistry)
        : null;
}

export function migrateWorkanaToSubscriptions(legacySubscription, currentRegistry = []) {
    const registry = normalizeSubscriptionRegistry(currentRegistry);
    let parsed = legacySubscription;
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }
    if (!parsed || typeof parsed !== 'object' || !String(parsed.plan || '').trim()) {
        return { subscriptions: registry.subscriptions, migrated: false };
    }
    if (registry.subscriptions.some(item => (
        item.id === 'sub_workana_plan' || item.name.toLowerCase().includes('workana')
    ))) return { subscriptions: registry.subscriptions, migrated: false };

    const startDate = parseSubscriptionDate(parsed.startDate)
        ? parsed.startDate
        : formatDateOnly(new Date());
    const periodMonths = Math.min(120, Math.max(1, Math.trunc(Number(parsed.cycle) || 3)));
    const migratedAt = new Date().toISOString();
    const subscription = normalizeSubscription({
        id: 'sub_workana_plan',
        name: `Workana · Plan ${String(parsed.plan).trim()}`,
        category: 'trabajo',
        cost: parsed.cost,
        currency: 'USD',
        periodMonths,
        startDate,
        nextRenewalDate: calculateNextRenewalDate(startDate, periodMonths),
        autoRenew: true,
        status: 'active',
        notes: 'Importada desde la configuración histórica de Proyectos.',
        alert: { enabled: true, times: ['09:00'], daysBefore: 7 },
        createdAt: migratedAt,
        updatedAt: migratedAt,
        history: [{
            id: `subevt_workana_import_${stableHash(startDate)}`,
            type: 'created',
            occurredAt: migratedAt,
            effectiveDate: startDate,
            cost: parsed.cost,
            currency: 'USD',
            note: 'Migración desde Proyectos'
        }]
    });
    return { subscriptions: [subscription, ...registry.subscriptions], migrated: true };
}

export function getSubscriptionExpenseOccurrenceKey(subscription, renewalDate = null) {
    const date = renewalDate || subscription?.nextRenewalDate;
    if (!subscription?.id || !parseSubscriptionDate(date)) return null;
    return `subscription:${subscription.id}:renewal:${date}`;
}

export function advanceSubscriptionRenewal(subscription, fromDate = null) {
    const normalized = normalizeSubscription(subscription);
    const renewalDate = fromDate || normalized?.nextRenewalDate;
    if (!normalized || !parseSubscriptionDate(renewalDate)) return normalized;
    const afterRenewal = parseSubscriptionDate(renewalDate);
    afterRenewal.setDate(afterRenewal.getDate() + 1);
    return {
        ...normalized,
        nextRenewalDate: addMonthsWithBillingAnchor(
            renewalDate,
            normalized.periodMonths,
            normalized.billingAnchorDay,
            normalized.billingAnchorIsMonthEnd
        ) || calculateNextRenewalDate(
            normalized.startDate,
            normalized.periodMonths,
            afterRenewal
        ),
        updatedAt: new Date().toISOString()
    };
}

export function appendSubscriptionHistoryEvent(subscription, event) {
    const normalized = normalizeSubscription(subscription);
    if (!normalized) return null;
    const occurredAt = normalizeIsoTimestamp(event?.occurredAt, new Date().toISOString());
    const type = ['created', 'updated', 'renewed', 'expense-recorded', 'paused', 'canceled', 'reactivated']
        .includes(event?.type) ? event.type : 'updated';
    const historyItem = normalizeHistory([{
        ...event,
        id: event?.id || `subevt_${stableHash(`${normalized.id}:${occurredAt}:${type}:${event?.occurrenceKey || ''}`)}`,
        type,
        occurredAt,
        cost: event?.cost ?? normalized.cost,
        currency: event?.currency || normalized.currency
    }], normalized.cost, normalized.currency)[0];
    return {
        ...normalized,
        history: historyItem ? [...normalized.history, historyItem].slice(-5000) : normalized.history,
        updatedAt: occurredAt
    };
}
