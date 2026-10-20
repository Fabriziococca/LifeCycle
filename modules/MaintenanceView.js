import { escapeHtml as esc } from '../text-utils.mjs';
import { planningDialog } from './PlanningStore.js';
import { argentinaDay, parseTimes } from '../schedule-date-utils.mjs';
import { completeMaintenance, maintenanceDescription, alignMaintenanceDate } from '../maintenance-utils.mjs';
const field=(label,name,value='',type='text',extra='')=>`<label>${label}<input class="text-input" name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
const option=(value,label,current)=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`;
const button=(action,label,id)=>`<button type="button" class="btn btn-secondary" data-work-action="maintenance-${action}" data-id="${esc(id)}">${label}</button>`;
export class MaintenanceView {
    constructor(work){this.work=work;this.app=work.app;}
    section(client,data) {
        const records=data.followups.filter(f=>f.clientId===client.id&&f.maintenance);
        return `<section class="maintenance-section"><header class="planning-heading"><h3>Mantenimiento</h3>${client.archived?'':button('new','Nueva rutina',client.id)}</header><p>Responsabilidades recurrentes, última realización y próxima revisión.</p>${records.filter(f=>!f.maintenance.archived).map(f=>this.card(f,data)).join('')||'<p>Sin rutinas activas.</p>'}${records.some(f=>f.maintenance.archived)?`<details><summary>Rutinas archivadas</summary>${records.filter(f=>f.maintenance.archived).map(f=>this.card(f,data)).join('')}</details>`:''}</section>`;
    }
    card(f,data) {
        const m=f.maintenance, client=data.clients.find(c=>c.id===f.clientId), inactive=client?.archived||m.archived, due=f.reviewOn<=argentinaDay();
        const status=inactive?'Archivada':m.paused?'Pausada':due?'Para revisar':'Programada';
        return `<article id="maintenance-${f.id}" class="card planning-card maintenance-card" data-maintenance-id="${f.id}"><header class="planning-heading"><div><small>${esc(client?.name||'')} · Mantenimiento</small><h4>${esc(f.title)}</h4></div><span class="badge ${inactive||m.paused?'gray':due?'orange':'green'}">${status}</span></header><p>${esc(maintenanceDescription(m))}</p><dl class="care-dates"><div><dt>Última realización</dt><dd>${esc(m.history[0]?.doneOn||'Sin registros')}</dd></div><div><dt>Próxima revisión</dt><dd>${esc(f.reviewOn)}</dd></div></dl>${f.projectId?`<p>${esc(this.work.projectName(f.projectId))}</p>`:''}${m.instructions?`<p class="work-text">${esc(m.instructions)}</p>`:''}<p>${f.reminderEnabled?'Avisos '+esc(m.times.join(', '))+' · Argentina, desde la revisión hasta realizarla':'Avisos desactivados'}</p><div class="planning-actions">${!inactive&&!m.paused?button('done','Marcar realizado',f.id):''}${!client?.archived?button('edit','Editar rutina',f.id)+(!m.archived?button('pause',m.paused?'Reanudar':'Pausar',f.id):'')+button('archive',m.archived?'Reactivar rutina':'Archivar rutina',f.id):''}${button('delete','Eliminar rutina',f.id)}</div><details><summary>Historial (${m.history.length})</summary>${m.history.map(h=>`<div class="care-history"><strong>${esc(h.doneOn)}</strong><small>Revisión prevista: ${esc(h.dueOn)}</small>${h.note?`<p class="work-text">${esc(h.note)}</p>`:''}</div>`).join('')||'<p>Todavía no registraste realizaciones.</p>'}</details></article>`;
    }
    async action(action,id) {
        if(!action.startsWith('maintenance-'))return false;
        const data=this.work.store.value, revision=data.revision, owner=this.app.auth.readyUserId, generation=this.app.auth.syncGeneration;
        const save=async()=>{
            if(owner!==this.app.auth.readyUserId||generation!==this.app.auth.syncGeneration)throw new Error('La sesión cambió. Volvé a abrir la acción.');
            await this.work.store.save(data,revision);this.app.notificationsCenter?.updateBadge();this.app.today?.render();
        };
        const kind=action.slice(12), old=data.followups.find(f=>f.id===id&&f.maintenance);
        if(kind==='new'||kind==='edit') {
            const clientId=old?.clientId||id, client=data.clients.find(c=>c.id===clientId);
            if(!client||client.archived)throw new Error('Reactivá el cliente para configurar sus rutinas.');
            const m=old?.maintenance,c=m?.cadence;
            const html=field('Responsabilidad','title',old?.title||'','text','required maxlength="300"')+
                `<label>Proyecto (opcional)<select class="text-input" name="projectId"><option value="">Sin proyecto</option>${data.links.filter(l=>l.clientId===clientId).map(l=>`<option value="${esc(l.projectId)}" ${old?.projectId===l.projectId?'selected':''}>${esc(this.work.projectName(l.projectId))}</option>`).join('')}</select></label>`+
                `<label>Instrucciones (opcional)<textarea class="text-input" name="instructions" maxlength="2000">${esc(m?.instructions||'')}</textarea></label>`+
                field('Próxima revisión','reviewOn',old?.reviewOn||argentinaDay(),'date','required')+
                `<label>Cómo se repite<select class="text-input" name="mode">${option('completion','Desde la última realización',c?.type==='weekly'?'weekly':c?.anchor||'completion')}${option('calendar','Calendario fijo',c?.anchor)}${option('weekly','Días de la semana',c?.type)}</select></label>`+
                `<div data-cadence-interval class="care-form-grid">${field('Cada','every',c?.every||1,'number','required min="1" max="365"')}<label>Unidad<select class="text-input" name="unit">${option('days','Días',c?.unit||'weeks')}${option('weeks','Semanas',c?.unit||'weeks')}${option('months','Meses',c?.unit)}</select></label></div>`+
                `<fieldset data-cadence-weekly><legend>Días de revisión</legend><div class="care-weekdays">${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d,i)=>`<label class="lifecycle-checkbox-label"><input class="lifecycle-checkbox" type="checkbox" name="weekday" value="${i}" ${c?.days?.includes(i)?'checked':''}>${d}</label>`).join('')}</div></fieldset>`+
                `<label class="lifecycle-checkbox-label"><input class="lifecycle-checkbox" type="checkbox" name="enabled" ${old?.reminderEnabled?'checked':''}>Enviar avisos desde la revisión hasta realizarla</label>`+
                field('Horarios Argentina (separados por comas)','times',m?.times.join(', ')||'09:00','text','required placeholder="09:00, 18:00"')+
                '<p>Hasta seis horarios. Al realizarla se calcula la próxima revisión; el calendario fijo conserva su frecuencia aunque te retrases.</p>';
            const newId=old?.id||crypto.randomUUID();
            const dialog=planningDialog(this.app,old?'Editar rutina':'Nueva rutina de mantenimiento',html,async f=>{
                const times=parseTimes(f.get('times')), mode=f.get('mode'), reviewOn=f.get('reviewOn');
                const unchanged=old&&reviewOn===old.reviewOn&&mode===(c.type==='weekly'?'weekly':c.anchor)&&Number(f.get('every'))===(c.every||1)&&f.get('unit')===(c.unit||'weeks')&&JSON.stringify(f.getAll('weekday').map(Number))===JSON.stringify(c.days||[]);
                const cadence=mode==='weekly'?{type:'weekly',days:f.getAll('weekday').map(Number),anchorDate:reviewOn}:{type:'interval',every:Number(f.get('every')),unit:f.get('unit'),anchor:mode,anchorDate:unchanged?c.anchorDate:reviewOn};
                const item={...old,id:newId,clientId,projectId:f.get('projectId'),title:f.get('title').trim(),actor:'me',status:'open',priority:old?.priority||'normal',reviewOn:alignMaintenanceDate(cadence,reviewOn),promisedOn:'',reminderEnabled:f.has('enabled'),reminderTime:times[0],updatedAt:new Date().toISOString(),maintenance:{version:1,scheduleVersion:(m?.scheduleVersion||0)+1,instructions:f.get('instructions').trim(),times,cadence,paused:m?.paused||false,archived:m?.archived||false,history:m?.history||[]}};
                data.followups=old?data.followups.map(x=>x.id===old.id?item:x):[...data.followups,item];await save();
            });
            const toggle=()=>{const weekly=dialog.querySelector('[name=mode]').value==='weekly';dialog.querySelector('[data-cadence-interval]').hidden=weekly;dialog.querySelector('[data-cadence-weekly]').hidden=!weekly;};
            toggle();dialog.querySelector('[name=mode]').addEventListener('change',toggle);
        } else {
            if(!old)throw new Error('La rutina ya no está disponible.');
            if(kind==='done') {
                const historyId='mh_'+crypto.randomUUID();
                planningDialog(this.app,'Registrar mantenimiento',`<p>${esc(old.title)}</p>${field('Realizado el','doneOn',argentinaDay(),'date',`required max="${argentinaDay()}"`)}<label>Nota de la revisión (opcional)<textarea class="text-input" name="note" maxlength="2000"></textarea></label><p>Se conserva este registro y se programa la próxima revisión.</p>`,async f=>{data.followups=data.followups.map(x=>x.id===id?completeMaintenance(old,{id:historyId,doneOn:f.get('doneOn'),note:f.get('note').trim()}):x);await save();});
            } else if(kind==='pause'||kind==='archive') {
                const key=kind==='pause'?'paused':'archived';
                if(!await this.app.confirmAction({title:old.maintenance[key]?'Reactivar rutina':kind==='pause'?'Pausar rutina':'Archivar rutina',message:'El historial se conserva. Los avisos se envían sólo mientras la rutina y el cliente estén activos.',confirmLabel:'Confirmar',tone:'warning'}))return true;
                old.maintenance[key]=!old.maintenance[key];old.maintenance.scheduleVersion++;await save();
            } else if(kind==='delete') {
                if(!await this.app.confirmAction({title:'Eliminar rutina',message:`Se eliminará “${old.title}” con sus ${old.maintenance.history.length} registros de realización. Podés archivarla para conservarlos.`,confirmLabel:'Eliminar rutina',tone:'danger'}))return true;
                data.followups=data.followups.filter(x=>x.id!==id);await save();
            }
        }
        return true;
    }
}
