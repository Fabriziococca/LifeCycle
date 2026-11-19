import { build } from 'esbuild';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { browserAssetNames } from '../browser-assets.mjs';
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
// Keep the established cascade. Vendor font URLs are relative to the vendor directory.
const styleFiles = ['vendor/phosphor/phosphor.css', 'design-tokens.css', 'style.css',
    'privacy-lock.css', 'planning.css', 'work.css', 'visual.css'];
const styles = (await Promise.all(styleFiles.map(async file => {
    let css = (await readFile(path.join(root, file), 'utf8')).replace(/\r\n/g, '\n');
    if (file.startsWith('vendor/phosphor/')) css = css.replaceAll("url('./", "url('vendor/phosphor/");
    return `/* Source: ${file} */\n${css.trimEnd()}\n`;
}))).join('\n');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const htmlFile = path.join(root, 'index.html');
const html = await readFile(htmlFile, 'utf8');
const previous = browserAssetNames(html);
const script = `app.bundle.${hash(output)}.js`;
const stylesheet = `app.styles.${hash(styles)}.css`;
const nextHtml = html.replace(`src="${previous.script}"`, `src="${script}"`)
    .replace(`href="${previous.stylesheet}"`, `href="${stylesheet}"`);
const assets = [[script, output], [stylesheet, styles]];
if (process.argv.includes('--check')) {
    if (html !== nextHtml) throw new Error('Startup references are stale. Run npm run build:browser.');
    for (const [name, content] of assets) {
        if (await readFile(path.join(root, name), 'utf8') !== content) throw new Error(`Stale browser asset: ${name}`);
    }
} else {
    for (const [name, content] of assets) await writeFile(path.join(root, name), content);
    if (html !== nextHtml) await writeFile(htmlFile, nextHtml);
    for (const name of Object.values(previous)) {
        if (name !== script && name !== stylesheet && /\.[a-f0-9]{16}\./.test(name)) {
            await unlink(path.join(root, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
        }
    }
}
console.log(JSON.stringify({ browserModules: inputNames.length, bundleBytes: Buffer.byteLength(output), stylesheetBytes: Buffer.byteLength(styles), checked: process.argv.includes('--check') }));
