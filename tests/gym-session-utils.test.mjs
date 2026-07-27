import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createActiveGymSession,
    normalizeActiveGymSession
} from '../gym-session-utils.mjs';

test('createActiveGymSession snapshots the selected routine day', () => {
    const now = new Date(2026, 6, 27, 18, 30);
    const session = createActiveGymSession({
        selectedDay: 'Lunes',
        now,
        routine: [
            { day: 'Lunes', name: 'Press banca', series: 2, weight: 50, reps: 8 },
            { day: 'Martes', name: 'Sentadilla', series: 3, weight: 70, reps: 6 }
        ]
    });

    assert.equal(session.id, now.getTime());
    assert.equal(session.date, '2026-07-27');
    assert.equal(session.day, 'Lunes');
    assert.deepEqual(Object.keys(session.exercises), ['Press banca']);
    assert.equal(session.exercises['Press banca'].length, 2);
    assert.deepEqual(session.exercises['Press banca'][0], {
        weight: 50,
        reps: 8,
        rir: null,
        failed: false
    });
});

test('normalizeActiveGymSession validates and normalizes persisted input', () => {
    const normalized = normalizeActiveGymSession(JSON.stringify({
        id: 123,
        date: '2026-07-27',
        day: 'Lunes',
        startedAt: '2026-07-27T21:30:00.000Z',
        updatedAt: '2026-07-27T21:35:00.000Z',
        exercises: {
            ' Press banca ': [
                { weight: '52.5', reps: '8', rir: '2', failed: 0 },
                { weight: -10, reps: 'invalid', rir: 50, failed: true }
            ]
        }
    }));

    assert.equal(normalized.day, 'Lunes');
    assert.deepEqual(normalized.exercises['Press banca'][0], {
        weight: 52.5,
        reps: 8,
        rir: 2,
        failed: false
    });
    assert.deepEqual(normalized.exercises['Press banca'][1], {
        weight: 0,
        reps: 0,
        rir: 10,
        failed: true
    });
});

test('normalizeActiveGymSession rejects malformed sessions', () => {
    assert.equal(normalizeActiveGymSession(null), null);
    assert.equal(normalizeActiveGymSession('{bad json'), null);
    assert.equal(normalizeActiveGymSession({ id: 1, exercises: [] }), null);
    assert.equal(normalizeActiveGymSession({ exercises: {} }), null);
});
