import { escapeHtml as esc } from '../text-utils.mjs';
import { PlanningStore, planningDialog } from './PlanningStore.js';
import { APPOINTMENTS_KEY, appointmentState } from '../appointments-utils.mjs';
import { argentinaDay, parseTimes } from '../schedule-date-utils.mjs';
const field=(label,name,value='',type='text',extra='')=>`<label>${label}<input class="text-input" name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
const button=(action,label,id='')=>`<button type="button" class="btn btn-secondary" data-appointment-action="${action}" data-id="${esc(id)}">${label}</button>`;
export class AppointmentsModule {
    constructor(app) {
        this.app=app;this.store=new PlanningStore(app,APPOINTMENTS_KEY);this.view='controls';this.filter='upcoming';
        const health=document.getElementById('salud-section'), controls=health.querySelector('.health-controls-grid');
        this.controls=controls;
        this.tabs=document.createElement('div');this.tabs.className='planning-tabs';this.tabs.setAttribute('aria-label','Vistas de Salud');
        this.tabs.innerHTML=button('controls','Controles y estudios')+button('turnos','Turnos');
        health.querySelector('.section-title').before(this.tabs);
        this.heading=health.querySelector('.section-title');
        this.root=document.createElement('div');this.root.id='health-appointments';health.append(this.root);
        health.addEventListener('click',e=>{const b=e.target.closest('[data-appointment-action]');if(b)void this.action(b.dataset.appointmentAction,b.dataset.id).catch(err=>app.showMessage({title:'No se pudo completar',message:err.message,tone:'warning'}));});
        this.root.addEventListener('change',e=>{if(e.target.name==='appointment-filter'){this.filter=e.target.value;this.render();}});
        this.render();
    }
    activate(view='turnos'){this.view=view;this.render();}
    render() {
        document.getElementById('salud-section').dataset.healthView=this.view;
        this.controls.hidden=this.view!=='controls';this.heading.hidden=this.view!=='controls';this.root.hidden=this.view!=='turnos';
        this.tabs.querySelectorAll('button').forEach(b=>{const selected=b.dataset.appointmentAction===this.view;b.className='btn '+(selected?'btn-primary':'btn-secondary');b.setAttribute('aria-pressed',String(selected));});
        let data;try{data=this.store.value;}catch {this.root.innerHTML='<p role="alert">No se pudo leer la agenda. Recargá y revisá la sincronización.</p>';return;}
        const list=[...data.events].filter(e=>this.filter==='all'||(this.filter==='upcoming'?e.status==='pending'&&!e.archived:e.status!=='pending'||e.archived)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
        this.root.innerHTML=`<header class="planning-heading"><div><h2>Turnos de Salud</h2><p>Consultas y estudios con avisos anticipados, en horario Argentina.</p></div>${button('new','Nuevo turno')}</header><label class="planning-filter">Ver<select class="text-input" name="appointment-filter">${[['upcoming','Pendientes'],['history','Historial y archivados'],['all','Todos']].map(([k,v])=>`<option value="${k}" ${k===this.filter?'selected':''}>${v}</option>`).join('')}</select></label><div class="care-grid">${list.map(e=>this.card(e)).join('')||'<div class="card planning-empty">Sin turnos en esta vista. Agregá una consulta o estudio y elegí desde cuándo querés recibir avisos.</div>'}</div>`;
    }
    card(e) {
        const s=appointmentState(e);
        return `<article id="appointment-${e.id}" class="card planning-card appointment-card"><header class="planning-heading"><div><small>${e.kind==='study'?'Estudio':'Consulta'}${e.professional?' · '+esc(e.professional):''}</small><h3>${esc(e.name)}</h3></div><span class="badge ${s.tone}">${e.archived?'Archivado':s.label}</span></header><p><strong>${esc(e.date)} · ${esc(e.time)}</strong> · Argentina</p>${e.location?`<p>${esc(e.location)}</p>`:''}${e.notes?`<details><summary>Notas e indicaciones</summary><p class="work-text">${esc(e.notes)}</p></details>`:''}<p>${e.status!=='pending'||e.archived?'Avisos finalizados':e.paused?'Avisos pausados':s.past?'La hora del turno pasó. Confirmá si asististe; los avisos de asistencia terminaron.':s.stage?'Avisos de este tramo: '+esc(s.stage.times.join(', ')):'Los avisos empiezan '+Math.max(...e.stages.map(s=>s.days))+' días antes.'}</p><details><summary>Programación de avisos</summary>${[...e.stages].sort((a,b)=>b.days-a.days).map(s=>`<p>Desde ${s.days} días antes: ${esc(s.times.join(', '))}</p>`).join('')}<p>Cada tramo reemplaza al anterior. Los avisos del día del turno se envían sólo antes de la cita.</p></details><div class="planning-actions">${button('edit','Editar / reprogramar',e.id)}${e.status==='pending'&&!e.archived?button('done','Marcar realizado',e.id)+button('pause',e.paused?'Reanudar avisos':'Pausar avisos',e.id)+button('cancel','Cancelar turno',e.id):''}${e.status!=='pending'&&!e.archived?button('reopen','Volver a pendiente',e.id):''}${button('archive',e.archived?'Desarchivar':'Archivar',e.id)}${e.trackerId?button('tracker','Abrir control vinculado',e.id):''}${button('delete','Eliminar turno',e.id)}</div>${e.status==='done'?`<p>Realizado el ${esc(e.completedOn)}.</p>`:''}</article>`;
    }
    stageRow(s,index) {return `<div class="care-stage" data-stage-index="${index}">${field('Desde cuántos días antes','stageDays'+index,s.days,'number','required min="0" max="365"')}${field('Horarios (separados por comas)','stageTimes'+index,s.times.join(', '),'text','required placeholder="09:00, 18:00"')}<button type="button" class="btn btn-secondary" data-remove-stage>Quitar tramo</button></div>`;}
    async action(action,id) {
        if(action==='controls'||action==='turnos'){this.activate(action);return;}
        const data=this.store.value, old=data.events.find(e=>e.id===id), revision=data.revision, owner=this.app.auth.readyUserId,generation=this.app.auth.syncGeneration;
        const save=async()=>{if(owner!==this.app.auth.readyUserId||generation!==this.app.auth.syncGeneration)throw new Error('La sesión cambió. Volvé a abrir la acción.');await this.store.save(data,revision);this.render();this.app.today?.render();};
        if(action==='new'||action==='edit') {
            const trackers=this.app.customTrackers?.registry?.trackers?.filter(t=>t.section==='health'&&!t.archived&&!t.deleted)||[];
            const stages=old?.stages||[{days:15,times:['09:00']},{days:7,times:['09:00','18:00']}], newId=old?.id||'ha_'+crypto.randomUUID();
            const html=field('Nombre del turno','name',old?.name||'','text','required maxlength="120"')+
                `<label>Tipo<select class="text-input" name="kind"><option value="consultation">Consulta</option><option value="study" ${old?.kind==='study'?'selected':''}>Estudio</option></select></label>`+
                field('Profesional / especialidad (opcional)','professional',old?.professional||'','text','maxlength="120"')+
                `<div class="care-form-grid">${field('Fecha','date',old?.date||argentinaDay(),'date','required')}${field('Hora Argentina','time',old?.time||'18:00','time','required')}</div>`+
                field('Lugar o dirección (opcional)','location',old?.location||'','text','maxlength="300"')+
                `<label>Notas / indicaciones (opcional)<textarea class="text-input" name="notes" maxlength="2000">${esc(old?.notes||'')}</textarea></label>`+
                `<label>Control o estudio vinculado (opcional)<select class="text-input" name="trackerId"><option value="">Sin vínculo</option>${trackers.map(t=>`<option value="${esc(t.id)}" ${old?.trackerId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}${old?.trackerId&&!trackers.some(t=>t.id===old.trackerId)?`<option value="${esc(old.trackerId)}" selected>Vínculo histórico</option>`:''}</select></label>`+
                `<label class="lifecycle-checkbox-label"><input type="checkbox" class="lifecycle-checkbox" name="enabled" ${!old?.paused?'checked':''}>Activar avisos anticipados</label><fieldset><legend>Tramos de aviso · Argentina</legend><div data-stages>${stages.map((s,i)=>this.stageRow(s,i)).join('')}</div><button type="button" class="btn btn-secondary" data-add-stage>Agregar tramo</button><p>De uno a cuatro tramos, hasta seis horarios por tramo. El tramo más cercano reemplaza al anterior.</p></fieldset>`;
            const layer=planningDialog(this.app,old?'Editar turno':'Nuevo turno',html,async f=>{
                const nextStages=[...layer.querySelectorAll('[data-stage-index]')].map(row=>{const i=row.dataset.stageIndex;return{days:Number(f.get('stageDays'+i)),times:parseTimes(f.get('stageTimes'+i))};});
                const item={...old,id:newId,name:f.get('name').trim(),kind:f.get('kind'),professional:f.get('professional').trim(),date:f.get('date'),time:f.get('time'),location:f.get('location').trim(),notes:f.get('notes').trim(),trackerId:f.get('trackerId'),status:old?.status||'pending',archived:old?.archived||false,paused:!f.has('enabled'),scheduleVersion:(old?.scheduleVersion||0)+1,stages:nextStages};
                data.events=old?data.events.map(e=>e.id===id?item:e):[...data.events.filter(e=>e.id!==newId),item];await save();
            });
            let index=stages.length;
            const update=()=>{const count=layer.querySelectorAll('[data-stage-index]').length;layer.querySelector('[data-add-stage]').disabled=count>=4;layer.querySelectorAll('[data-remove-stage]').forEach(b=>b.disabled=count<=1);};
            layer.addEventListener('click',e=>{if(e.target.closest('[data-add-stage]')){layer.querySelector('[data-stages]').insertAdjacentHTML('beforeend',this.stageRow({days:0,times:['08:00']},index++));update();}if(e.target.closest('[data-remove-stage]')){e.target.closest('[data-stage-index]').remove();update();}});update();
        } else {
            if(!old)throw new Error('El turno ya no está disponible.');
            if(action==='tracker'){this.activate('controls');this.app.notificationsCenter.openItem({module:'custom_tracker',id:old.trackerId});return;}
            if(action==='done') {
                planningDialog(this.app,'Confirmar realización',`<p>${esc(old.name)}</p>${field('Realizado el','completedOn',old.date>argentinaDay()?argentinaDay():old.date,'date',`required max="${argentinaDay()}"`)}<p>Esto confirma el turno. Podés abrir el control vinculado para registrar resultados o adjuntar estudios.</p>`,async f=>{old.status='done';old.completedOn=f.get('completedOn');old.scheduleVersion++;await save();});return;
            }
            const actions={pause:['Pausar / reanudar avisos','Se conserva el turno y su programación.'],cancel:['Cancelar turno','El turno se conserva en el historial y deja de enviar avisos.'],reopen:['Volver a pendiente','Se reanudan los avisos si la fecha es futura y no están pausados.'],archive:['Archivar / desarchivar turno','Se conserva su información. Los turnos archivados no envían avisos.'],delete:['Eliminar turno','Se elimina esta cita y su programación. Los controles, estudios y archivos vinculados se conservan.']};
            if(!actions[action])return;
            if(!await this.app.confirmAction({title:actions[action][0],message:actions[action][1],confirmLabel:action==='delete'?'Eliminar turno':'Confirmar',tone:action==='delete'?'danger':'warning'}))return;
            if(action==='pause')old.paused=!old.paused;
            if(action==='cancel')old.status='cancelled';
            if(action==='reopen'){old.status='pending';delete old.completedOn;}
            if(action==='archive')old.archived=!old.archived;
            if(action==='delete')data.events=data.events.filter(e=>e.id!==id);
            old.scheduleVersion++;await save();
        }
    }
    getOverdueItems(now=new Date()) {
        try{return this.store.value.events.filter(e=>{const s=appointmentState(e,now);return e.status==='pending'&&!e.archived&&(s.past||s.stage);}).map(e=>({module:'appointment',id:e.id,name:e.name,desc:`${e.date} ${e.time} · ${appointmentState(e,now).label}`,icon:'ph-calendar-check',urgency:appointmentState(e,now).days<=1?'muy_urgente':'urgente',completable:false}));}catch{return[];}
    }
    open(id){this.activate('turnos');this.filter='all';this.render();return 'appointment-'+id;}
}
