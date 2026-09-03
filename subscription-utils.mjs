/**
 * subscription-utils.mjs
 * Módulo de utilidades para gestión de suscripciones, cálculo de periodos,
 * historial de renovaciones y migración de suscripciones heredadas (Workana).
 * Fase C (Tandas 11 a 15).
 */

import { normalizeAlertTimes, TIME_PATTERN } from './alert-schedule-utils.mjs';

export const SUBSCRIPTION_SCHEMA_VERSION = 1;
export const SUBSCRIPTION_STORAGE_KEY = 'lifecycle_subscriptions';

export const SUBSCRIPTION_CATEGORIES = Object.freeze([
    'trabajo',
    'software',
    'streaming',
    'servicios',
    'otros'
]);

export const SUBSCRIPTION_CATEGORY_LABELS = Object.freeze({
    trabajo: '💼 Trabajo y Freelance',
    software: '💻 Software y Herramientas',
    streaming: '🎬 Entretenimiento y Streaming',
    servicios: '⚡ Servicios y Utilidades',
    otros: '📦 Otros'
});

export const SUBSCRIPTION_STATUSES = Object.freeze([
    'active',
    'paused',
    'canceled'
]);

/**
 * Añade N meses a una fecha respetando los límites de fin de mes
 * (por ejemplo 31 de enero + 1 mes = 28/29 de febrero).
 *
 * @param {string|Date} dateInput
 * @param {number} monthsToAdd
 * @returns {string} YYYY-MM-DD
 */
