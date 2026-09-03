import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

test('Tanda 2: all configurable tracker and module icons have Spanish human-readable labels', async () => {
    const trackerModuleSource = fs.readFileSync(path.join(ROOT, 'modules', 'CustomTrackersModule.js'), 'utf8');
    
    const match = trackerModuleSource.match(/const ICON_LABELS = Object\.freeze\(\{([\s\S]*?)\}\);/);
    assert.ok(match, 'ICON_LABELS must be defined in CustomTrackersModule.js');
    
    const labelsBlock = match[1];
    assert.match(labelsBlock, /'ph-robot':/);
    assert.match(labelsBlock, /'ph-test-tube':/);
    assert.match(labelsBlock, /'ph-sparkle':/);
    assert.match(labelsBlock, /'ph-paw-print':/);
    assert.match(labelsBlock, /'ph-plant':/);
});

test('Tanda 2: closing More menu triggers tooltip dismissal', async () => {
    const navSource = fs.readFileSync(path.join(ROOT, 'modules', 'AdaptiveNavigationModule.js'), 'utf8');
    assert.match(navSource, /closeMore[\s\S]*?this\.app\.tooltips\?\.hide\?\.\(\)/);
});

test('Tanda 3: currency and behavior preferences are located in tab-preferencias', async () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    
    const prefTabMatch = index.match(/<div class="profile-tab-content[^"]*" id="tab-preferencias">([\s\S]*?)<\/div>\s*<!-- Pestaña/);
    assert.ok(prefTabMatch, 'tab-preferencias must exist in index.html');
    const prefTabContent = prefTabMatch[1];

    assert.match(prefTabContent, /id="btn-currency-usd"/, 'USD currency button must be in tab-preferencias');
    assert.match(prefTabContent, /id="btn-currency-ars"/, 'ARS currency button must be in tab-preferencias');
    assert.match(prefTabContent, /id="pref-auto-clean-tasks"/, 'auto-clean tasks preference must be in tab-preferencias');
    assert.match(prefTabContent, /id="pref-hide-project-templates"/, 'hide templates preference must be in tab-preferencias');
});

test('Tanda 4: app header includes visible account button for mobile navigation', async () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const styles = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

    assert.match(index, /id="header-profile-btn"/, 'header-profile-btn must be present in index.html');
    assert.match(index, /class="header-profile-btn"[^>]*aria-label="[^"]*cuenta/i);
    assert.match(appSource, /headerProfileBtn[\s\S]*?addEventListener\('click', handleOpenProfile\)/);
    assert.match(styles, /@media \(max-width: 767px\)[\s\S]*\.header-profile-btn\s*\{\s*display:\s*inline-flex;/);
});

test('Tanda 5: hide project templates preference toggles picker without deleting template data', async () => {
    const projectsSource = fs.readFileSync(path.join(ROOT, 'modules', 'ProjectsModule.js'), 'utf8');

    assert.match(projectsSource, /lifecycle_hide_project_templates/);
    assert.match(projectsSource, /templatePicker\.classList\.toggle\('hidden', hideTemplates\)/);
});
