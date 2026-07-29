import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function decodeBasicEntities(value) {
    return value
        .replace(/&times;/gi, '×')
        .replace(/&#10060;/g, '❌')
        .replace(/&nbsp;/gi, ' ');
}

function getVisibleButtonText(markup) {
    return decodeBasicEntities(
        markup
            .replace(/<i\b[^>]*>[\s\S]*?<\/i>/gi, '')
            .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
            .replace(/<[^>]+>/g, ' ')
    ).replace(/\s+/g, ' ').trim();
}

test('icon-only controls keep an accessible name for the shared tooltip', async () => {
    const moduleFiles = (await readdir(path.join(ROOT, 'modules')))
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(ROOT, 'modules', file));
    const sourceFiles = [path.join(ROOT, 'index.html'), ...moduleFiles];
    const missingNames = [];

    for (const file of sourceFiles) {
        const source = await readFile(file, 'utf8');
        const buttons = source.matchAll(/<button\b[\s\S]*?<\/button>/gi);
        for (const match of buttons) {
            const markup = match[0];
            const openingTag = markup.match(/^<button\b[^>]*>/i)?.[0] || '';
            const visibleText = getVisibleButtonText(markup);
            const iconOnly = (
                visibleText === ''
                || /^(?:×|✕|❌)$/.test(visibleText)
                || /^\$\{[^}]*icon[^}]*\}$/i.test(visibleText)
            );
            if (!iconOnly) continue;

            const hasName = /\b(?:aria-label|title|data-tooltip)\s*=/i
                .test(openingTag);
            if (!hasName) {
                const line = source.slice(0, match.index).split('\n').length;
                missingNames.push(
                    `${path.relative(ROOT, file)}:${line}`
                );
            }
        }
    }

    assert.deepEqual(
        missingNames,
        [],
        `Controles de solo icono sin nombre accesible: ${missingNames.join(', ')}`
    );
});

test('configurable trackers use one explicit reorder mode instead of row arrows', async () => {
    const source = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');

    assert.doesNotMatch(source, /data-custom-manager-action="move-(?:up|down)"/);
    assert.match(source, /data-reorder-list/);
    assert.match(source, /Sortable\.create/);
    assert.match(index, /id="btn-order-custom-trackers"/);
    assert.match(index, /data-custom-order-action="save"/);
    assert.match(index, /data-custom-order-action="cancel"/);
});

test('the global tooltip controller is initialized by the application', async () => {
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const tooltipSource = await readFile(
        path.join(ROOT, 'tooltip-controller.mjs'),
        'utf8'
    );

    assert.match(appSource, /new TooltipController\(document\)/);
    assert.match(tooltipSource, /data-tooltip/);
    assert.match(tooltipSource, /focusin/);
    assert.match(tooltipSource, /mouseover/);
});

test('quick task capture is global, categorized and keyboard accessible', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const tasksSource = await readFile(
        path.join(ROOT, 'modules', 'TareasModule.js'),
        'utf8'
    );

    assert.match(index, /id="global-quick-task-btn"/);
    assert.match(index, /id="tareas-task-category"/);
    assert.match(index, /aria-labelledby="tareas-task-modal-title"/);
    assert.match(tasksSource, /openTaskCapture\(\{ quick: true \}\)/);
    assert.match(tasksSource, /event\.altKey/);
    assert.match(tasksSource, /event\.key\.toLowerCase\(\) !== 'n'/);
    assert.match(appSource, /showToast\(message/);
});

test('mobile navigation explains horizontal overflow and reacts after authentication', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');

    assert.match(index, /id="main-nav-scroll-hint"/);
    assert.match(index, /id="profile-nav-scroll-hint"/);
    assert.match(appSource, /new ResizeObserver\(update\)/);
    assert.match(appSource, /has-horizontal-overflow/);
});

test('Today reuses critical items and links back to their source modules', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const todaySource = await readFile(
        path.join(ROOT, 'modules', 'TodayModule.js'),
        'utf8'
    );

    assert.match(index, /data-section="hoy-section"/);
    assert.match(index, /id="hoy-section"/);
    assert.match(appSource, /new TodayModule\(this\)/);
    assert.match(todaySource, /notificationsCenter\?\.getOverdueItems/);
    assert.match(todaySource, /data-today-action="open"/);
    assert.match(todaySource, /data-today-action="complete"/);
});

test('Today exposes synchronized configurable shortcuts', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const todaySource = await readFile(
        path.join(ROOT, 'modules', 'TodayModule.js'),
        'utf8'
    );
    const trackerSource = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );

    assert.match(index, /id="today-actions-manager"/);
    assert.match(index, /id="today-actions-summary"/);
    assert.match(todaySource, /data-today-action="quick-action"/);
    assert.match(todaySource, /data-today-action="configure-quick-actions"/);
    assert.match(trackerSource, /todayPreferences/);
    assert.match(trackerSource, /data-today-preference-action="toggle"/);
});

test('recurring cards provide one explicit multi-register mode', async () => {
    const source = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );

    assert.match(source, /data-custom-bulk-action="enter"/);
    assert.match(source, /data-custom-bulk-action="record"/);
    assert.match(source, /data-custom-runtime-action="toggle-bulk"/);
    assert.match(source, /\.custom-tracker-card\.is-bulk-selectable/);
    assert.match(source, /recordTrackers\(trackerIds/);
    assert.match(source, /custom-runtime-overview/);
});

test('the profile names the configurable-card manager in plain language', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const profileButton = index.match(
        /<button class="profile-menu-item" data-tab="seguimientos">[\s\S]*?<\/button>/
    )?.[0] || '';

    assert.match(profileButton, />Tarjetas</);
    assert.match(index, /<h2>Tus tarjetas<\/h2>/);
});

test('task creation presents urgent work first and keeps non-urgent as long-term', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const generalSelect = index.match(
        /<select id="tareas-task-urgency"[\s\S]*?<\/select>/
    )?.[0] || '';
    const projectSelect = index.match(
        /<select id="tareas-freelance-new-task-urgency"[\s\S]*?<\/select>/
    )?.[0] || '';

    [generalSelect, projectSelect].forEach(markup => {
        assert.ok(markup.indexOf('value="urgente"') >= 0);
        assert.ok(
            markup.indexOf('value="urgente"') < markup.indexOf('value="muy_urgente"')
        );
        assert.ok(
            markup.indexOf('value="muy_urgente"') < markup.indexOf('value="no_urgente"')
        );
        assert.match(markup, /No urgente \(largo plazo\)/);
    });
});
