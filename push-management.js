'use strict';

const crypto = require('node:crypto');

const DEVICE_NAME_MAX = 80;
const DEVICE_META_MAX = 160;
const HISTORY_STATUSES = new Set(['pending', 'accepted', 'failed', 'expired', 'unknown', 'no_devices']);
const PUSH_TELEMETRY_EVENTS = new Set(['received', 'displayed', 'discarded_expired']);
const PUSH_RECEIPT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const PUSH_NOTIFICATION_TAG_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function cleanText(value, maxLength) {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
}

function endpointFingerprint(endpoint) {
    const normalized = cleanText(endpoint, 4096);
    if (!normalized) return '';
    return crypto
        .createHash('sha256')
        .update(normalized)
        .digest('hex')
        .slice(0, 20);
}

function inferBrowser(userAgent = '') {
    const value = String(userAgent);
    if (/Brave/i.test(value)) return 'Brave';
    if (/Edg\//i.test(value)) return 'Edge';
    if (/Firefox\//i.test(value)) return 'Firefox';
    if (/CriOS\//i.test(value)) return 'Chrome';
    if (/Chrome\//i.test(value)) return 'Chrome';
    if (/Safari\//i.test(value) && !/Chrome|Chromium|Android/i.test(value)) return 'Safari';
    return 'Navegador';
}

function inferPlatform(userAgent = '') {
    const value = String(userAgent);
    if (/iPhone|iPad|iPod/i.test(value)) return 'iOS';
    if (/Android/i.test(value)) return 'Android';
    if (/Windows/i.test(value)) return 'Windows';
    if (/Macintosh|Mac OS X/i.test(value)) return 'macOS';
    if (/Linux/i.test(value)) return 'Linux';
    return 'Dispositivo';
}

function normalizeDeviceMetadata(value = {}, fallbackUserAgent = '') {
    const input = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
    const userAgent = cleanText(input.userAgent || fallbackUserAgent, 512);
    const platform = cleanText(input.platform, DEVICE_META_MAX) || inferPlatform(userAgent);
    const browser = cleanText(input.browser, DEVICE_META_MAX) || inferBrowser(userAgent);
    const name = cleanText(input.name, DEVICE_NAME_MAX) || `${platform} · ${browser}`;
    return { name, platform, browser, userAgent };
}

function preserveDeviceName(metadata = {}, existingRow = {}) {
    const existingName = cleanText(existingRow.device_name, DEVICE_NAME_MAX);
    return existingName
        ? { ...metadata, device_name: existingName }
        : { ...metadata };
}

function getLatestTimestamp(...values) {
    return values
        .map(value => Date.parse(value || ''))
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0] || 0;
}

function toPublicPushDevice(row = {}) {
    const successAt = row.last_success_at || null;
    const failureAt = row.last_failure_at || null;
    const latestSuccess = Date.parse(successAt || '') || 0;
    const latestFailure = Date.parse(failureAt || '') || 0;
    const activityTimestamp = getLatestTimestamp(
        row.last_seen_at,
        row.last_success_at,
        row.last_failure_at,
        row.created_at
    );
    return {
        id: String(row.id || ''),
        name: cleanText(row.device_name, DEVICE_NAME_MAX)
            || `${cleanText(row.platform, DEVICE_META_MAX) || inferPlatform(row.user_agent)} · ${cleanText(row.browser, DEVICE_META_MAX) || inferBrowser(row.user_agent)}`,
        platform: cleanText(row.platform, DEVICE_META_MAX) || inferPlatform(row.user_agent),
        browser: cleanText(row.browser, DEVICE_META_MAX) || inferBrowser(row.user_agent),
        endpointFingerprint: endpointFingerprint(row.subscription?.endpoint),
        createdAt: row.created_at || null,
        lastSeenAt: row.last_seen_at || row.created_at || null,
        lastSuccessAt: successAt,
        lastFailureAt: failureAt,
        failureCount: Math.max(0, Number.parseInt(row.consecutive_failures, 10) || 0),
        lastStatus: latestFailure > latestSuccess
            ? 'failed'
            : (latestSuccess > 0 ? 'accepted' : 'unknown'),
        activityAt: activityTimestamp
            ? new Date(activityTimestamp).toISOString()
            : null
    };
}

function parsePushPayload(payload) {
    try {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return {
            title: cleanText(parsed.title, 160),
            body: cleanText(parsed.body, 500)
        };
    } catch {
        return {};
    }
}

function createPushReceiptCredential() {
    const token = crypto.randomBytes(32).toString('base64url');
    return {
        token,
        tokenHash: hashPushReceiptToken(token)
    };
}

function hashPushReceiptToken(value) {
    const token = String(value || '');
    if (!PUSH_RECEIPT_TOKEN_PATTERN.test(token)) return '';
    return crypto.createHash('sha256').update(token).digest('hex');
}

function createPushTopic(alertKey, scheduledAt) {
    const normalizedAlertKey = cleanText(alertKey, 160);
    const scheduledDate = new Date(scheduledAt || '');
    if (!normalizedAlertKey || !Number.isFinite(scheduledDate.getTime())) return '';

    return crypto
        .createHash('sha256')
        .update(`${normalizedAlertKey}\n${scheduledDate.toISOString()}`)
        .digest('base64url')
        .slice(0, 32);
}

function normalizePushTelemetryEvent(value) {
    const event = String(value || '');
    return PUSH_TELEMETRY_EVENTS.has(event) ? event : '';
}

function attachPushDeliveryMetadata(payload, metadata = {}) {
    let parsed;
    try {
        parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
        return payload;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return payload;

    const id = String(metadata.id || '');
    const receiptToken = String(metadata.receiptToken || '');
    const notificationTag = String(metadata.notificationTag || '');
    const scheduledAt = new Date(metadata.scheduledAt || '');
    const expiresAt = new Date(metadata.expiresAt || '');
    if (
        !/^\d+$/.test(id)
        || !PUSH_RECEIPT_TOKEN_PATTERN.test(receiptToken)
        || !Number.isFinite(scheduledAt.getTime())
        || !Number.isFinite(expiresAt.getTime())
    ) {
        return payload;
    }

    return JSON.stringify({
        ...parsed,
        ...(PUSH_NOTIFICATION_TAG_PATTERN.test(notificationTag)
            ? { notificationTag }
            : {}),
        delivery: {
            id,
            receiptToken,
            scheduledAt: scheduledAt.toISOString(),
            expiresAt: expiresAt.toISOString()
        }
    });
}

function normalizeHistoryStatus(value) {
    return HISTORY_STATUSES.has(value) ? value : '';
}

function normalizeHistoryLimit(value, fallback = 50) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed)
        ? Math.min(100, Math.max(1, parsed))
        : fallback;
}

function normalizeProviderStatus(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 100 && parsed <= 599
        ? parsed
        : null;
}

function isMissingPushManagementSchema(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code)
        || message.includes('notification_delivery_log')
        || message.includes('device_name')
        || message.includes('last_seen_at')
        || message.includes('endpoint_fingerprint')
        || message.includes('confirmed_at');
}

function isMissingPushTelemetrySchema(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    return ['42703', 'PGRST204'].includes(code)
        || message.includes('receipt_token_hash')
        || message.includes('scheduled_at')
        || message.includes('expires_at')
        || message.includes('received_at')
        || message.includes('displayed_at')
        || message.includes('discarded_at')
        || message.includes('attempt_no')
        || message.includes('retry_of_id')
        || message.includes('claim_notification_delivery_retry')
        || (
            code === '23514'
            && message.includes('notification_delivery_log_status_check')
        );
}

function isDuplicatePushDispatchError(error) {
    const code = String(error?.code || '');
    const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return code === '23505'
        && message.includes('notification_delivery_log_dispatch_once_idx');
}

module.exports = {
    attachPushDeliveryMetadata,
    createPushReceiptCredential,
    createPushTopic,
    endpointFingerprint,
    hashPushReceiptToken,
    inferBrowser,
    inferPlatform,
    isDuplicatePushDispatchError,
    isMissingPushManagementSchema,
    isMissingPushTelemetrySchema,
    normalizeDeviceMetadata,
    normalizeHistoryLimit,
    normalizeHistoryStatus,
    normalizeProviderStatus,
    normalizePushTelemetryEvent,
    parsePushPayload,
    preserveDeviceName,
    toPublicPushDevice
};
