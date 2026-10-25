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
// Keep the established cascade. Vendor font URLs are relative to the vendor directory.
const styleFiles = ['vendor/phosphor/phosphor.css', 'design-tokens.css', 'style.css',
    'privacy-lock.css', 'planning.css', 'work.css', 'visual.css'];
const styles = (await Promise.all(styleFiles.map(async file => {
    let css = (await readFile(path.join(root, file), 'utf8')).replace(/\r\n/g, '\n');
    if (file.startsWith('vendor/phosphor/')) css = css.replaceAll("url('./", "url('vendor/phosphor/");
    return `/* Source: ${file} */\n${css.trimEnd()}\n`;
}))).join('\n');
if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')).replace(/\r\n/g, '\n') !== output) {
        throw new Error('Browser bundle is stale. Run npm run build:browser and include app.bundle.js.');
    }
    if ((await readFile(path.join(root, 'app.styles.css'), 'utf8')).replace(/\r\n/g, '\n') !== styles) {
        throw new Error('Browser stylesheet is stale. Run npm run build:browser and include app.styles.css.');
    }
} else {
    await writeFile(target, output);
    await writeFile(path.join(root, 'app.styles.css'), styles);
}
console.log(JSON.stringify({ browserModules: inputNames.length, bundleBytes: Buffer.byteLength(output), stylesheetBytes: Buffer.byteLength(styles), checked: process.argv.includes('--check') }));
