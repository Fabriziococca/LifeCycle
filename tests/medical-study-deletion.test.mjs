import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthSyncModule } from '../modules/AuthSyncModule.js';
import { HealthModule } from '../modules/HealthModule.js';

test('medical-study cleanup removes owned files before deleting local records', async () => {
    let removedPaths = null;
    let saved = false;
    const health = Object.create(HealthModule.prototype);
    health.controller = {
        auth: {
            async deleteMedicalFiles(paths) {
                removedPaths = paths;
            }
        }
    };
    health.activeStudyTrackerId = 'ct_other_study';
    health.bloodTests = [
        { id: 'blood_1', trackerId: 'ct_study_1', date: '2026-08-01', storagePath: 'user/blood_1.pdf' },
        { id: 'blood_2', trackerId: 'ct_study_1', date: '2026-07-01', portalUrl: 'https://example.com' },
        { id: 'blood_3', trackerId: 'ct_other_study', date: '2026-06-01' }
    ];
    health.saveBloodTests = () => { saved = true; };
    health.render = () => {};

    const result = await health.deleteStudyEntriesForTracker('ct_study_1');

    assert.deepEqual(removedPaths, ['user/blood_1.pdf']);
    assert.equal(saved, true);
    assert.deepEqual(health.bloodTests.map(entry => entry.id), ['blood_3']);
    assert.deepEqual(result, { deletedEntries: 2, deletedFiles: 1 });
});

test('medical-study cleanup preserves every record if storage deletion fails', async () => {
    const health = Object.create(HealthModule.prototype);
    health.controller = {
        auth: {
            async deleteMedicalFiles() {
                throw new Error('storage unavailable');
            }
        }
    };
    health.activeStudyTrackerId = 'ct_other_study';
    health.bloodTests = [
        { id: 'blood_1', trackerId: 'ct_study_1', date: '2026-08-01', storagePath: 'user/blood_1.pdf' }
    ];
    health.saveBloodTests = () => assert.fail('must not persist partial cleanup');
    health.render = () => {};

    await assert.rejects(
        () => health.deleteStudyEntriesForTracker('ct_study_1'),
        /storage unavailable/
    );
    assert.equal(health.bloodTests.length, 1);
});

test('batch medical-file deletion validates ownership, deduplicates and uses one request', async () => {
    let removedPaths = null;
    const auth = Object.create(AuthSyncModule.prototype);
    auth.user = { id: 'user_123' };
    auth.supabase = {
        storage: {
            from(bucket) {
                assert.equal(bucket, 'blood-tests');
                return {
                    async remove(paths) {
                        removedPaths = paths;
                        return { error: null };
                    }
                };
            }
        }
    };

    await auth.deleteMedicalFiles([
        'user_123/blood_1.pdf',
        'user_123/blood_1.pdf',
        'user_123/blood_2.png'
    ]);
    assert.deepEqual(removedPaths, [
        'user_123/blood_1.pdf',
        'user_123/blood_2.png'
    ]);
    await assert.rejects(
        () => auth.deleteMedicalFiles(['another_user/blood_3.pdf']),
        /no es válida para esta cuenta/
    );
});
