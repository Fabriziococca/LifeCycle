import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
    return readFile(path.join(ROOT, relativePath), 'utf8');
}

test('shared surfaces expose opaque, readable values for the light theme', async () => {
    const styles = await read('style.css');
    const lightTheme = styles.match(/html\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)?.[1] || '';

    assert.match(lightTheme, /--surface-elevated:\s*#ffffff/);
    assert.match(lightTheme, /--surface-section:\s*#f1f5f9/);
    assert.match(lightTheme, /--surface-inset:\s*#f8fafc/);
    assert.match(lightTheme, /--border-subtle:\s*rgba\(15, 23, 42, 0\.12\)/);
    assert.match(lightTheme, /--progress-track:\s*rgba\(15, 23, 42, 0\.12\)/);
    assert.match(lightTheme, /--mobile-nav-shadow:\s*0 -10px 30px rgba\(15, 23, 42, 0\.12\)/);
});

test('critical overlays and dense managers consume semantic theme surfaces', async () => {
    const styles = await read('style.css');

    assert.match(styles, /\.notifications-panel\s*\{[\s\S]*?background:\s*var\(--surface-elevated\)/);
    assert.match(styles, /\.notification-item\s*\{[\s\S]*?background:\s*var\(--surface-inset\)/);
    assert.match(styles, /\.notification-item-title\s*\{[\s\S]*?color:\s*var\(--text-primary\)/);
    assert.match(styles, /\.custom-manager-browser\s*\{[\s\S]*?background:\s*var\(--surface-section\)/);
    assert.match(styles, /\.custom-manager-section\s*\{[\s\S]*?background:\s*var\(--surface-elevated\)/);
    assert.match(styles, /\.alert-card-item\s*\{[\s\S]*?background:\s*var\(--surface-elevated\)/);
    assert.match(styles, /\.vehicle-info-card\s*\{[\s\S]*?background:\s*var\(--surface-inset\)/);
    assert.match(styles, /\.project-template-list-item\s*\{[\s\S]*?background:\s*var\(--surface-inset\)/);
    assert.match(styles, /\.finance-recurring-list-item\s*\{[\s\S]*?background:\s*var\(--surface-inset\)/);
    assert.match(styles, /\.main-nav\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--surface-elevated\) 96%, transparent\)/);
    assert.match(styles, /#profile-email\s*\{[\s\S]*?color:\s*var\(--text-primary\)/);
    assert.match(styles, /html\[data-theme="light"\][\s\S]*?\.notifications-panel[\s\S]*?background:\s*var\(--surface-elevated\)\s*!important/);
});

test('runtime-rendered task, alert, project and vehicle content is theme-aware', async () => {
    const [tasks, alerts, projects, vehicle] = await Promise.all([
        read(path.join('modules', 'TareasModule.js')),
        read(path.join('modules', 'AlertsModule.js')),
        read(path.join('modules', 'ProjectsModule.js')),
        read(path.join('modules', 'VehicleModule.js'))
    ]);

    assert.match(tasks, /background:var\(--surface-inset\)/);
    assert.match(tasks, /task-text-span" style="color:var\(--text-primary\)/);
    assert.doesNotMatch(tasks, /task-text-span" style="color:white/);

    assert.match(alerts, /alert-interval-input[\s\S]{0,500}background: var\(--control-bg\); color: var\(--text-primary\)/);
    assert.match(alerts, /alert-time-input[\s\S]{0,400}background: var\(--control-bg\); color: var\(--text-primary\)/);

    assert.match(projects, /project-client" style="color:var\(--text-primary\)/);
    assert.match(projects, /countdown-badge" style="background: var\(--surface-inset\)/);
    assert.match(vehicle, /vehicle-issue-title-row[\s\S]{0,250}color:var\(--text-primary\)/);
});

test('runtime-rendered finance, gym and tracker details avoid dark-only neutral colors', async () => {
    const [finances, gym, hygiene, lenses, health] = await Promise.all([
        read(path.join('modules', 'FinanzasModule.js')),
        read(path.join('modules', 'GymModule.js')),
        read(path.join('modules', 'HygieneModule.js')),
        read(path.join('modules', 'LensModule.js')),
        read(path.join('modules', 'HealthModule.js'))
    ]);

    for (const source of [finances, gym, hygiene, lenses, health]) {
        assert.doesNotMatch(source, /color\s*:\s*(?:white|#fff(?:fff)?)/i);
        assert.doesNotMatch(source, /rgba\(255\s*,\s*255\s*,\s*255\s*,\s*0\.0[2358]\)/i);
    }

    assert.match(finances, /background:var\(--progress-track\)/);
    assert.match(finances, /color:var\(--text-primary\)/);
    assert.match(gym, /background:var\(--surface-inset\)/);
    assert.match(gym, /stroke="var\(--divider-color\)"/);
    assert.match(hygiene, /background:\s*var\(--progress-track\)/);
    assert.match(lenses, /background:\s*var\(--surface-solid\)/);
    assert.match(health, /background:\s*var\(--surface-inset\)/);
});

test('light interactive controls preserve readable popovers, links and checked switches', async () => {
    const styles = await read('style.css');
    const lightSubtleSurfaceGroup = styles.match(
        /html\[data-theme="light"\]\s+:is\(([\s\S]*?)\)\s*\{\s*background:\s*var\(--surface-subtle\)/
    )?.[1] || '';

    assert.match(styles, /\.icon-btn\.is-primary\s*\{[\s\S]*?color:\s*var\(--text-link\)/);
    assert.match(styles, /\.profile-context-link\s*\{[\s\S]*?color:\s*var\(--text-link\)/);
    assert.match(styles, /\.custom-tracker-menu-popover button\.danger\s*\{[\s\S]*?color:\s*var\(--status-red\)/);
    assert.match(
        styles,
        /html\[data-theme="light"\]\s+\.switch input:not\(:checked\) \+ \.slider\s*\{[\s\S]*?background-color:\s*#cbd5e1/
    );
    assert.doesNotMatch(styles, /html\[data-theme="light"\]\s+\.switch \.slider\s*\{/);
    assert.match(
        styles,
        /html\[data-theme="light"\]\s+\.custom-tracker-menu-popover\s*\{[\s\S]*?background:\s*var\(--surface-elevated\)/
    );
    assert.doesNotMatch(lightSubtleSurfaceGroup, /\.custom-tracker-menu-popover/);
});
