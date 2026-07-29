import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTodayOverview } from '../today-utils.mjs';

test('today overview groups tasks, projects and follow-ups without duplicating items', () => {
    const overview = buildTodayOverview([
        { module: 'custom_tracker', id: 'tracker-1', name: 'Botella' },
        { module: 'tareas', id: 'task-1', urgency: 'urgente', name: 'Comprar' },
        { module: 'projects', id: 'project-1', name: 'Proyecto' },
        { module: 'projects_tasks', id: 'task-2', urgency: 'muy_urgente', name: 'Entregar' },
        { module: 'workana', id: 'subscription', name: 'Suscripción' }
    ]);

    assert.equal(overview.total, 5);
    assert.deepEqual(overview.counts, {
        tasks: 2,
        projects: 2,
        followups: 1
    });
    assert.deepEqual(
        overview.groups.find(group => group.id === 'tasks').items.map(item => item.id),
        ['task-2', 'task-1']
    );
});

test('today overview accepts missing or malformed input as an empty day', () => {
    assert.deepEqual(buildTodayOverview(null).counts, {
        tasks: 0,
        projects: 0,
        followups: 0
    });
    assert.equal(buildTodayOverview([null, 'invalid']).total, 0);
});
