import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
    absWorkingDir: root,
    entryPoints: ['app.js'],
    outfile: 'app.bundle.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome110', 'safari16'],
    minify: true,
    keepNames: true,
    charset: 'utf8',
    legalComments: 'inline',
    metafile: true,
    write: false,
    logLevel: 'warning'
});
const inputNames = Object.keys(result.metafile.inputs);
if (result.metafile.outputs['app.bundle.js'].imports.length) {
    throw new Error('The startup bundle must not request another module graph');
}
if (inputNames.some(name => /(?:^|\/)(?:server\.js|notification-utils\.js|security-utils\.js|\.env|vapid-keys\.json)$/.test(name))) {
    throw new Error('A backend-only file entered the browser bundle');
}
const output = result.outputFiles[0].text;
const target = path.join(root, 'app.bundle.js');
if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')).replace(/\r\n/g, '\n') !== output) {
        throw new Error('Browser bundle is stale. Run npm run build:browser and include app.bundle.js.');
    }
} else {
    await writeFile(target, output);
}
console.log(JSON.stringify({ browserModules: inputNames.length, bundleBytes: Buffer.byteLength(output), checked: process.argv.includes('--check') }));
