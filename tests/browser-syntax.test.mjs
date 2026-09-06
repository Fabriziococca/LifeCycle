import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('todos los scripts propios publicados en web y Android tienen sintaxis JavaScript válida', () => {
    const files = readdirSync(root).filter(name => /\.(js|mjs)$/.test(name));
    const visit = directory => {
        for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
            const relative = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(relative);
            else if (/\.(js|mjs)$/.test(entry.name)) files.push(relative);
        }
    };
    visit('modules');
    const failures = [];
    for (const file of files) {
        // Explicit module parsing is essential: Node's automatic CommonJS fallback
        // can accept a malformed file that browsers reject as an ES module.
        const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
            input: readFileSync(path.join(root, file), 'utf8'),
            encoding: 'utf8',
            timeout: 10000,
            windowsHide: true
        });
        if (result.status !== 0) failures.push(`${file}: ${result.error?.message || result.stderr}`);
    }
    assert.deepEqual(failures, [], failures.join('\n'));
});
