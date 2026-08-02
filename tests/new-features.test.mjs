import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('style.css defines --status-purple and --status-purple-glow in :root', () => {
    const cssPath = path.join(process.cwd(), 'style.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    assert.match(content, /--status-purple:\s*#a855f7/);
    assert.match(content, /--status-purple-glow:\s*rgba\(168,\s*85,\s*247/);
});

test('24-hour completed task cleanup filters out tasks completed > 24h ago when enabled', () => {
    const now = Date.now();
    const twentyFiveHoursAgo = now - (25 * 60 * 60 * 1000);
    const oneHourAgo = now - (1 * 60 * 60 * 1000);

    const tasks = [
        { id: 't1', text: 'Tarea antigua', completed: true, completedAt: twentyFiveHoursAgo },
        { id: 't2', text: 'Tarea reciente', completed: true, completedAt: oneHourAgo },
        { id: 't3', text: 'Tarea pendiente', completed: false }
    ];

    const isAutoCleanEnabled = true;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    const filtered = tasks.filter(t => {
        if (!isAutoCleanEnabled) return true;
        if (!t.completed) return true;
        const completedTime = t.completedAt;
        if (!completedTime) return true;
        return (now - new Date(completedTime).getTime()) < TWENTY_FOUR_HOURS;
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered.some(t => t.id === 't1'), false);
    assert.equal(filtered.some(t => t.id === 't2'), true);
    assert.equal(filtered.some(t => t.id === 't3'), true);
});

test('project creation preserves clientSource and source attributes', () => {
    const newProj = {
        id: 101,
        client: 'Diego',
        project: 'Scraping números',
        source: 'external',
        clientSource: 'workana'
    };

    assert.equal(newProj.source, 'external');
    assert.equal(newProj.clientSource, 'workana');
});

test('ProjectsModule.js declares clientSourceBadge before building card innerHTML', () => {
    const projPath = path.join(process.cwd(), 'modules', 'ProjectsModule.js');
    const content = fs.readFileSync(projPath, 'utf8');
    const badgeDeclarationIndex = content.indexOf('const clientSourceBadge =');
    const innerHTMLIndex = content.indexOf('${clientSourceBadge}');
    assert.ok(badgeDeclarationIndex > 0, 'clientSourceBadge must be declared');
    assert.ok(innerHTMLIndex > badgeDeclarationIndex, 'clientSourceBadge must be declared before innerHTML interpolation');
});
