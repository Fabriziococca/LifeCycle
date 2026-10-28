import { escapeHtml as esc } from '../text-utils.mjs';
import { planningDialog } from './PlanningStore.js';
import { argentinaDay, addDays, validDay } from '../schedule-date-utils.mjs';
import { completeMaintenance, maintenanceDescription, maintenanceSchedule, maintenancePriority, nextMaintenanceDate, isMaintenanceCycle, maintenanceCycleState } from '../maintenance-utils.mjs';
import { nextReminderDay, formatReminderDay } from '../recurring-reminder-utils.mjs';
import { cycleIdentity, cycleMetrics } from '../cycle-card-view.mjs';
import { timeSlotsEditor, bindTimeSlotsEditor, readTimeSlots } from './TimeSlotsEditor.js';
const field=(label,name,value='',type='text',extra='')=>`<label>${label}<input class="text-input" name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
const option=(value,label,current)=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`;
const button=(action,label,id)=>`<button type="button" class="btn btn-secondary" data-work-action="maintenance-${action}" data-id="${esc(id)}">${label}</button>`;
export class MaintenanceView {
    constructor(work){this.work=work;this.app=work.app;}
    bindEscalationEditor(root,m) {
        const get=id=>root.querySelector('#'+id), enabled=get('reminder-escalation-enabled'), input=get('reminder-escalation-day');
        let previousBase;
        const update=()=>{
            const type=get('recurring-reminder-frequency').value, interval=type==='interval';
            const fromCompletion=interval&&get('reminder-from-completion').checked;
            const repeat=get('reminder-repeat-until-done');
            if(fromCompletion)repeat.checked=true;
            repeat.disabled=fromCompletion;
            const base=fromCompletion&&get('recurring-reminder-unit').value==='days'?Number(get('recurring-reminder-every').value):0;
            if(previousBase===undefined)input.value=(m?.escalationDays??4)+base;
            else if((previousBase===0)!==(base===0))input.value=Number(input.value)-previousBase+base;
            previousBase=base;
            const tracking=type!=='once'&&(fromCompletion||get('reminder-repeat-until-done').checked);
            enabled.disabled=!tracking;input.disabled=!tracking||!enabled.checked;
            input.min=base+1;input.max=base+3650;
            get('reminder-escalation-label').textContent=base?'Prioridad alta desde el día':'Días pendiente antes de subir la prioridad';
            get('reminder-escalation-preview').textContent=!tracking?'Activá el seguimiento hasta realizarla para reforzar los avisos pendientes.':base?`Aviso normal al día ${base}; prioridad alta al día ${input.value}. Los plazos vuelven a empezar cuando registrás la realización.`:'La prioridad alta empieza esa cantidad de días después de la fecha prevista, si la tarea sigue pendiente.';
        };
        root.addEventListener('input',update);root.addEventListener('change',update);update();
        return ()=>{root.removeEventListener('input',update);root.removeEventListener('change',update);};
    }
    section(client,data) {
        const records=data.followups.filter(f=>f.clientId===client.id&&f.maintenance);
        const active=records.filter(f=>!f.maintenance.archived), cycles=active.filter(isMaintenanceCycle), notices=active.filter(f=>!isMaintenanceCycle(f));
        return `<section class="maintenance-section"><header class="planning-heading"><div><h3>Tarjetas del cliente</h3><p>Registrá lo que hiciste y el contador vuelve a empezar.</p></div>${client.archived?'':button('card-new','Nueva tarjeta',client.id)}</header><div class="maintenance-cycle-grid">${cycles.map(f=>this.card(f,data,{showClient:false})).join('')||'<p>Sin tarjetas. Creá una y elegí cuándo avisar y cuándo vence.</p>'}</div><details class="maintenance-other" ${notices.length?'open':''}><summary>Recordatorios con otra frecuencia${notices.length?' ('+notices.length+')':''}</summary><p>Avisos de una sola vez, semanales, mensuales o con otra programación.</p>${client.archived?'':button('new','Agregar recordatorio',client.id)}${notices.map(f=>this.card(f,data)).join('')}</details>${records.some(f=>f.maintenance.archived)?`<details class="maintenance-other"><summary>Recordatorios archivados</summary><div class="maintenance-cycle-grid">${records.filter(f=>f.maintenance.archived).map(f=>this.card(f,data)).join('')}</div></details>`:''}</section>`;
    }
    card(f,data,options) {
        if(isMaintenanceCycle(f))return this.cycleCard(f,data,options);
        const m=f.maintenance, client=data.clients.find(c=>c.id===f.clientId), inactive=client?.archived||m.archived;
        const tracking=m.repeatUntilDone!==false, upcoming=tracking?f.reviewOn:nextReminderDay(maintenanceSchedule(f),argentinaDay(),{inclusive:m.times.some(t=>Date.parse(`${argentinaDay()}T${t}:00-03:00`)>Date.now())});
        const priority=maintenancePriority(f);
        const status=inactive?'Archivado':m.completed?'Realizado':m.paused?'Pausado':priority.high?'Prioridad alta':tracking&&f.reviewOn<=argentinaDay()?'Pendiente':upcoming?(tracking&&priority.highOn?(m.history.length?'Al día':'Ciclo inicial'):'Programado'):'Fecha pasada';
        const history=m.history.map(h=>`<div class="care-history"><strong>${esc(h.doneOn)}</strong><small>Fecha prevista: ${esc(h.dueOn)}</small>${h.note?`<p class="work-text">${esc(h.note)}</p>`:''}</div>`).join('')||'<p>Todavía no registraste realizaciones.</p>';
        const done=!inactive&&!m.paused&&!m.completed?button('done','Marcar realizado',f.id):'';
        return `<article id="maintenance-${f.id}" class="card planning-card maintenance-card ${priority.high&&!inactive?'is-high-priority':''}" data-maintenance-id="${f.id}" data-maintenance-priority="${priority.high?'high':'normal'}">
            <header class="planning-heading"><div><small>${esc(client?.name||'')} · Recordatorio</small><h4>${esc(f.title)}</h4></div><span class="badge ${inactive||m.paused?'gray':priority.high?'red':status==='Pendiente'?'orange':'green'}">${status}</span></header>
            <p>${esc(maintenanceDescription(m))} · ${esc(m.times.join(', '))} · Argentina</p>
            ${f.projectId?`<p>${esc(this.work.projectName(f.projectId))}</p>`:''}
            ${m.instructions?`<p class="work-text">${esc(m.instructions)}</p>`:''}
            ${tracking&&priority.highOn?`<div class="maintenance-thresholds"><div><small>Última realización</small><strong>${m.history[0]?formatReminderDay(m.history[0].doneOn):'Sin registrar'}</strong></div><div><small>Aviso normal desde</small><strong>${formatReminderDay(f.reviewOn)}</strong></div><div><small>Prioridad alta desde</small><strong>${formatReminderDay(priority.highOn)}</strong></div></div>`:''}
            <p>${m.completed?'Finalizado':upcoming?'Próximo día: '+formatReminderDay(upcoming):'Sin próxima fecha'}${!f.reminderEnabled?' · Avisos desactivados':tracking?' · Repetir hasta realizarla':''}</p>
            <div class="planning-actions">${tracking?done:''}${!client?.archived?button('edit','Editar recordatorio',f.id)+(!m.archived?button('pause',m.paused?'Reanudar':'Pausar',f.id):'')+button('archive',m.archived?'Reactivar recordatorio':'Archivar recordatorio',f.id):''}${button('delete','Eliminar recordatorio',f.id)}</div>
            <details><summary>${tracking?'Historial':'Seguimiento e historial'} (${m.history.length})</summary>${tracking?'':done}${history}</details>
        </article>`;
    }
    cycleCard(f,data,{showClient=true}={}) {
        const m=f.maintenance, client=data.clients.find(c=>c.id===f.clientId), s=maintenanceCycleState(f);
        if(client?.archived){s.label='Archivado';s.tone='gray';}
        const color=s.tone==='gray'?'var(--text-secondary)':`var(--status-${s.tone})`, inactive=client?.archived||m.archived||m.completed;
        const shortDay=day=>new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',...(day.slice(0,4)!==argentinaDay().slice(0,4)?{year:'numeric'}:{})}).format(new Date(day+'T12:00:00Z'));
        const menuAction=(action,label)=>`<button type="button" role="menuitem" data-work-action="maintenance-${action}" data-id="${esc(f.id)}">${label}</button>`;
        return `<article id="maintenance-${f.id}" class="custom-tracker-card maintenance-card maintenance-cycle-card status-${s.tone}" data-maintenance-id="${esc(f.id)}" data-maintenance-priority="${s.tone==='red'?'high':'normal'}" style="--custom-status-color:${color}">
            <div class="custom-tracker-card-header"><div class="custom-tracker-identity">${cycleIdentity(f.title,'ph-clock-clockwise',s.label)}</div><details class="custom-tracker-menu cycle-menu"><summary role="button" aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de ${esc(f.title)}"><i class="ph ph-dots-three-vertical" aria-hidden="true"></i></summary><div class="custom-tracker-menu-popover" role="menu" aria-label="Acciones de la tarjeta">${!client?.archived?menuAction('card-edit','Editar tarjeta')+menuAction('edit','Otra frecuencia de repetición'):''}${m.instructions?menuAction('instructions','Ver instrucciones'):''}${menuAction('history','Ver historial ('+m.history.length+')')}${!client?.archived?menuAction('archive',m.archived?'Desarchivar':'Archivar'):''}${menuAction('delete','Eliminar tarjeta')}</div></details></div>
            ${showClient||f.projectId?`<small class="cycle-context">${showClient?esc(client?.name||''):''}${f.projectId?(showClient?' · ':'')+esc(this.work.projectName(f.projectId)):''}</small>`:''}
            ${cycleMetrics({elapsedDays:s.elapsedDays,cadenceLabel:`de ${s.deadlineDays} días`,latestLabel:s.lastDoneOn?shortDay(s.lastDoneOn):'Sin registrar',nextLabel:shortDay(s.deadlineOn),nextCaption:'Vence',progress:s.progress})}
            <p class="cycle-rule">Atención desde el día ${s.warningDays} · ${f.reminderEnabled?'Avisos '+esc(m.times.join(', ')):'Avisos desactivados'}</p>
            ${inactive?'':`<div class="tracker-utility-row">${button('pause',m.paused?'Reanudar':'Pausar',f.id)}</div><button type="button" class="btn btn-primary custom-tracker-record" data-work-action="maintenance-done" data-id="${esc(f.id)}" ${m.paused?'disabled':''}><i class="ph ph-check-circle" aria-hidden="true"></i> Registrar realización</button>`}
        </article>`;
    }
    editCycle(old,client,data,save) {
        const m=old?.maintenance, state=old&&maintenanceCycleState(old), id=old?.id||crypto.randomUUID();
        const projects=(old?.projectId&&!data.links.some(l=>l.clientId===client.id&&l.projectId===old.projectId)?`<option value="${esc(old.projectId)}" selected>Vínculo anterior · ${esc(this.work.projectName(old.projectId))}</option>`:'')+data.links.filter(l=>l.clientId===client.id).map(l=>`<option value="${esc(l.projectId)}" ${old?.projectId===l.projectId?'selected':''}>${esc(this.work.projectName(l.projectId))}</option>`).join('');
        const html=`<p class="planning-hint">${esc(client.name)} · días y horarios de Argentina</p>${field('Nombre de la tarjeta','name',old?.title||'','text','required maxlength="120"')}<div class="care-form-grid">${field('Atención desde el día','warningDays',state?.warningDays||3,'number','required min="1" max="365" step="1"')}${field('Vencida desde el día','deadlineDays',state?.deadlineDays||7,'number','required min="1" max="4015" step="1"')}</div><p class="planning-hint">Los días se cuentan desde cada realización. Recibís avisos desde Atención hasta que la registrás.</p>${m?.history.length?`<p>Último registro: <strong>${state?.lastDoneOn?formatReminderDay(state.lastDoneOn):'Sin registrar'}</strong>${m?.paused?' · tarjeta pausada':''}</p>`:field('Empezar a contar desde','startOn',state?.startOn||argentinaDay(),'date','required')}<div class="schedule-times-field"><span>Horarios de aviso</span>${timeSlotsEditor(m?.times||['22:00'],'noticeTime')}</div><label class="lifecycle-checkbox-label reminder-active-switch"><span><strong>Enviar notificaciones</strong><small>Se envían mientras la tarjeta no esté pausada.</small></span><span class="switch"><input type="checkbox" name="enabled" ${old?.reminderEnabled===false?'':'checked'}><span class="slider round"></span></span></label><details class="schedule-optional"><summary>Proyecto e instrucciones (opcional)</summary><label>Proyecto de este cliente<select class="text-input" name="projectId"><option value="">Sólo el cliente, sin proyecto</option>${projects}</select></label><label>Instrucciones<textarea class="text-input" name="instructions" maxlength="2000">${esc(m?.instructions||'')}</textarea></label></details>`;
        const layer=planningDialog(this.app,old?'Editar tarjeta':'Nueva tarjeta del cliente',html,async form=>{
            const warning=Number(form.get('warningDays')), deadline=Number(form.get('deadlineDays'));
            if(!Number.isInteger(warning)||warning<1||warning>365||!Number.isInteger(deadline)||deadline<warning||deadline-warning>3650)throw new Error('El vencimiento debe ser igual o posterior al día de atención (hasta 3650 días después).');
            const startOn=m?.history.length?state.startOn:form.get('startOn');if(!validDay(startOn))throw new Error('Elegí una fecha de inicio válida.');
            const times=readTimeSlots(form,'noticeTime'), projectId=form.get('projectId');
            if(projectId!==old?.projectId&&projectId&&!data.links.some(l=>l.clientId===client.id&&l.projectId===projectId))throw new Error('Elegí un proyecto vinculado a este cliente.');
            const maintenance={...m,version:1,scheduleVersion:(m?.scheduleVersion||0)+1,times,instructions:form.get('instructions').trim(),history:m?.history||[],paused:m?.paused||false,archived:m?.archived||false,completed:m?.completed||false,repeatUntilDone:true,cadence:{...m?.cadence,type:'interval',every:warning,unit:'days',anchor:'completion',anchorDate:m?.history.length?m.cadence.anchorDate:startOn}};
            if(deadline>warning)maintenance.escalationDays=deadline-warning;else delete maintenance.escalationDays;
            const item={...old,id,clientId:client.id,projectId,title:form.get('name').trim(),actor:'me',status:'open',priority:old?.priority||'normal',reviewOn:addDays(startOn,warning),promisedOn:old?.promisedOn||'',reminderEnabled:form.has('enabled'),reminderTime:times[0],updatedAt:new Date().toISOString(),maintenance};
            data.followups=old?data.followups.map(f=>f.id===id?item:f):[...data.followups,item];await save();
        });
        if(layer){document.querySelectorAll('.cycle-menu[open]').forEach(menu=>menu.open=false);layer.classList.add('schedule-editor-dialog');bindTimeSlotsEditor(layer);layer.querySelector('[name=name]').focus();}
    }
    async action(action,id) {
        if(!action.startsWith('maintenance-'))return false;
        const data=this.work.store.value, revision=data.revision, owner=this.app.auth.readyUserId, generation=this.app.auth.syncGeneration;
        const save=async()=>{
            if(owner!==this.app.auth.readyUserId||generation!==this.app.auth.syncGeneration)throw new Error('La sesión cambió. Volvé a abrir la acción.');
            await this.work.store.save(data,revision);this.app.notificationsCenter?.updateBadge();this.app.today?.render();
        };
        const kind=action.slice(12), old=data.followups.find(f=>f.id===id&&f.maintenance);
        if(kind==='history'||kind==='instructions') {
            if(!old)throw new Error('La tarjeta ya no está disponible.');
            document.querySelectorAll('.cycle-menu[open]').forEach(menu=>menu.open=false);
            const state=maintenanceCycleState(old), m=old.maintenance;
            const content=kind==='instructions'?`<p class="work-text">${esc(m.instructions)}</p>`:(m.history.map(h=>`<div class="care-history"><strong>${formatReminderDay(h.doneOn)}</strong><small>Fecha prevista: ${formatReminderDay(h.dueOn)}</small>${h.note?`<p class="work-text">${esc(h.note)}</p>`:''}</div>`).join('')||`<p>Sin realizaciones registradas.${state?' Ciclo inicial desde '+formatReminderDay(state.startOn)+'.':''}</p>`);
            planningDialog(this.app,kind==='instructions'?'Instrucciones':'Historial de la tarjeta',`<h3>${esc(old.title)}</h3>${content}`);return true;
        }
        if(kind==='card-new'||kind==='card-edit') {
            const client=data.clients.find(c=>c.id===(old?.clientId||id));
            if(!client||client.archived)throw new Error('Reactivá el cliente para configurar sus tarjetas.');
            if(kind==='card-edit'&&(!old||!isMaintenanceCycle(old)))throw new Error('La tarjeta ya no está disponible.');
            this.editCycle(old,client,data,save);return true;
        }
        if(kind==='new'||kind==='edit') {
            const clientId=old?.clientId||id, client=data.clients.find(c=>c.id===clientId);
            if(!client||client.archived)throw new Error('Reactivá el cliente para configurar sus recordatorios.');
            const m=old?.maintenance, cadence=m?.cadence;
            const reminderId=old?.id||crypto.randomUUID();
            const schedule=old?maintenanceSchedule(old):{type:'weekly',days:[1,2,3,4,5,6,0]};
            const projectOptions=data.links.filter(l=>l.clientId===clientId).map(l=>`<option value="${esc(l.projectId)}" ${old?.projectId===l.projectId?'selected':''}>${esc(this.work.projectName(l.projectId))}</option>`).join('');
            const html=`<p>Cliente: <strong>${esc(client.name)}</strong></p><label>Proyecto de este cliente (opcional)<select class="text-input" id="reminder-client-project"><option value="">Sólo el cliente, sin proyecto</option>${projectOptions}</select></label><details class="reminder-advanced" ${m?.escalationDays?'open':''}><summary>Seguimiento y prioridad (opcional)</summary><label class="lifecycle-checkbox-label"><input type="checkbox" id="reminder-repeat-until-done" ${m?.repeatUntilDone!==false&&old?'checked':''}> Repetir diariamente desde la fecha prevista hasta marcarla realizada</label><label class="lifecycle-checkbox-label"><input type="checkbox" id="reminder-from-completion" ${cadence?.anchor==='completion'?'checked':''}> Para intervalos: contar desde la última realización</label><label class="lifecycle-checkbox-label"><input type="checkbox" id="reminder-escalation-enabled" ${m?.escalationDays?'checked':''}> Subir a prioridad alta si sigue pendiente</label><label><span id="reminder-escalation-label">Prioridad alta desde el día</span><input class="text-input" type="number" id="reminder-escalation-day" min="1" max="4015" step="1"></label><p id="reminder-escalation-preview" role="status"></p><p>Una sola vez termina después de su fecha. Los avisos programados no confirman que hiciste la tarea.</p></details>`;
            return this.app.alerts.openRecurringReminderEditor(null,document.activeElement,{
                workspace:'work',label:`Trabajo · ${client.name} · horarios de Argentina`,html,
                initial:{id:old?.id,name:old?.title||'',body:m?.instructions||'',title:m?.pushTitle||''},
                config:{schedule,times:m?.times||['09:00'],enabled:old?.reminderEnabled??true},
                onOpen:root=>this.bindEscalationEditor(root,m),
                onSave:async value=>{
                    const projectId=value.root.querySelector('#reminder-client-project').value;
                    const fromCompletion=value.root.querySelector('#reminder-from-completion').checked&&value.schedule.type==='interval';
                    const repeating=value.schedule.type==='once'?false:(fromCompletion||value.root.querySelector('#reminder-repeat-until-done').checked);
                    const unchanged=old&&JSON.stringify(schedule)===JSON.stringify(value.schedule)&&fromCompletion===(cadence.anchor==='completion');
                    const reviewOn=unchanged?old.reviewOn:fromCompletion?nextMaintenanceDate({maintenance:{cadence:{type:'interval',every:value.schedule.every,unit:value.schedule.unit,anchor:'completion'}}},value.schedule.startDate):(nextReminderDay(value.schedule,argentinaDay())||value.schedule.date);
                    const nextCadence=unchanged?cadence:fromCompletion?{type:'interval',every:value.schedule.every,unit:value.schedule.unit,anchor:'completion',anchorDate:value.schedule.startDate}:{type:'scheduled',schedule:value.schedule,anchorDate:reviewOn};
                    const base=fromCompletion&&value.schedule.unit==='days'?value.schedule.every:0;
                    const escalationDays=repeating&&value.root.querySelector('#reminder-escalation-enabled').checked?Number(value.root.querySelector('#reminder-escalation-day').value)-base:undefined;
                    if(escalationDays!==undefined&&(!Number.isInteger(escalationDays)||escalationDays<1||escalationDays>3650))throw new Error('La prioridad alta debe empezar después del aviso normal (hasta 3650 días de atraso).');
                    const item={...old,id:reminderId,clientId,projectId,title:value.name,actor:'me',status:'open',priority:old?.priority||'normal',reviewOn,promisedOn:'',reminderEnabled:value.enabled,reminderTime:value.times[0],updatedAt:new Date().toISOString(),maintenance:{...m,version:1,scheduleVersion:(m?.scheduleVersion||0)+1,instructions:value.body,pushTitle:value.title,times:value.times,cadence:nextCadence,repeatUntilDone:repeating,escalationDays,completed:unchanged?(m?.completed||false):false,paused:m?.paused||false,archived:m?.archived||false,history:m?.history||[]}};
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
