import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectIncomeMovements } from '../project-income-utils.mjs';

test('partial release calculates gross and net amounts correctly for 50%', () => {
    const totalGross = 461.00;
    const totalNet = 363.17;
    const pendingNet = 363.17;

    const pct = 50;
    const releaseNet = Math.round(((pendingNet * pct) / 100) * 100) / 100;
    const releaseGross = Math.round((releaseNet * (totalGross / totalNet)) * 100) / 100;

    assert.equal(releaseNet, 181.59);
    assert.equal(releaseGross, 230.51);

    const remainingNet = Math.round((totalNet - releaseNet) * 100) / 100;
    assert.equal(remainingNet, 181.58);
});

test('FinanzasModule getCombinedEntries includes partial releases from active projects', () => {
    const activeProject = {
        id: 1,
        client: 'David',
        project: 'Seguridad',
        source: 'workana',
        budgetNet: 363.17,
        partialReleases: [
            { id: 101, date: '2026-08-02', percent: 50, grossAmount: 230.50, netAmount: 181.58 }
        ]
    };

    const entries = buildProjectIncomeMovements({
        activeProjects: [activeProject],
        fallbackDate: '2026-08-08'
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'proj-partial-active-1-101');
    assert.equal(entries[0].amount, 181.58);
    assert.equal(entries[0].description, '[Parcial 50%] David - Seguridad');
});
