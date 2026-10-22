import { escapeHtml as esc } from '../text-utils.mjs';
import { planningDialog } from './PlanningStore.js';
import { argentinaDay } from '../schedule-date-utils.mjs';
import { completeMaintenance, maintenanceDescription, maintenanceSchedule } from '../maintenance-utils.mjs';
import { nextReminderDay, formatReminderDay } from '../recurring-reminder-utils.mjs';
const field=(label,name,value='',type='text',extra='')=>`<label>${label}<input class="text-input" name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
const option=(value,label,current)=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`;
const button=(action,label,id)=>`<button type="button" class="btn btn-secondary" data-work-action="maintenance-${action}" data-id="${esc(id)}">${label}</button>`;
export class MaintenanceView {
    constructor(work){this.work=work;this.app=work.app;}
    section(client,data) {
        const records=data.followups.filter(f=>f.clientId===client.id&&f.maintenance);
        return `<section class="maintenance-section"><header class="planning-heading"><h3>Recordatorios del cliente</h3>${client.archived?'':button('new','Agregar recordatorio',client.id)}</header><p>Avisos puntuales o con repetición. También los encontrás en Recordatorios de Trabajo.</p>${records.filter(f=>!f.maintenance.archived).map(f=>this.card(f,data)).join('')||'<p>Sin recordatorios. Agregá uno con la frecuencia que necesites.</p>'}${records.some(f=>f.maintenance.archived)?`<details><summary>Recordatorios archivados</summary>${records.filter(f=>f.maintenance.archived).map(f=>this.card(f,data)).join('')}</details>`:''}</section>`;
    }
    card(f,data) {
        const m=f.maintenance, client=data.clients.find(c=>c.id===f.clientId), inactive=client?.archived||m.archived;
        const tracking=m.repeatUntilDone!==false, upcoming=tracking?f.reviewOn:nextReminderDay(maintenanceSchedule(f),argentinaDay(),{inclusive:m.times.some(t=>Date.parse(`${argentinaDay()}T${t}:00-03:00`)>Date.now())});
        const status=inactive?'Archivado':m.completed?'Realizado':m.paused?'Pausado':tracking&&f.reviewOn<=argentinaDay()?'Pendiente':upcoming?'Programado':'Fecha pasada';
        const history=m.history.map(h=>`<div class="care-history"><strong>${esc(h.doneOn)}</strong><small>Fecha prevista: ${esc(h.dueOn)}</small>${h.note?`<p class="work-text">${esc(h.note)}</p>`:''}</div>`).join('')||'<p>Todavía no registraste realizaciones.</p>';
        const done=!inactive&&!m.paused&&!m.completed?button('done','Marcar realizado',f.id):'';
        return `<article id="maintenance-${f.id}" class="card planning-card maintenance-card" data-maintenance-id="${f.id}">
            <header class="planning-heading"><div><small>${esc(client?.name||'')} · Recordatorio</small><h4>${esc(f.title)}</h4></div><span class="badge ${inactive||m.paused?'gray':status==='Pendiente'?'orange':'green'}">${status}</span></header>
            <p>${esc(maintenanceDescription(m))} · ${esc(m.times.join(', '))} · Argentina</p>
            ${f.projectId?`<p>${esc(this.work.projectName(f.projectId))}</p>`:''}
            ${m.instructions?`<p class="work-text">${esc(m.instructions)}</p>`:''}
            <p>${m.completed?'Finalizado':upcoming?'Próximo día: '+formatReminderDay(upcoming):'Sin próxima fecha'}${!f.reminderEnabled?' · Avisos desactivados':tracking?' · Repetir hasta realizarla':''}</p>
            <div class="planning-actions">${tracking?done:''}${!client?.archived?button('edit','Editar recordatorio',f.id)+(!m.archived?button('pause',m.paused?'Reanudar':'Pausar',f.id):'')+button('archive',m.archived?'Reactivar recordatorio':'Archivar recordatorio',f.id):''}${button('delete','Eliminar recordatorio',f.id)}</div>
            <details><summary>${tracking?'Historial':'Seguimiento e historial'} (${m.history.length})</summary>${tracking?'':done}${history}</details>
        </article>`;
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
            if(!client||client.archived)throw new Error('Reactivá el cliente para configurar sus recordatorios.');
            const m=old?.maintenance, cadence=m?.cadence;
            const reminderId=old?.id||crypto.randomUUID();
            const schedule=old?maintenanceSchedule(old):{type:'weekly',days:[1,2,3,4,5,6,0]};
            const projectOptions=data.links.filter(l=>l.clientId===clientId).map(l=>`<option value="${esc(l.projectId)}" ${old?.projectId===l.projectId?'selected':''}>${esc(this.work.projectName(l.projectId))}</option>`).join('');
            const html=`<p>Cliente: <strong>${esc(client.name)}</strong></p><label>Proyecto de este cliente (opcional)<select class="text-input" id="reminder-client-project"><option value="">Sólo el cliente, sin proyecto</option>${projectOptions}</select></label><details class="reminder-advanced"><summary>Seguimiento de la tarea (opcional)</summary><label class="lifecycle-checkbox-label"><input type="checkbox" id="reminder-repeat-until-done" ${m?.repeatUntilDone!==false&&old?'checked':''}> Repetir diariamente desde la fecha prevista hasta marcarla realizada</label><label class="lifecycle-checkbox-label"><input type="checkbox" id="reminder-from-completion" ${cadence?.anchor==='completion'?'checked':''}> Para intervalos: contar desde la última realización</label><p>Una sola vez termina después de su fecha. Los avisos programados no confirman que hiciste la tarea.</p></details>`;
            return this.app.alerts.openRecurringReminderEditor(null,document.activeElement,{
                workspace:'work',label:`Trabajo · ${client.name} · horarios de Argentina`,html,
                initial:{id:old?.id,name:old?.title||'',body:m?.instructions||'',title:m?.pushTitle||''},
                config:{schedule,times:m?.times||['09:00'],enabled:old?.reminderEnabled??true},
                onSave:async value=>{
                    const projectId=value.root.querySelector('#reminder-client-project').value;
                    const fromCompletion=value.root.querySelector('#reminder-from-completion').checked&&value.schedule.type==='interval';
                    const repeating=value.schedule.type==='once'?false:(fromCompletion||value.root.querySelector('#reminder-repeat-until-done').checked);
                    const unchanged=old&&JSON.stringify(schedule)===JSON.stringify(value.schedule)&&fromCompletion===(cadence.anchor==='completion');
                    const reviewOn=unchanged?old.reviewOn:(nextReminderDay(value.schedule,argentinaDay())||value.schedule.date);
                    const nextCadence=unchanged?cadence:fromCompletion?{type:'interval',every:value.schedule.every,unit:value.schedule.unit,anchor:'completion',anchorDate:value.schedule.startDate}:{type:'scheduled',schedule:value.schedule,anchorDate:reviewOn};
                    const item={...old,id:reminderId,clientId,projectId,title:value.name,actor:'me',status:'open',priority:old?.priority||'normal',reviewOn,promisedOn:'',reminderEnabled:value.enabled,reminderTime:value.times[0],updatedAt:new Date().toISOString(),maintenance:{...m,version:1,scheduleVersion:(m?.scheduleVersion||0)+1,instructions:value.body,pushTitle:value.title,times:value.times,cadence:nextCadence,repeatUntilDone:repeating,completed:unchanged?(m?.completed||false):false,paused:m?.paused||false,archived:m?.archived||false,history:m?.history||[]}};
                    data.followups=old?data.followups.map(x=>x.id===old.id?item:x):[...data.followups.filter(x=>x.id!==reminderId),item];await save();
                }
            });
        } else {
            if(!old)throw new Error('El recordatorio ya no está disponible.');
            if(kind==='done') {
                const historyId='mh_'+crypto.randomUUID();
                planningDialog(this.app,'Registrar tarea realizada',`<p>${esc(old.title)}</p>${field('Realizado el','doneOn',argentinaDay(),'date',`required max="${argentinaDay()}"`)}<label>Nota de la revisión (opcional)<textarea class="text-input" name="note" maxlength="2000"></textarea></label><p>Se conserva este registro y se programa la próxima revisión.</p>`,async f=>{data.followups=data.followups.map(x=>x.id===id?completeMaintenance(old,{id:historyId,doneOn:f.get('doneOn'),note:f.get('note').trim()}):x);await save();});
            } else if(kind==='pause'||kind==='archive') {
                const key=kind==='pause'?'paused':'archived';
                if(!await this.app.confirmAction({title:old.maintenance[key]?'Reactivar recordatorio':kind==='pause'?'Pausar recordatorio':'Archivar recordatorio',message:'El historial se conserva. Los avisos se envían sólo mientras el recordatorio y el cliente estén activos.',confirmLabel:'Confirmar',tone:'warning'}))return true;
                old.maintenance[key]=!old.maintenance[key];old.maintenance.scheduleVersion++;await save();
            } else if(kind==='delete') {
                if(!await this.app.confirmAction({title:'Eliminar recordatorio',message:`Se eliminará “${old.title}” con sus ${old.maintenance.history.length} registros de realización. Podés archivarla para conservarlos.`,confirmLabel:'Eliminar recordatorio',tone:'danger'}))return true;
                data.followups=data.followups.filter(x=>x.id!==id);await save();
            }
        }
        return true;
    }
}
