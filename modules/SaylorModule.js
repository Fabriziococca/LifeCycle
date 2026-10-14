import { escapeHtml as esc } from '../text-utils.mjs';
import { PlanningStore, planningDialog } from './PlanningStore.js';
import { SAYLOR_KEY, planningId, moneyMinor, localDate, saylorTotals, closeSaylor, validatePlanning } from '../planning-utils.mjs';

const field = (label,name,value='',type='text',extra='') => `<label>${label}<input class="text-input" name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const option = (value,label,selected) => `<option value="${value}" ${selected===value?'selected':''}>${label}</option>`;
export class SaylorModule {
    constructor(app) {
        this.app=app; this.store=new PlanningStore(app,SAYLOR_KEY); this.tab='events';
        const section=document.getElementById('trading-section'); if(!section) return;
        const events=document.createElement('div'); events.id='trading-events-pane';
        while(section.firstChild) events.append(section.firstChild);
        section.append(events);
        section.insertAdjacentHTML('afterbegin',`<div class="planning-tabs" aria-label="Trading"><button class="btn btn-primary" data-trading-tab="events">Eventos</button><button class="btn btn-secondary" data-trading-tab="saylor">Saylor</button></div>`);
        this.root=document.createElement('div'); this.root.id='saylor-pane'; this.root.className='hidden planning-workspace'; section.append(this.root);
        section.querySelectorAll('[data-trading-tab]').forEach(button=>button.addEventListener('click',()=>this.activate(button.dataset.tradingTab)));
        this.root.addEventListener('click',e=>{ const button=e.target.closest('[data-saylor-action]'); if(button) this.action(button.dataset.saylorAction,button.dataset.id,button.dataset.load); });
        this.render();
    }
    activate(tab='saylor') {
        this.tab=tab; document.getElementById('trading-events-pane')?.classList.toggle('hidden',tab!=='events');
        this.root.classList.toggle('hidden',tab!=='saylor');
        document.querySelectorAll('[data-trading-tab]').forEach(b=>{b.classList.toggle('btn-primary',b.dataset.tradingTab===tab); b.classList.toggle('btn-secondary',b.dataset.tradingTab!==tab);b.setAttribute('aria-pressed',String(b.dataset.tradingTab===tab));});
        if(tab==='saylor') this.render(); else this.app.trading?.activate();
    }
    money(minor) { return this.app.isFinancialAmountsHidden?.() ? '••••••' : new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(minor/100)+' USD'; }
    render() {
        if(!this.root) return;
        let data; try { data=this.store.value; } catch(error) { this.root.textContent=error.message; return; }
        this.root.innerHTML=`<header class="planning-heading"><div><h2>Saylor</h2><p>BTC · Long · Aislado · 5× · 3 cargadores de 30 balas</p></div><button class="btn btn-primary" data-saylor-action="create">Iniciar Saylor</button></header>
            <details open class="planning-reference"><summary>Reglas de referencia (tocar para ampliar)</summary><a href="/assets/saylor-reglas-2026.png" target="_blank" rel="noopener"><img src="/assets/saylor-reglas-2026.png" alt="Lámina de reglas Saylor del autor; tocar para ampliar" loading="lazy"></a><p>Registro personal con 3 cargadores. La lámina del autor parte de 2 y contempla uno adicional. No ejecuta operaciones ni calcula cotizaciones.</p></details>
            <p class="planning-hint">Los aportes históricos no cambian con el precio de BTC. Tu recordatorio de Trading se administra en Recordatorios.</p>
            ${data.campaigns.length?'':'<div class="card planning-empty">Todavía no hay operaciones. Podés iniciar una nueva o incorporar una que ya esté en curso.</div>'}
            ${[...data.campaigns].reverse().map(c=>{const t=saylorTotals(c); return `<article class="card planning-card" data-campaign="${c.id}"><header class="planning-heading"><div><h3>${esc(c.name)}</h3><p>${esc(c.exchange||'Exchange sin indicar')} · Inicio ${esc(c.startedOn)}</p></div><strong>${c.status==='active'?'En curso':'Finalizada'}</strong></header>
                <div class="planning-metrics"><div><small>Balas registradas</small><strong>${t.bullets} / 90</strong></div><div><small>Aportes nominales</small><strong>${this.money(t.contributedMinor)}</strong></div><div><small>Disponibles</small><strong>${t.remaining} balas</strong></div><div><small>Valor de cada bala</small><strong>${this.money(c.bulletMinor)}</strong></div></div>
                <div class="planning-magazines">${t.magazines.map((n,i)=>`<label>Cargador ${i+1}: ${n}/30<progress max="30" value="${n}">${n}/30</progress></label>`).join('')}</div>
                <p>Posición: <b>${t.position} balas · ${this.money(t.positionMinor)}</b><br>Sólo margen: <b>${t.margin} balas · ${this.money(t.marginMinor)}</b></p>
                ${c.closure?`<p class="planning-result">Resultado del ${esc(c.closure.date)}: <b>${c.closure.profitMinor<0?'−':''}${this.money(Math.abs(c.closure.profitMinor))}</b> · ${c.closure.percentBps/100}% sobre ${c.closure.basis==='all'?'todos los aportes':'aportes a posición'} · ${c.closure.actual?'importe real declarado':'cálculo nominal'}.</p><p>Vinculado una sola vez a ${c.closure.profitMinor<0?'gastos':'ingresos'} de Finanzas. No incluye devolución del capital.</p>`:''}
                <div class="planning-actions">${c.status==='active'?`<button class="btn btn-primary" data-saylor-action="load" data-id="${c.id}">Registrar recarga</button><button class="btn btn-secondary" data-saylor-action="edit" data-id="${c.id}">Editar operación</button>`:''}<button class="btn btn-secondary" data-saylor-action="close" data-id="${c.id}">${c.closure?'Editar cierre':'Finalizar'}</button></div>
                <details><summary>Historial (${c.loads.length})</summary>${[...c.loads].reverse().map(l=>`<div class="planning-history"><span>${esc(l.date)} · ${l.quantity} balas a ${l.destination==='position'?'posición':'margen'}${l.initial?' · saldo inicial declarado':''}${l.voidedAt?' · anulada':''}</span>${!l.voidedAt&&c.status==='active'?`<button class="btn btn-secondary" data-saylor-action="void" data-id="${c.id}" data-load="${l.id}">Anular</button>`:''}</div>`).join('')||'<p>Sin recargas registradas.</p>'}</details></article>`;}).join('')}`;
    }
    action(action,id,loadId) {
        try {
            const data=this.store.value, expected=data.revision, c=data.campaigns.find(x=>x.id===id);
            if(action==='create'||action==='edit') {
                const locked=c && c.loads.length>0;
                const newId=planningId('sc'), initialIds=[planningId('sl'),planningId('sl')];
                const layer=planningDialog(this.app,c?'Editar operación':'Iniciar Saylor',`${field('Nombre','name',c?.name||'Saylor BTC','text','required maxlength="120"')}${field('Exchange (opcional)','exchange',c?.exchange||'','text','maxlength="80"')}${field('Fecha de inicio','startedOn',c?.startedOn||localDate(),'date',`required max="${localDate()}" ${c?'readonly':''}`)}<div class="planning-form-grid">${field('Capital total asignado (USD)','capital',(c?.bulletMinor||5000)*90/100,'number',`required min="0.90" step="0.01" ${locked?'readonly':''}`)}${field('Valor por bala (USD)','bullet',(c?.bulletMinor||5000)/100,'number',`required min="0.01" max="10000000" step="0.01" ${locked?'readonly':''}`)}</div><p>3 cargadores iguales, 30 balas cada uno. Con recargas, el valor de la bala se conserva.</p>${c?'':`<fieldset><legend>¿Ya estaba iniciada? Saldo inicial declarado (opcional)</legend>${field('Balas ya puestas a posición','initialPosition',0,'number','required min="0" max="90" step="1"')}${field('Balas ya puestas sólo a margen','initialMargin',0,'number','required min="0" max="90" step="1"')}<p>No se inventará un historial anterior: quedará un saldo inicial con la fecha indicada.</p></fieldset>`}`,async f=>{
                    const bulletMinor=moneyMinor(f.get('bullet'));
                    if(moneyMinor(f.get('capital'))!==bulletMinor*90) throw new Error('El capital debe corresponder a 90 balas iguales. Ajustá el valor por bala.');
                    const campaign=c || {id:newId,status:'active',loads:[]};
                    Object.assign(campaign,{name:f.get('name').trim(),exchange:f.get('exchange').trim(),startedOn:f.get('startedOn'),bulletMinor});
                    if(!c) { for(const [name,destination] of [['initialPosition','position'],['initialMargin','margin']]) {const n=Number(f.get(name));if(!Number.isInteger(n)||n<0)throw new Error('Ingresá una cantidad entera de balas.');if(n)campaign.loads.push({id:initialIds[destination==='position'?0:1],quantity:n,destination,date:campaign.startedOn,initial:true});} data.campaigns=data.campaigns.filter(x=>x.id!==newId);data.campaigns.push(campaign); }
                    validatePlanning(data,SAYLOR_KEY); await this.store.save(data,expected);
                });
                if(layer&&!locked) { const capital=layer.querySelector('[name=capital]'),bullet=layer.querySelector('[name=bullet]'); capital.addEventListener('input',()=>bullet.value=(Number(capital.value)/90).toFixed(2));bullet.addEventListener('input',()=>capital.value=(Number(bullet.value)*90).toFixed(2)); }
            } else if(action==='load' && c?.status==='active') {
                const loadId=planningId('sl');
                const layer=planningDialog(this.app,'Registrar recarga',`<p>${esc(c.name)} · ${saylorTotals(c).remaining} balas disponibles</p><div class="planning-actions" aria-label="Cantidades rápidas">${[1,2,3,4,5].map(n=>`<button type="button" class="btn btn-secondary" data-quantity="${n}">+${n}</button>`).join('')}</div>${field('Cantidad de balas','quantity',1,'number','required min="1" max="90" step="1"')}<label>Destino<select class="time-input" name="destination">${option('position','Aumentar posición','position')}${option('margin','Agregar sólo margen','position')}</select></label>${field('Fecha de la recarga','date',localDate(),'date',`required min="${c.startedOn}" max="${localDate()}"`)}<p class="planning-preview"></p><p>Registrá una operación ya realizada en el exchange. Este botón no mueve dinero.</p>`,async f=>{c.loads=c.loads.filter(x=>x.id!==loadId);c.loads.push({id:loadId,quantity:Number(f.get('quantity')),destination:f.get('destination'),date:f.get('date')});await this.store.save(data,expected);});
                if(layer) {const q=layer.querySelector('[name=quantity]'); const preview=()=>layer.querySelector('.planning-preview').textContent=`Aporte nominal: ${this.money(Number(q.value)*c.bulletMinor)}`; layer.querySelectorAll('[data-quantity]').forEach(b=>b.addEventListener('click',()=>{q.value=b.dataset.quantity;preview();}));q.addEventListener('input',preview);preview();}
            } else if(action==='close' && c) {
                const layer=planningDialog(this.app,c.closure?'Editar cierre':'Finalizar Saylor',`${field('Fecha de cierre','date',c.closure?.date||localDate(),'date',`required min="${c.startedOn}" max="${localDate()}"`)}<label>Base del porcentaje<select name="basis" class="time-input">${option('all','Todos los aportes: posición + margen',c.closure?.basis||'all')}${option('position','Sólo aportes a posición',c.closure?.basis||'all')}</select></label>${field('Porcentaje de resultado (%)','percent',(c.closure?.percentBps??2000)/100,'number','required min="-100" max="10000" step="0.01"')}${field('Resultado neto real en USD (opcional)','actual',c.closure?.actual?c.closure.profitMinor/100:'','number','step="0.01"')}<p>El cálculo porcentual es nominal: no consulta BTC ni deduce comisiones/funding. Si conocés el resultado neto real, ingresalo arriba. Un resultado negativo se registra como gasto.</p><p class="planning-preview"></p><p>Al guardar se ${c.closure?'actualizará':'creará'} el resultado vinculado en Finanzas, en el mes del cierre. La devolución del capital no suma ingresos.</p>`,async f=>{c.closure=closeSaylor(c,Object.fromEntries(f));c.status='closed';await this.store.save(data,expected);});
                if(layer){const preview=()=>{try{const cl=closeSaylor(c,Object.fromEntries(new FormData(layer.querySelector('form'))));layer.querySelector('.planning-preview').textContent=`Base: ${this.money(cl.baseMinor)} · Resultado: ${cl.profitMinor<0?'−':''}${this.money(Math.abs(cl.profitMinor))}`;}catch(e){layer.querySelector('.planning-preview').textContent=e.message;}};layer.querySelector('form').addEventListener('input',preview);preview();}
            } else if(action==='void' && c?.status==='active') {
                const voidedAt=new Date().toISOString();
                planningDialog(this.app,'Anular recarga',`<p>La recarga se conservará como anulada y sus balas volverán a estar disponibles.</p>`,async()=>{const l=c.loads.find(x=>x.id===loadId);if(!l)throw new Error('La recarga ya cambió.');l.voidedAt=voidedAt;await this.store.save(data,expected);});
            }
        } catch(error) {this.app.showToast?.(error.message,{tone:'error'});}
    }
}
