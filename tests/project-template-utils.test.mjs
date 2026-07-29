import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PROJECT_TEMPLATE_REGISTRY_VERSION,
    buildProjectTemplate,
    cloneTemplateTasks,
    getProjectTemplatePayload,
    normalizeProjectTemplateRegistry,
    removeProjectTemplate,
    upsertProjectTemplate
} from '../project-template-utils.mjs';

test('normaliza registros anteriores y descarta plantillas inválidas o duplicadas', () => {
    const registry = normalizeProjectTemplateRegistry([
        {
            id: 'landing',
            name: ' Landing ',
            projectName: ' Sitio web ',
            deliveryDays: '5',
            includeBudget: true,
            budgetGross: '250',
            feeType: '15',
            tasks: [
                { text: ' Maquetar ', urgency: 'muy_urgente', completed: true },
                { text: ' ' }
            ]
        },
        { id: 'landing', name: 'Duplicada' },
        { id: 'invalid', name: ' ' }
    ]);

    assert.equal(registry.version, PROJECT_TEMPLATE_REGISTRY_VERSION);
    assert.equal(registry.templates.length, 1);
    assert.deepEqual(registry.templates[0].tasks, [
        { text: 'Maquetar', urgency: 'muy_urgente' }
    ]);
    assert.equal(registry.templates[0].budgetGross, 250);
});

test('construye una plantilla desde un proyecto sin conservar estados de tareas', () => {
    const template = buildProjectTemplate({
        project: 'API privada',
        days: 7,
        budgetGross: 400,
        feeType: 'custom',
        manualPercent: 12.5,
        source: 'external',
        summary: 'Backend',
        phases: '1. Diseño\n2. Entrega',
        tasks: [
            { id: 99, text: 'Definir contrato', completed: true, urgency: 'urgente' }
        ]
    }, {
        id: 'api-template',
        name: 'API',
        includeBudget: false,
        now: '2026-07-29T12:00:00.000Z'
    });

    assert.equal(template.budgetGross, null);
    assert.equal(template.includeBudget, false);
    assert.equal(template.source, 'external');
    assert.deepEqual(template.tasks, [
        { text: 'Definir contrato', urgency: 'urgente' }
    ]);
});

test('upsert y remove actualizan el registro sin mutar el original', () => {
    const original = normalizeProjectTemplateRegistry({
        version: 1,
        templates: [{ id: 'one', name: 'Uno' }]
    });
    const updated = upsertProjectTemplate(original, { id: 'two', name: 'Dos' });
    const removed = removeProjectTemplate(updated, 'one');

    assert.equal(original.templates.length, 1);
    assert.deepEqual(updated.templates.map(item => item.id), ['one', 'two']);
    assert.deepEqual(removed.templates.map(item => item.id), ['two']);
});

test('clona tareas con IDs nuevos y todas pendientes', () => {
    const cloned = cloneTemplateTasks([
        { text: 'Diseñar', urgency: 'urgente' },
        { text: 'Probar', urgency: 'muy_urgente' }
    ], (_, index) => `task-${index}`);

    assert.deepEqual(cloned, [
        { id: 'task-0', text: 'Diseñar', completed: false, urgency: 'urgente' },
        { id: 'task-1', text: 'Probar', completed: false, urgency: 'muy_urgente' }
    ]);
});

test('genera el contenido repetible para un proyecto nuevo', () => {
    const payload = getProjectTemplatePayload({
        id: 'web',
        name: 'Web',
        summary: 'Resumen',
        phases: 'Fases',
        tasks: [{ text: 'Publicar', urgency: 'no_urgente' }]
    }, () => 123);

    assert.equal(payload.summary, 'Resumen');
    assert.equal(payload.phases, 'Fases');
    assert.deepEqual(payload.tasks, [
        { id: 123, text: 'Publicar', completed: false, urgency: 'no_urgente' }
    ]);
});
