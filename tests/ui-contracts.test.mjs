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

test('application feedback never falls back to native browser dialogs', async () => {
    const moduleFiles = (await readdir(path.join(ROOT, 'modules')))
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(ROOT, 'modules', file));
    const sourceFiles = [path.join(ROOT, 'app.js'), ...moduleFiles];
    const nativeDialogCalls = [];

    for (const file of sourceFiles) {
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(
            /(?<![\w.])(?:window\.)?(?:alert|confirm)\s*\(/g
        )) {
            const line = source.slice(0, match.index).split('\n').length;
            nativeDialogCalls.push(`${path.relative(ROOT, file)}:${line}`);
        }
    }

    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(appSource, /new FeedbackController\(document\)/);
    assert.deepEqual(
        nativeDialogCalls,
        [],
        `Diálogos nativos encontrados: ${nativeDialogCalls.join(', ')}`
    );
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

test('global search is local, keyboard accessible and routes to source modules', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const searchSource = await readFile(
        path.join(ROOT, 'modules', 'GlobalSearchModule.js'),
        'utf8'
    );

    assert.match(index, /id="global-search-btn"/);
    assert.match(index, /id="global-search-modal"/);
    assert.match(index, /id="global-search-input"/);
    assert.match(index, /role="listbox"/);
    assert.match(appSource, /new GlobalSearchModule\(this\)/);
    assert.match(searchSource, /event\.ctrlKey \|\| event\.metaKey/);
    assert.match(searchSource, /event\.key === 'ArrowDown'/);
    assert.match(searchSource, /event\.key === 'Enter'/);
    assert.match(searchSource, /activateSection\?\.\('tareas-section'/);
    assert.match(searchSource, /renderMonthlyHistory\?\.\('all'\)/);
    assert.doesNotMatch(searchSource, /finanzas|attachments|medicalData/);
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

test('profile identity remains intact and long email addresses can wrap', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');
    const accountCard = index.match(
        /<div id="auth-logged-in"[\s\S]*?<div class="card-body">/
    )?.[0] || '';

    assert.match(accountCard, /id="profile-email"/);
    assert.match(accountCard, /id="sync-status-badge"/);
    assert.match(styles, /#profile-email[\s\S]*overflow-wrap:\s*anywhere/);
});

test('tracker manager filters sections and remembers the selected filter', async () => {
    const source = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );
    const stateSource = await readFile(path.join(ROOT, 'ui-state.mjs'), 'utf8');

    assert.match(source, /data-tracker-category-filter="all"/);
    assert.match(source, /trackerManagerFilter/);
    assert.match(source, /aria-pressed=/);
    assert.match(stateSource, /trackerManagerFilter:\s*'all'/);
});

test('project cards stack their header and keep destructive action separate on mobile', async () => {
    const projectsSource = await readFile(
        path.join(ROOT, 'modules', 'ProjectsModule.js'),
        'utf8'
    );
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');

    assert.match(projectsSource, /class="project-card-header"/);
    assert.match(projectsSource, /class="countdown-badge-wrapper"/);
    assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.project-card-header[\s\S]*flex-direction:\s*column/);
    assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) auto/);
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

test('project templates reuse structure without copying client identity or dates', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const projectsSource = await readFile(
        path.join(ROOT, 'modules', 'ProjectsModule.js'),
        'utf8'
    );
    const templateUtils = await readFile(
        path.join(ROOT, 'project-template-utils.mjs'),
        'utf8'
    );

    assert.match(index, /id="projectTemplateSelect"/);
    assert.match(index, /id="project-templates-modal"/);
    assert.match(index, /aria-labelledby="project-templates-modal-title"/);
    assert.match(index, /El cliente y las fechas nunca se copian/);
    assert.match(projectsSource, /getProjectTemplatePayload/);
    assert.match(projectsSource, /templatePayload\.tasks/);
    assert.doesNotMatch(templateUtils, /\bclient\s*:/);
    assert.doesNotMatch(templateUtils, /\baccepted\s*:/);
});

test('recurring finances require confirmation and protect each occurrence from duplicates', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const financeSource = await readFile(
        path.join(ROOT, 'modules', 'FinanzasModule.js'),
        'utf8'
    );

    assert.match(index, /id="btnManageFinanceRecurring"/);
    assert.match(index, /aria-labelledby="finance-recurring-modal-title"/);
    assert.match(index, /No se crean ingresos ni gastos automáticamente/);
    assert.match(index, /id="fin-recurring-due-panel"/);
    assert.match(financeSource, /openFinanceRecurringRegistration/);
    assert.match(financeSource, /hasRecordedFinanceOccurrence/);
    assert.match(financeSource, /recurringOccurrence/);
});

test('relevant module context is restored instead of resetting after reload', async () => {
    const financeSource = await readFile(
        path.join(ROOT, 'modules', 'FinanzasModule.js'),
        'utf8'
    );
    const gymSource = await readFile(
        path.join(ROOT, 'modules', 'GymModule.js'),
        'utf8'
    );
    const vehicleSource = await readFile(
        path.join(ROOT, 'modules', 'VehicleModule.js'),
        'utf8'
    );
    const tasksSource = await readFile(
        path.join(ROOT, 'modules', 'TareasModule.js'),
        'utf8'
    );
    const alertsSource = await readFile(
        path.join(ROOT, 'modules', 'AlertsModule.js'),
        'utf8'
    );

    assert.match(financeSource, /uiState\?\.financeTab/);
    assert.match(financeSource, /financeMonth/);
    assert.match(gymSource, /uiState\?\.gymTab/);
    assert.match(vehicleSource, /uiState\?\.vehicleTab/);
    assert.match(tasksSource, /uiState\?\.tasksCategory/);
    assert.match(tasksSource, /tasksProjectId/);
    assert.match(alertsSource, /uiState\?\.alertsCategory/);
});

test('vehicle cards are configurable without losing legacy data paths', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const vehicleSource = await readFile(
        path.join(ROOT, 'modules', 'VehicleModule.js'),
        'utf8'
    );
    const catalogSource = await readFile(
        path.join(ROOT, 'modules', 'VehicleCatalogModule.js'),
        'utf8'
    );
    const trackerManagerSource = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );
    const serverSource = await readFile(path.join(ROOT, 'server.js'), 'utf8');

    assert.match(index, /id="vehicle-custom-maintenance-cards"/);
    assert.match(index, /id="vehicle-custom-document-cards"/);
    assert.match(vehicleSource, /new VehicleCatalogModule\(this\)/);
    assert.match(catalogSource, /migrateVehicleCatalog/);
    assert.match(catalogSource, /syncCardAlertConfig/);
    assert.match(trackerManagerSource, /data-tracker-category-filter="vehicle"/);
    assert.match(serverSource, /buildVehicleCatalogNotification/);
});
