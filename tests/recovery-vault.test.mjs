import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryVault, encryptRecoverySnapshot, decryptRecoverySnapshot } from '../recovery-vault.mjs';

test('recovery copy round-trips locally, encrypts contents and accepts new copies without retaining the password', async () => {
    const vault = await createRecoveryVault('owner-a', 'long-local-phrase-test');
    const payload = { appName: 'LifeCycle', ownerId: 'owner-a', exportDate: '2026-09-27T23:00:00Z', data: { lensDate: '2026-09-01' } };
    vault.snapshots = [await encryptRecoverySnapshot(vault, payload)];
    assert.equal(JSON.stringify(vault).includes('2026-09-01'), false);
    assert.equal(JSON.stringify(vault).includes('long-local-phrase-test'), false);
    assert.deepEqual(await decryptRecoverySnapshot(vault, 'long-local-phrase-test'), payload);
    await assert.rejects(decryptRecoverySnapshot(vault, 'wrong-password'), /incorrecta/);
    const tampered = structuredClone(vault);
    tampered.ownerId = 'owner-b';
    await assert.rejects(decryptRecoverySnapshot(tampered, 'long-local-phrase-test'), /incorrecta/);
    const damaged = structuredClone(vault);
    damaged.snapshots[0].value = `AAAA${damaged.snapshots[0].value.slice(4)}`;
    await assert.rejects(decryptRecoverySnapshot(damaged, 'long-local-phrase-test'), /incorrecta/);
    const updated = { ...payload, data: { lensDate: '2026-09-27' } };
    vault.snapshots.unshift(await encryptRecoverySnapshot(vault, updated));
    assert.deepEqual(await decryptRecoverySnapshot(vault, 'long-local-phrase-test'), updated);
    assert.deepEqual(await decryptRecoverySnapshot(vault, 'long-local-phrase-test', 1), payload);
});

test('empty owner and short local phrases are rejected', async () => {
    await assert.rejects(createRecoveryVault('', 'long-enough-password'));
    await assert.rejects(createRecoveryVault('owner', 'short'));
});
