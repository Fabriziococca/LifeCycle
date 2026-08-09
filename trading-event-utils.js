(function initializeTradingEventUtils(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.LifeCycleTradingEvents = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTradingEventUtils() {
    'use strict';

    const DAY_MS = 24 * 60 * 60 * 1000;
    const DEFAULT_TRADING_NOTICE_DAYS = Object.freeze([60, 30, 15, 7, 1]);
    const MAX_TRADING_EVENTS = 500;
    const MAX_TRADING_NOTICE_DAYS = 365;
    const MAX_TRADING_NOTICES = 12;
    const TRADING_EVENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,95}$/;
    const TRADING_ALERT_PREFIX = 'trading_event:';

    function cleanText(value, maxLength) {
        return String(value ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength);
    }

    function normalizeTimestamp(value) {
        const timestamp = new Date(value).getTime();
        return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
    }

    function normalizeTradingNoticeDays(value, fallback = DEFAULT_TRADING_NOTICE_DAYS) {
        const source = Array.isArray(value) ? value : fallback;
        return [...new Set(source
            .map(item => Number(item))
            .filter(item => (
                Number.isInteger(item)
                && item >= 1
                && item <= MAX_TRADING_NOTICE_DAYS
            )))]
            .sort((a, b) => b - a)
            .slice(0, MAX_TRADING_NOTICES);
    }

    function parseTradingNoticeDays(value) {
        const source = Array.isArray(value)
            ? value
            : String(value ?? '').split(/[\s,;]+/).filter(Boolean);
        if (source.length === 0 || source.length > MAX_TRADING_NOTICES) return null;
        if (source.some(item => !/^\d{1,3}$/.test(String(item).trim()))) return null;
        const numeric = source.map(Number);
        if (numeric.some(item => item < 1 || item > MAX_TRADING_NOTICE_DAYS)) return null;
        const normalized = normalizeTradingNoticeDays(numeric, []);
        return normalized.length > 0 ? normalized : null;
    }

    function normalizeTradingSourceUrl(value) {
        const candidate = cleanText(value, 500);
        if (!candidate) return '';
        try {
            const parsed = new URL(candidate);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch {
            return '';
        }
    }

    function normalizeTradingEvent(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const id = cleanText(value.id, 96).toLowerCase();
        const company = cleanText(value.company, 100);
        const ticker = cleanText(value.ticker, 20).toUpperCase();
        const name = cleanText(value.name, 120);
        const scheduledAt = normalizeTimestamp(value.scheduledAt);
        const noticeDays = normalizeTradingNoticeDays(value.noticeDays);
        if (
            !TRADING_EVENT_ID_PATTERN.test(id)
            || !company
            || !name
            || !scheduledAt
            || noticeDays.length === 0
        ) {
            return null;
        }

        const createdAt = normalizeTimestamp(value.createdAt) || scheduledAt;
        const updatedAt = normalizeTimestamp(value.updatedAt) || createdAt;
        return {
            id,
            company,
            ticker,
            name,
            scheduledAt,
            notes: cleanText(value.notes, 800),
            sourceUrl: normalizeTradingSourceUrl(value.sourceUrl),
            noticeDays,
            status: value.status === 'paused' ? 'paused' : 'active',
            createdAt,
            updatedAt
        };
    }

    function normalizeTradingEvents(value) {
        if (!Array.isArray(value)) return [];
        const normalized = [];
        const seen = new Set();
        value.slice(0, MAX_TRADING_EVENTS).forEach(candidate => {
            const event = normalizeTradingEvent(candidate);
            if (!event || seen.has(event.id)) return;
            seen.add(event.id);
            normalized.push(event);
        });
        return normalized;
    }

    function tradingEventFromDatabaseRow(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        return normalizeTradingEvent({
            id: value.id,
            company: value.company,
            ticker: value.ticker,
            name: value.name,
            scheduledAt: value.scheduled_at,
            notes: value.notes,
            sourceUrl: value.source_url,
            noticeDays: value.notice_days,
            status: value.status,
            createdAt: value.created_at,
            updatedAt: value.updated_at
        });
    }

    function isMissingTradingPersistenceSchema(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || '').toLowerCase();
        return ['42P01', '42883', '42703', 'PGRST202', 'PGRST204', 'PGRST205']
            .includes(code)
            || message.includes('trading_events')
            || message.includes('trading_notification_dispatch')
            || message.includes('claim_trading_notification_dispatch')
            || message.includes('complete_trading_notification_dispatch');
    }

    function createTradingEventId(now = Date.now(), random = Math.random()) {
        const timePart = Math.max(0, Number(now) || Date.now()).toString(36);
        const randomPart = Math.floor(Math.max(0, Number(random) || 0) * 0xFFFFFF)
            .toString(36)
            .padStart(5, '0')
            .slice(0, 7);
        return `trade_${timePart}_${randomPart}`;
    }

    function getTradingScheduleToken(scheduledAt) {
        const normalized = normalizeTimestamp(scheduledAt);
        return normalized ? normalized.replace(/[-:.]/g, '') : '';
    }

    function buildTradingEventAlertKey(event, noticeDays) {
        const normalized = normalizeTradingEvent(event);
        const leadDays = Number(noticeDays);
        const scheduleToken = normalized
            ? getTradingScheduleToken(normalized.scheduledAt)
            : '';
        if (
            !normalized
            || !scheduleToken
            || !Number.isInteger(leadDays)
            || !normalized.noticeDays.includes(leadDays)
        ) {
            return '';
        }
        return `${TRADING_ALERT_PREFIX}${normalized.id}:${scheduleToken}:${leadDays}d`;
    }

    function parseTradingEventAlertKey(value) {
        const key = String(value ?? '');
        const match = key.match(/^trading_event:([a-z0-9][a-z0-9_-]{2,95}):([0-9TZ]{16,24}):(\d{1,3})d$/);
        if (!match) return null;
        const noticeDays = Number(match[3]);
        if (
            !Number.isInteger(noticeDays)
            || noticeDays < 1
            || noticeDays > MAX_TRADING_NOTICE_DAYS
        ) return null;
        return {
            eventId: match[1],
            scheduleToken: match[2],
            noticeDays
        };
    }

    function getDueTradingEventNotice(value, now = new Date()) {
        const event = normalizeTradingEvent(value);
        const nowTimestamp = new Date(now).getTime();
        const scheduledTimestamp = event
            ? new Date(event.scheduledAt).getTime()
            : Number.NaN;
        if (
            !event
            || event.status !== 'active'
            || !Number.isFinite(nowTimestamp)
            || !Number.isFinite(scheduledTimestamp)
            || nowTimestamp >= scheduledTimestamp
        ) {
            return null;
        }

        const currentThreshold = [...event.noticeDays]
            .sort((a, b) => a - b)
            .find(days => nowTimestamp >= scheduledTimestamp - (days * DAY_MS));
        if (currentThreshold === undefined) return null;

        const alertKey = buildTradingEventAlertKey(event, currentThreshold);
        if (!alertKey) return null;
        return {
            event,
            noticeDays: currentThreshold,
            triggerAt: new Date(
                scheduledTimestamp - (currentThreshold * DAY_MS)
            ).toISOString(),
            alertKey
        };
    }

    return Object.freeze({
        DAY_MS,
        DEFAULT_TRADING_NOTICE_DAYS,
        MAX_TRADING_EVENTS,
        MAX_TRADING_NOTICE_DAYS,
        MAX_TRADING_NOTICES,
        TRADING_ALERT_PREFIX,
        buildTradingEventAlertKey,
        createTradingEventId,
        getDueTradingEventNotice,
        isMissingTradingPersistenceSchema,
        normalizeTradingEvent,
        normalizeTradingEvents,
        normalizeTradingNoticeDays,
        normalizeTradingSourceUrl,
        parseTradingEventAlertKey,
        parseTradingNoticeDays,
        tradingEventFromDatabaseRow
    });
});
