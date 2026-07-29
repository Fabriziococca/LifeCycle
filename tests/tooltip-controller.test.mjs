import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getTooltipText,
    TooltipController
} from '../tooltip-controller.mjs';

function createControl({
    tooltip = '',
    title = '',
    ariaLabel = '',
    text = ''
} = {}) {
    const attributes = new Map([
        ['title', title],
        ['aria-label', ariaLabel]
    ]);
    return {
        dataset: { tooltip },
        textContent: text,
        getAttribute(name) {
            return attributes.get(name) || '';
        }
    };
}

test('getTooltipText prioritizes the explicit LifeCycle tooltip', () => {
    const control = createControl({
        tooltip: 'Editar tarjeta',
        title: 'Título anterior',
        ariaLabel: 'Editar Cepillo de dientes'
    });

    assert.equal(getTooltipText(control), 'Editar tarjeta');
});

test('getTooltipText keeps compatibility with existing title attributes', () => {
    const control = createControl({
        title: 'Eliminar registro',
        ariaLabel: 'Eliminar registro del historial'
    });

    assert.equal(getTooltipText(control), 'Eliminar registro');
});

test('getTooltipText exposes the accessible name of icon-only controls', () => {
    const control = createControl({
        ariaLabel: 'Archivar tarjeta'
    });

    assert.equal(getTooltipText(control), 'Archivar tarjeta');
});

test('getTooltipText does not duplicate an already clear text label', () => {
    const control = createControl({
        ariaLabel: 'Crear una tarjeta nueva',
        text: 'Nueva tarjeta'
    });

    assert.equal(getTooltipText(control), '');
});

test('keyboard focus schedules the contextual tooltip', () => {
    const controller = new TooltipController({});
    const target = {};
    let scheduled = null;
    controller.findTarget = () => target;
    controller.schedule = (nextTarget, delay) => {
        scheduled = { nextTarget, delay };
    };

    controller.handleFocusIn({ target });

    assert.deepEqual(scheduled, {
        nextTarget: target,
        delay: controller.focusDelay
    });
});

test('mouse hover schedules tooltips only on hover-capable devices', () => {
    const originalWindow = globalThis.window;
    const controller = new TooltipController({});
    const target = { contains: () => false };
    let scheduled = null;
    controller.findTarget = () => target;
    controller.schedule = (nextTarget, delay) => {
        scheduled = { nextTarget, delay };
    };

    try {
        globalThis.window = {
            matchMedia: () => ({ matches: true })
        };
        controller.handlePointerOver({
            target,
            relatedTarget: null,
            pointerType: 'mouse',
            sourceCapabilities: null
        });

        assert.deepEqual(scheduled, {
            nextTarget: target,
            delay: controller.hoverDelay
        });

        scheduled = null;
        globalThis.window = {
            matchMedia: () => ({ matches: false })
        };
        controller.handlePointerOver({
            target,
            relatedTarget: null,
            pointerType: 'touch',
            sourceCapabilities: { firesTouchEvents: true }
        });

        assert.equal(scheduled, null);
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
    }
});
