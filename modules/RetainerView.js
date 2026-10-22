import { escapeHtml as esc } from '../text-utils.mjs';
import { planningDialog } from './PlanningStore.js';
import { argentinaDay, parseTimes } from '../schedule-date-utils.mjs';
import { billingDate, confirmRetainer, voidLastRetainerPayment, retainerMoney, retainerList, pendingRetainers } from '../retainer-utils.mjs';
const field=(label,name,value='',type='text',extra='')=>`<label>${label}<input class="text-input" name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
const button=(action,label,id,extra='')=>`<button type="button" class="btn btn-secondary" data-work-action="retainer-${action}" data-id="${esc(id)}" ${extra}>${label}</button>`;
export class RetainerView {
    constructor(work){this.work=work;this.app=work.app;}
    money(r){return this.app.isFinancialAmountsHidden?.()?'•••• '+r.currency:retainerMoney(r.amountMinor,r.currency);}
    section(client) {
        const list=client.retainers||[];
        return `<section class="retainer-section"><header class="planning-heading"><h3>Mantenimiento mensual</h3>${client.archived?'':button('new','Agregar mantenimiento mensual',client.id)}</header><p>Qué incluye, cuánto cobrás y cuándo confirmar el pago. Los recordatorios de las tareas se configuran arriba.</p>${list.filter(r=>!r.archived).map(r=>this.card(client,r)).join('')||'<p>Sin mantenimientos mensuales.</p>'}${list.some(r=>r.archived)?`<details><summary>Mantenimientos archivados</summary>${list.filter(r=>r.archived).map(r=>this.card(client,r)).join('')}</details>`:''}</section>`;
    }
    card(client,r,compact=false) {
        const inactive=client.archived||r.archived, due=r.nextDue<=argentinaDay(), last=r.payments.filter(p=>!p.voidedAt).at(-1);
        return `<article ${compact?'':`id="retainer-${r.id}"`} class="card planning-card retainer-card"><header class="planning-heading"><div><small>${esc(client.name)} · Mantenimiento mensual</small><h4>${esc(r.title)}</h4></div><span class="badge ${inactive||r.paused?'gray':due?'orange':'green'}">${inactive?'Archivado':r.paused?'Pausado':due?'Cobro por confirmar':'Programado'}</span></header><p><strong>${esc(this.money(r))} / mes</strong> · Cobro el día ${r.billingDay}</p><p>${due?'Período pendiente':'Próximo cobro'}: <strong>${esc(r.nextDue)}</strong></p>${!compact?`<p class="work-text">${esc(r.tasks||'Sin tareas incluidas anotadas.')}</p>${r.projectIds.length?`<p>Proyectos: ${r.projectIds.map(id=>esc(this.work.projectName(id))).join(' · ')}</p>`:'<p>Asociado al cliente, sin proyecto específico.</p>'}<p>${r.reminderEnabled?'Avisos de cobro: '+esc(r.times.join(', '))+' · Argentina, desde el vencimiento hasta confirmar.':'Avisos de cobro desactivados.'}</p>`:''}<div class="planning-actions">${due&&!inactive&&!r.paused?button('pay','Sí, recibí el pago',r.id)+button('unpaid','Todavía no pagó',r.id):''}${compact?button('open','Abrir mantenimiento',r.id):!client.archived?button('edit','Editar mantenimiento',r.id)+(!r.archived?button('pause',r.paused?'Reanudar':'Pausar',r.id):'')+button('archive',r.archived?'Reactivar':'Archivar',r.id)+(!r.payments.length?button('delete','Eliminar',r.id):''):''}</div>${!compact?`<details><summary>Historial de cobros (${r.payments.length})</summary>${r.payments.slice().reverse().map(p=>`<div class="care-history"><strong>${esc(this.money(p))} · ${esc(p.receivedOn)}</strong><p>Período ${esc(p.dueOn)} · ${p.voidedAt?'Anulado, sin efecto en Finanzas':'Confirmado en Finanzas'}</p>${!client.archived&&last?.id===p.id?button('void','Anular último cobro',r.id):''}</div>`).join('')||'<p>Todavía no confirmaste pagos. Llegar al vencimiento no registra ingresos.</p>'}</details>`:''}</article>`;
    }
    pending(state){return pendingRetainers(state,argentinaDay()).map(({client,retainer})=>this.card(client,retainer,true)).join('');}
    projectSection(projectId) {
        const state=this.work.store.state;
        const list=retainerList(state).filter(({retainer:r})=>r.projectIds.includes(String(projectId)));
        if(!list.length)return '';
        return `<section class="project-retainers"><h4>Mantenimiento del cliente</h4>${list.map(({client,retainer:r})=>`<p>${esc(r.title)} · ${esc(this.money(r))} / mes · ${r.archived||client.archived?'Archivado':r.paused?'Pausado':'Próximo cobro: '+esc(r.nextDue)}</p>${button('open','Ver mantenimiento de '+esc(client.name),r.id)}`).join('')}<small>Se cobra y confirma por separado del presupuesto de este proyecto.</small></section>`;
    }
    open(id) {
        const found=retainerList(this.work.store.value).find(x=>x.retainer.id===id);
        if(!found)throw new Error('El mantenimiento ya no está disponible.');
        this.work.clientId=found.client.id;this.app.activateSection('work-clients-section');this.work.render();
        document.getElementById('retainer-'+id)?.scrollIntoView({block:'center'});
    }
    async action(action,id) {
        const kind=action.slice('retainer-'.length);
        if(kind==='open'){this.open(id);return;}
        const state=this.work.store.value, revision=state.revision, owner=this.app.auth.readyUserId, generation=this.app.auth.syncGeneration;
        const found=retainerList(state).find(x=>x.retainer.id===id), r=found?.retainer, client=found?.client||state.clients.find(c=>c.id===id);
        if(!client)throw new Error('El cliente ya no está disponible.');
        const save=async next=>{
            if(owner!==this.app.auth.readyUserId||generation!==this.app.auth.syncGeneration)throw new Error('La sesión cambió. Volvé a abrir la acción.');
            if(next)client.retainers=(client.retainers||[]).map(x=>x.id===id?next:x);
            await this.work.store.save(state,revision);
        };
        if(client.archived)throw new Error('Reactivá el cliente para modificar sus mantenimientos.');
        if(kind==='new'||kind==='edit') {
            const newId=r?.id||crypto.randomUUID(), linked=state.links.filter(l=>l.clientId===client.id), locked=!!r?.payments.length;
            const html=`<p>Cliente: <strong>${esc(client.name)}</strong></p>`+field('Nombre del mantenimiento','title',r?.title||'','text','required maxlength="120" placeholder="Mantenimiento PlayStation"')+
                `<label>Tareas incluidas<textarea class="text-input" name="tasks" maxlength="4000" placeholder="Reiniciar PC, revisar proxies y grabaciones…">${esc(r?.tasks||'')}</textarea></label><div class="care-form-grid">${field('Importe mensual','amount',r?r.amountMinor/100:'','number','required min="0.01" max="1000000000" step="0.01"')}<label>Moneda<select name="currency" class="text-input"><option value="USD">USD</option><option value="ARS" ${r?.currency==='ARS'?'selected':''}>ARS</option></select></label></div><div class="care-form-grid">${field('Día de cobro de cada mes','billingDay',r?.billingDay||Number(argentinaDay().slice(-2)),'number','required min="1" max="31"')}${field(locked?'Mes pendiente (se conserva)':'Primer mes por cobrar','month',r?.nextDue.slice(0,7)||argentinaDay().slice(0,7),'month',locked?'disabled':'required')}</div><p>En meses cortos se usa el último día. Si no confirmás el pago, el mismo período sigue pendiente; no se saltea ningún mes. ${locked?'Los cambios de importe y tareas se aplican al período pendiente; los cobros anteriores se conservan.':''}</p><fieldset><legend>Proyectos de este cliente (opcional)</legend>${linked.map(l=>`<label class="lifecycle-checkbox-label"><input class="lifecycle-checkbox" type="checkbox" name="projectId" value="${esc(l.projectId)}" ${r?.projectIds.includes(l.projectId)?'checked':''}>${esc(this.work.projectName(l.projectId))}</label>`).join('')||'<p>Vinculá un proyecto desde la ficha si querés asociarlo. Podés continuar sólo con el cliente.</p>'}</fieldset><label class="lifecycle-checkbox-label"><input class="lifecycle-checkbox" type="checkbox" name="enabled" ${!r||r.reminderEnabled?'checked':''}>Avisarme cuando el cobro esté pendiente</label>`+field('Horarios Argentina (separados por comas)','times',r?.times.join(', ')||'15:00','text','required placeholder="09:00, 18:00"')+'<p>Hasta seis horarios diarios. Sólo confirmar un pago crea el ingreso en Finanzas.</p>';
            planningDialog(this.app,r?'Editar mantenimiento mensual':'Nuevo mantenimiento mensual',html,async f=>{
                const amount=Number(f.get('amount')), amountMinor=Math.round(amount*100);
                if(!Number.isFinite(amount)||Math.abs(amount*100-amountMinor)>.00001)throw new Error('Usá un importe con hasta dos decimales.');
                const day=Number(f.get('billingDay')), next={...r,id:newId,version:1,title:f.get('title').trim(),tasks:f.get('tasks').trim(),amountMinor,currency:f.get('currency'),billingDay:day,nextDue:billingDate(locked?r.nextDue.slice(0,7):f.get('month'),day),projectIds:f.getAll('projectId'),times:parseTimes(f.get('times')),reminderEnabled:f.has('enabled'),paused:r?.paused||false,archived:r?.archived||false,scheduleVersion:(r?.scheduleVersion||0)+1,payments:r?.payments||[]};
                if(r)await save(next);else{client.retainers=[...(client.retainers||[]).filter(x=>x.id!==newId),next];await save();}
            });return;
        }
        if(!r)throw new Error('El mantenimiento ya no está disponible.');
        if(kind==='pay') {
            const receiptId=crypto.randomUUID(), accounts=this.app.finanzas?.workspaceView?.workspace?.accounts||[];
            planningDialog(this.app,'Confirmar pago recibido',`<p><strong>${esc(client.name)} · ${esc(r.title)}</strong></p><p>Período ${esc(r.nextDue)} · ${esc(this.money(r))}</p><p>Confirmá sólo si ya recibiste este pago. Se registra una vez en Finanzas y se habilita el siguiente mes.</p>${field('Recibido el','receivedOn',argentinaDay(),'date',`required min="${r.nextDue}" max="${argentinaDay()}"`)}${r.currency==='ARS'?field('Cotización usada: ARS por 1 USD','exchangeRate','','number','required min="0.000001" max="1000000" step="0.000001"')+'<p>Se conserva el importe en pesos y su equivalente USD con esta cotización.</p>':''}<label>Cuenta de ingreso (opcional)<select name="accountId" class="text-input"><option value="">Sin cuenta asignada</option>${accounts.filter(a=>!a.archived&&a.currency===r.currency&&a.kind!=='credit').map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label>`,async f=>{
                if(f.get('accountId')&&!accounts.some(a=>a.id===f.get('accountId')&&!a.archived&&a.currency===r.currency&&a.kind!=='credit'))throw new Error('Elegí una cuenta compatible.');
                await save(confirmRetainer(r,{id:receiptId,dueOn:r.nextDue,receivedOn:f.get('receivedOn'),today:argentinaDay(),exchangeRate:r.currency==='ARS'?Number(f.get('exchangeRate')):1,accountId:f.get('accountId'),clientName:client.name}));
            });
        } else if(kind==='unpaid') {
            this.app.showToast?.('Sigue pendiente. No se registró ningún ingreso ni se avanzó el mes.');
        } else if(kind==='void') {
            const last=r.payments.filter(p=>!p.voidedAt).at(-1);if(!last)return;
            if(await this.app.confirmAction({title:'Anular último cobro',message:`Se quitará su efecto de Finanzas y volverá a quedar pendiente el período ${last.dueOn}. Se conserva el historial. Esto no devuelve dinero al cliente.`,confirmLabel:'Anular cobro',tone:'danger'}))await save(voidLastRetainerPayment(r,last.id));
        } else if(kind==='pause'||kind==='archive') {
            const key=kind==='pause'?'paused':'archived';
            if(await this.app.confirmAction({title:r[key]?'Reactivar mantenimiento':kind==='pause'?'Pausar mantenimiento':'Archivar mantenimiento',message:'Se conservan los pagos confirmados en Finanzas y el período pendiente. Los avisos sólo se envían mientras el mantenimiento y el cliente estén activos.',confirmLabel:'Confirmar',tone:'warning'}))await save({...r,[key]:!r[key],scheduleVersion:r.scheduleVersion+1});
        } else if(kind==='delete') {
            if(r.payments.length)throw new Error('Este mantenimiento tiene historial de cobros. Podés archivarlo.');
            if(await this.app.confirmAction({title:'Eliminar mantenimiento mensual',message:'Se eliminará este mantenimiento sin cobros registrados. Podés archivarlo para conservarlo.',confirmLabel:'Eliminar',tone:'danger'})){client.retainers=client.retainers.filter(x=>x.id!==id);await save();}
        }
    }
}
