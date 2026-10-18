import test from 'node:test';
import assert from 'node:assert/strict';
import { chargingHistoryPrefix, latestChargingNotice } from '../charging-notice-utils.mjs';
import { ChargingModule } from '../modules/ChargingModule.js';
const id='cd_fixture-qa',session='cs_fixture-qa';
const row=(extra={})=>({id:'1',alert_key:`charging:${id}:${session}:0`,endpoint_fingerprint:'first-device',attempted_at:'2026-10-17T18:03:00Z',status:'accepted',...extra});

test('charging history accepts only one literal device identifier',()=>{
    assert.equal(chargingHistoryPrefix(id),`charging:${id}:`);
    for(const input of [null,[],{},'cd_a%','cd_foo:cs_other','cd_foo,alert_key.like.*','../cd_foo'])assert.equal(chargingHistoryPrefix(input),null);
});
test('charging notices do not mistake provider acceptance for device reception',()=>{
    assert.match(latestChargingNotice([row()],id).label,/recepción sin confirmar/);
    assert.equal(latestChargingNotice([row()],id).tone,'warning');
    assert.match(latestChargingNotice([row({received_at:'2026-10-17T18:03:01Z'})],id).label,/visualización sin confirmar/);
    assert.equal(latestChargingNotice([row({displayed_at:'2026-10-17T18:03:02Z'})],id).tone,'success');
    assert.match(latestChargingNotice([row({discarded_at:'2026-10-17T18:20:00Z'})],id).label,/descartado/);
});
test('charging notice summarizes devices and retries without losing a confirmed display',()=>{
    const result=latestChargingNotice([
        row({displayed_at:'2026-10-17T18:03:02Z'}),
        row({id:'2',attempted_at:'2026-10-17T18:08:00Z'}),
        row({id:'3',endpoint_fingerprint:'second-device',status:'failed'})
    ],id);
    assert.equal(result.label,'Mostrado en 1 dispositivo');assert.equal(result.failed,1);
    assert.equal(result.sessionId,session);assert.equal(result.attemptedAt,'2026-10-17T18:08:00Z');
    const newer=row({alert_key:`charging:${id}:cs_new-session:0`,attempted_at:'2026-10-18T18:00:00Z'});
    assert.equal(latestChargingNotice([row({displayed_at:'2026-10-17T18:03:02Z'}),newer],id).sessionId,'cs_new-session');
    assert.match(latestChargingNotice([newer],id).label,/recepción sin confirmar/);
    const failedRetry=latestChargingNotice([row(),row({id:'2',status:'failed',attempted_at:'2026-10-17T18:08:00Z'})],id);
    assert.match(failedRetry.label,/recepción sin confirmar/);assert.equal(failedRetry.failed,1);
});
test('charging notices separate failures, unavailable devices and absent history',()=>{
    assert.match(latestChargingNotice([row({status:'no_devices'})],id).label,/Sin dispositivos/);
    assert.equal(latestChargingNotice([row({status:'failed'})],id).tone,'danger');
    assert.match(latestChargingNotice([row({status:'expired'})],id).label,/vencido/);
    assert.equal(latestChargingNotice([row({alert_key:'charging:cd_other-device:cs_other-session:0'})],id),null);
    assert.equal(latestChargingNotice([row({attempted_at:'invalid'})],id),null);
});
test('charging history reads are cached and cannot leak across account changes',async()=>{
    const previous=globalThis.document;globalThis.document={hidden:false};
    try {
        let resolve,requests=0;
        const auth={readyUserId:'qa-one',syncGeneration:1,pushManagement:{request:()=>{requests++;return new Promise(r=>resolve=r);}}};
        const charging=Object.assign(Object.create(ChargingModule.prototype),{app:{auth},root:{hidden:false,offsetParent:{}},store:{value:{devices:[{id,archived:false,deleted:false}]}},view:'active',noticeGeneration:0,notices:new Map(),render(){}});
        const old=charging.refreshNotices();await charging.refreshNotices();assert.equal(requests,1);
        auth.readyUserId='qa-two';auth.syncGeneration++;charging.reset();
        resolve({available:true,entries:[row({displayed_at:'2026-10-17T18:03:02Z'})]});await old;
        assert.equal(charging.notices.size,0);
        auth.pushManagement.request=async()=>{requests++;return {available:true,entries:[]};};
        await charging.refreshNotices();assert.equal(requests,2);assert.equal(charging.notices.get(id).state,'ready');
        await charging.refreshNotices();assert.equal(requests,2);
        auth.pushManagement.request=async()=>{throw new Error('offline');};
        await charging.refreshNotices(true);assert.equal(charging.notices.get(id).state,'failed');
    } finally {globalThis.document=previous;}
});
