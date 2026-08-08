import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildProjectIncomeMovements,
    calculateClosedMonthAverages,
    groupProjectIncomeMovementsByMonth
} from '../project-income-utils.mjs';

test('project income movements split partial releases from the final remainder', () => {
    const movements = buildProjectIncomeMovements({
        historyProjects: [{
            id: 7,
            client: 'Acme',
            project: 'Portal',
            source: 'external',
            budgetNet: 400,
            deliveredDate: '2026-08-08',
            partialReleases: [
                { id: 71, date: '2026-07-15', percent: 25, netAmount: 100 },
                { id: 72, date: '2026-08-01', percent: 25, netAmount: 100 }
            ]
        }],
        fallbackDate: '2026-08-08'
    });

    assert.deepEqual(
        movements.map(({ id, kind, date, amount, canReverse }) => ({
            id,
            kind,
            date,
            amount,
            canReverse
        })),
        [
            {
                id: 'proj-partial-hist-7-71',
                kind: 'partial',
                date: '2026-07-15',
                amount: 100,
                canReverse: false
            },
            {
                id: 'proj-partial-hist-7-72',
                kind: 'partial',
                date: '2026-08-01',
                amount: 100,
                canReverse: false
            },
            {
                id: 'proj-final-7',
                kind: 'final',
                date: '2026-08-08',
                amount: 200,
                canReverse: true
            }
        ]
    );
});

test('monthly groups include active partial releases without duplicating project totals', () => {
    const movements = buildProjectIncomeMovements({
        activeProjects: [{
            id: 1,
            client: 'David',
            project: 'Seguridad',
            budgetNet: 363.17,
            partialReleases: [
                { id: 101, date: '2026-08-02', percent: 50, netAmount: 181.59 }
            ]
        }],
        historyProjects: [{
            id: 2,
            client: 'Ana',
            project: 'Tienda',
            budgetNet: 250,
            deliveredDate: '2026-07-20'
        }],
        fallbackDate: '2026-08-08'
    });
    const groups = groupProjectIncomeMovementsByMonth(movements);

    assert.equal(groups['2026-08'].totalNet, 181.59);
    assert.equal(groups['2026-08'].movements[0].scope, 'active');
    assert.equal(groups['2026-07'].totalNet, 250);
});

test('averages exclude the current month and use only completed calendar months', () => {
    const averages = calculateClosedMonthAverages([
        { date: '2026-05-05', amount: 90 },
        { date: '2026-06-05', amount: 120 },
        { date: '2026-07-05', amount: 150 },
        { date: '2026-08-02', amount: 181.59 }
    ], {
        today: new Date(2026, 7, 8, 12, 0, 0)
    });

    assert.equal(averages.historical, 120);
    assert.equal(averages.last3, 120);
    assert.equal(averages.last6, 60);
});
