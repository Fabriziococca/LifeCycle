import { PlanningStore, planningDialog } from './PlanningStore.js';
import { CHARGING_KEY, chargingState, chargingDuration } from '../charging-utils.mjs';
import { escapeHtml as esc } from '../text-utils.mjs';
import { latestChargingNotice } from '../charging-notice-utils.mjs';
const button=(action,label,id='',extra='')=>`<button type="button" class="btn ${['start','stop'].includes(action)?'btn-primary':'btn-secondary'}" data-charge-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`;
const format=value=>new Date(value).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export class ChargingModule {
    constructor(app) {
        this.app=app;this.store=new PlanningStore(app,CHARGING_KEY);this.view='active';this.notices=new Map();this.noticeGeneration=0;
        this.root=document.getElementById('charging-root');
        this.root.addEventListener('click',e=>{const b=e.target.closest('[data-charge-action]');if(b)void this.action(b.dataset.chargeAction,b.dataset.id).catch(err=>app.showToast?.(err.message,{tone:'error'}));});
        this.root.addEventListener('change',e=>{if(e.target.name==='charging-view'){this.view=e.target.value;this.render();void this.refreshNotices();}});
        document.getElementById('tabs-container')?.addEventListener('click',()=>{this.render();void this.refreshNotices();});
        const managerButton=document.createElement('button');managerButton.type='button';managerButton.className='btn btn-secondary';managerButton.textContent='Administrar cargas';
        document.getElementById('btn-new-custom-tracker')?.after(managerButton);
        managerButton.addEventListener('click',()=>{this.open();this.app.activateSection('higiene-section');this.root.scrollIntoView({block:'start'});});
        window.addEventListener('lifecycle:auth-ready',()=>{this.reset();this.render();void this.refreshNotices();});
        document.addEventListener('visibilitychange',()=>{if(!document.hidden)void this.refreshNotices();});
        // Local clock only. No cloud reads, polling or browser-only alarms.
        this.timer=setInterval(()=>{
            if(document.hidden||!this.root.offsetParent||this.store.busy||document.getElementById('planning-dialog')||document.activeElement?.tagName==='SELECT')return;
            const focused=this.root.contains(document.activeElement)?document.activeElement?.closest('[data-charge-action]')?.dataset:null;
            const action=focused?.chargeAction,id=focused?.id;this.render();
            if(action)[...this.root.querySelectorAll('[data-charge-action]')].find(b=>b.dataset.chargeAction===action&&b.dataset.id===id)?.focus({preventScroll:true});
        },30000);
        this.render();
    }
    render() {
        const focused=this.root.contains(document.activeElement)?document.activeElement:null;
        const focusAction=focused?.dataset?.chargeAction,focusId=focused?.dataset?.id,focusFilter=focused?.name==='charging-view';
        this.root.hidden=this.app.hygiene?.currentCategory!=='cargas';
        let data;try{data=this.store.value;}catch{this.root.innerHTML='<p role="alert">No se pudo leer el control de cargas. No se modificó el historial.</p>';return;}
        const devices=data.devices.filter(d=>this.view==='trash'?d.deleted:!d.deleted&&d.archived===(this.view==='archived'));
        this.app.customTrackers?.updateRuntimeOverview('hygiene');
        const loading=[...this.notices.values()].some(n=>n.state==='loading');
        this.root.innerHTML=`<header class="planning-heading"><div><h2><i class="ph ph-plug" aria-hidden="true"></i> Cargas</h2><p>Conectá, seguí el tiempo y registrá cuándo lo desconectaste.</p></div>${button('edit','Nuevo dispositivo')}</header>
            <div class="charging-toolbar"><div class="charging-filter"><label>Mostrar<select name="charging-view" class="time-input">${[['active','Activos'],['archived','Archivados'],['trash','Papelera']].map(([v,l])=>`<option value="${v}" ${this.view===v?'selected':''}>${l}</option>`).join('')}</select></label></div>${button('refresh',loading?'Consultando avisos…':'Actualizar avisos','',loading?'disabled':'')}</div>
            <div class="cards-grid charging-grid">${devices.map(d=>this.card(d)).join('')||'<p>No hay dispositivos en esta vista.</p>'}</div>
            <p class="fw-note">Los avisos se revisan cada cinco minutos y pueden demorar en llegar al teléfono. El estado se consulta al abrir esta pestaña o al tocar Actualizar avisos. LifeCycle no corta la corriente; usá el plazo indicado por el fabricante.</p>`;
        if(focusAction)[...this.root.querySelectorAll('[data-charge-action]')].find(b=>b.dataset.chargeAction===focusAction&&b.dataset.id===focusId)?.focus({preventScroll:true});
        else if(focusFilter)this.root.querySelector('[name="charging-view"]')?.focus({preventScroll:true});
    }
    card(d) {
        const s=chargingState(d),status=d.deleted?'En papelera':d.archived?'Archivado':s.active?(s.overdue?'Revisar y desconectar':'Cargando'):'Sin carga en curso';
        const last=d.sessions.filter(x=>x.finishedAt).sort((a,b)=>Date.parse(b.finishedAt)-Date.parse(a.finishedAt))[0];
        const limit=s.active?s.active.limitMinutes:d.maxMinutes;
        const settings=d.paused?'Avisos pausados. El tiempo físico de carga sigue transcurriendo.':!d.notify?'Avisos desactivados.':!limit?'Sin plazo: no hay aviso automático para esta carga.':`Aviso al cumplir el plazo${d.repeatMinutes?` y cada ${d.repeatMinutes} minutos hasta desconectar`:': una sola vez'}.`;
        return `<article class="card charging-card ${s.overdue?'charging-due':''}" id="charge-${d.id}" data-charging-id="${d.id}">
            <header class="charging-card-heading"><span class="charging-icon" aria-hidden="true"><i class="ph ph-plug"></i></span><div><h3>${esc(d.name)}</h3><span class="charging-status">${status}</span></div></header>
            <div class="charging-time"><strong>${s.active?chargingDuration(s.elapsedMinutes):limit?chargingDuration(limit):'Sin plazo'}</strong><span>${s.active?'desde el inicio':'plazo configurado'}</span></div>
            ${s.active&&limit?`<progress class="charging-progress" max="${limit}" value="${Math.min(limit,s.elapsedMinutes)}" aria-label="Tiempo de carga transcurrido"></progress><p class="charging-remaining">${s.overdue?'Plazo cumplido · revisá el dispositivo':`Faltan ${chargingDuration(s.remainingMinutes)}`}</p>`:''}
            <dl class="charging-meta">${s.active?`<div><dt>Conectado</dt><dd>${format(s.active.startedAt)}</dd></div><div><dt>Revisar a las</dt><dd>${s.dueAt?format(s.dueAt):'Sin plazo configurado'}</dd></div>`:`<div><dt>Última desconexión</dt><dd>${last?format(last.finishedAt):'Sin registros'}</dd></div>`}${s.active&&limit?`<div><dt>Plazo de esta carga</dt><dd>${chargingDuration(limit)}</dd></div>`:''}</dl>
            <p class="charging-settings">${settings}</p>${this.noticeCard(d,s)}
            <div class="charging-card-actions">${!d.deleted&&!d.archived?`<div class="charging-primary">${s.active?button('stop','Ya lo desconecté',d.id):button('start','Poner a cargar',d.id,d.paused?'disabled':'')}</div><div class="charging-secondary">${button('edit','Editar',d.id)}${button('pause',d.paused?'Reanudar avisos':'Pausar avisos',d.id)}</div>`:button('restore',d.deleted?'Restaurar dispositivo':'Reactivar dispositivo',d.id)}
                <div class="charging-secondary">${button('history',`Historial (${d.sessions.length})`,d.id)}${!d.deleted&&!s.active?button('archive',d.archived?'Enviar a papelera':'Archivar',d.id):''}</div></div></article>`;
    }
    noticeCard(d,s) {
        const cache=this.notices.get(d.id),notice=cache?.notice;
        let label='Sin consultar',detail='Abrí esta pestaña o tocá Actualizar avisos.',tone='neutral';
        if(cache?.state==='loading'){label='Consultando último aviso…';detail='';}
        else if(cache?.state==='failed'){label='No se pudo verificar el último aviso';detail='Tocá Actualizar avisos para reintentar.';tone='warning';}
        else if(cache?.state==='unavailable'){label='Historial de avisos no disponible';detail='No se puede confirmar el estado del envío.';tone='warning';}
        else if(cache?.state==='ready') {
            if(!notice){label='Sin avisos registrados';detail='No hay envíos de este dispositivo en el historial disponible.';}
            else {label=notice.label;tone=notice.tone;detail=`Envío: ${format(notice.attemptedAt)}.${notice.failed?' Hubo intentos de envío fallidos.':''}${notice.partial?' La consulta muestra sólo parte de los intentos.':''}`;}
        }
        const previous=s.active&&notice&&notice.sessionId!==s.active.id;
        return `<div class="charging-notice" data-notice-state="${esc(cache?.state||'idle')}" data-tone="${tone}"><span class="charging-notice-caption">Último aviso${previous?' · carga anterior':''}</span><strong>${esc(label)}</strong>${detail?`<p>${esc(detail)}</p>`:''}${previous&&s.overdue?'<p>Aún no hay un aviso registrado para la carga actual en esta consulta.</p>':''}${cache?.checkedAt?`<small>Consultado: ${format(cache.checkedAt)}</small>`:''}${notice?'<small>«Mostrado» confirma que el dispositivo lo publicó; no que lo hayas leído.</small>':''}</div>`;
    }
    reset() {this.view='active';this.notices.clear();this.noticeGeneration++;}
    async refreshNotices(force=false) {
        const auth=this.app.auth,owner=auth?.readyUserId,generation=auth?.syncGeneration,epoch=this.noticeGeneration;
        if(!owner||this.root.hidden||!this.root.offsetParent||document.hidden)return;
        let data;try{data=this.store.value;}catch{return;}
        const devices=data.devices.filter(d=>this.view==='trash'?d.deleted:!d.deleted&&d.archived===(this.view==='archived'));
        const pending=devices.filter(d=>{const n=this.notices.get(d.id);return n?.state!=='loading'&&(force||!n?.checkedAt||Date.now()-Date.parse(n.checkedAt)>60000);});
        for(const d of pending)this.notices.set(d.id,{state:'loading'});
        if(!pending.length)return;
        this.render();
        // Bounded concurrency, only on entry/explicit refresh. The local clock
        // rendering above never polls delivery history or Supabase.
        let index=0;
        await Promise.all(Array.from({length:Math.min(3,pending.length)},async()=>{
            while(index<pending.length) {
                if(owner!==auth.readyUserId||generation!==auth.syncGeneration||epoch!==this.noticeGeneration)return;
                const d=pending[index++];let next;
                try {
                    const result=await auth.pushManagement.request(`/api/push/history?scope=charging&device=${encodeURIComponent(d.id)}&limit=100`);
                    if(!result.available)next={state:'unavailable'};
                    else if(!Array.isArray(result.entries))throw new Error('Historial inválido');
                    else next={state:'ready',notice:latestChargingNotice(result.entries,d.id)};
                } catch {next={state:'failed'};}
                if(owner!==auth.readyUserId||generation!==auth.syncGeneration||epoch!==this.noticeGeneration)return;
                this.notices.set(d.id,{...next,checkedAt:new Date().toISOString()});
            }
        }));
        if(owner===auth.readyUserId&&generation===auth.syncGeneration&&epoch===this.noticeGeneration)this.render();
    }
    async action(action,id) {
        if(action==='refresh'){await this.refreshNotices(true);return;}
        const data=this.store.value,revision=data.revision,d=data.devices.find(x=>x.id===id),auth=this.app.auth,owner=auth?.readyUserId,generation=auth?.syncGeneration;
        const sameOwner=()=>{if(!owner||owner!==auth.readyUserId||generation!==auth.syncGeneration)throw new Error('La sesión cambió. Volvé a abrir el control de cargas.');};
        if(action==='history') {
            if(!d)return;
            const layer=planningDialog(this.app,`Historial · ${d.name}`,`<div class="charging-history">${[...d.sessions].sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt)).map(s=>`<article class="planning-card"><p>Inicio: ${format(s.startedAt)}</p><p>${s.finishedAt?`Desconectado: ${format(s.finishedAt)} · ${chargingDuration(Math.floor((Date.parse(s.finishedAt)-Date.parse(s.startedAt))/60000))}`:'En curso'}</p><p>Plazo registrado: ${s.limitMinutes?chargingDuration(s.limitMinutes):'Sin definir'}</p></article>`).join('')||'<p>Sin cargas registradas.</p>'}</div>`,async()=>{});
            layer?.querySelector('[type=submit]').remove();return;
        }
        if(action==='edit') {
            const newId=d?.id||'cd_'+crypto.randomUUID(),createdAt=d?.createdAt||new Date().toISOString();
            const layer=planningDialog(this.app,d?'Editar dispositivo':'Nuevo dispositivo',`<label>Nombre<input class="text-input" name="name" maxlength="120" required value="${esc(d?.name||'')}"></label><label>Plazo de carga (minutos, opcional)<input class="text-input" name="minutes" type="number" min="1" max="10080" step="1" value="${d?.maxMinutes??''}"></label><p>Ejemplo: 180 minutos = 3 horas. Si no lo conocés, dejalo vacío; sólo se registrará el tiempo transcurrido.</p><label>Avisos<select class="time-input" name="notify"><option value="yes" ${d?.notify!==false?'selected':''}>Avisarme al cumplir el plazo</option><option value="no" ${d?.notify===false?'selected':''}>Sin notificaciones</option></select></label><label>Si todavía no lo desconecté<select class="time-input" name="repeat">${[[0,'No repetir'],[30,'Repetir cada 30 minutos'],[60,'Repetir cada hora']].map(([v,l])=>`<option value="${v}" ${(d?.repeatMinutes??30)===v?'selected':''}>${l}</option>`).join('')}</select></label>${d&&chargingState(d).active?'<p>El plazo de la carga actual se conserva. Los cambios de duración se usarán a partir de la próxima carga.</p>':''}`,async f=>{
                sameOwner();const next=structuredClone(data),existing=next.devices.find(x=>x.id===newId),item=existing||{id:newId,createdAt,archived:false,deleted:false,paused:false,sessions:[]};
                Object.assign(item,{name:String(f.get('name')).trim(),maxMinutes:f.get('minutes')===''?null:Number(f.get('minutes')),notify:f.get('notify')==='yes',repeatMinutes:Number(f.get('repeat'))});
                if(!existing)next.devices.push(item);await this.store.save(next,revision);void this.refreshNotices();
            });return layer;
        }
        if(!d||this.store.busy)return;
        if(action==='start') {
            if(d.archived||d.deleted||d.paused||chargingState(d).active)return;
            d.sessions.push({id:'cs_'+crypto.randomUUID(),startedAt:new Date().toISOString(),finishedAt:null,limitMinutes:d.maxMinutes});
        } else if(action==='stop') {
            const s=chargingState(d).active;if(!s)return;s.finishedAt=new Date(Math.max(Date.now(),Date.parse(s.startedAt))).toISOString();
        } else if(action==='pause')d.paused=!d.paused;
        else if(action==='restore'){d.deleted=false;d.archived=false;}
        else if(action==='archive') {
            if(chargingState(d).active)throw new Error('Confirmá la desconexión antes de archivar.');
            const trash=d.archived;
            if(!await this.app.confirmAction({title:trash?'Enviar a papelera':'Archivar dispositivo',message:`${d.name}. Se conserva todo el historial y podés recuperarlo después.`,confirmLabel:trash?'Enviar a papelera':'Archivar',tone:'warning'}))return;
            d.archived=true;d.deleted=trash;
        } else return;
        sameOwner();await this.store.save(data,revision);this.app.showToast?.('Carga guardada y sincronizada.');
    }
    getOverdueItems() {
        return this.store.value.devices.filter(d=>!d.deleted&&!d.archived&&!d.paused&&chargingState(d).overdue).map(d=>({module:'charging',id:d.id,name:d.name,icon:'ph-plug',desc:'Se cumplió el plazo de carga. Confirmá cuando lo desconectes.'}));
    }
    open(id) {const d=this.store.value.devices.find(x=>x.id===id);this.view=d?.deleted?'trash':d?.archived?'archived':'active';this.app.hygiene.currentCategory='cargas';this.app.saveUiState?.({hygieneCategory:'cargas'});this.app.hygiene.render();this.render();return `charge-${id}`;}
}
