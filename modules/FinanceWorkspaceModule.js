import { escapeHtml as esc } from '../text-utils.mjs';
import { getLocalISODate, getLocalISOMonth } from '../utils.js';
import { RESOURCE_KEYS } from '../resource-policy.mjs';
import { financeWorkScope, WORK_SCOPES } from '../work-utils.mjs';
import { financeWorkspace, buildFinanceAccount, buildFinanceMovement, buildFinanceTransfer,
    buildFinanceBudget, buildWorkspaceMovements, accountBalanceMinor, budgetSpentMinor,
    validateFinanceWorkspace, buildFinanceReceipt, buildOriginalConfirmation, confirmUsdOriginals, financeSourceFingerprint } from '../finance-workspace-utils.mjs';
import { reportMinor, summarizeCurrency, currentBalanceValue, suggestedReceiptRate, financeValuationMode, estimatedFinanceValue } from '../finance-currency-utils.mjs';
import { monthlyIncomeSeries } from '../finance-income-chart.mjs';

const TABS = { summary: 'Resumen', movements: 'Movimientos', accounts: 'Cuentas', budgets: 'Presupuestos', cards: 'Tarjetas' };
const KINDS = { cash: 'Efectivo', bank: 'Banco', wallet: 'Billetera', credit: 'Crédito' };
const option = (value, label, selected) => `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;

export class FinanceWorkspaceModule {
    constructor(finance) {
        this.finance = finance; this.app = finance.app;
        this.root = document.getElementById('finance-workspace');
        if (!this.root) return;
        this.tab = 'summary'; this.month = this.app.uiState?.financeMonth || getLocalISOMonth();
        this.query = ''; this.type = ''; this.page = 1; this.scope = 'all'; this.originalCurrency = 'all';
        this.chartSource='all'; this.chartMonth=this.month;
        this.root.innerHTML = `
            <div class="fw-toolbar"><div><span class="fw-eyebrow">TU DINERO, EN ORDEN</span><h2>Finanzas</h2></div>
            <button type="button" class="btn-primary" data-fw-action="new-movement">＋ Nuevo movimiento</button></div>
            <div class="fw-controls"><label>Mes <input id="fw-month" type="month" value="${esc(this.month)}"></label>
            <label>Mostrar totales en <select id="fw-currency">${option('USD','USD',this.currency)}${option('ARS','ARS',this.currency)}</select></label>
            <label>Cotización <select id="fw-valuation">${option('current','Actual · automática',this.valuationMode)}${option('historical','De cada cobro · histórico',this.valuationMode)}</select></label>
            <label>Moneda original <select id="fw-original">${option('all','Todas','all')}${option('USD','USD','all')}${option('ARS','ARS','all')}${option('unknown','Original no registrada','all')}</select></label>
            <label>Ámbito <select id="fw-scope">${Object.entries(WORK_SCOPES).map(([key,label])=>option(key,label,'all')).join('')}</select></label>
            <button type="button" class="financial-privacy-toggle" data-fw-action="privacy">Mostrar / ocultar montos</button></div>
            <nav class="fw-tabs" aria-label="Secciones de Finanzas">${Object.entries(TABS).map(([key, label]) => `<button type="button" data-fw-tab="${key}">${label}</button>`).join('')}</nav>
            <p id="fw-report-note" class="fw-note"></p>
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
        this.root.querySelector('#fw-currency').addEventListener('change', event => { this.page = 1; this.app.setPreferredCurrency(event.target.value); });
        this.root.querySelector('#fw-valuation').addEventListener('change', event => {
            localStorage.setItem('finance_valuation_mode', financeValuationMode(event.target.value));
            this.page = 1; this.app.refreshFinancialViews();
        });
        this.root.querySelector('#fw-original').addEventListener('change', event => { this.originalCurrency = event.target.value; this.page = 1; this.render(); });
        this.root.querySelector('#fw-scope').addEventListener('change', event => { this.scope=event.target.value;this.page=1;this.render(); });
        this.root.querySelector('#fw-search').addEventListener('input', event => { this.query = event.target.value; this.page = 1; this.renderBody(); });
        this.root.querySelector('#fw-type').addEventListener('change', event => { this.type = event.target.value; this.page = 1; this.renderBody(); });
        this.root.addEventListener('change',event=>{
            if(event.target.id==='fw-income-source'){this.chartSource=event.target.value;this.renderBody();}
            if(event.target.id==='fw-income-month')this.selectIncomeMonth(event.target.value);
        });
        this.root.addEventListener('keydown',event=>{
            const point=event.target.closest('[data-income-month]');
            if(point&&['Enter',' '].includes(event.key)){event.preventDefault();this.selectIncomeMonth(point.dataset.incomeMonth);}
        });
        this.dialog.addEventListener('close', () => this.returnFocus?.isConnected && this.returnFocus.focus());
        this.dialog.addEventListener('click', event => { if (event.target === this.dialog || event.target.closest('[data-fw-close]')) this.dialog.close(); });
        this.dialog.addEventListener('submit', event => { event.preventDefault(); void this.submit(event); });
        this.dialog.addEventListener('change', event => {
            if(this.editing?.kind==='original') { if(event.target.name==='currency') this.updateOriginalFields(); return; }
            if(this.editing?.kind==='confirm-usd') { this.updateUsdSelection(); return; }
            if (event.target.name === 'currency') this.updateCurrencyFields();
            if (event.target.name === 'date') this.updateReceiptDate();
            if (['fromId','toId'].includes(event.target.name)) this.updateTransferFields();
        });
        this.dialog.addEventListener('click',event=>{
            if(event.target.closest('[data-select-usd]')) { this.dialog.querySelectorAll('[name=originalKeys]').forEach(input=>input.checked=true); this.updateUsdSelection(); }
        });
    }
    get currency() { return localStorage.getItem('preferred_currency') === 'ARS' ? 'ARS' : 'USD'; }
    get valuationMode() { return financeValuationMode(localStorage.getItem('finance_valuation_mode')); }
    get reportOptions() { return { mode:this.valuationMode, rate:this.app.getCachedExchangeRate?.()?.rate }; }
    get reportBasis() { return this.valuationMode === 'current' ? 'equivalente actual' : 'histórico'; }
    get missingQuote() { return this.valuationMode === 'current' ? 'cotización actual disponible' : 'cotización histórica ARS'; }
    get workspace() { return financeWorkspace(this.finance.data); }
    get movements() { return buildWorkspaceMovements({ ...this.finance.data, expenses: this.finance.getCombinedExpenses() }, this.finance.getCombinedEntries()); }
    money(value, code = this.currency) {
        if(this.app.financialAmountsHidden)return '••••••';
        return (code==='ARS'?'ARS ':'')+new Intl.NumberFormat('es-AR', { style: 'currency', currency: code }).format(value / 100);
    }
    category(value, type) { return this.finance.getFinanceRecurringCategoryLabel(type, value); }
    scopeOf(item) { return financeWorkScope(item,this.app.work?.store?.state?.settings?.financeScopes||{}); }
    scopedMovements() { return this.movements.filter(item => (this.originalCurrency === 'all' || (this.originalCurrency === 'unknown' ? item.legacyEquivalent : !item.legacyEquivalent && item.nativeCurrency === this.originalCurrency))
        && (this.scope==='all'||this.scopeOf(item)===this.scope)); }
    monthly() { return this.scopedMovements().filter(item=>item.date?.slice(0,7)===this.month); }
    empty(text, action = '') { return `<div class="fw-empty"><h3>Todavía no hay registros</h3><p>${esc(text)}</p>${action}</div>`; }
    button(action, text, recordId = '') { return `<button type="button" class="btn-secondary" data-fw-action="${action}" data-fw-id="${esc(recordId)}">${esc(text)}</button>`; }
    render() {
        if (!this.root) return;
        this.root.querySelectorAll('[data-fw-tab]').forEach(button => button.setAttribute('aria-current', button.dataset.fwTab === this.tab ? 'page' : 'false'));
        this.root.querySelector('#fw-filters').hidden = this.tab !== 'movements';
        this.root.querySelector('#fw-currency').value = this.currency;
        this.root.querySelector('#fw-valuation').value = this.valuationMode;
        this.root.querySelector('#fw-valuation').disabled = !['summary','movements'].includes(this.tab);
        this.root.querySelector('#fw-scope').disabled = !['summary','movements'].includes(this.tab);
        this.root.querySelector('#fw-original').disabled = !['summary','movements'].includes(this.tab);
        this.renderBody();
        // The existing quote service/cache is shared with Projects. No polling or
        // bank integration is introduced; failures leave an explicit unavailable state.
        if (this.root.offsetParent && !this.app.getCachedExchangeRate?.()?.isFresh && Date.now() - (this.rateRequestedAt || 0) > 60_000) {
            this.rateRequestedAt = Date.now();
            void this.app.fetchLemonRate?.().then(() => this.renderBody()).catch(() => {});
        }
    }
    renderBody() {
        const body = this.root.querySelector('#fw-body');
        const report = ['summary','movements'].includes(this.tab);
        this.root.querySelector('#fw-report-note').innerHTML = !report ? '' : this.valuationMode === 'current'
            ? `Conversión automática al cambio de referencia actual, también para cobros antiguos. No es la cotización de la fecha del cobro. Cambiar la vista no modifica tus registros ni representa dinero que aún conservás.<br><small>${this.rateLabel(this.app.getCachedExchangeRate?.())}</small>`
            : 'El histórico usa la cotización guardada de cada cobro o gasto. Si falta, podés completarla desde Movimientos o volver a la vista Actual · automática. El saldo de cuentas siempre usa la referencia actual.';
        try {
            if (this.tab === 'summary') body.innerHTML = this.summary();
            else if (this.tab === 'movements') body.innerHTML = this.movementList();
            else if (this.tab === 'budgets') body.innerHTML = this.budgets();
            else body.innerHTML = this.accounts(this.tab === 'cards');
        } catch (error) { body.textContent = `No se modificaron tus datos. ${error.message}`; }
    }
    summary() {
        const list = this.monthly();
        const options = this.reportOptions;
        const income = summarizeCurrency(list.filter(item => item.type === 'income'), this.currency, options);
        const expense = summarizeCurrency(list.filter(item => item.type === 'expense'), this.currency, options);
        const categories = new Map();
        const estimatedCategories = new Set(list.filter(item=>item.type==='expense'&&estimatedFinanceValue(item,this.currency,this.valuationMode)).map(item=>item.category));
        list.filter(item => item.type === 'expense').forEach(item => { const value = reportMinor(item,this.currency,options); if(value!==null) categories.set(item.category, (categories.get(item.category) || 0) + value); });
        const incomplete = income.missingCount + expense.missingCount;
        const metric = (label, report, css) => `<article class="fw-metric ${css}"><span>${label} · ${this.reportBasis}${report.estimatedCount?' · incluye estimados':''}</span><strong>${report.estimatedCount?'≈ ':''}${report.missingCount && !report.totalMinor ? `${this.money(report.missingUsd*100,'USD')} eq. guardado` : `${report.missingCount?'Subtotal: ':''}${this.money(report.totalMinor)}`}</strong>${report.missingCount ? `<small class="fw-warning">${report.missingCount} sin ${this.missingQuote}. El equivalente USD guardado se conserva.</small>` : ''}<small>${this.originalBreakdown(report)}</small>${report.estimatedCount?'<small class="fw-warning">Estimados basados en equivalentes USD anteriores; revisá los importes originales en Movimientos.</small>':''}</article>`;
        return `<div class="fw-metrics">${metric('Ingresos del mes',income,'fw-income')}${metric('Gastos del mes',expense,'fw-expense')}
            <article class="fw-metric"><span>Resultado del mes · ${this.reportBasis}${income.estimatedCount+expense.estimatedCount?' · incluye estimados':''}</span><strong>${incomplete ? 'Pendiente de cotización' : `${income.estimatedCount+expense.estimatedCount?'≈ ':''}${this.money(income.totalMinor-expense.totalMinor)}`}</strong><small>${incomplete ? `Subtotal conocido: ${this.money(income.totalMinor-expense.totalMinor)}. Faltan cotizaciones.` : 'Ingresos menos gastos del período; no es tu saldo actual.'}</small></article></div>
            ${incomplete ? `<p class="fw-warning" role="status">El total en ${esc(this.currency)} está incompleto. ${this.valuationMode === 'current' ? 'Falta la referencia actual; se actualizará automáticamente al estar disponible.' : 'Podés completar la cotización de cada registro desde Movimientos o elegir Actual · automática.'} Los equivalentes USD guardados se conservan.</p>` : ''}
            ${this.balanceSummary()}
            ${this.incomeChart()}
            <div class="fw-columns"><section class="fw-panel"><h3>En qué se fue</h3>${expense.missingCount ? '<p class="fw-warning">Sólo gastos convertibles con la cotización elegida.</p>' : ''}${categories.size ? [...categories].sort((a,b) => b[1]-a[1]).map(([key,value]) => `<div class="fw-category"><div><span>${esc(this.category(key,'expense'))}${estimatedCategories.has(key)?' · incluye estimados':''}</span><strong>${estimatedCategories.has(key)?'≈ ':''}${this.money(Math.round(value))}</strong></div><progress max="${Math.max(1, expense.totalMinor)}" value="${Math.max(0,value)}" aria-label="${esc(this.category(key,'expense'))}"></progress></div>`).join('') : '<p>Sin gastos convertibles con estos filtros.</p>'}</section>
            <section class="fw-panel"><h3>Tu organización</h3><p>Los cobros de Proyectos y los gastos de Suscripciones siguen apareciendo aquí sin duplicarlos.</p><p>${this.workspace.accounts.filter(item=>!item.archived).length} cuentas y tarjetas activas · ${this.workspace.budgets.filter(item=>item.month===this.month).length} presupuestos este mes.</p><p>Sin conexión bancaria ni servicios pagos añadidos.</p></section></div>
            ${this.app.work?.retainers?.pending(this.app.work.store.state)||''}<div class="fw-heading"><h3>Últimos movimientos</h3>${this.button('all-movements','Ver todos')}</div>${list.length ? this.rows(list.slice(0,8)) : this.empty('Registrá tu primer movimiento de este mes y moneda.')}`;
    }
    originalBreakdown(report) {
        const parts = ['USD','ARS'].filter(code => report.originals[code] !== 0).map(code => this.money(report.originals[code],code));
        if (report.legacyCount) parts.push(`${this.money(report.legacyUsd*100,'USD')} estimado · original no registrada (${report.legacyCount})`);
        return parts.length ? `Original: ${parts.join(' + ')}` : 'Sin movimientos.';
    }
    incomeMonthLabel(month) { return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}); }
    incomePointLabel(row) {
        return `${this.incomeMonthLabel(row.month)}: ${row.missingCount?`pendiente de cotización; subtotal ${this.money(row.totalMinor)}`:`${row.estimatedCount?'≈ ':''}${this.money(row.totalMinor)}`}. ${row.count?`${row.count} ingresos registrados`:'Sin ingresos registrados'}.${row.estimatedCount?' Incluye estimados.':''}`;
    }
    selectIncomeMonth(month) {
        const row=this.incomeChartData?.find(item=>item.month===month);if(!row)return;
        this.chartMonth=month;
        this.root.querySelector('#fw-income-month').value=month;
        this.root.querySelector('#fw-income-detail').textContent=this.incomePointLabel(row);
        this.root.querySelectorAll('[data-income-month]').forEach(point=>point.setAttribute('aria-pressed',String(point.dataset.incomeMonth===month)));
    }
    incomeChart() {
        const header='<div class="fw-heading"><h3>Evolución de ingresos</h3><span>12 meses · '+esc(this.currency)+' · '+this.reportBasis+'</span></div>';
        if(this.app.financialAmountsHidden)return `<section id="fw-income-chart" class="fw-panel">${header}<p>Montos ocultos. Mostralos para ver el gráfico.</p></section>`;
        const rows=monthlyIncomeSeries(this.scopedMovements(),this.month,this.currency,this.reportOptions,this.chartSource);
        this.incomeChartData=rows;
        if(!rows.some(row=>row.month===this.chartMonth))this.chartMonth=this.month;
        const selected=rows.find(row=>row.month===this.chartMonth);
        const small=this.root.clientWidth<550,w=small?360:720,h=220,left=58,right=w-18,top=24,bottom=176;
        const max=Math.max(1,...rows.map(row=>row.plotMinor||0)),x=i=>left+i*(right-left)/11,y=value=>bottom-value/max*(bottom-top);
        const compact=new Intl.NumberFormat('es-AR',{notation:'compact',maximumFractionDigits:1});
        const grid=[0,.5,1].map(ratio=>`<line x1="${left}" y1="${y(max*ratio)}" x2="${right}" y2="${y(max*ratio)}" class="fw-chart-grid"/><text x="${left-8}" y="${y(max*ratio)+4}" text-anchor="end">${esc(compact.format(max*ratio/100))}</text>`).join('');
        const segments=[];let points=[];
        rows.forEach((row,i)=>{if(row.plotMinor===null){if(points.length)segments.push(points.join(' '));points=[];}else points.push(`${x(i)},${y(row.plotMinor)}`);});if(points.length)segments.push(points.join(' '));
        const dots=rows.map((row,i)=>`<g role="button" tabindex="0" data-income-month="${row.month}" aria-pressed="${row.month===this.chartMonth}" aria-label="${esc(this.incomePointLabel(row))}"><title>${esc(this.incomePointLabel(row))}</title><rect x="${x(i)-10}" y="${(row.plotMinor===null?bottom:y(row.plotMinor))-12}" width="20" height="24" fill="transparent"/>${row.plotMinor===null?`<text x="${x(i)}" y="${bottom-8}" text-anchor="middle">?</text>`:`<circle cx="${x(i)}" cy="${y(row.plotMinor)}" r="${row.count?5:3}" class="${row.estimatedCount?'fw-chart-estimated':'fw-chart-point'}"/>`}</g>${!small||i%3===0||i===11?`<text x="${x(i)}" y="${bottom+26}" text-anchor="middle">${esc(new Date(`${row.month}-01T12:00:00Z`).toLocaleDateString('es-AR',{month:'short',year:'2-digit',timeZone:'UTC'}))}</text>`:''}`).join('');
        const hasData=rows.some(row=>row.count);
        return `<section id="fw-income-chart" class="fw-panel">${header}<p class="fw-note">Todos los ingresos registrados: software, clientes, Trading y otras fuentes. Hasta ${esc(this.incomeMonthLabel(this.month))}; respeta los filtros de ámbito y moneda original.</p>
            <div class="fw-controls"><label>Origen del gráfico<select id="fw-income-source">${option('all','Todos los ingresos',this.chartSource)}${option('software','Software y clientes',this.chartSource)}${option('trading','Trading',this.chartSource)}${option('other','Otros ingresos',this.chartSource)}</select></label></div>
            ${hasData?`<svg viewBox="0 0 ${w} ${h}" class="fw-income-svg" aria-label="Evolución mensual de ingresos en ${this.currency}">${grid}${segments.map(points=>`<polyline points="${points}" class="fw-chart-line"/>`).join('')}${dots}</svg>`:'<p>No hay ingresos registrados en estos 12 meses con los filtros elegidos.</p>'}
            <p class="fw-note">Tocá un punto para ver el importe. Punto hueco y ≈: incluye estimados. ?: falta cotización; la línea se interrumpe. Los meses vacíos representan ausencia de registros.</p>
            <label>Detalle mensual<select id="fw-income-month">${rows.map(row=>option(row.month,this.incomeMonthLabel(row.month),this.chartMonth)).join('')}</select></label><p id="fw-income-detail" aria-live="polite">${esc(this.incomePointLabel(selected))}</p>
            <details><summary>Ver importes por mes</summary><div class="fw-chart-table"><table><caption>Ingresos registrados por mes · ${this.currency} · ${this.reportBasis}</caption><thead><tr><th>Mes</th><th>Ingresos</th><th>Registros</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${esc(this.incomeMonthLabel(row.month))}</th><td>${row.missingCount?`Pendiente · subtotal ${this.money(row.totalMinor)}`:`${row.estimatedCount?'≈ ':''}${this.money(row.totalMinor)}`}</td><td>${row.count}</td></tr>`).join('')}</tbody></table></div></details></section>`;
    }
    balanceSummary() {
        const accounts = this.workspace.accounts;
        if (!accounts.length) return '<p class="fw-note">El resultado del mes no indica cuánto dinero conservás. Si querés ver tu saldo actual, podés agregar cuentas con sus saldos en Cuentas. Es opcional.</p>';
        const cache = this.app.getCachedExchangeRate?.();
        const balances = accounts.map(account => ({ currency:account.currency, balance:accountBalanceMinor(account,this.movements,this.workspace.transfers,getLocalISODate()) }));
        const value = currentBalanceValue(balances,this.currency,cache?.rate);
        return `<section class="fw-panel fw-current-balance"><div class="fw-heading"><h3>Saldo neto de cuentas · ${cache?.isFresh ? 'al cambio actual' : 'última cotización disponible'}</h3>${this.button('refresh-rate','Actualizar cotización')}</div>
            <strong class="fw-balance">${value.totalMinor === null ? 'Cotización no disponible' : this.money(value.totalMinor)}</strong>
            <p>${this.money(value.originals.USD,'USD')} + ${this.money(value.originals.ARS,'ARS')}</p>
            <p class="fw-note">Todas las cuentas registradas, incluidas archivadas y deudas de tarjetas, hasta hoy. No depende del mes ni de los filtros; excluye movimientos futuros. Sólo refleja lo que registraste; no consulta tus bancos.</p>
            <small>${this.rateLabel(cache)}</small></section>`;
    }
    rateLabel(cache) {
        if (!cache) return 'Sin cotización actual. Los importes originales se conservan.';
        const sources = { 'criptoya-lemon':'Lemon vía CriptoYa', 'dolarapi-cripto':'Dólar cripto vía DolarApi' };
        return `${this.app.financialAmountsHidden ? 'Cotización oculta' : `1 USD = ${this.money(cache.rate*100,'ARS')}`} · ${esc(sources[cache.source] || 'Cotización guardada')} · ${esc(new Date(cache.timestamp).toLocaleString('es-AR'))}${cache.isFresh ? '' : ' · pendiente de actualización'}. Es una referencia, no una operación de cambio.`;
    }
    rows(list) {
        return `<div class="fw-movements">${list.map(item => {
            const account = this.workspace.accounts.find(account => account.id === item.accountId);
            const value = reportMinor(item,this.currency,this.reportOptions);
            return `<article class="fw-movement"><div><span class="fw-kind ${item.type === 'income' ? 'fw-positive' : 'fw-negative'}">${item.type === 'income' ? '↗ Ingreso' : '↘ Gasto'}</span><h4>${esc(item.description || 'Sin detalle')}</h4>
                <p>${esc(item.date || '')} · ${esc(this.category(item.category,item.type))} · ${esc(item.sourceLabel)} · ${esc(account?.name || 'Sin cuenta asignada')}</p>${item.legacyEquivalent ? '<small class="fw-warning">Estimado · moneda original pendiente de confirmar.</small>' : item.originalConfirmedAt ? `<small>Importe original confirmado. Referencia anterior: ${this.money(item.amount*100,'USD')} equivalente guardado.${item.rateSource==='saved-equivalent'?' La equivalencia anterior no acredita una cotización histórica.':''}</small>` : ''}</div>
                <div class="fw-movement-end"><strong>${item.legacyEquivalent?'≈ ':''}${this.money(item.nativeAmountMinor,item.nativeCurrency)}${item.legacyEquivalent ? ' eq.' : ''}</strong><small>${value === null ? `Sin ${this.missingQuote}` : `${estimatedFinanceValue(item,this.currency,this.valuationMode)?'≈ ':''}${this.money(Math.round(value))} · ${this.reportBasis}`}</small><small>${WORK_SCOPES[this.scopeOf(item)]}</small><div>${item.legacyEquivalent||item.originalConfirmedAt?this.button('confirm-original',item.legacyEquivalent?'Confirmar importe original':'Corregir importe original',item.key):''}${this.button('receipt','Moneda y cotización',item.key)}${!['Proyecto','Saylor','Mantenimiento'].includes(item.sourceLabel)?this.button('scope','Clasificar',item.key):''}${item.editable ? this.button('edit-movement','Editar',item.key) + this.button('delete-movement','Eliminar',item.key) : this.button(item.origin==='retainer'?'retainer':item.sourceLabel==='Saylor'?'saylor':item.subscriptionId ? 'subscriptions' : 'projects', 'Ver origen',item.retainerId||'')}</div></div></article>`;
        }).join('')}</div>`;
    }
    movementList() {
        const query = this.query.trim().toLocaleLowerCase();
        const list = this.monthly().filter(item => (!this.type || item.type === this.type) && (!query || `${item.description} ${item.category} ${this.category(item.category,item.type)} ${item.sourceLabel}`.toLocaleLowerCase().includes(query)));
        const pages = Math.max(1, Math.ceil(list.length / 30)); this.page = Math.min(this.page, pages);
        return `<div class="fw-heading"><h3>${list.length} movimientos</h3>${list.some(item=>item.type==='income'&&item.legacyEquivalent&&item.amount>0)?this.button('confirm-usd','Confirmar ingresos como USD'):''}<span>${this.valuationMode === 'current' ? 'Equivalentes actuales' : 'Equivalentes históricos'} en ${esc(this.currency)} · ${esc(this.month)}</span></div>
            ${list.length ? this.rows(list.slice((this.page - 1) * 30, this.page * 30)) : this.empty('No hay coincidencias. Revisá el mes, la moneda y los filtros.')}
            ${pages > 1 ? `<div class="fw-pagination">${this.button('previous','Anterior')}<span>Página ${this.page} de ${pages}</span>${this.button('next','Siguiente')}</div>` : ''}`;
    }
    accounts(credit) {
        const list = this.workspace.accounts.filter(item => (item.kind === 'credit') === credit);
        const movements = this.movements, transfers = this.workspace.transfers;
        return `<div class="fw-heading"><h3>${credit ? 'Tarjetas de crédito' : 'Cuentas y billeteras'}</h3><div>${this.button(credit ? 'new-card' : 'new-account', credit ? 'Nueva tarjeta' : 'Nueva cuenta')}${this.button('transfer', credit ? 'Registrar pago / traspaso' : 'Traspasar')}</div></div>
            <p class="fw-note">${credit ? 'Seguimiento manual: no paga el banco ni genera avisos nuevos. Los días de cierre/vencimiento son orientativos; revisá el resumen real. El pago mueve saldo, no duplica gastos.' : 'Usar cuentas es opcional. Saldo inicial + movimientos asignados + traspasos. Si no registrás tus conversiones o gastos, el saldo calculado puede diferir del real.'}</p>
            ${credit ? '' : this.balanceSummary()}
            ${list.length ? `<div class="fw-account-grid">${list.map(account => {
                const balance = accountBalanceMinor(account,movements,transfers,getLocalISODate());
                return `<article class="fw-panel"><div class="fw-heading"><h3>${esc(account.name)}</h3><span>${esc(account.currency)} · ${account.archived ? 'Archivada' : KINDS[account.kind]}</span></div>
                    <p>${credit ? 'Deuda registrada' : 'Saldo calculado'}</p><strong class="fw-balance">${this.money(credit ? Math.max(0,-balance) : balance,account.currency)}</strong>
                    ${credit ? `<p>Disponible: ${this.money(Math.max(0,account.limitMinor+balance),account.currency)}${balance > 0 ? ` · A favor: ${this.money(balance,account.currency)}` : ''}</p><p>Cierre: día ${account.closingDay} · Vence: día ${account.dueDay}</p>` : ''}
                    <div class="fw-actions">${this.button('edit-account','Editar',account.id)}${this.button('archive-account',account.archived?'Reactivar':'Archivar',account.id)}</div></article>`;
            }).join('')}</div>` : this.empty(credit ? 'Agregá una tarjeta para registrar consumos y pagos sin duplicar gastos.' : 'Creá una cuenta en ARS o USD y su saldo inicial. No se asignará historial automáticamente.')}
            <h3>Traspasos y pagos registrados</h3><p class="fw-note">Se muestran los últimos 20. No forman parte de ingresos ni gastos.</p>
            ${transfers.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(item => `<div class="fw-transfer"><span>${esc(item.date)} · ${esc(this.workspace.accounts.find(a=>a.id===item.fromId)?.name)} → ${esc(this.workspace.accounts.find(a=>a.id===item.toId)?.name)} · ${esc(item.description || '')}</span><strong>${this.money(item.amountMinor,item.currency)}${item.receivedCurrency ? ` → ${this.money(item.receivedAmountMinor,item.receivedCurrency)}` : ''}</strong>${item.voidedAt ? '<span>Anulado · sin efecto en saldos</span>' : this.button('void-transfer','Anular',item.id)}</div>`).join('') || '<p>Sin traspasos registrados.</p>'}`;
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
        const point=event.target.closest('[data-income-month]');if(point){this.selectIncomeMonth(point.dataset.incomeMonth);return;}
        const workAction=event.target.closest('[data-work-action]');
        if(workAction){try{await this.app.work.action(workAction.dataset.workAction,workAction.dataset.id);}catch(e){this.app.showToast?.(e.message,{tone:'warning'});}return;}
        const tab = event.target.closest('[data-fw-tab]');
        if (tab) { this.tab = tab.dataset.fwTab; this.render(); return; }
        const button = event.target.closest('[data-fw-action]'); if (!button) return;
        const action = button.dataset.fwAction, recordId = button.dataset.fwId;
        if (action === 'refresh-rate') { button.disabled=true; try { await this.app.fetchLemonRate({force:true}); this.renderBody(); } finally { button.disabled=false; } return; }
        if (action === 'privacy') { this.app.setFinancialAmountsHidden(!this.app.isFinancialAmountsHidden()); return; }
        if(action==='confirm-usd'&&this.app.financialAmountsHidden) { this.app.showToast?.('Mostrá los montos para revisar los ingresos antes de confirmarlos.'); return; }
        if (action === 'all-movements') { this.tab = 'movements'; this.render(); return; }
        if (action === 'previous' || action === 'next') { this.page = Math.max(1,this.page+(action==='next'?1:-1)); this.renderBody(); return; }
        if (action === 'recurring') { this.finance.openFinanceRecurringModal(button); return; }
        if (action === 'retainer') { this.app.work.retainers.open(recordId); return; }
        if (action === 'subscriptions' || action === 'projects' || action==='saylor') { this.app.activateSection(action==='saylor'?'trading-section':action==='subscriptions'?'suscripciones-section':'projects-section'); return; }
        if (action==='scope') {
            const item=this.movements.find(x=>x.key===recordId);if(!item)return;
            const {planningDialog}=await import('./PlanningStore.js');
            const data=this.app.work.store.value,revision=data.revision;
            planningDialog(this.app,'Clasificar movimiento',`<p>Se cambia sólo el ámbito. El importe, la cuenta y el registro original se conservan.</p><label>Ámbito<select name="scope">${Object.entries(WORK_SCOPES).filter(([key])=>key!=='all').map(([key,label])=>option(key,label,this.scopeOf(item))).join('')}</select></label>`,async f=>{data.settings.financeScopes[item.type+':'+item.id]=f.get('scope');await this.app.work.store.save(data,revision);this.render();});return;
        }
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
        let batch;
        if (action==='confirm-original') {
            kind='original'; existing=this.movements.find(item=>item.key===recordId); if(!existing)return;
            title='Confirmar moneda e importe original';
            fields=`<p>${esc(existing.description)} · ${esc(existing.date)}</p><p class="fw-note">Referencia anterior: ${this.money(existing.amount*100,'USD')} equivalente guardado. Confirmá lo que realmente ${existing.type==='income'?'recibiste':'pagaste'}; no necesitás buscar una cotización.</p>`
                +this.select('currency','Moneda original',option('','Elegí la moneda',existing.legacyEquivalent?'':existing.nativeCurrency)+option('ARS','ARS · pesos',existing.legacyEquivalent?'':existing.nativeCurrency)+option('USD','USD · dólares',existing.legacyEquivalent?'':existing.nativeCurrency))
                +this.field('amount','Importe original','number',existing.legacyEquivalent?'':existing.nativeAmountMinor/100,'required min="0.01" step="0.01"')
                +'<p class="fw-note">El importe confirmado se usará en los totales. El equivalente anterior se conserva como antecedente; no se inventa una cotización histórica. Si cambiás la moneda, una cuenta asignada de otra moneda quedará desvinculada.</p>';
        } else if(action==='confirm-usd') {
            kind='confirm-usd'; title='Confirmar ingresos recibidos en USD';
            const query=this.query.trim().toLocaleLowerCase();
            batch=this.monthly().filter(item=>item.type==='income'&&item.legacyEquivalent&&item.amount>0&&this.type!=='expense'&&(!query||`${item.description} ${item.category} ${this.category(item.category,item.type)} ${item.sourceLabel}`.toLocaleLowerCase().includes(query))).slice(0,200);
            fields=`<p>Ingresos con moneda pendiente de ${esc(this.month)}, según tus filtros. Hasta 200 por tanda.</p><p class="fw-note">Seleccioná sólo los que realmente recibiste en dólares. Se propone el equivalente guardado como importe USD; los gastos quedan fuera.</p><button type="button" class="btn-secondary" data-select-usd>Seleccionar todos los listados</button><div class="fw-original-list">${batch.map(item=>`<label class="fw-original-choice"><input type="checkbox" name="originalKeys" value="${esc(item.key)}"><span>${esc(item.description||'Sin detalle')}<small>${esc(item.date)} · ${esc(item.sourceLabel)} · ${this.money(Math.round(item.amount*100),'USD')}</small></span></label>`).join('')}</div><p id="fw-usd-selection" aria-live="polite"></p>`;
        } else if (action === 'new-movement' || action === 'edit-movement' || action === 'receipt') {
            kind = action === 'receipt' ? 'receipt' : 'movement'; existing = this.movements.find(item=>item.key===recordId);
            if (action === 'edit-movement' && !existing?.editable) return;
            if (kind === 'receipt' && !existing) return;
            title = kind === 'receipt' ? 'Moneda y cotización del registro' : existing ? 'Editar movimiento' : 'Nuevo movimiento';
            fields = kind === 'receipt' ? `<p class="fw-note">${esc(existing.description)} · ${esc(existing.date)} · ${this.money(existing.amount*100,'USD')} equivalente guardado. Completar estos datos no genera otro movimiento ni cambia ese equivalente.</p>` : this.select('type','Tipo',option('income','Ingreso',existing?.type||'expense')+option('expense','Gasto',existing?.type||'expense'))
                + this.field('description','Detalle','text',existing?.description||'','required maxlength="300"')
                + this.field('category','Categoría','text',existing?.category||'','required maxlength="80" list="fw-categories"')
                + `<datalist id="fw-categories">${[...new Set(['servicios','comida','transporte','salud','ocio','extraordinary',...this.movements.map(item=>item.category)])].map(value=>`<option value="${esc(value)}">${esc(this.category(value,'expense'))}</option>`).join('')}</datalist>`
                + this.field('date','Fecha','date',existing?.date||getLocalISODate(),'required');
            const initialCurrency = existing?.legacyEquivalent ? 'unknown' : existing?.nativeCurrency || this.currency;
            const initialRate = existing?.rateSource === 'saved-equivalent' ? null : existing?.nativeCurrency === 'ARS' && !existing?.legacyEquivalent ? existing.exchangeRate : existing?.valuationRate
                || (!existing ? suggestedReceiptRate(getLocalISODate(),getLocalISODate(),this.app.getCachedExchangeRate?.()) : null);
            fields += kind==='movement'&&existing?.originalConfirmedAt ? '<p class="fw-note">La moneda y el importe confirmados se conservan. Para corregirlos, usá Corregir importe original.</p>' : this.select('currency','Moneda original', (existing?.legacyEquivalent ? option('unknown','Original no registrada',initialCurrency) : '') + option('USD','USD',initialCurrency)+option('ARS','ARS',initialCurrency))
                + this.field('amount',existing?.legacyEquivalent?'Importe (equivalente USD si la original es desconocida)':'Importe original','number',existing?(existing.legacyEquivalent?existing.amount:existing.nativeAmountMinor/100):'','required min="0.01" step="any"')
                + `<div id="fw-rate-field">${this.field('rate','Cotización del cobro / gasto: ARS por 1 USD','number',initialRate||'','min="0.000001" max="1000000" step="any"')}<small>Histórica: usá la de esa fecha. Para USD es opcional; sin ella el total histórico en ARS queda incompleto. La cotización actual sólo se sugiere para hoy.</small></div>`
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
            title='Traspaso / conversión entre cuentas';
            const options = ws.accounts.filter(item=>!item.archived).map(item=>option(item.id,`${item.name} · ${item.currency}`,null)).join('');
            fields = this.select('fromId','Desde',options)+this.select('toId','Hacia',options)
                +this.field('amount','Importe que sale','number','','required min="0.01" step="0.01"')
                +`<div id="fw-received-field" hidden>${this.field('receivedAmount','Importe neto que recibiste','number','','min="0.01" step="0.01"')}<small>En la moneda de destino, después de comisiones. Usamos tus importes reales, sin aplicar la cotización de hoy.</small></div>`
                +this.field('date','Fecha','date',getLocalISODate(),'required')+this.field('description','Detalle','text','','maxlength="300"')
                +'<p class="fw-note">Opcional: sólo registra saldos en LifeCycle. No mueve dinero real. La conversión no vuelve a contarse como ingreso ni gasto.</p>';
        } else if (action === 'new-budget' || action === 'edit-budget') {
            kind='budget'; existing=ws.budgets.find(item=>item.id===recordId); title=existing?'Editar presupuesto':'Nuevo presupuesto';
            fields=this.field('category','Categoría (igual a la de tus gastos)','text',existing?.category||'','required maxlength="80"')
                +this.field('month','Mes','month',existing?.month||this.month,'required')
                +this.select('currency','Moneda',option('USD','USD',existing?.currency||this.currency)+option('ARS','ARS',existing?.currency||this.currency))
                +this.field('amount','Límite mensual','number',existing?existing.limitMinor/100:'','required min="0.01" step="0.01"');
        } else return;
        this.editing = { kind, recordId, existing, fingerprint: this.fingerprint(kind,recordId), ownerId: this.app.auth?.readyUserId, batch:batch?.map(item=>({key:item.key,fingerprint:JSON.stringify(item),amount:item.amount})) };
        this.dialog.innerHTML = `<form><div class="fw-heading"><h2 id="fw-dialog-title">${title}</h2><button type="button" data-fw-close aria-label="Cerrar">✕</button></div><div class="fw-form-grid">${fields}</div><p id="fw-form-error" role="alert"></p><div class="fw-actions"><button type="button" class="btn-secondary" data-fw-close>Cancelar</button><button type="submit" class="btn-primary">Guardar</button></div></form>`;
        this.dialog.setAttribute('aria-labelledby','fw-dialog-title');
        if (kind==='account' && existing) { this.dialog.querySelector('[name=kind]').disabled=true; this.dialog.querySelector('[name=currency]').disabled=true; }
        if (['movement','receipt'].includes(kind)) { this.updateCurrencyFields(existing?.accountId); if(existing && kind==='movement') this.dialog.querySelector('[name=type]').disabled=true; }
        if (kind==='transfer') this.updateTransferFields();
        if (kind==='original') { this.dialog.querySelector('[name=currency]').required=true; this.dialog.querySelector('[type=submit]').textContent='Confirmar importe original'; }
        if (kind==='confirm-usd') this.updateUsdSelection();
        this.dialog.showModal();
    }
    fingerprint(kind,recordId) {
        if (!recordId) return null;
        const item = ['movement','receipt','original'].includes(kind) ? this.movements.find(item=>item.key===recordId) : kind==='account' ? this.workspace.accounts.find(item=>item.id===recordId) : this.workspace.budgets.find(item=>item.id===recordId);
        return JSON.stringify(item);
    }
    updateOriginalFields() {
        const input=this.dialog.querySelector('[name=amount]'),code=this.dialog.querySelector('[name=currency]').value;
        input.value=code==='USD'?(Math.round(this.editing.existing.amount*100)/100).toFixed(2):'';
    }
    updateUsdSelection() {
        const selected=[...this.dialog.querySelectorAll('[name=originalKeys]:checked')];
        const total=selected.reduce((sum,input)=>sum+Math.round((this.editing.batch.find(item=>item.key===input.value)?.amount||0)*100),0);
        this.dialog.querySelector('#fw-usd-selection').textContent=`${selected.length} ingresos seleccionados · ${this.money(total,'USD')}. Confirmá que estos importes fueron recibidos en USD.`;
        const submit=this.dialog.querySelector('[type=submit]'); submit.disabled=!selected.length; submit.textContent=`Confirmar ${selected.length} ingresos en USD`;
    }
    updateCurrencyFields(selectedAccount) {
        if(!['movement','receipt'].includes(this.editing?.kind)) return;
        if(!this.dialog.querySelector('[name=currency]'))return;
        const code=this.dialog.querySelector('[name=currency]').value, select=this.dialog.querySelector('[name=accountId]');
        const selected=selectedAccount??select.value;
        select.innerHTML=option('','Sin cuenta asignada',selected)+this.workspace.accounts.filter(item=>(!item.archived||item.id===this.editing.existing?.accountId)&&item.currency===code).map(item=>option(item.id,`${item.name}${item.archived?' (archivada)':''}`,selected)).join('');
        this.dialog.querySelector('[name=rate]').required=code==='ARS'||(code==='unknown'&&this.editing.kind==='receipt');
        this.dialog.querySelector('[name=accountId]').closest('label').hidden=code==='unknown';
        this.dialog.querySelector('[name=amount]').closest('label').hidden=code==='unknown'&&this.editing.kind==='receipt';
        this.dialog.querySelector('[name=amount]').readOnly=code==='unknown';
        this.dialog.querySelector('[name=amount]').required=code!=='unknown';
    }
    updateReceiptDate() {
        if (this.editing?.kind !== 'movement') return;
        const rate = this.dialog.querySelector('[name=rate]');
        // Changing the date requires an explicit historical quote; never reuse a
        // suggested current quote for a receipt backdated by the user.
        if(rate)rate.value='';
    }
    updateTransferFields() {
        if (this.editing?.kind !== 'transfer') return;
        const from=this.workspace.accounts.find(a=>a.id===this.dialog.querySelector('[name=fromId]').value);
        const to=this.workspace.accounts.find(a=>a.id===this.dialog.querySelector('[name=toId]').value);
        const cross=from && to && from.currency!==to.currency;
        this.dialog.querySelector('#fw-received-field').hidden=!cross;
        this.dialog.querySelector('[name=receivedAmount]').required=Boolean(cross);
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
            if(kind==='original') {
                const item=buildOriginalConfirmation(input,existing,ws);
                this.saveWorkspace({...ws,receipts:[...(ws.receipts||[]).filter(receipt=>receipt.key!==item.key),item]});
                this.app.projects?.render();
            } else if(kind==='confirm-usd') {
                const keys=new FormData(event.target).getAll('originalKeys');
                const selections=keys.map(key=>this.editing.batch.find(item=>item.key===key)||{key});
                this.saveWorkspace(confirmUsdOriginals(ws,this.movements,selections)); this.app.projects?.render();
            } else if(kind==='account') {
                if(existing) { input.currency=existing.currency; input.kind=existing.kind; }
                const item=buildFinanceAccount(input,existing);
                this.saveWorkspace({...ws,accounts:existing?ws.accounts.map(value=>value.id===item.id?item:value):[...ws.accounts,item]});
            } else if(kind==='budget') {
                const item=buildFinanceBudget(input,ws,existing?.id);
                this.saveWorkspace({...ws,budgets:existing?ws.budgets.map(value=>value.id===item.id?item:value):[...ws.budgets,item]});
            } else if(kind==='transfer') {
                if(!this.finance.getFinanceResourceCapacity(RESOURCE_KEYS.FINANCE_TRANSACTIONS)) return;
                this.saveWorkspace({...ws,transfers:[...ws.transfers,buildFinanceTransfer(input,ws)]});
            } else if(kind==='receipt') {
                const item=buildFinanceReceipt(input,existing,ws);
                this.saveWorkspace({...ws,receipts:[...(ws.receipts||[]).filter(receipt=>receipt.key!==item.key),item]});
                this.app.projects?.render();
            } else {
                if(existing) input.type=existing.type;
                const collection=input.type==='income'?'entries':'expenses';
                const original=existing?this.finance.data[collection].find(item=>String(item.id)===String(existing.id)):null;
                if(!existing&&!this.finance.getFinanceResourceCapacity(RESOURCE_KEYS.FINANCE_TRANSACTIONS)) return;
                const confirmed = existing?.originalConfirmedAt;
                const item=buildFinanceMovement(confirmed?{...input,currency:original.nativeCurrency||'unknown',amount:original.nativeAmountMinor/100,rate:original.nativeCurrency==='ARS'?original.exchangeRate:original.valuationRate}:input,ws,original);
                const previous=this.finance.data;
                this.finance.data={...previous,[collection]:existing?previous[collection].map(value=>String(value.id)===String(item.id)?item:value):[...previous[collection],item]};
                if(confirmed)this.finance.data.workspace={...ws,receipts:(ws.receipts||[]).map(receipt=>receipt.key===existing.key?{...receipt,date:item.date,sourceFingerprint:financeSourceFingerprint(item)}:receipt)};
                try { this.finance.saveData(); } catch(error) { this.finance.data=previous; throw error; }
                this.finance.render();
            }
            this.dialog.close(); this.app.showToast?.('Guardado en LifeCycle. Revisá el indicador de sincronización.');
        } catch(error) { this.dialog.querySelector('#fw-form-error').textContent=error.message; }
        finally { button.disabled=false; }
    }
}
