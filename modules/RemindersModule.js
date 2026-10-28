import { escapeHtml as esc } from '../text-utils.mjs';
import { describeRecurringSchedule, normalizeRecurringSchedule, nextReminderDay, formatReminderDay } from '../recurring-reminder-utils.mjs';
import { argentinaDay } from '../schedule-date-utils.mjs';

// Two destinations share this DOM and the existing stores. No copies of reminders.
export class RemindersModule {
    constructor(app) {
        this.app=app;
        this.root=document.createElement('div');
        this.root.id='reminders-hub';this.root.className='planning-workspace';
        this.root.innerHTML=`<header class="planning-heading"><div><span class="fw-eyebrow" id="reminders-space"></span><h2>Tus avisos</h2><p>Tu programación y tus avisos, en un solo lugar.</p></div><div class="planning-actions"><label id="reminders-client-choice" hidden>Para<select id="reminders-client" class="text-input"><option value="">Trabajo general</option></select></label><button type="button" class="btn btn-primary" data-hub-action="new"><i class="ph ph-plus"></i> Nuevo recordatorio</button></div></header><div id="reminders-list" class="reminder-list"></div><details id="reminder-settings"><summary>Configuración de avisos por categoría</summary><div id="reminder-settings-host"></div></details>`;
        const original=document.querySelector('#tab-alertas > .card');
        if(original)this.root.querySelector('#reminder-settings-host').append(original);
        this.root.addEventListener('click',e=>{const b=e.target.closest('[data-hub-action]');if(b)void this.action(b).catch(error=>app.showToast?.(error.message,{tone:'warning'}));});
    }
    get workspace(){return this.app.work?.area||'personal';}
    isVisible(){return ['personal-reminders-section','work-reminders-section'].includes(document.querySelector('.main-section:not(.hidden)')?.id);}
    render() {
        if(!this.isVisible())return;
        const host=document.querySelector(`#${this.workspace==='work'?'work':'personal'}-reminders-section .reminders-host`);
        if(this.root.parentElement!==host)host.append(this.root);
        this.root.querySelector('#reminders-space').textContent=this.workspace==='work'?'Trabajo':'Personal';
        const choice=this.root.querySelector('#reminders-client-choice'), select=this.root.querySelector('#reminders-client'), previous=select.value;
        let state;try{state=this.app.work.store.value;}catch{}
        choice.hidden=this.workspace!=='work';
        select.innerHTML='<option value="">Trabajo general</option>'+(state?.clients||[]).filter(c=>!c.archived).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
        select.value=[...select.options].some(o=>o.value===previous)?previous:'';
        this.root.querySelector('#reminder-settings').hidden=this.workspace==='work';
        this.app.alerts.render();
    }
    renderList() {
        if(!this.isVisible())return;
        const a=this.app.alerts, today=argentinaDay();
        const reminders=a.getRecurringReminderRegistry().reminders.filter(r=>r.workspace===this.workspace);
        const html=reminders.map(r=>{
            const c=a.configs[r.id]||{}, s=normalizeRecurringSchedule(c.schedule,r.defaultSchedule);
            const paused=c.paused||!c.enabled, times=c.times||r.defaultTimes;
            let next;try{next=nextReminderDay(s,today,{inclusive:times.some(t=>Date.parse(`${today}T${t}:00-03:00`)>Date.now())});}catch{}
            const past=s.type==='once'&&!next;
            return `<article class="reminder-row" data-reminder-id="${esc(r.id)}"><div><small>${this.workspace==='work'?'Trabajo general':'Personal'}</small><h3>${esc(r.name)}</h3><p>${esc(describeRecurringSchedule(s))} · ${esc((c.times||r.defaultTimes).join(', '))}</p><p>${esc(r.body)}</p><small>${paused?'Pausado':past?'Fecha pasada · no se repetirá':next?'Próximo día: '+formatReminderDay(next):'Sin próxima fecha'} · Argentina</small></div><div class="planning-actions"><button class="btn btn-secondary" data-hub-action="edit" data-id="${esc(r.id)}">Editar</button><button class="btn btn-secondary" data-hub-action="pause" data-id="${esc(r.id)}">${paused?'Reanudar':'Pausar'}</button><button class="btn btn-secondary" data-hub-action="delete" data-id="${esc(r.id)}">Eliminar</button></div></article>`;
        });
        if(this.workspace==='work'){
            let data;try{data=this.app.work.store.value;}catch{}
            if(data){
                const clients=new Set(data.clients.filter(c=>!c.archived).map(c=>c.id));
                const entries=data.followups.filter(f=>f.maintenance&&!f.maintenance.archived&&clients.has(f.clientId));
                if(entries.length)html.push(`<div class="maintenance-cycle-grid">${entries.map(f=>this.app.work.maintenance.card(f,data)).join('')}</div>`);
            }else html.push('<p role="status">Sincronizando los recordatorios de clientes…</p>');
        }
        this.root.querySelector('#reminders-list').innerHTML=html.join('')||'<div class="planning-empty">Todavía no creaste recordatorios en este espacio.</div>';
        this.root.querySelector('#reminders-list').onclick=e=>{const b=e.target.closest('[data-work-action]');if(b)void this.app.work.action(b.dataset.workAction,b.dataset.id).catch(error=>this.app.showToast?.(error.message,{tone:'warning'}));};
    }
    async action(button){
        const action=button.dataset.hubAction,id=button.dataset.id,a=this.app.alerts;
        if(action==='new'){
            const clientId=this.root.querySelector('#reminders-client').value;
            if(this.workspace==='work'&&clientId)return this.app.work.maintenance.action('maintenance-new',clientId);
            return a.openRecurringReminderEditor(null,button,{workspace:this.workspace});
        }
        if(action==='edit')return a.openRecurringReminderEditor(id,button);
        if(action==='delete')return a.deleteRecurringReminder(id);
        if(action==='pause'){
            const c=a.configs[id];if(!c)return;
            if(c.paused||!c.enabled){c.paused=false;c.enabled=true;}else c.paused=true;
            a.saveData();this.app.triggerDataSync?.('alerts_config');a.render();
        }
    }
}
