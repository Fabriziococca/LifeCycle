import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveLensStartDate } from '../lens-time-utils.mjs';

test('lens start time keeps valid past timestamps unchanged', () => {
    const start = resolveLensStartDate(
        '2026-07-28T00:30:00.000Z',
        new Date('2026-07-28T03:00:00.000Z')
    );
    assert.equal(start.toISOString(), '2026-07-28T00:30:00.000Z');
});

test('lens start time interprets a same-clock future time as yesterday', () => {
    const start = resolveLensStartDate(
        '2026-07-28T09:00:00.000Z',
        new Date('2026-07-28T03:00:00.000Z')
    );
    assert.equal(start.toISOString(), '2026-07-27T09:00:00.000Z');
});

test('lens start time rejects malformed or implausibly future values', () => {
    assert.equal(resolveLensStartDate('not-a-date'), null);
    assert.equal(
        resolveLensStartDate(
            '2026-08-02T09:00:00.000Z',
            new Date('2026-07-28T03:00:00.000Z')
        ),
        null
    );
});
