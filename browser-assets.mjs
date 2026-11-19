// These references are relative to the app root so the static and native builds also work.
export function browserAssetNames(html) {
    const script = html.match(/<script type="module" src="(app\.bundle(?:\.[a-f0-9]{16})?\.js)"/)?.[1];
    const stylesheet = html.match(/<link rel="stylesheet" href="(app\.styles(?:\.[a-f0-9]{16})?\.css)"/)?.[1];
    if (!script || !stylesheet) throw new Error('Missing LifeCycle startup asset in index.html');
    return { script, stylesheet };
}
