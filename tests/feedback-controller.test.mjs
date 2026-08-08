import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeFeedbackOptions
} from '../feedback-controller.mjs';

test('message feedback uses safe visible defaults', () => {
    assert.deepEqual(
        normalizeFeedbackOptions('Cambios guardados.'),
        {
            mode: 'message',
            tone: 'info',
            title: 'Información',
            message: 'Cambios guardados.',
            details: [],
            confirmLabel: 'Entendido',
            cancelLabel: 'Cancelar',
            showCancel: false,
            icon: 'ph-info',
            closeOnBackdrop: true
        }
    );
});

test('destructive confirmation prioritizes cancellation and explicit labels', () => {
    const result = normalizeFeedbackOptions({
        title: 'Eliminar estudio',
        message: 'El archivo adjunto no se podrá recuperar.',
        tone: 'danger',
        confirmLabel: 'Eliminar definitivamente',
        cancelLabel: 'Conservar'
    }, {
        mode: 'confirm'
    });

    assert.equal(result.mode, 'confirm');
    assert.equal(result.tone, 'danger');
    assert.equal(result.showCancel, true);
    assert.equal(result.confirmLabel, 'Eliminar definitivamente');
    assert.equal(result.cancelLabel, 'Conservar');
    assert.equal(result.icon, 'ph-warning-octagon');
});

test('unknown tones and empty labels fall back deterministically', () => {
    const result = normalizeFeedbackOptions({
        tone: 'purple',
        title: ' ',
        confirmLabel: ''
    }, {
        mode: 'confirm'
    });

    assert.equal(result.tone, 'warning');
    assert.equal(result.title, 'Atención');
    assert.equal(result.confirmLabel, 'Confirmar');
});

test('confirmation details keep only complete safe label-value pairs', () => {
    const result = normalizeFeedbackOptions({
        message: 'Revisá el movimiento.',
        details: [
            { label: 'Proyecto', value: 'Sitio institucional' },
            { label: 'Monto', value: 'USD 125.00' },
            { label: '', value: 'omitido' },
            null
        ]
    }, {
        mode: 'confirm'
    });

    assert.deepEqual(result.details, [
        { label: 'Proyecto', value: 'Sitio institucional' },
        { label: 'Monto', value: 'USD 125.00' }
    ]);
});
