import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createTaskRecord,
    DEFAULT_TASK_URGENCY,
    getTaskCaptureCategories
} from '../task-capture-utils.mjs';

test('quick capture exposes regular folders without duplicating or including Freelance', () => {
    assert.deepEqual(
        getTaskCaptureCategories([
            'Personal',
            ' Freelance ',
            'Cotidianas',
            'Personal',
            '',
            null
        ]),
        ['Personal', 'Cotidianas']
    );
});

test('quick capture builds the same task shape used by the task module', () => {
    const task = createTaskRecord(
        {
            text: '  Comprar jabón blanco  ',
            category: 'Personal',
            urgency: 'muy_urgente'
        },
        {
            categories: ['Personal', 'Freelance'],
            existingIds: [1000],
            now: () => 1000
        }
    );

    assert.deepEqual(task, {
        id: 1001,
        text: 'Comprar jabón blanco',
        category: 'Personal',
        urgency: 'muy_urgente',
        completed: false,
        createdAt: '1970-01-01T00:00:01.000Z'
    });
});

test('quick capture rejects empty text and unknown folders', () => {
    assert.throws(
        () => createTaskRecord(
            { text: '   ', category: 'Personal' },
            { categories: ['Personal'] }
        ),
        /Escribí qué tarea/
    );

    assert.throws(
        () => createTaskRecord(
            { text: 'Comprar jabón', category: 'Inexistente' },
            { categories: ['Personal'] }
        ),
        /carpeta válida/
    );
});

test('quick capture defaults to urgent when urgency is missing or unknown', () => {
    const task = createTaskRecord(
        {
            text: 'Comprar jabón',
            category: 'Personal',
            urgency: 'inventada'
        },
        {
            categories: ['Personal'],
            now: () => 2000
        }
    );

    assert.equal(DEFAULT_TASK_URGENCY, 'urgente');
    assert.equal(task.urgency, DEFAULT_TASK_URGENCY);
});
