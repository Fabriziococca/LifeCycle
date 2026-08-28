import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CUSTOM_TRACKER_FIELD,
    DEFAULT_BLOOD_STUDY_TRACKER_ID,
    DEFAULT_ROBOT_TRACKER_ID,
    LEGACY_CUSTOM_TRACKER_FIELD
} from '../custom-tracker-utils.mjs';
import {
    migrateLegacyTrackerRegistry,
    readLegacyTrackerSnapshot
} from '../tracker-migration.mjs';

const NOW = new Date('2026-07-28T12:00:00.000Z');

test('a fresh account starts without predefined cards', () => {
    const result = migrateLegacyTrackerRegistry({
        hasLegacyAccountData: false,
        now: NOW
    });

    assert.equal(result.migrated, true);
    assert.equal(result.report.source, 'empty');
    assert.equal(result.registry.trackers.length, 0);
});

test('empty serialized cloud objects are still recognized as a fresh account', () => {
    const values = new Map([
        ['hygiene_tracker_data', '{}'],
        ['groomingData_v2', '{}'],
        ['health_medical_data', '{}'],
        ['alerts_config', '{}']
    ]);
    const snapshot = readLegacyTrackerSnapshot({
        getItem(key) {
            return values.get(key) ?? null;
        }
    });
    const result = migrateLegacyTrackerRegistry({
        ...snapshot,
        now: NOW
    });

    assert.equal(snapshot.hasLegacyAccountData, false);
    assert.equal(result.report.source, 'empty');
    assert.equal(result.registry.trackers.length, 0);
});

test('the legacy personal account migrates recurring cards plus the annual study and preserves state', () => {
    const result = migrateLegacyTrackerRegistry({
        hygieneData: {
            celular: [
                '2026-07-25T12:00:00.000Z',
                '2026-07-20T12:00:00.000Z'
            ],
            toalla_mano: '2026-07-27T12:00:00.000Z'
        },
        groomingData: {
            barba: ['2026-07-26T12:00:00.000Z']
        },
        healthData: {
            dentista: {
                lastVisit: '2026-01-15',
                frequencyMonths: 8,
                history: ['2026-01-15', '2025-05-10']
            },
            oculista: {
                lastVisit: '2026-02-01',
                frequencyMonths: 12,
                history: ['2026-02-01']
            }
        },
        lensData: {
            lensDate: '2026-07-10',
            solutionDate: '2026-07-05'
        },
        alertsConfig: {
            celular: { enabled: false, time: '21:30' },
            dentista: { enabled: true, time: '18:00' }
        },
        hasLegacyAccountData: true,
        now: NOW
    });

    assert.equal(result.registry.trackers.length, 33);
    assert.deepEqual(result.report.bySection, {
        hygiene: 14,
        grooming: 10,
        lenses: 6,
        health: 3
    });

    const phone = result.registry.trackers.find(item => item.id === 'trk_hygiene_celular');
    assert.equal(phone.alertKey, 'celular');
    assert.equal(phone.alert.enabled, false);
    assert.equal(phone.alert.time, '21:30');
    assert.equal(result.registry.histories[phone.id].length, 2);

    const dentist = result.registry.trackers.find(item => item.id === 'trk_health_dentista');
    assert.equal(dentist.cadence.unit, 'months');
    assert.equal(dentist.cadence.value, 8);
    assert.equal(result.registry.histories[dentist.id][0], '2026-01-15T12:00:00.000Z');

    const lenses = result.registry.trackers.find(item => item.id === 'trk_lenses_lenses');
    assert.equal(lenses.behavior.decrementStock, true);
    assert.equal(lenses.legacySource.key, 'lensDate');

    const bloodStudy = result.registry.trackers.find(
        item => item.id === DEFAULT_BLOOD_STUDY_TRACKER_ID
    );
    assert.equal(bloodStudy.template, 'medical-study');
    assert.equal(bloodStudy.thresholds.red, 360);
});

test('a legacy robot becomes a normal creatable state reminder without being featured', () => {
    const result = migrateLegacyTrackerRegistry({
        hygieneData: {
            robot_cleaner: {
                status: 'dirty',
                marked_dirty_at: '2026-07-28T08:00:00.000Z'
            }
        },
        alertsConfig: {
            robot: { enabled: true, time: '23:00', interval_hours: 8 }
        },
        hasLegacyAccountData: true,
        now: NOW
    });
    const robot = result.registry.trackers.find(item => item.id === DEFAULT_ROBOT_TRACKER_ID);

    assert.equal(robot.template, 'state-reminder');
    assert.equal(robot.state.active, true);
    assert.equal(robot.behavior.intervalHours, 8);
    assert.equal(robot.alertKey, 'robot');
    assert.equal(result.registry.featuredBySection.hygiene, null);
});

