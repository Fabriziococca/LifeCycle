import test from 'node:test';
import assert from 'node:assert/strict';

import {
    combineLocalDateWithTime,
    getCalendarDaysElapsed,
    getCalendarDaysUntil,
    getLocalISODate,
    getLocalISOMonth,
    parseDateLocal
} from '../date-utils.mjs';

test('parseDateLocal keeps date-only values on the selected local calendar day', () => {
    const parsed = parseDateLocal('2026-07-27');

    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 6);
    assert.equal(parsed.getDate(), 27);
    assert.equal(parsed.getHours(), 0);
});

test('parseDateLocal rejects invalid calendar dates', () => {
    assert.equal(parseDateLocal('2026-02-30'), null);
    assert.equal(parseDateLocal('not-a-date'), null);
});

test('local ISO helpers do not roll late local hours into another month', () => {
    const lateLocalTime = new Date(2026, 6, 31, 23, 45, 0);

    assert.equal(getLocalISODate(lateLocalTime), '2026-07-31');
    assert.equal(getLocalISOMonth(lateLocalTime), '2026-07');
});

test('combineLocalDateWithTime preserves the selected date and current local time', () => {
    const currentTime = new Date(2026, 6, 27, 22, 35, 12, 456);
    const combined = combineLocalDateWithTime('2026-07-10', currentTime);

    assert.equal(getLocalISODate(combined), '2026-07-10');
    assert.equal(combined.getHours(), 22);
    assert.equal(combined.getMinutes(), 35);
    assert.equal(combined.getSeconds(), 12);
});

test('calendar day calculations are stable and future elapsed values never look overdue', () => {
    const today = new Date(2026, 6, 27, 23, 50);

    assert.equal(getCalendarDaysElapsed('2026-07-20', today), 7);
    assert.equal(getCalendarDaysElapsed('2026-07-28', today), 0);
    assert.equal(getCalendarDaysUntil('2026-07-28', today), 1);
    assert.equal(getCalendarDaysUntil('2026-07-20', today), -7);
});
