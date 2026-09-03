import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeAlertTimes, formatAlertTimes, getScheduleDeliveryKey } from '../alert-schedule-utils.mjs';
import { createCustomTracker } from '../custom-tracker-utils.mjs';
import { normalizeRecurringReminder, migrateRecurringReminderConfigs } from '../recurring-reminder-utils.mjs';

const ROOT = process.cwd();

test('Tanda 6: multi-schedule rules sort, deduplicate and cap within the calendar day', () => {
    const normalized = normalizeAlertTimes(['21:30', '08:00', '21:30', '14:00']);
    assert.deepEqual(normalized.times, ['08:00', '14:00', '21:30']);
    assert.equal(normalized.time, '08:00');
    assert.equal(formatAlertTimes(normalized.times), '08:00, 14:00 y 21:30');

    // Cap at 6 per day
    const overflow = normalizeAlertTimes(['01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00']);
    assert.equal(overflow.times.length, 6);
    assert.equal(overflow.times[5], '06:00');
});

test('Tanda 7: custom trackers and recurring reminders preserve backward compatibility with single time', () => {
    const trackerLegacy = createCustomTracker({
        section: 'hygiene',
        name: 'Vitamina D',
        actionLabel: 'Tomar vitamina',
        intervalDays: 1,
        alert: { enabled: true, time: '10:00' }
    }, { id: 'ct_vitamina_test' });
    assert.equal(trackerLegacy.alert.time, '10:00');
    assert.deepEqual(trackerLegacy.alert.times, ['10:00']);

    const trackerMulti = createCustomTracker({
        section: 'hygiene',
        name: 'Suplementos',
        actionLabel: 'Tomar suplementos',
        intervalDays: 1,
        alert: { enabled: true, times: ['09:00', '21:00'] }
    }, { id: 'ct_suplementos_test' });
    assert.equal(trackerMulti.alert.time, '09:00');
    assert.deepEqual(trackerMulti.alert.times, ['09:00', '21:00']);

    const configs = migrateRecurringReminderConfigs({
        creatine: { enabled: true, times: ['08:00', '20:00'], days: [1, 2, 3, 4, 5] }
    });
    assert.equal(configs.creatine.time, '08:00');
    assert.deepEqual(configs.creatine.times, ['08:00', '20:00']);
});

test('Tanda 8A & 8B: UI editors expose controls for adding and removing extra schedules', () => {
    const alertsSource = fs.readFileSync(path.join(ROOT, 'modules', 'AlertsModule.js'), 'utf8');
    const customTrackersSource = fs.readFileSync(path.join(ROOT, 'modules', 'CustomTrackersModule.js'), 'utf8');
    const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    assert.match(alertsSource, /btn-add-extra-time/);
    assert.match(alertsSource, /btn-remove-extra-time/);
    assert.match(alertsSource, /renderReminderExtraTimesList/);

    assert.match(customTrackersSource, /btn-custom-tracker-add-time/);
    assert.match(customTrackersSource, /custom-tracker-extra-times-list/);
    assert.match(customTrackersSource, /renderCustomTrackerExtraTimes/);

    assert.match(indexSource, /id="btn-add-reminder-time"/);
    assert.match(indexSource, /id="recurring-reminder-extra-times-list"/);
});

test('Tanda 9 & 10: server dispatch identifies each schedule slot and separates slot logs', () => {
    const serverSource = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

    assert.match(serverSource, /alertTimes\s*=\s*\(Array\.isArray\(conf\.times\)/);
    assert.match(serverSource, /slotLogKey/);
    assert.match(serverSource, /activeDeliveryKey/);
    assert.match(serverSource, /data\.alerts_sent_log\[activeDeliveryKey\]/);
});