import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeAlertTimes,
    formatAlertTimes,
    getScheduleDeliveryKey,
    MAX_ALERT_TIMES_PER_DAY
} from '../alert-schedule-utils.mjs';

test('normalizeAlertTimes: handles legacy single time string and returns sorted array', () => {
    const result = normalizeAlertTimes('23:00');
    assert.equal(result.time, '23:00');
    assert.deepEqual(result.times, ['23:00']);
});

test('normalizeAlertTimes: accepts array of multiple times, deduplicates and sorts chronologically', () => {
    const result = normalizeAlertTimes(['20:00', '09:00', '20:00', '14:30']);
    assert.equal(result.time, '09:00');
    assert.deepEqual(result.times, ['09:00', '14:30', '20:00']);
});

test('normalizeAlertTimes: rejects invalid formats and falls back safely', () => {
    const result = normalizeAlertTimes(['invalid', '25:99', '12:60']);
    assert.equal(result.time, '09:00');
    assert.deepEqual(result.times, ['09:00']);
});

test('normalizeAlertTimes: caps at MAX_ALERT_TIMES_PER_DAY (6)', () => {
    const times = ['01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00'];
    const result = normalizeAlertTimes(times);
    assert.equal(result.times.length, MAX_ALERT_TIMES_PER_DAY);
    assert.deepEqual(result.times, ['01:00', '02:00', '03:00', '04:00', '05:00', '06:00']);
});

test('formatAlertTimes: generates readable strings in Spanish', () => {
    assert.equal(formatAlertTimes(['09:00']), '09:00');
    assert.equal(formatAlertTimes(['09:00', '20:00']), '09:00 y 20:00');
    assert.equal(formatAlertTimes(['08:00', '14:00', '21:00']), '08:00, 14:00 y 21:00');
});

test('getScheduleDeliveryKey: generates unique schedule key per time slot', () => {
    assert.equal(getScheduleDeliveryKey('card_1', '09:00'), 'card_1@09:00');
    assert.equal(getScheduleDeliveryKey('card_1', '20:00'), 'card_1@20:00');
});
