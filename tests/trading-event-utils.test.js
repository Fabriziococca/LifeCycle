const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_TRADING_NOTICE_DAYS,
    buildTradingEventAlertKey,
    getDueTradingEventNotice,
    normalizeTradingEvent,
    normalizeTradingEvents,
    parseTradingEventAlertKey,
    parseTradingNoticeDays
} = require('../trading-event-utils');

function buildEvent(overrides = {}) {
    return {
        id: 'trade_nvidia_q3',
        company: 'NVIDIA',
        ticker: 'nvda',
        name: 'Resultados Q3',
        scheduledAt: '2026-10-30T20:00:00.000Z',
        notes: '',
        sourceUrl: 'https://investor.nvidia.com/',
        noticeDays: [...DEFAULT_TRADING_NOTICE_DAYS],
        status: 'active',
        createdAt: '2026-08-08T20:00:00.000Z',
        updatedAt: '2026-08-08T20:00:00.000Z',
        ...overrides
    };
}

test('trading events normalize safe fields without mutating the source', () => {
    const source = buildEvent({ ticker: ' nvda ' });
    const normalized = normalizeTradingEvent(source);

    assert.equal(normalized.ticker, 'NVDA');
    assert.deepEqual(normalized.noticeDays, [60, 30, 15, 7, 1]);
    assert.equal(normalized.sourceUrl, 'https://investor.nvidia.com/');
    assert.notEqual(normalized, source);
    assert.equal(source.ticker, ' nvda ');
});

test('trading notice intervals are bounded, editable and unique', () => {
    assert.deepEqual(parseTradingNoticeDays('90, 30, 7, 7, 1'), [90, 30, 7, 1]);
    assert.equal(parseTradingNoticeDays('60, quince, 1'), null);
    assert.equal(parseTradingNoticeDays('0, 1'), null);
    assert.equal(parseTradingNoticeDays('366'), null);
});

test('only the current progressive threshold becomes due', () => {
    const event = buildEvent();

    assert.equal(getDueTradingEventNotice(event, '2026-08-20T20:00:00.000Z'), null);
    assert.equal(
        getDueTradingEventNotice(event, '2026-09-01T20:00:00.000Z').noticeDays,
        60
    );
    assert.equal(
        getDueTradingEventNotice(event, '2026-10-01T20:00:00.000Z').noticeDays,
        30
    );
    assert.equal(
        getDueTradingEventNotice(event, '2026-10-24T20:00:00.000Z').noticeDays,
        7
    );
    assert.equal(
        getDueTradingEventNotice(event, '2026-10-30T08:00:00.000Z').noticeDays,
        1
    );
});

test('paused and completed trading events never become due', () => {
    assert.equal(
        getDueTradingEventNotice(buildEvent({ status: 'paused' }), '2026-10-24T20:00:00.000Z'),
        null
    );
    assert.equal(
        getDueTradingEventNotice(buildEvent(), '2026-10-30T20:00:00.000Z'),
        null
    );
});

test('idempotency keys include the event schedule and threshold', () => {
    const event = normalizeTradingEvent(buildEvent());
    const originalKey = buildTradingEventAlertKey(event, 30);
    const movedEvent = normalizeTradingEvent(buildEvent({
        scheduledAt: '2026-11-15T20:00:00.000Z'
    }));
    const movedKey = buildTradingEventAlertKey(movedEvent, 30);

    assert.notEqual(originalKey, movedKey);
    assert.deepEqual(parseTradingEventAlertKey(originalKey), {
        eventId: event.id,
        scheduleToken: '20261030T200000000Z',
        noticeDays: 30
    });
    assert.equal(
        parseTradingEventAlertKey('trading_event:trade_nvidia_q3:20261030T200000000Z:0d'),
        null
    );
});

test('the registry rejects malformed or duplicated events', () => {
    const valid = buildEvent();
    const malformed = buildEvent({ id: '../unsafe' });
    const duplicate = buildEvent({ name: 'Duplicado' });

    const normalized = normalizeTradingEvents([valid, malformed, duplicate]);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].name, 'Resultados Q3');
});
