import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const outputDirectory = path.join(projectRoot, 'www');
const excludedRootScripts = new Set(['server.js', 'transcription-worker.js']);
const fixedAssets = new Set([
    'index.html',
    'style.css',
    'manifest.json',
    'sw.js',
    'icon.png',
    'icon-v2.png',
    'shared_rules.json'
]);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const rootEntries = await readdir(projectRoot, { withFileTypes: true });
for (const entry of rootEntries) {
    if (!entry.isFile()) continue;
    const isBrowserScript = /\.(?:js|mjs)$/i.test(entry.name) && !excludedRootScripts.has(entry.name);
    if (!fixedAssets.has(entry.name) && !isBrowserScript) continue;
    await cp(path.join(projectRoot, entry.name), path.join(outputDirectory, entry.name));
}

for (const directory of ['modules', 'vendor']) {
    await cp(path.join(projectRoot, directory), path.join(outputDirectory, directory), {
        recursive: true
    });
}

console.log(`Capacitor web bundle preparado en ${outputDirectory}`);
