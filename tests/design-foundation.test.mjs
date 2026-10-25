import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const css = await readFile(new URL('../design-tokens.css', import.meta.url), 'utf8');
function palette(block) { return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[a-f0-9]{6});/gi)].map(m => [m[1], m[2]])); }
function luminance(hex) {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
        .map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return rgb.reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
}
for (const [name,block] of [
    ['dark',css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]],
    ['light',css.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)[1]]
]) test(`${name}: text, secondary text and action labels stay readable`, () => {
    const values=palette(block);
    for(const [fg,bg] of [['text-primary','bg-color'],['text-secondary','surface-solid'],['text-on-accent','primary-color']]) {
        const a=luminance(values[fg]),b=luminance(values[bg]);
        assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${name}: ${fg}/${bg}`);
    }
});

test('self-hosted design assets are included in browser, recovery and native web builds',async()=>{
    const [index,recovery,worker,bundler]=await Promise.all(['index.html','recovery.html','sw.js','scripts/build-capacitor-web.mjs'].map(file=>readFile(new URL('../'+file,import.meta.url),'utf8')));
    assert.ok(index.indexOf('design-tokens.css')<index.indexOf('href="style.css"'));
    assert.match(recovery,/design-tokens\.css/);
    assert.match(recovery,/font-src 'self'/);
    assert.match(worker,/'\/design-tokens\.css'/);
    for(const file of ['design-tokens.css','visual.css','work.css'])assert.ok(bundler.includes(`'${file}'`));
    await access(new URL('../assets/fonts/inter-latin.woff2',import.meta.url));
    await access(new URL('../assets/fonts/Inter-OFL.txt',import.meta.url));
    assert.doesNotMatch(index,/unpkg\.com/);
    assert.match(index,/vendor\/phosphor\/phosphor\.css/);
    const icons=await readFile(new URL('../vendor/phosphor/phosphor.css',import.meta.url),'utf8');
    for(const font of icons.matchAll(/url\('\.\/(.*?)'\)/g))await access(new URL('../vendor/phosphor/'+font[1],import.meta.url));
});
