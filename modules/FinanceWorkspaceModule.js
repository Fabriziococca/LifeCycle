import { escapeHtml as esc } from '../text-utils.mjs';
import { getLocalISODate, getLocalISOMonth } from '../utils.js';
import { RESOURCE_KEYS } from '../resource-policy.mjs';
import { financeWorkspace, buildFinanceAccount, buildFinanceMovement, buildFinanceTransfer,
    buildFinanceBudget, buildWorkspaceMovements, accountBalanceMinor, budgetSpentMinor,
    validateFinanceWorkspace } from '../finance-workspace-utils.mjs';

const TABS = { summary: 'Resumen', movements: 'Movimientos', accounts: 'Cuentas', budgets: 'Presupuestos', cards: 'Tarjetas' };
const KINDS = { cash: 'Efectivo', bank: 'Banco', wallet: 'Billetera', credit: 'Crédito' };
const option = (value, label, selected) => `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;

export class FinanceWorkspaceModule {
    constructor(finance) {
        this.finance = finance; this.app = finance.app;
        this.root = document.getElementById('finance-workspace');
        if (!this.root) return;
        this.tab = 'summary'; this.currency = 'USD'; this.month = this.app.uiState?.financeMonth || getLocalISOMonth();
        this.query = ''; this.type = ''; this.page = 1;
        this.root.innerHTML = `
            <div class="fw-toolbar"><div><span class="fw-eyebrow">TU DINERO, EN ORDEN</span><h2>Finanzas</h2></div>
            <button type="button" class="btn-primary" data-fw-action="new-movement">＋ Nuevo movimiento</button></div>
            <div class="fw-controls"><label>Mes <input id="fw-month" type="month" value="${esc(this.month)}"></label>
            <label>Moneda de los registros <select id="fw-currency">${option('USD','USD','USD')}${option('ARS','ARS','USD')}</select></label>
            <button type="button" class="financial-privacy-toggle" data-fw-action="privacy">Mostrar / ocultar montos</button></div>
            <nav class="fw-tabs" aria-label="Secciones de Finanzas">${Object.entries(TABS).map(([key, label]) => `<button type="button" data-fw-tab="${key}">${label}</button>`).join('')}</nav>
            <p class="fw-note">Los registros antiguos sin moneda original aparecen como equivalente USD guardado. No se inventan importes en pesos ni se convierten al valor de hoy.</p>
            <div id="fw-filters" class="fw-controls" hidden><label>Buscar <input id="fw-search" type="search" placeholder="Detalle, categoría, origen…"></label>
            <label>Tipo <select id="fw-type">${option('', 'Ingresos y gastos', '')}${option('income','Ingresos','')}${option('expense','Gastos','')}</select></label></div>
            <div id="fw-body"></div>
            <div class="fw-footer"><button type="button" class="btn-secondary" data-fw-action="recurring">Gastos e ingresos fijos</button>
            <button type="button" class="btn-secondary" data-fw-action="subscriptions">Suscripciones y avisos</button></div>`;
        this.dialog = document.createElement('dialog');
        this.dialog.className = 'fw-dialog'; this.dialog.id = 'fw-dialog';
        document.body.append(this.dialog);
        this.root.addEventListener('click', event => this.onClick(event).catch(error => this.app.showMessage({ title:'No se pudo completar la acción', message:error.message, tone:'warning' })));
        this.root.querySelector('#fw-month').addEventListener('change', event => {
            if (!event.target.value) return;
            this.month = event.target.value; this.page = 1; this.app.saveUiState?.({ financeMonth: this.month }); this.render();
        });
        this.root.querySelector('#fw-currency').addEventListener('change', event => { this.currency = event.target.value; this.page = 1; this.render(); });
        this.root.querySelector('#fw-search').addEventListener('input', event => { this.query = event.target.value; this.page = 1; this.renderBody(); });
        this.root.querySelector('#fw-type').addEventListener('change', event => { this.type = event.target.value; this.page = 1; this.renderBody(); });
        this.dialog.addEventListener('close', () => this.returnFocus?.isConnected && this.returnFocus.focus());
        this.dialog.addEventListener('click', event => { if (event.target === this.dialog || event.target.closest('[data-fw-close]')) this.dialog.close(); });
        this.dialog.addEventListener('submit', event => { event.preventDefault(); void this.submit(event); });
        this.dialog.addEventListener('change', event => { if (event.target.name === 'currency') this.updateCurrencyFields(); });
    }
    get workspace() { return financeWorkspace(this.finance.data); }
    get movements() { return buildWorkspaceMovements(this.finance.data, this.finance.getCombinedEntries()); }
    money(value, code = this.currency) { return this.app.financialAmountsHidden ? '••••••' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: code }).format(value / 100); }
    category(value, type) { return this.finance.getFinanceRecurringCategoryLabel(type, value); }
    monthly() { return this.movements.filter(item => item.date?.slice(0, 7) === this.month && item.nativeCurrency === this.currency); }
    empty(text, action = '') { return `<div class="fw-empty"><h3>Todavía no hay registros</h3><p>${esc(text)}</p>${action}</div>`; }
    button(action, text, recordId = '') { return `<button type="button" class="btn-secondary" data-fw-action="${action}" data-fw-id="${esc(recordId)}">${esc(text)}</button>`; }
    render() {
        if (!this.root) return;
        this.root.querySelectorAll('[data-fw-tab]').forEach(button => button.setAttribute('aria-current', button.dataset.fwTab === this.tab ? 'page' : 'false'));
        this.root.querySelector('#fw-filters').hidden = this.tab !== 'movements';
        this.renderBody();
    }
    renderBody() {
        const body = this.root.querySelector('#fw-body');
        try {
            if (this.tab === 'summary') body.innerHTML = this.summary();
            else if (this.tab === 'movements') body.innerHTML = this.movementList();
            else if (this.tab === 'budgets') body.innerHTML = this.budgets();
            else body.innerHTML = this.accounts(this.tab === 'cards');
        } catch (error) { body.textContent = `No se modificaron tus datos. ${error.message}`; }
    }
    summary() {
        const list = this.monthly();
        const income = list.filter(item => item.type === 'income').reduce((sum, item) => sum + item.nativeAmountMinor, 0);
        const expense = list.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.nativeAmountMinor, 0);
        const categories = new Map();
        list.filter(item => item.type === 'expense').forEach(item => categories.set(item.category, (categories.get(item.category) || 0) + item.nativeAmountMinor));
        return `<div class="fw-metrics"><article class="fw-metric fw-income"><span>Ingresos del mes</span><strong>${this.money(income)}</strong></article>
            <article class="fw-metric fw-expense"><span>Gastos del mes</span><strong>${this.money(expense)}</strong></article>
            <article class="fw-metric"><span>Balance del mes</span><strong>${this.money(income - expense)}</strong></article></div>
            <div class="fw-columns"><section class="fw-panel"><h3>En qué se fue</h3>${categories.size ? [...categories].sort((a,b) => b[1]-a[1]).map(([key,value]) => `<div class="fw-category"><div><span>${esc(this.category(key,'expense'))}</span><strong>${this.money(value)}</strong></div><progress max="${Math.max(1, expense)}" value="${Math.max(0,value)}" aria-label="${esc(this.category(key,'expense'))}"></progress></div>`).join('') : '<p>Sin gastos en esta moneda y mes.</p>'}</section>
            <section class="fw-panel"><h3>Tu organización</h3><p>Los cobros de Proyectos y los gastos de Suscripciones siguen apareciendo aquí sin duplicarlos.</p><p>${this.workspace.accounts.filter(item=>!item.archived).length} cuentas y tarjetas activas · ${this.workspace.budgets.filter(item=>item.month===this.month).length} presupuestos este mes.</p><p>Sin conexión bancaria ni servicios pagos añadidos.</p></section></div>
            <div class="fw-heading"><h3>Últimos movimientos</h3>${this.button('all-movements','Ver todos')}</div>${list.length ? this.rows(list.slice(0,8)) : this.empty('Registrá tu primer movimiento de este mes y moneda.')}`;
    }
    rows(list) {
        return `<div class="fw-movements">${list.map(item => {
            const account = this.workspace.accounts.find(account => account.id === item.accountId);
            return `<article class="fw-movement"><div><span class="fw-kind ${item.type === 'income' ? 'fw-positive' : 'fw-negative'}">${item.type === 'income' ? '↗ Ingreso' : '↘ Gasto'}</span><h4>${esc(item.description || 'Sin detalle')}</h4>
                <p>${esc(item.date || '')} · ${esc(this.category(item.category,item.type))} · ${esc(item.sourceLabel)} · ${esc(account?.name || 'Sin cuenta asignada')}</p>${item.legacyEquivalent ? '<small>Equivalente USD guardado; moneda original no disponible.</small>' : ''}</div>
                <div class="fw-movement-end"><strong>${this.money(item.nativeAmountMinor,item.nativeCurrency)}</strong><div>${item.editable ? this.button('edit-movement','Editar',item.key) + this.button('delete-movement','Eliminar',item.key) : this.button(item.subscriptionId ? 'subscriptions' : 'projects', 'Ver origen')}</div></div></article>`;
        }).join('')}</div>`;
    }
    movementList() {
        const query = this.query.trim().toLocaleLowerCase();
        const list = this.monthly().filter(item => (!this.type || item.type === this.type) && (!query || `${item.description} ${item.category} ${this.category(item.category,item.type)} ${item.sourceLabel}`.toLocaleLowerCase().includes(query)));
        const pages = Math.max(1, Math.ceil(list.length / 30)); this.page = Math.min(this.page, pages);
        return `<div class="fw-heading"><h3>${list.length} movimientos</h3><span>${esc(this.currency)} · ${esc(this.month)}</span></div>
            ${list.length ? this.rows(list.slice((this.page - 1) * 30, this.page * 30)) : this.empty('No hay coincidencias. Revisá el mes, la moneda y los filtros.')}
            ${pages > 1 ? `<div class="fw-pagination">${this.button('previous','Anterior')}<span>Página ${this.page} de ${pages}</span>${this.button('next','Siguiente')}</div>` : ''}`;
    }
    accounts(credit) {
        const list = this.workspace.accounts.filter(item => (item.kind === 'credit') === credit);
        const movements = this.movements, transfers = this.workspace.transfers;
        return `<div class="fw-heading"><h3>${credit ? 'Tarjetas de crédito' : 'Cuentas y billeteras'}</h3><div>${this.button(credit ? 'new-card' : 'new-account', credit ? 'Nueva tarjeta' : 'Nueva cuenta')}${this.button('transfer', credit ? 'Registrar pago / traspaso' : 'Traspasar')}</div></div>
            <p class="fw-note">${credit ? 'Seguimiento manual: no paga el banco ni genera avisos nuevos. Los días de cierre/vencimiento son orientativos; revisá el resumen real. El pago mueve saldo, no duplica gastos.' : 'Saldo inicial + movimientos asignados + traspasos. Los movimientos sin cuenta no alteran saldos. No se mezclan monedas.'}</p>
            ${list.length ? `<div class="fw-account-grid">${list.map(account => {
                const balance = accountBalanceMinor(account,movements,transfers);
                return `<article class="fw-panel"><div class="fw-heading"><h3>${esc(account.name)}</h3><span>${esc(account.currency)} · ${account.archived ? 'Archivada' : KINDS[account.kind]}</span></div>
                    <p>${credit ? 'Deuda registrada' : 'Saldo calculado'}</p><strong class="fw-balance">${this.money(credit ? Math.max(0,-balance) : balance,account.currency)}</strong>
                    ${credit ? `<p>Disponible: ${this.money(Math.max(0,account.limitMinor+balance),account.currency)}${balance > 0 ? ` · A favor: ${this.money(balance,account.currency)}` : ''}</p><p>Cierre: día ${account.closingDay} · Vence: día ${account.dueDay}</p>` : ''}
                    <div class="fw-actions">${this.button('edit-account','Editar',account.id)}${this.button('archive-account',account.archived?'Reactivar':'Archivar',account.id)}</div></article>`;
            }).join('')}</div>` : this.empty(credit ? 'Agregá una tarjeta para registrar consumos y pagos sin duplicar gastos.' : 'Creá una cuenta en ARS o USD y su saldo inicial. No se asignará historial automáticamente.')}
            <h3>Traspasos y pagos registrados</h3><p class="fw-note">Se muestran los últimos 20. No forman parte de ingresos ni gastos.</p>
            ${transfers.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(item => `<div class="fw-transfer"><span>${esc(item.date)} · ${esc(this.workspace.accounts.find(a=>a.id===item.fromId)?.name)} → ${esc(this.workspace.accounts.find(a=>a.id===item.toId)?.name)} · ${esc(item.description || '')}</span><strong>${this.money(item.amountMinor,item.currency)}</strong>${item.voidedAt ? '<span>Anulado · sin efecto en saldos</span>' : this.button('void-transfer','Anular',item.id)}</div>`).join('') || '<p>Sin traspasos registrados.</p>'}`;
    }
    budgets() {
        const list = this.workspace.budgets.filter(item => item.month === this.month && item.currency === this.currency);
        return `<div class="fw-heading"><h3>Presupuestos por categoría</h3>${this.button('new-budget','Nuevo presupuesto')}</div><p class="fw-note">Límites mensuales fijos. Cada presupuesto usa sólo los gastos de su misma categoría y moneda; no convierte movimientos automáticamente.</p>
            ${list.length ? `<div class="fw-account-grid">${list.map(item => {
                const used = budgetSpentMinor(item,this.movements), remaining = item.limitMinor - used;
                return `<article class="fw-panel"><h3>${esc(this.category(item.category,'expense'))}</h3><p>${this.money(used)} de ${this.money(item.limitMinor)}</p><progress value="${Math.max(0,used)}" max="${Math.max(item.limitMinor,used,1)}" aria-label="Consumo del presupuesto"></progress><p class="${remaining < 0 ? 'fw-negative' : 'fw-positive'}">${remaining < 0 ? 'Excedido por' : 'Disponible'} ${this.money(Math.abs(remaining))}</p>${this.button('edit-budget','Editar',item.id)}${this.button('delete-budget','Eliminar límite',item.id)}</article>`;
            }).join('')}</div>` : this.empty('Definí cuánto querés gastar por categoría en este mes. No borra ni limita tus movimientos.')}`;
    }
    async onClick(event) {
        const tab = event.target.closest('[data-fw-tab]');
        if (tab) { this.tab = tab.dataset.fwTab; this.render(); return; }
        const button = event.target.closest('[data-fw-action]'); if (!button) return;
        const action = button.dataset.fwAction, recordId = button.dataset.fwId;
        if (action === 'privacy') { this.app.setFinancialAmountsHidden(!this.app.isFinancialAmountsHidden()); return; }
        if (action === 'all-movements') { this.tab = 'movements'; this.render(); return; }
        if (action === 'previous' || action === 'next') { this.page = Math.max(1,this.page+(action==='next'?1:-1)); this.renderBody(); return; }
        if (action === 'recurring') { this.finance.openFinanceRecurringModal(button); return; }
        if (action === 'subscriptions' || action === 'projects') { this.app.activateSection(action==='subscriptions'?'suscripciones-section':'projects-section'); return; }
        if (action === 'void-transfer') {
            const ownerId = this.app.auth?.readyUserId;
            const confirmed = await this.app.confirmAction({ title:'Anular traspaso / pago', message:'Se conserva el registro, pero deja de afectar los saldos. No revierte ningún pago real en tu banco.', confirmLabel:'Anular registro', tone:'warning' });
            if (confirmed && ownerId && ownerId === this.app.auth?.readyUserId) this.saveWorkspace({ ...this.workspace, transfers:this.workspace.transfers.map(item=>item.id===recordId&&!item.voidedAt?{...item,voidedAt:new Date().toISOString()}:item) });
            return;
        }
        if (action === 'archive-account') {
            const account = this.workspace.accounts.find(item=>item.id===recordId); if (!account) return;
            const updated = { ...this.workspace, accounts: this.workspace.accounts.map(item=>item.id===recordId?{...item,archived:!item.archived}:item) };
            this.saveWorkspace(updated); return;
        }
        if (action === 'delete-movement') {
            const item = this.movements.find(item=>item.key===recordId); if (!item?.editable) return;
            if (item.type === 'income') await this.finance.deleteEntry(item.id); else await this.finance.deleteExpense(item.id);
            return;
        }
        if (action === 'delete-budget') {
            const confirmed = await this.app.confirmAction({ title:'Eliminar presupuesto', message:'Se elimina sólo el límite de esta categoría y mes. Tus gastos se conservan.', confirmLabel:'Eliminar límite', tone:'warning' });
            if (confirmed) this.saveWorkspace({ ...this.workspace, budgets: this.workspace.budgets.filter(item=>item.id!==recordId) });
            return;
        }
        this.open(action,recordId,button);
    }
    field(name,label,type='text',value='',extra='') { return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`; }
    select(name,label,options) { return `<label>${esc(label)}<select name="${name}">${options}</select></label>`; }
    open(action,recordId,button) {
        let title, fields = '', kind = action, existing = null;
        this.returnFocus = button;
        const ws = this.workspace;
        if (action === 'new-movement' || action === 'edit-movement') {
            kind = 'movement'; existing = this.movements.find(item=>item.key===recordId);
            if (action === 'edit-movement' && !existing?.editable) return;
            title = existing ? 'Editar movimiento' : 'Nuevo movimiento';
            fields = this.select('type','Tipo',option('income','Ingreso',existing?.type||'expense')+option('expense','Gasto',existing?.type||'expense'))
                + this.field('description','Detalle','text',existing?.description||'','required maxlength="300"')
                + this.field('category','Categoría','text',existing?.category||'','required maxlength="80" list="fw-categories"')
                + `<datalist id="fw-categories">${[...new Set(['servicios','comida','transporte','salud','ocio','extraordinary',...this.movements.map(item=>item.category)])].map(value=>`<option value="${esc(value)}">${esc(this.category(value,'expense'))}</option>`).join('')}</datalist>`
                + this.field('date','Fecha','date',existing?.date||getLocalISODate(),'required')
                + this.select('currency','Moneda original',option('USD','USD',existing?.nativeCurrency||this.currency)+option('ARS','ARS',existing?.nativeCurrency||this.currency))
                + this.field('amount','Importe original','number',existing?existing.nativeAmountMinor/100:'','required min="0.01" step="0.01"')
                + `<div id="fw-rate-field">${this.field('rate','Cotización usada: ARS por 1 USD','number',existing?.exchangeRate||this.app.getValidCachedLemonRate?.()||'','min="0.000001" max="1000000" step="any"')}<small>Para una fecha pasada, indicá su cotización. No consultamos ni inventamos la histórica.</small></div>`
                + this.select('accountId','Cuenta / tarjeta','');
            if (existing?.legacyEquivalent) fields += '<p class="fw-note">Este registro sólo guardaba un equivalente USD. No recuperamos la moneda original; revisá el importe antes de cambiarla.</p>';
        } else if (['new-account','new-card','edit-account'].includes(action)) {
            kind = 'account'; existing = ws.accounts.find(item=>item.id===recordId);
            const credit = action === 'new-card' || existing?.kind === 'credit';
            title = existing ? 'Editar cuenta / tarjeta' : credit ? 'Nueva tarjeta' : 'Nueva cuenta';
            fields = this.field('name','Nombre','text',existing?.name||'','required maxlength="100"')
                + this.select('kind','Tipo',Object.entries(KINDS).filter(([key])=>credit?key==='credit':key!=='credit').map(([key,label])=>option(key,label,existing?.kind||'bank')).join(''))
                + this.select('currency','Moneda',option('ARS','ARS',existing?.currency||this.currency)+option('USD','USD',existing?.currency||this.currency))
                + this.field('opening',credit?'Deuda inicial (antes de consumos registrados)':'Saldo inicial (antes de movimientos asignados)','number',existing?(credit?-existing.openingMinor:existing.openingMinor)/100:0,'required step="0.01"')
                + (credit ? this.field('limit','Límite de crédito','number',existing?existing.limitMinor/100:0,'required min="0" step="0.01"') + this.field('closingDay','Día de cierre','number',existing?.closingDay||1,'required min="1" max="31"') + this.field('dueDay','Día de vencimiento','number',existing?.dueDay||10,'required min="1" max="31"') : '')
                + '<p class="fw-note">No se importan ni asignan movimientos anteriores automáticamente. Archivar conserva todo el historial.</p>';
        } else if (action === 'transfer') {
            title='Traspaso / pago de tarjeta';
            const options = ws.accounts.filter(item=>!item.archived).map(item=>option(item.id,`${item.name} · ${item.currency}`,null)).join('');
            fields = this.select('fromId','Desde',options)+this.select('toId','Hacia',options)
                +this.field('amount','Importe (misma moneda)','number','','required min="0.01" step="0.01"')
                +this.field('date','Fecha','date',getLocalISODate(),'required')+this.field('description','Detalle','text','','maxlength="300"')
                +'<p class="fw-note">Sólo registra saldos en LifeCycle. No transfiere dinero ni paga el banco. No genera otro gasto.</p>';
        } else if (action === 'new-budget' || action === 'edit-budget') {
            kind='budget'; existing=ws.budgets.find(item=>item.id===recordId); title=existing?'Editar presupuesto':'Nuevo presupuesto';
            fields=this.field('category','Categoría (igual a la de tus gastos)','text',existing?.category||'','required maxlength="80"')
                +this.field('month','Mes','month',existing?.month||this.month,'required')
                +this.select('currency','Moneda',option('USD','USD',existing?.currency||this.currency)+option('ARS','ARS',existing?.currency||this.currency))
                +this.field('amount','Límite mensual','number',existing?existing.limitMinor/100:'','required min="0.01" step="0.01"');
        } else return;
        this.editing = { kind, recordId, existing, fingerprint: this.fingerprint(kind,recordId), ownerId: this.app.auth?.readyUserId };
        this.dialog.innerHTML = `<form><div class="fw-heading"><h2 id="fw-dialog-title">${title}</h2><button type="button" data-fw-close aria-label="Cerrar">✕</button></div><div class="fw-form-grid">${fields}</div><p id="fw-form-error" role="alert"></p><div class="fw-actions"><button type="button" class="btn-secondary" data-fw-close>Cancelar</button><button type="submit" class="btn-primary">Guardar</button></div></form>`;
        this.dialog.setAttribute('aria-labelledby','fw-dialog-title');
        if (kind==='account' && existing) { this.dialog.querySelector('[name=kind]').disabled=true; this.dialog.querySelector('[name=currency]').disabled=true; }
        if (kind==='movement') { this.updateCurrencyFields(existing?.accountId); if(existing) this.dialog.querySelector('[name=type]').disabled=true; }
        this.dialog.showModal();
    }
    fingerprint(kind,recordId) {
        if (!recordId) return null;
        const item = kind==='movement' ? this.movements.find(item=>item.key===recordId) : kind==='account' ? this.workspace.accounts.find(item=>item.id===recordId) : this.workspace.budgets.find(item=>item.id===recordId);
        return JSON.stringify(item);
    }
    updateCurrencyFields(selectedAccount) {
        if(this.editing?.kind!=='movement') return;
        const code=this.dialog.querySelector('[name=currency]').value, select=this.dialog.querySelector('[name=accountId]');
        const selected=selectedAccount??select.value;
        select.innerHTML=option('','Sin cuenta asignada',selected)+this.workspace.accounts.filter(item=>(!item.archived||item.id===this.editing.existing?.accountId)&&item.currency===code).map(item=>option(item.id,`${item.name}${item.archived?' (archivada)':''}`,selected)).join('');
        this.dialog.querySelector('#fw-rate-field').hidden=code==='USD';
        this.dialog.querySelector('[name=rate]').required=code==='ARS';
    }
    saveWorkspace(workspace) {
        validateFinanceWorkspace(workspace);
        const previous=this.finance.data;
        this.finance.data={...previous,workspace};
        try { this.finance.saveData(); } catch(error) { this.finance.data=previous; throw error; }
        this.finance.render();
    }
    async submit(event) {
        const button=event.target.querySelector('[type=submit]'); button.disabled=true;
        try {
            const {kind,recordId,existing,fingerprint}=this.editing;
            if (!this.editing.ownerId || this.editing.ownerId !== this.app.auth?.readyUserId) throw new Error('La sesión cambió. Volvé a ingresar antes de guardar.');
            if(recordId && fingerprint!==this.fingerprint(kind,recordId)) throw new Error('Este registro cambió en otra pestaña o dispositivo. Cerrá el editor y abrilo de nuevo.');
            const input=Object.fromEntries(new FormData(event.target));
            const ws=this.workspace;
            if(kind==='account') {
                if(existing) { input.currency=existing.currency; input.kind=existing.kind; }
                const item=buildFinanceAccount(input,existing);
                this.saveWorkspace({...ws,accounts:existing?ws.accounts.map(value=>value.id===item.id?item:value):[...ws.accounts,item]});
            } else if(kind==='budget') {
                const item=buildFinanceBudget(input,ws,existing?.id);
                this.saveWorkspace({...ws,budgets:existing?ws.budgets.map(value=>value.id===item.id?item:value):[...ws.budgets,item]});
            } else if(kind==='transfer') {
                if(!this.finance.getFinanceResourceCapacity(RESOURCE_KEYS.FINANCE_TRANSACTIONS)) return;
                this.saveWorkspace({...ws,transfers:[...ws.transfers,buildFinanceTransfer(input,ws)]});
            } else {
                if(existing) input.type=existing.type;
                const collection=input.type==='income'?'entries':'expenses';
                const original=existing?this.finance.data[collection].find(item=>String(item.id)===String(existing.id)):null;
                if(!existing&&!this.finance.getFinanceResourceCapacity(RESOURCE_KEYS.FINANCE_TRANSACTIONS)) return;
                const item=buildFinanceMovement(input,ws,original);
                const previous=this.finance.data;
                this.finance.data={...previous,[collection]:existing?previous[collection].map(value=>String(value.id)===String(item.id)?item:value):[...previous[collection],item]};
                try { this.finance.saveData(); } catch(error) { this.finance.data=previous; throw error; }
                this.finance.render();
            }
            this.dialog.close(); this.app.showToast?.('Guardado en LifeCycle. Revisá el indicador de sincronización.');
        } catch(error) { this.dialog.querySelector('#fw-form-error').textContent=error.message; }
        finally { button.disabled=false; }
    }
}
