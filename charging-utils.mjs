export const CHARGING_KEY = 'lifecycle_charging';
export const emptyCharging = () => ({version:1,revision:0,devices:[]});
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const stamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const minutes=value=>value===null||(Number.isInteger(value)&&value>=1&&value<=10080);
export function validateCharging(data) {
    assert(data&&data.version===1&&Number.isSafeInteger(data.revision)&&data.revision>=0,'Versión de cargas no compatible.');
    assert(Array.isArray(data.devices)&&data.devices.length<=100,'Podés conservar hasta 100 dispositivos.');
    const ids=new Set(),sessions=new Set();let total=0;
    for(const d of data.devices) {
        assert(d&&/^cd_[a-z0-9-]{3,90}$/i.test(d.id||'')&&!ids.has(d.id),'Dispositivo inválido o duplicado.');ids.add(d.id);
        assert(typeof d.name==='string'&&d.name.trim().length>0&&d.name.length<=120,'Ingresá un nombre de hasta 120 caracteres.');
        assert(minutes(d.maxMinutes),'El plazo debe ser un número entero de minutos entre 1 y 10.080, o quedar vacío.');
        assert(typeof d.archived==='boolean'&&typeof d.deleted==='boolean'&&typeof d.paused==='boolean'&&typeof d.notify==='boolean'&&(!d.deleted||d.archived),'Estado de dispositivo inválido.');
        assert([0,30,60].includes(d.repeatMinutes),'Elegí un aviso único, cada 30 minutos o cada hora.');
        assert(stamp(d.createdAt)&&Array.isArray(d.sessions)&&d.sessions.length<=2000,'Historial de cargas inválido.');
        let active=0;
        for(const s of d.sessions) {
            assert(s&&/^cs_[a-z0-9-]{3,90}$/i.test(s.id||'')&&!sessions.has(s.id),'Carga inválida o duplicada.');sessions.add(s.id);
            assert(stamp(s.startedAt)&&minutes(s.limitMinutes),'Inicio o plazo de carga inválido.');
            assert(s.finishedAt===null||(stamp(s.finishedAt)&&Date.parse(s.finishedAt)>=Date.parse(s.startedAt)),'La desconexión no puede ser anterior al inicio.');
            if(s.finishedAt===null)active++;
        }
        total+=d.sessions.length;
        assert(active<=1&&(!d.archived||active===0),'Un dispositivo sólo puede tener una carga en curso y debe desconectarse antes de archivar.');
    }
    assert(total<=10000,'El historial supera 10.000 cargas. Exportá un respaldo antes de reducirlo.');
    return structuredClone(data);
}
export function readCharging(value) {return value==null||value===''?emptyCharging():validateCharging(typeof value==='string'?JSON.parse(value):value);}
export function chargingState(device,now=new Date()) {
    const active=device.sessions.find(s=>s.finishedAt===null);
    const dueAt=active?.limitMinutes?new Date(Date.parse(active.startedAt)+active.limitMinutes*60000).toISOString():null;
    return {active,dueAt,elapsedMinutes:active?Math.max(0,Math.floor((+now-Date.parse(active.startedAt))/60000)):0,
        overdue:Boolean(dueAt&&+now>=Date.parse(dueAt)),remainingMinutes:dueAt?Math.max(0,Math.ceil((Date.parse(dueAt)-+now)/60000)):null};
}
export function chargingNotificationCandidates(value,now=new Date()) {
    const data=readCharging(value),time=+now;
    return data.devices.flatMap(d=>{
        if(d.deleted||d.archived||d.paused||!d.notify)return [];
        const state=chargingState(d,now);if(!state.overdue)return [];
        const due=Date.parse(state.dueAt),slot=d.repeatMinutes?Math.floor((time-due)/(d.repeatMinutes*60000)):0;
        const scheduled=due+slot*d.repeatMinutes*60000;
        // A restart does not replay old notices. A still-connected device may
        // produce a fresh, explicitly configured reminder in the next slot.
        if(time<scheduled||time>=scheduled+15*60000)return [];
        return [{deviceId:d.id,key:`charging:${d.id}:${state.active.id}:${slot}`,title:`🔌 ${d.name}`,body:'Se cumplió el plazo de carga que configuraste. Revisá el dispositivo y confirmá cuando lo desconectes.',scheduledAt:new Date(scheduled).toISOString(),expiresAt:new Date(scheduled+15*60000).toISOString()}];
    });
}
export function isChargingRetryRelevant(value,candidate,now=new Date()) {
    return chargingNotificationCandidates(value,now).some(n=>n.key===candidate.alert_key&&Date.parse(n.scheduledAt)===Date.parse(candidate.scheduled_at)&&n.title===candidate.title&&n.body===candidate.body);
}
export function restoreCharging(value) {
    const data=readCharging(value);
    // An imported snapshot cannot establish that a physical device is still
    // connected. Retain its history and require explicit resumption of notices.
    for(const d of data.devices)if(chargingState(d).active)d.paused=true;
    return data;
}
export function chargingDuration(minutes) {const hours=Math.floor(minutes/60),rest=minutes%60;return [hours?`${hours} h`:'',rest||!hours?`${rest} min`:''].filter(Boolean).join(' ');}
