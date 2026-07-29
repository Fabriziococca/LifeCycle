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
