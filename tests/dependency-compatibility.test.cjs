const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

test('la dependencia UUID corregida conserva la compatibilidad CommonJS de xcode', () => {
    // Capacitor CLI still uses xcode, whose only UUID call is v4(). Keep its
    // CommonJS API while overriding the vulnerable legacy uuid dependency.
    const xcode = require('xcode');
    const project = xcode.project('compatibility-only.pbxproj');
    project.hash = { project: { objects: {} } };
    const ids = Array.from({ length: 100 }, () => project.generateUuid());
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => /^[A-F0-9]{24}$/.test(id)));

    const requireFromXcode = createRequire(require.resolve('xcode'));
    const uuid = requireFromXcode('uuid');
    assert.throws(() => uuid.v5('test', uuid.v5.DNS, new Uint8Array(8)), RangeError);
});
