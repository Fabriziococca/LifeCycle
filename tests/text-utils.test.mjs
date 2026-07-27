import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml } from '../text-utils.mjs';

test('escapeHtml neutralizes markup and quoted attributes', () => {
    assert.equal(
        escapeHtml('<img src=x onerror="alert(1)"> & \'test\''),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#039;test&#039;'
    );
});