export function addMonthsToDate(dateInput, monthsToAdd) {
    const baseDate = typeof dateInput === 'string'
        ? new Date(dateInput + 'T12:00:00')
        : new Date(dateInput);

    if (Number.isNaN(baseDate.getTime())) {
        return new Date().toISOString().slice(0, 10);
    }

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();

    // Calcular mes y año destino
    const targetMonthIndex = month + monthsToAdd;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

    // Obtener último día del mes destino
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const adjustedDay = Math.min(day, daysInTargetMonth);

    const result = new Date(targetYear, targetMonth, adjustedDay, 12, 0, 0);
    const yStr = result.getFullYear();
    const mStr = String(result.getMonth() + 1).padStart(2, '0');
    const dStr = String(result.getDate()).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Calcula la próxima fecha de renovación a partir de la fecha de inicio y el ciclo.
 * Avanza tantos periodos como sean necesarios hasta superar la fecha actual.
 *
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {number} periodMonths - Número de meses por ciclo (1, 3, 6, 12)
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function calculateNextRenewalDate(startDateStr, periodMonths, referenceDate = new Date()) {
    const period = Math.max(1, parseInt(periodMonths, 10) || 1);
    let current = startDateStr;
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    let guard = 0;
    while (guard < 1200) { // Límite de 100 años
        const next = addMonthsToDate(current, period);
        const nextDate = new Date(next + 'T12:00:00');
        nextDate.setHours(0, 0, 0, 0);

        if (nextDate >= ref) {
            return next;
        }
        current = next;
        guard++;
    }

    return addMonthsToDate(startDateStr, period);
}

/**
 * Calcula los días restantes hasta la fecha de renovación.
 *
 * @param {string} renewalDateStr - YYYY-MM-DD
 * @param {Date} [referenceDate=new Date()]
 * @returns {number} días (negativo si ya venció)
 */
export function getDaysUntilRenewal(renewalDateStr, referenceDate = new Date()) {
    if (!renewalDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(renewalDateStr)) return 0;
    const target = new Date(renewalDateStr + 'T12:00:00');
    target.setHours(0, 0, 0, 0);

    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    const diffMs = target.getTime() - ref.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcula el gasto mensual equivalente para comparar suscripciones de distintos ciclos.
 *
 * @param {number} cost
 * @param {number} periodMonths
 * @returns {number}
 */
export function calculateMonthlyEquivalent(cost, periodMonths) {
    const c = Math.max(0, Number(cost) || 0);
    const p = Math.max(1, parseInt(periodMonths, 10) || 1);
    return Math.round((c / p) * 100) / 100;
}

/**
 * Normaliza una suscripción individual garantizando integridad de datos.
 *
 * @param {Object} raw
 * @param {Date} [now=new Date()]
 * @returns {Object|null}
 */
export function normalizeSubscription(raw, now = new Date()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const id = String(raw.id || '').trim() || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const name = String(raw.name || '').trim() || 'Suscripción sin nombre';
    const category = SUBSCRIPTION_CATEGORIES.includes(raw.category) ? raw.category : 'otros';
    const cost = Math.max(0, Number(raw.cost) || 0);
    const currency = (raw.currency === 'ARS' || raw.currency === 'ARS$') ? 'ARS' : 'USD';
    const periodMonths = Math.min(120, Math.max(1, parseInt(raw.periodMonths || raw.cycle, 10) || 1));
    
    let startDate = String(raw.startDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        startDate = new Date(now).toISOString().slice(0, 10);
    }

    let nextRenewalDate = String(raw.nextRenewalDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextRenewalDate)) {
        nextRenewalDate = calculateNextRenewalDate(startDate, periodMonths, now);
    }

    const autoRenew = raw.autoRenew !== false;
    const status = SUBSCRIPTION_STATUSES.includes(raw.status) ? raw.status : 'active';
    const paymentMethod = String(raw.paymentMethod || 'Tarjeta').trim();
    const notes = String(raw.notes || '').trim().slice(0, 2000);
    const autoRecordExpense = raw.autoRecordExpense === true;
    const lastExpensePeriod = typeof raw.lastExpenseRecordedPeriod === 'string' ? raw.lastExpenseRecordedPeriod : null;

    // Normalizar horarios de aviso
    const rawAlertTimes = Array.isArray(raw.alert?.times)
        ? raw.alert.times
        : (raw.alert?.time ? [raw.alert.time] : ['09:00']);
    const normalizedAlert = normalizeAlertTimes(rawAlertTimes, '09:00');
    const alertDaysBefore = Math.min(30, Math.max(0, parseInt(raw.alert?.daysBefore, 10) || 3));
    const alertEnabled = raw.alert?.enabled !== false;

    // Normalizar historial
    const history = Array.isArray(raw.history)
        ? raw.history.map(item => ({
            date: String(item.date || '').slice(0, 10),
            cost: Number(item.cost) || cost,
            currency: item.currency || currency,
            note: String(item.note || '').slice(0, 500)
        })).filter(h => /^\d{4}-\d{2}-\d{2}$/.test(h.date))
        : [];

    return {
        id,
        name,
        category,
        cost,
        currency,
        periodMonths,
        startDate,
        nextRenewalDate,
        autoRenew,
        status,
        paymentMethod,
        notes,
        autoRecordExpense,
        lastExpenseRecordedPeriod: lastExpensePeriod,
        alert: {
            enabled: alertEnabled,
            time: normalizedAlert.time,
            times: normalizedAlert.times,
            daysBefore: alertDaysBefore
        },
        history,
        createdAt: raw.createdAt || new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
    };
}

/**
 * Normaliza el registro completo de suscripciones.
 *
 * @param {Object} value
 * @returns {{ version: number, subscriptions: Object[] }}
 */
export function normalizeSubscriptionRegistry(value) {
    const hasRegistry = value && typeof value === 'object' && !Array.isArray(value);
    const rawList = hasRegistry && Array.isArray(value.subscriptions)
        ? value.subscriptions
        : (Array.isArray(value) ? value : []);

    const subscriptions = [];
    const seenIds = new Set();

    for (const raw of rawList) {
        const item = normalizeSubscription(raw);
        if (item && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            subscriptions.push(item);
        }
    }

    return {
        version: SUBSCRIPTION_SCHEMA_VERSION,
        subscriptions
    };
}

/**
 * Traslada la suscripción heredada de Workana (projectPulseSubscription)
 * hacia el registro de suscripciones sin duplicar en ejecuciones sucesivas.
 *
 * @param {Object|string} legacySubscription
 * @param {Object[]|{ subscriptions: Object[] }} currentRegistry
 * @returns {{ subscriptions: Object[], migrated: boolean }}
 */
export function migrateWorkanaToSubscriptions(legacySubscription, currentRegistry = []) {
    const registry = normalizeSubscriptionRegistry(currentRegistry);
    if (!legacySubscription) {
        return { subscriptions: registry.subscriptions, migrated: false };
    }

    let parsed = legacySubscription;
    if (typeof legacySubscription === 'string') {
        try {
            parsed = JSON.parse(legacySubscription);
        } catch {
            return { subscriptions: registry.subscriptions, migrated: false };
        }
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.plan) {
        return { subscriptions: registry.subscriptions, migrated: false };
    }

    const workanaId = 'sub_workana_plan';
    const existingIndex = registry.subscriptions.findIndex(s => s.id === workanaId || s.name.toLowerCase().includes('workana'));

    if (existingIndex >= 0) {
        // Ya migrada
        return { subscriptions: registry.subscriptions, migrated: false };
    }

    const cycle = Math.max(1, parseInt(parsed.cycle, 10) || 3);
    const cost = Math.max(0, Number(parsed.cost) || 0);
    const startDate = parsed.startDate || new Date().toISOString().slice(0, 10);
    const planName = parsed.plan ? `Plan ${parsed.plan}` : 'Membresía';

    const workanaSub = normalizeSubscription({
        id: workanaId,
        name: `Workana (${planName})`,
        category: 'trabajo',
        cost,
        currency: 'USD',
        periodMonths: cycle,
        startDate,
        nextRenewalDate: calculateNextRenewalDate(startDate, cycle),
        autoRenew: true,
        status: 'active',
        paymentMethod: 'Tarjeta',
        notes: 'Suscripción importada automáticamente desde el módulo de Proyectos.',
        alert: {
            enabled: true,
            time: '09:00',
            times: ['09:00'],
            daysBefore: 7
        }
    });

    registry.subscriptions.unshift(workanaSub);
    return {
        subscriptions: registry.subscriptions,
        migrated: true
    };
}