test('V1 personalized cards join the same V2 registry without losing archive or history', () => {
    const result = migrateLegacyTrackerRegistry({
        hygieneData: {
            [LEGACY_CUSTOM_TRACKER_FIELD]: {
                version: 1,
                trackers: [{
                    id: 'ct_sillones_001',
                    section: 'hygiene',
                    subsection: 'dormitorio_bano',
                    name: 'Lavar sillones',
                    actionLabel: 'Registrar limpieza',
                    intervalDays: 45,
                    icon: 'ph-sparkle',
                    instructions: 'Aspirar primero.',
                    archived: true,
                    alert: { enabled: true, time: '19:00' }
                }],
                histories: {
                    ct_sillones_001: ['2026-06-01T12:00:00.000Z']
                }
            }
        },
        hasLegacyAccountData: true,
        now: NOW
    });

    const tracker = result.registry.trackers.find(item => item.id === 'ct_sillones_001');
    assert.ok(tracker);
    assert.equal(tracker.archived, true);
    assert.equal(tracker.subsection, 'dormitorio_bano');
    assert.deepEqual(
        result.registry.histories[tracker.id],
        ['2026-06-01T12:00:00.000Z']
    );
});

test('an existing current registry is authoritative and migration is idempotent', () => {
    const first = migrateLegacyTrackerRegistry({
        hygieneData: { celular: '2026-07-25' },
        hasLegacyAccountData: true,
        now: NOW
    });
    const deletedTrackerId = first.registry.trackers[0].id;
    first.registry.trackers[0].archived = true;
    first.registry.trackers[0].deleted = true;
    first.registry.trackers[0].deletedAt = '2026-07-28T13:00:00.000Z';
    first.registry.histories[deletedTrackerId] = [];

    const second = migrateLegacyTrackerRegistry({
        hygieneData: {
            celular: '2026-07-26',
            [CUSTOM_TRACKER_FIELD]: first.registry
        },
        hasLegacyAccountData: true,
        now: new Date('2026-07-29T12:00:00.000Z')
    });

    assert.equal(second.migrated, false);
    assert.equal(second.report.source, 'v3');
    assert.equal(second.registry.trackers.some(item => item.id === deletedTrackerId), false);
    assert.equal(Object.hasOwn(second.registry.histories, deletedTrackerId), false);
    assert.deepEqual(second.registry.deletedTrackerIds, [deletedTrackerId]);
});

test('special cards are not recreated after their permanent deletion tombstone', () => {
    const source = migrateLegacyTrackerRegistry({
        hygieneData: {
            robot_cleaner: {
                status: 'dirty',
                marked_dirty_at: '2026-07-28T08:00:00.000Z'
            }
        },
        bloodTests: [{ id: 'blood_1', date: '2026-07-01' }],
        hasLegacyAccountData: true,
        now: NOW
    }).registry;
    source.trackers = source.trackers.filter(tracker => ![
        DEFAULT_ROBOT_TRACKER_ID,
        DEFAULT_BLOOD_STUDY_TRACKER_ID
    ].includes(tracker.id));
    delete source.histories[DEFAULT_ROBOT_TRACKER_ID];
    delete source.histories[DEFAULT_BLOOD_STUDY_TRACKER_ID];
    source.deletedTrackerIds = [
        DEFAULT_ROBOT_TRACKER_ID,
        DEFAULT_BLOOD_STUDY_TRACKER_ID
    ];

    const result = migrateLegacyTrackerRegistry({
        hygieneData: {
            robot_cleaner: {
                status: 'dirty',
                marked_dirty_at: '2026-07-28T08:00:00.000Z'
            },
            [CUSTOM_TRACKER_FIELD]: source
        },
        bloodTests: [{ id: 'blood_1', date: '2026-07-01' }],
        hasLegacyAccountData: true,
        now: new Date('2026-07-29T12:00:00.000Z')
    });

    assert.equal(result.registry.trackers.some(
        tracker => tracker.id === DEFAULT_ROBOT_TRACKER_ID
    ), false);
    assert.equal(result.registry.trackers.some(
        tracker => tracker.id === DEFAULT_BLOOD_STUDY_TRACKER_ID
    ), false);
    assert.deepEqual(result.registry.deletedTrackerIds, source.deletedTrackerIds);
});

test('a supported older unified registry upgrades without rebuilding legacy cards', () => {
    const first = migrateLegacyTrackerRegistry({
        hygieneData: { computadora: '2026-07-01' },
        hasLegacyAccountData: true,
        now: NOW
    });
    const previousIds = first.registry.trackers.map(tracker => tracker.id);
    first.registry.version = 2;

    const upgraded = migrateLegacyTrackerRegistry({
        hygieneData: {
            computadora: '2026-07-26',
            [CUSTOM_TRACKER_FIELD]: first.registry
        },
        hasLegacyAccountData: true,
        now: new Date('2026-07-29T12:00:00.000Z')
    });

    assert.equal(upgraded.migrated, true);
    assert.equal(upgraded.report.source, 'v2');
    assert.equal(upgraded.report.versionUpgraded, true);
    assert.deepEqual(upgraded.registry.trackers.map(tracker => tracker.id), previousIds);
    assert.equal(new Set(upgraded.registry.trackers.map(tracker => tracker.id)).size, previousIds.length);
});
