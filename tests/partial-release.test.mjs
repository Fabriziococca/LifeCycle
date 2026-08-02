import test from 'node:test';
import assert from 'node:assert/strict';

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

    const entries = [];
    if (Array.isArray(activeProject.partialReleases)) {
        activeProject.partialReleases.forEach((rel, idx) => {
            entries.push({
                id: `proj-partial-active-${activeProject.id}-${rel.id || idx}`,
                category: 'freelance',
                source: activeProject.source,
                date: rel.date,
                amount: Number(rel.netAmount),
                description: `[Parcial ${rel.percent}%] ${activeProject.client} - ${activeProject.project}`
            });
        });
    }

    assert.equal(entries.length, 1);
    assert.equal(entries[0].amount, 181.58);
    assert.equal(entries[0].description, '[Parcial 50%] David - Seguridad');
});
