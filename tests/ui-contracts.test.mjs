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
    assert.match(tasksSource, /matchesKeyboardShortcut\(event, 'quick-task'\)/);
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
    assert.match(index, /class="header-actions"/);
    assert.match(index, /id="global-search-modal"/);
    assert.match(index, /id="global-search-input"/);
    assert.match(index, /role="listbox"/);
    assert.match(appSource, /new GlobalSearchModule\(this\)/);
    assert.match(searchSource, /matchesKeyboardShortcut\(event, 'command-palette'\)/);
    assert.match(searchSource, /event\.key === 'ArrowDown'/);
    assert.match(searchSource, /event\.key === 'Enter'/);
    assert.match(searchSource, /activateSection\?\.\('tareas-section'/);
    assert.match(searchSource, /renderMonthlyHistory\?\.\('all'\)/);
    assert.match(searchSource, /kind: 'command'/);
    assert.match(searchSource, /target: \{ command: 'new-reminder' \}/);
    assert.match(searchSource, /target: \{ command: 'register-expense' \}/);
    assert.doesNotMatch(searchSource, /attachments|medicalData/);
    const launcher = index.match(/<button[^>]+id="global-search-btn"[\s\S]*?<\/button>/)?.[0] || '';
    assert.doesNotMatch(launcher, /<kbd>/);
});

test('mobile navigation explains horizontal overflow and reacts after authentication', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');

    assert.match(index, /id="main-nav-scroll-hint"/);
    assert.match(index, /id="profile-nav-scroll-hint"/);
    assert.match(appSource, /new ResizeObserver\(update\)/);
    assert.match(appSource, /has-horizontal-overflow/);
});

