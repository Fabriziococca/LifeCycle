import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualFeedback } from '../visual-feedback.mjs';

function fixture({ reduced = false, preference = null } = {}) {
    const documentRef = { documentElement: { dataset: {} }, hidden: false,
        getElementById: () => null, getAnimations: () => [] };
    const media = { matches: reduced, addEventListener() {} };
    const app = { auth: { readyUserId: 'qa', syncGeneration: 1, flushPendingKeySync: async () => true } };
    const visual = new VisualFeedback(app, { documentRef, media, storage: { getItem: () => preference } });
    return { app, visual, documentRef, media };
}

test('System reduced motion and a local reduced preference both disable interaction motion', () => {
    for (const options of [{ reduced: true }, { preference: 'reduced' }]) {
        const { visual, documentRef } = fixture(options);
        let played = 0;
        visual.enter({ getClientRects: () => [1], animate: () => played++ });
        assert.equal(played, 0);
        assert.equal(documentRef.documentElement.dataset.motion, 'reduced');
    }
});

test('A failed sync never shows a saved confirmation; confirmed sync does', async () => {
    const { visual, app } = fixture();
    const shown = [];
    visual.saved = selector => shown.push(selector);
    app.auth.flushPendingKeySync = async () => false;
    assert.equal(await visual.afterSync(['card']), false);
    assert.deepEqual(shown, []);
    app.auth.flushPendingKeySync = async () => true;
    assert.equal(await visual.afterSync(['card']), true);
    assert.deepEqual(shown, ['card']);
});

test('Changing owner or sync generation while saving cannot paint a success on the next session', async () => {
    for (const field of ['readyUserId', 'syncGeneration']) {
        const { visual, app } = fixture();
        let shown = false;
        visual.saved = () => { shown = true; };
        app.auth.flushPendingKeySync = async () => { app.auth[field] = 'changed'; return true; };
        assert.equal(await visual.afterSync(['card']), false);
        assert.equal(shown, false);
    }
});

test('A newly requested reduced preference safely stops finite and infinite animations', () => {
    const { visual, documentRef, media } = fixture();
    const stopped = [];
    documentRef.getAnimations = () => [
        { effect: { getTiming: () => ({ iterations: 1 }) }, finish: () => stopped.push('finish') },
        { effect: { getTiming: () => ({ iterations: Infinity }) }, cancel: () => stopped.push('cancel') }
    ];
    media.matches = true;
    visual.apply();
    assert.deepEqual(stopped, ['finish', 'cancel']);
});
