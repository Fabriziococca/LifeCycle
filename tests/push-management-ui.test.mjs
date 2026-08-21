import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildPushEnginePresentation,
    buildPushHistoryPresentation
} from '../modules/PushManagementModule.js';

test('push engine summary exposes an operational state without technical noise', () => {
    const result = buildPushEnginePresentation({
        configured: true,
        running: false,
        lastSuccessAt: '2026-08-08T21:00:00.000Z',
        lastFailureAt: null,
        consecutiveFailures: 0
    });

    assert.equal(result.tone, 'success');
    assert.equal(result.title, 'Motor operativo');
    assert.match(result.detail, /Última revisión correcta/);
    assert.equal(result.lastError, '');
});

test('push engine summary keeps the last recovered error visible', () => {
    const result = buildPushEnginePresentation({
        configured: true,
        lastSuccessAt: '2026-08-08T21:00:00.000Z',
        lastFailureAt: '2026-08-08T20:00:00.000Z',
        consecutiveFailures: 0
    });

    assert.equal(result.title, 'Motor operativo');
    assert.match(result.lastError, /^Último error registrado/);
    assert.match(result.lastError, /recuperado en una revisión posterior/);
});

test('push engine summary prioritizes consecutive failures', () => {
    const result = buildPushEnginePresentation({
        configured: true,
        lastSuccessAt: '2026-08-08T19:00:00.000Z',
        lastFailureAt: '2026-08-08T21:00:00.000Z',
        consecutiveFailures: 2
    });

    assert.equal(result.tone, 'danger');
    assert.equal(result.title, 'Motor con errores');
    assert.match(result.detail, /2 revisiones consecutivas fallaron/);
    assert.match(result.lastError, /^Último error registrado/);
    assert.doesNotMatch(result.lastError, /recuperado/);

    const singular = buildPushEnginePresentation({
        configured: true,
        consecutiveFailures: 1
    });
    assert.equal(singular.detail, '1 revisión consecutiva falló.');
});

test('push engine summary distinguishes incomplete configuration', () => {
    const result = buildPushEnginePresentation({ configured: false });

    assert.equal(result.tone, 'warning');
    assert.equal(result.title, 'Motor pendiente de configuración');
    assert.equal(result.lastError, '');
});

test('push history distinguishes provider, device display and stale discard', () => {
    assert.equal(
        buildPushHistoryPresentation({ status: 'accepted' }).label,
        'Aceptada por Push'
    );
    assert.equal(
        buildPushHistoryPresentation({
            status: 'accepted',
            displayed_at: '2026-08-21T01:03:00.000Z'
        }).label,
        'Mostrada por el dispositivo'
    );
    assert.equal(
        buildPushHistoryPresentation({
            status: 'accepted',
            discarded_at: '2026-08-21T07:00:00.000Z'
        }).label,
        'Descartada por vencida'
    );
    assert.equal(
        buildPushHistoryPresentation({ status: 'unknown' }).label,
        'Resultado desconocido'
    );
});
