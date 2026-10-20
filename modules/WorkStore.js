import { WORK_KEY, emptyWork, validateWork } from '../work-utils.mjs';
import { PLANNING_KEYS, emptyPlanning, readPlanning } from '../planning-utils.mjs';
import { CHARGING_KEY, restoreCharging } from '../charging-utils.mjs';

const canonical = value => {
    const next = structuredClone(value);
    for (const key of ['clients','followups','notes']) next[key].sort((a,b)=>a.id.localeCompare(b.id));
    next.links.sort((a,b)=>String(a.projectId).localeCompare(String(b.projectId)));
    return validateWork(next);
};
const stable=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]))):v;
const equalWork=(a,b)=>JSON.stringify(stable({...canonical(a),revision:0}))===JSON.stringify(stable({...canonical(b),revision:0}));
const decode=value=>{try{return typeof value==='string'?JSON.parse(value):value;}catch{return value;}};
const equalValue=(a,b)=>JSON.stringify(stable(decode(a)))===JSON.stringify(stable(decode(b)));

// Separate, owner-scoped store. A failed or stale write never enters generic sync.
export class WorkStore {
    constructor(app) { this.app=app;this.reset(); }
    reset() { this.owner=null;this.state=null;this.busy=false;this.loadedAt=0;this.inflight=null;localStorage.removeItem(WORK_KEY); }
    get value() {
        if (!this.state || this.owner!==this.app.auth?.readyUserId) throw new Error('Trabajo todavía no está sincronizado. Reintentá con conexión.');
        return structuredClone(this.state);
    }
    identity() {
        const auth=this.app.auth, owner=auth?.readyUserId;
        if (!owner || owner!==auth.user?.id || !auth.supabase) throw new Error('Conectate e iniciá sesión para usar Trabajo.');
        return {auth,owner,generation:auth.syncGeneration};
    }
    accept(state, owner) {
        if(owner!==this.app.auth?.readyUserId) throw new Error('La sesión cambió.');
        this.state=canonical(state);this.owner=owner;this.loadedAt=Date.now();
        localStorage.setItem(WORK_KEY,JSON.stringify(this.state));
        this.app.work?.render();this.app.finanzas?.workspaceView?.render?.();this.app.notificationsCenter?.updateBadge();
        return this.value;
    }
    async load(force=false) {
        const {auth,owner,generation}=this.identity();
        if(!force && this.state && this.owner===owner && Date.now()-this.loadedAt<30000) return this.value;
        if(this.inflight?.owner===owner) {
            if(!force)return this.inflight.promise;
            await this.inflight.promise.catch(()=>{});
            return this.load(true);
        }
        const promise=(async()=>{
            const {data,error}=await auth.supabase.rpc('get_work_state');
            if(error) throw new Error('No pudimos sincronizar Trabajo. Se conserva la última copia; reintentá con conexión.');
            if(generation!==auth.syncGeneration || owner!==auth.readyUserId) throw new Error('La sesión cambió.');
            // A fetch begun before a save must not replace its confirmed revision.
            if(this.owner===owner && this.state && data.revision<this.state.revision) return this.value;
            return this.accept(data,owner);
        })();
        this.inflight={owner,promise};
        try{return await promise;} finally {if(this.inflight?.promise===promise)this.inflight=null;}
    }
    async save(value, expectedRevision=this.value.revision, restore=null) {
        if(this.busy) throw new Error('Esperá a que termine el guardado.');
        const {auth,owner,generation}=this.identity();
        if(this.value.revision!==expectedRevision) throw new Error('Trabajo cambió. Volvé a abrir el formulario.');
        const next=canonical({...value,revision:expectedRevision+1});
        this.busy=true;
        let guarded=false;
        const release=()=>{if(!guarded)return;guarded=false;if(generation===auth.syncGeneration){auth.planningWriteCount=Math.max(0,(auth.planningWriteCount||0)-1);auth.localEditGeneration=(auth.localEditGeneration||0)+1;}};
        try {
            if(!await auth.flushPendingKeySync()) throw new Error('Primero deben sincronizarse los cambios pendientes.');
            if(owner!==auth.readyUserId || generation!==auth.syncGeneration) throw new Error('La sesión cambió.');
            if(restore){guarded=true;auth.planningWriteCount=(auth.planningWriteCount||0)+1;auth.localEditGeneration=(auth.localEditGeneration||0)+1;}
            const args={p_state:next,p_expected_revision:expectedRevision,p_updates:restore?.updates??null,p_delete_keys:restore?.deletes??[]};
            let result=await auth.supabase.rpc('save_work_state',args);
            // One identical retry is safe for ordinary writes after a lost response.
            if(result.error && !restore && String(result.error.code)!=='40001') result=await auth.supabase.rpc('save_work_state',args);
            if(result.error) {
                const latest=await auth.supabase.rpc('work_backup_snapshot');
                const confirmed=!latest.error&&latest.data?.work&&equalWork(latest.data.work,next)
                    &&(!restore||(Object.entries(restore.updates).every(([key,v])=>equalValue(v,latest.data.personal?.[key]))&&restore.deletes.every(key=>!Object.hasOwn(latest.data.personal||{},key))));
                if(confirmed)result={data:latest.data.work};
                else {
                    if(String(result.error.code)==='40001') { await this.load(true);throw new Error('Otra pantalla guardó cambios. Actualizamos Trabajo; revisalos y volvé a abrir el formulario.'); }
                    throw new Error('No se confirmó el guardado. Conservá el formulario y revisá la conexión.');
                }
            }
            if(owner!==auth.readyUserId || generation!==auth.syncGeneration) throw new Error('La sesión cambió durante el guardado.');
            const confirmed=this.accept(result.data,owner);
            if(restore) {release();auth.cloudRevision=null;auth.appliedCloudRevision=null;await auth.checkAndSyncData({force:true}); }
            this.app.recovery?.scheduleSnapshot();
            return confirmed;
        } finally {release();if(generation===auth.syncGeneration)this.busy=false;}
    }
    async backupSnapshot() {
        const {auth,owner}=this.identity();
        if(this.busy || auth.planningWriteCount || !await auth.flushPendingKeySync()) throw new Error('Esperá a que termine la sincronización antes de descargar.');
        const {data,error}=await auth.supabase.rpc('work_backup_snapshot');
        if(error || !data?.work || !data.personal) throw new Error('No se pudo confirmar un respaldo completo de Trabajo. Reintentá con conexión.');
        this.accept(data.work,owner);
        return {...data.personal,[WORK_KEY]:JSON.stringify(data.work)};
    }
    async restore(plan) {
        const snapshot=await this.backupSnapshot();
        const current=this.value, workEntry=plan.entries.find(([key])=>key===WORK_KEY);
        const incoming=workEntry ? (workEntry[1]===null?emptyWork():validateWork(JSON.parse(workEntry[1]))) : current;
        const updates={},deletes=[];
        for (const [key,value] of plan.entries) {
            if(key===WORK_KEY) continue;
            if(PLANNING_KEYS.includes(key)) {
                const old=readPlanning(snapshot[key]??null,key), item=value===null?emptyPlanning(key):readPlanning(value,key);
                updates[key]=JSON.stringify({...(key===CHARGING_KEY?restoreCharging(item):item),revision:old.revision+1});
            } else if(value===null) deletes.push(key); else updates[key]=value;
        }
        await this.save(incoming,current.revision,{updates,deletes});
        return plan.entries.map(([key])=>key);
    }
}