test('adaptive navigation uses a desktop sidebar and four mobile favorites plus More', async () => {
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const navigationSource = await readFile(
        path.join(ROOT, 'modules', 'AdaptiveNavigationModule.js'),
        'utf8'
    );
    const trackerSource = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');

    assert.match(appSource, /new AdaptiveNavigationModule\(this\)/);
    assert.match(appSource, /classList\.remove\('profile-view-active'\)/);
    assert.match(appSource, /classList\.add\('profile-view-active'\)/);
    assert.match(navigationSource, /favorites\.slice\(0, 4\)/);
    assert.match(navigationSource, /className = 'nav-btn adaptive-nav-more'/);
    assert.match(navigationSource, /data-adaptive-nav-profile="preferencias"/);
    assert.match(trackerSource, /data-module-favorite-action="toggle"/);
    assert.match(trackerSource, /toggleNavigationFavorite/);
    assert.match(styles, /@media \(min-width: 1100px\)[\s\S]*\.main-nav\s*\{[\s\S]*position:\s*fixed/);
    assert.match(styles, /@media \(max-width: 767px\)[\s\S]*grid-template-columns:\s*repeat\(5/);
});

test('profile groups settings and exposes the complete keyboard shortcut reference', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const shortcutsSource = await readFile(
        path.join(ROOT, 'keyboard-shortcuts.mjs'),
        'utf8'
    );
    const shortcutsModule = await readFile(
        path.join(ROOT, 'modules', 'KeyboardShortcutsModule.js'),
        'utf8'
    );

    assert.match(index, /class="profile-menu-group">Cuenta</);
    assert.match(index, /class="profile-menu-group">Personalización</);
    assert.match(index, /class="profile-menu-group">Datos y aplicación</);
    assert.match(index, /id="keyboard-shortcuts-list"/);
    assert.match(index, /data-profile-tab-link="alertas"/);
    assert.match(appSource, /new KeyboardShortcutsModule\(this\)/);
    assert.match(shortcutsSource, /id: 'command-palette'/);
    assert.match(shortcutsSource, /id: 'quick-task'/);
    assert.match(shortcutsModule, /document\.createElement\('kbd'\)/);
});

test('recurring reminders use an accessible editor and the shared destructive pattern', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const alertsSource = await readFile(
        path.join(ROOT, 'modules', 'AlertsModule.js'),
        'utf8'
    );

    assert.match(index, /id="btn-new-recurring-reminder"/);
    assert.match(index, /id="recurring-reminder-modal"[\s\S]*aria-modal="true"/);
    assert.match(index, /id="recurring-reminder-days"/);
    assert.match(alertsSource, /event\.key === 'Escape'/);
    assert.match(alertsSource, /event\.key === 'Tab'/);
    assert.match(alertsSource, /confirmAction\(\{/);
    assert.match(alertsSource, /showUndo\?\.\('Recordatorio eliminado\.'/);
});

test('the first visual cleanup batch uses shared controls without native white states', async () => {
    const moduleFiles = (await readdir(path.join(ROOT, 'modules')))
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(ROOT, 'modules', file));
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');
    const tasksSource = await readFile(
        path.join(ROOT, 'modules', 'TareasModule.js'),
        'utf8'
    );
    const financeSource = await readFile(
        path.join(ROOT, 'modules', 'FinanzasModule.js'),
        'utf8'
    );
    const projectsSource = await readFile(
        path.join(ROOT, 'modules', 'ProjectsModule.js'),
        'utf8'
    );
    const donutValueStyles = styles.match(
        /\.finance-donut-center strong\s*\{([^}]*)\}/
    )?.[1] || '';
    const genericDeleteCrosses = [];

    for (const file of [path.join(ROOT, 'index.html'), ...moduleFiles]) {
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(/&times;|❌/g)) {
            const line = source.slice(0, match.index).split('\n').length;
            genericDeleteCrosses.push(`${path.relative(ROOT, file)}:${line}`);
        }
    }

    assert.match(tasksSource, /this\.app\.openProfileTab\?\.\('preferencias'\)/);
    assert.doesNotMatch(tasksSource, /this\.app\.navigation/);
    assert.match(styles, /\.icon-btn\s*\{/);
    assert.match(styles, /\.lifecycle-checkbox\s*\{/);
    assert.match(styles, /\.lifecycle-checkbox-label\s*\{/);
    assert.match(styles, /\.switch input:checked \+ \.slider/);
    assert.match(styles, /input:-webkit-autofill/);
    assert.match(styles, /\.recurring-reminder-actions\s*\{/);
    assert.match(index, /id="global-search-close"[\s\S]*?class="icon-btn"/);
    assert.match(index, /id="fin-year-modal-close"[^>]*class="icon-btn"/);
    assert.match(index, /id="fin-expense-year-modal-close"[^>]*class="icon-btn"/);
    assert.match(index, /id="proj-plan-modal-close"[^>]*class="icon-btn"/);
    assert.match(index, /id="fin-donut-center-currency"/);
    assert.match(index, /id="fin-donut-center-amount"/);
    assert.match(financeSource, /getCompactCurrencyDisplayParts/);
    assert.match(projectsSource, /ph-arrow-counter-clockwise/);
    assert.doesNotMatch(donutValueStyles, /text-overflow|ellipsis/);
    assert.deepEqual(
        genericDeleteCrosses,
        [],
        `Cruces genéricas pendientes: ${genericDeleteCrosses.join(', ')}`
    );
});

test('the second discoverability batch avoids duplicate branding and reuses card editors', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const trackersSource = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );
    const vehicleSource = await readFile(
        path.join(ROOT, 'modules', 'VehicleCatalogModule.js'),
        'utf8'
    );

    assert.match(index, /id="app-context-title"[^>]*>Hoy<\/h1>/);
    assert.match(index, /id="app-context-icon"/);
    assert.match(appSource, /updateAppHeaderFromButton\(targetButton/);
    assert.match(
        styles,
        /body:not\(\.adaptive-nav-collapsed\):not\(\.profile-view-active\) \.app-header-brand/
    );
    assert.match(trackersSource, /data-custom-runtime-action="edit-config"/);
    assert.match(trackersSource, /data-custom-runtime-action="archive"/);
    assert.match(trackersSource, /<summary role="button" aria-haspopup="menu"/);
    assert.match(trackersSource, /String\(menu\.open\)/);
    assert.match(trackersSource, /openManagerEditor\(trackerId\)/);
    assert.match(trackersSource, /openProfileTab\?\.\('seguimientos'\)/);
    assert.match(vehicleSource, /ensureLegacyEditButton\(root, title, card\)/);
    assert.match(vehicleSource, /data-vehicle-card-action="edit-config"/);
    assert.ok(trackersSource.includes("yellow: { label: 'Próximo'"));
    assert.ok(trackersSource.includes("orange: { label: 'Atención'"));
    assert.match(trackersSource, /Empieza a mostrarse como cercano\./);
    assert.match(trackersSource, /Ya alcanzó o superó el plazo definido\./);
});

test('configurable card history opens from the action menu in one reusable dialog', async () => {
    const trackersSource = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');
    const cardRenderer = trackersSource.match(
        /renderTrackerCard\(tracker\)[\s\S]*?\n    getBeardPrediction\(/
    )?.[0] || '';

    assert.match(trackersSource, /id = 'custom-tracker-history-dialog'/);
    assert.match(trackersSource, /aria-modal/);
    assert.match(trackersSource, /openHistoryDialog\(trackerId, menuTrigger\)/);
    assert.match(trackersSource, /data-history-dialog-action="edit-latest"/);
    assert.match(trackersSource, /data-history-dialog-action="confirm-delete"/);
    assert.match(trackersSource, /this\.app\.showUndo\('El registro fue borrado\.'/);
    assert.match(cardRenderer, /data-custom-runtime-action="open-history"/);
    assert.match(cardRenderer, /Ver historial \(\$\{historyCount\}\)/);
    assert.match(cardRenderer, /data-custom-runtime-action="open-instructions"/);
    assert.doesNotMatch(cardRenderer, /class="custom-tracker-instructions"/);
    assert.match(cardRenderer, /data-custom-feature-action="toggle"/);
    assert.match(cardRenderer, /is-featured/);
    assert.doesNotMatch(cardRenderer, /data-custom-runtime-action="toggle-history"/);
    assert.doesNotMatch(cardRenderer, /class="custom-tracker-history/);
    assert.match(styles, /\.custom-history-dialog-list\s*{[\s\S]*?overflow-y:\s*auto/);
    assert.match(styles, /\.custom-history-dialog-summary\s*{[\s\S]*?grid-template-columns/);
});

test('the third compact-layout batch preserves vehicle and health histories behind disclosures', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');
    const healthSource = await readFile(
        path.join(ROOT, 'modules', 'HealthModule.js'),
        'utf8'
    );
    const vehicleSource = await readFile(
        path.join(ROOT, 'modules', 'VehicleModule.js'),
        'utf8'
    );

    assert.match(index, /class="health-controls-grid"/);
    assert.match(index, /id="blood-status-badge"/);
    assert.match(index, /id="blood-history-disclosure"/);
    assert.match(index, /summary class="btn btn-history" role="button" aria-expanded="false"/);
    assert.match(index, /id="blood-history-count"/);
    assert.match(index, /id="blood-tests-list"/);
    assert.match(healthSource, /text: 'Atención'/);
    assert.match(healthSource, /text: 'Próximo'/);
    assert.match(healthSource, /getCustomTrackerState\(tracker, trackerHistory\)/);
    assert.match(healthSource, /getStudyEntries\(trackerId\)/);
    assert.match(healthSource, /this\.bloodHistoryCount\.textContent/);
    assert.match(healthSource, /String\(this\.bloodHistoryDisclosure\.open\)/);

    assert.match(index, /class="card vehicle-odometer-card"/);
    assert.match(index, /class="lenses-dashboard vehicle-maintenance-grid"/);
    assert.match(index, /class="card vehicle-maintenance-card vehicle-fluids-card"/);
    assert.match(index, /id="vehicle-issue-composer"/);
    assert.match(index, /<summary class="btn btn-primary" role="button" aria-expanded="false"[\s\S]*?Reportar falla/);
    assert.match(index, /id="vehicle-issues-count"/);
    assert.match(vehicleSource, /this\.issueComposer\.open = false/);
    assert.match(vehicleSource, /String\(this\.issueComposer\.open\)/);
    assert.match(vehicleSource, /activeIssues\.some\(issue => issue\.urgency === 'alta'\)/);

    assert.match(styles, /\.health-tracker-host\s*{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(styles, /\.vehicle-fluid-grid\s*{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(styles, /\.vehicle-issue-composer:not\(\[open\]\) > \.vehicle-add-issue-form\s*{[\s\S]*?display: none/);
    assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.vehicle-fluid-grid/);
});

test('the fourth projects and finance batch protects money actions and separates open months', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const syncSource = await readFile(path.join(ROOT, 'sync-config.mjs'), 'utf8');
    const feedbackSource = await readFile(
        path.join(ROOT, 'feedback-controller.mjs'),
        'utf8'
    );
    const projectsSource = await readFile(
        path.join(ROOT, 'modules', 'ProjectsModule.js'),
        'utf8'
    );
    const financeSource = await readFile(
        path.join(ROOT, 'modules', 'FinanzasModule.js'),
        'utf8'
    );
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');

    assert.match(appSource, /lifecycle_financial_amounts_hidden/);
    assert.doesNotMatch(syncSource, /lifecycle_financial_amounts_hidden/);
    assert.match(appSource, /formatFinancialAmount\(amountUsd\)/);
    assert.match(appSource, /querySelectorAll\('\[data-financial-privacy-toggle\]'\)/);
    assert.equal((index.match(/data-financial-privacy-toggle/g) || []).length, 2);

    assert.match(feedbackSource, /class="app-feedback-details hidden"/);
    assert.match(feedbackSource, /this\.details\.replaceChildren/);
    assert.match(projectsSource, /title: 'Confirmar pago'/);
    assert.match(projectsSource, /label: 'Monto'/);
    assert.match(projectsSource, /label: 'Fecha'/);
    assert.match(projectsSource, /label: 'Tipo'/);
    assert.match(projectsSource, /calculateClosedMonthAverages\(this\.getIncomeMovements\(\)/);
    assert.match(projectsSource, /Mes en curso/);
    assert.match(projectsSource, /Meses cerrados/);
    assert.match(index, /id="proj-plan-viewer"/);
    assert.match(index, /id="proj-plan-editor" class="project-plan-editor hidden"/);
    assert.match(index, /id="proj-plan-tab-phases"/);

    assert.match(financeSource, /async deleteEntry\(id\)/);
    assert.match(financeSource, /async deleteExpense\(id\)/);
    assert.match(financeSource, /buildProjectIncomeMovements\(\{/);
    assert.match(index, /id="fin-year-category-select"/);
    assert.match(index, /id="fin-expense-year-category-select"/);
    assert.match(index, /id="fin-year-mobile-list"/);
    assert.match(index, /id="fin-expense-year-mobile-list"/);
    assert.match(styles, /\.finance-annual-table thead th\s*{[\s\S]*?position: sticky/);
    assert.match(styles, /\.history-month-card:not\(\[open\]\) > \.history-month-details\s*{[\s\S]*?display: none/);
    assert.match(styles, /\.finance-annual-mobile-month:not\(\[open\]\) > \.finance-annual-mobile-detail\s*{[\s\S]*?display: none/);
    assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.project-actions-compact-row > \.btn,[\s\S]*?min-height: 44px/);
    assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.finance-annual-mobile-list/);
});

test('Trading is an independent module with a responsive editor and idempotent progressive alerts', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const tradingSource = await readFile(
        path.join(ROOT, 'modules', 'TradingModule.js'),
        'utf8'
    );
    const tradingUtils = await readFile(
        path.join(ROOT, 'trading-event-utils.js'),
        'utf8'
    );
    const serverSource = await readFile(path.join(ROOT, 'server.js'), 'utf8');
    const syncSource = await readFile(path.join(ROOT, 'sync-config.mjs'), 'utf8');
    const stateSource = await readFile(path.join(ROOT, 'ui-state.mjs'), 'utf8');
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');

    assert.match(index, /data-section="trading-section"[\s\S]*?Trading/);
    assert.match(index, /<section id="trading-section"/);
    assert.doesNotMatch(index, /id="btnFinanceViewTrading"/);
    assert.match(index, /id="trading-event-form"/);
    assert.match(index, /id="trading-event-date"[\s\S]*?type="date"/);
    assert.match(index, /id="trading-event-time"[\s\S]*?type="time"/);
    assert.match(index, /id="trading-event-notice-days"/);
    assert.match(index, /60, 30, 15, 7, 1/);
    assert.match(index, /independientes del recordatorio semanal/);
    assert.match(index, /<strong>Enviar avisos<\/strong>/);
    assert.match(index, /seguirá visible como pausado, pero no enviará notificaciones/);

    assert.match(appSource, /new TradingModule\(this\)/);
    assert.match(tradingSource, /tradingEvents/);
    assert.match(tradingSource, /parseTradingNoticeDays/);
    assert.match(tradingSource, /scope=trading/);
    assert.match(tradingSource, /async deleteEvent/);
    assert.match(tradingSource, /statusPriority === currentPriority[\s\S]{0,120}attemptedAt > currentAttemptedAt/);
    assert.match(stateSource, /financeView: 'personal'/);
    assert.match(stateSource, /'trading-section'/);
    assert.match(syncSource, /'finanzasData'/);

    assert.match(tradingUtils, /DEFAULT_TRADING_NOTICE_DAYS = Object\.freeze\(\[60, 30, 15, 7, 1\]\)/);
    assert.match(tradingUtils, /scheduledTimestamp - \(currentThreshold \* DAY_MS\)/);
    assert.match(tradingUtils, /TRADING_ALERT_PREFIX[\s\S]*?getTradingScheduleToken/);
    assert.match(serverSource, /sendDueTradingEventAlerts/);
    assert.match(serverSource, /alerts_sent_log/);
    assert.match(serverSource, /query\.like\('alert_key', `\$\{TRADING_ALERT_PREFIX\}%`\)/);
    assert.doesNotMatch(serverSource, /DEFAULT_RECURRING_REMINDERS[\s\S]{0,400}sendDueTradingEventAlerts/);

    assert.match(styles, /\.trading-event-dialog\s*{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto/);
    assert.match(styles, /\.trading-event-dialog-body\s*{[\s\S]*?overflow-y: auto/);
    assert.match(styles, /\.trading-event-form-grid\s*{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(styles, /\.trading-event-actions \.btn\s*{[\s\S]*?min-height: 44px/);
    assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.trading-event-form-grid\s*{[\s\S]*?grid-template-columns: 1fr/);
});

test('appearance, recurring schedules and lightweight custom modules expose their UI contracts', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = await readFile(path.join(ROOT, 'app.js'), 'utf8');
    const trackerSource = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );
    const alertsSource = await readFile(
        path.join(ROOT, 'modules', 'AlertsModule.js'),
        'utf8'
    );
    const serverSource = await readFile(path.join(ROOT, 'server.js'), 'utf8');
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');

    assert.match(index, /lifecycle_theme_preference[\s\S]*?document\.documentElement\.dataset\.theme/);
    assert.match(index, /data-theme-choice="dark"/);
    assert.match(index, /data-theme-choice="light"/);
    assert.match(appSource, /new ThemeModule\(this\)/);
    assert.match(styles, /html\[data-theme="light"\]/);

    assert.match(index, /id="recurring-reminder-frequency"/);
    assert.match(index, /value="monthly"/);
    assert.match(index, /value="yearly"/);
    assert.match(index, /id="btn-add-earnings-season-reminders"/);
    assert.match(alertsSource, /addEarningsSeasonReminderPreset/);
    assert.match(alertsSource, /schedule:[\s\S]{0,120}type: 'yearly'/);
    assert.match(serverSource, /function recurringScheduleMatchesCandidate/);
    assert.match(serverSource, /Math\.min\(schedule\.day, lastDay\)/);

    assert.match(index, /id="btn-new-custom-module"/);
    assert.match(index, /id="custom-modules-summary"/);
    assert.match(trackerSource, /openModuleEditor/);
    assert.match(trackerSource, /archiveCustomModule/);
    assert.match(trackerSource, /ensureCustomModuleRuntime/);
    assert.match(trackerSource, /data-custom-module-runtime-action="new-card"/);
    assert.match(styles, /\.custom-module-runtime-section/);
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

test('tracker manager uses compact category navigation, search and collapsed archives', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const source = await readFile(
        path.join(ROOT, 'modules', 'CustomTrackersModule.js'),
        'utf8'
    );
    const vehicleSource = await readFile(
        path.join(ROOT, 'modules', 'VehicleCatalogModule.js'),
        'utf8'
    );
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');
    const stateSource = await readFile(path.join(ROOT, 'ui-state.mjs'), 'utf8');

    assert.match(source, /data-tracker-category-filter="all"/);
    assert.match(source, /data-custom-manager-search/);
    assert.match(source, /class="custom-manager-content-grid/);
    assert.match(source, /<details class="custom-manager-archived"/);
    assert.match(source, /normalizeManagerSearchText/);
    assert.match(source, /trackerManagerFilter/);
    assert.match(source, /aria-pressed=/);
    assert.match(vehicleSource, /getManagerCardsMatching\(query/);
    assert.match(vehicleSource, /renderManagerSection\(\{ query = '' \} = \{\}\)/);
    assert.match(styles, /#custom-trackers-manager-summary\s*{[\s\S]*?flex-direction:\s*column/);
    assert.match(styles, /\.custom-manager-sortable-list\s*{[\s\S]*?repeat\(2,/);
    assert.match(index, /Recordatorios usa esta misma[\s\S]*?no mantiene una copia separada/);
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

test('push management distinguishes devices, provider acceptance and failures', async () => {
    const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
    const authSource = await readFile(
        path.join(ROOT, 'modules', 'AuthSyncModule.js'),
        'utf8'
    );
    const managerSource = await readFile(
        path.join(ROOT, 'modules', 'PushManagementModule.js'),
        'utf8'
    );
    const serverSource = await readFile(path.join(ROOT, 'server.js'), 'utf8');
    const styles = await readFile(path.join(ROOT, 'style.css'), 'utf8');
    const migration = await readFile(
        path.join(ROOT, 'supabase', 'migrations', '20260801062050_push_management_and_history.sql'),
        'utf8'
    );

    assert.match(index, /id="push-devices-list"/);
    assert.match(index, /id="push-history-list"/);
    assert.match(index, /id="push-advanced-diagnostics"/);
    assert.match(index, /Diagnóstico avanzado/);
    assert.match(index, /Ver actividad técnica/);
    assert.match(index, /id="push-engine-last-error"/);
    assert.match(index, /id="btn-diagnose-push"/);
    assert.match(index, /id="push-diagnostics-results"/);
    assert.match(index, /Aceptada.*servicio Push/s);
    assert.match(authSource, /PushManagementModule/);
    assert.match(managerSource, /\/api\/push\/devices/);
    assert.match(managerSource, /data-push-device-action="test"/);
    assert.match(managerSource, /buildPushEnginePresentation/);
    assert.match(managerSource, /this\.advancedDiagnostics\?\.open/);
    assert.doesNotMatch(managerSource, /data-push-history-action="confirm-seen"/);
    assert.doesNotMatch(managerSource, /La vi/);
    assert.match(managerSource, /\/api\/push\/history/);
    assert.match(styles, /\.push-advanced-diagnostics:not\(\[open\]\) > \.push-advanced-content\s*\{[\s\S]*?display: none/);
    assert.match(serverSource, /app\.post\('\/api\/push\/status'/);
    assert.match(serverSource, /app\.post\('\/api\/push\/devices\/:id\/test'/);
    assert.match(serverSource, /notification_delivery_log/);
    assert.match(serverSource, /cleanupNotificationHistory/);
    assert.match(serverSource, /\/api\/push\/history\/:id\/confirm/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /revoke all.*authenticated/s);
});
