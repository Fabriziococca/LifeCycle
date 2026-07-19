import { getLocalISODate } from '../utils.js';

export class FinanzasModule {
    constructor(appController) {
        this.app = appController;
        this.data = this.loadData();
        this.currentProjectId = null;

        this.monthSelect = document.getElementById('finanzas-month-select');
        this.listContainer = document.getElementById('finanzasList');

        this.init();
    }

    loadData() {
        const raw = localStorage.getItem('finanzasData');
        if (!raw) return { entries: [] };
        try {
            return JSON.parse(raw) || { entries: [] };
        } catch (e) {
            console.error("Error parsing finanzas data:", e);
            return { entries: [] };
        }
    }

    saveData() {
        localStorage.setItem('finanzasData', JSON.stringify(this.data));
    }

    init() {
        const btnOpenModal = document.getElementById('btnOpenFinanzasModal');
        const modal = document.getElementById('finanzas-log-modal');
        const cancelBtn = document.getElementById('fin-log-cancel');
        const form = document.getElementById('finanzas-log-form');
        const categorySelect = document.getElementById('fin-input-category');

        btnOpenModal?.addEventListener('click', () => {
            form?.reset();
            const dateInp = document.getElementById('fin-input-date');
            const monthInp = document.getElementById('fin-input-month');
            if (dateInp) dateInp.value = getLocalISODate();
            if (monthInp) monthInp.value = new Date().toISOString().slice(0, 7);
            
            this.toggleModalFields();
            modal?.classList.remove('hidden');
        });

        cancelBtn?.addEventListener('click', () => {
            modal?.classList.add('hidden');
        });

        categorySelect?.addEventListener('change', () => {
            this.toggleModalFields();
        });

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEntry();
        });

        this.monthSelect?.addEventListener('change', () => {
            this.renderBreakdownAndList();
        });

        // Listeners para modal de desglose anual
        const btnOpenYear = document.getElementById('btnOpenFinYearDetails');
        const yearModal = document.getElementById('finanzas-year-details-modal');
        const closeYearBtn = document.getElementById('fin-year-modal-close');
        const yearSelect = document.getElementById('fin-year-select');

        btnOpenYear?.addEventListener('click', () => {
            this.populateYearsSelector();
            this.renderAnnualBreakdown();
            yearModal?.classList.remove('hidden');
        });

        closeYearBtn?.addEventListener('click', () => {
            yearModal?.classList.add('hidden');
        });

        yearSelect?.addEventListener('change', () => {
            this.renderAnnualBreakdown();
        });

        // Collapsible Freelance Breakdown
        const trigger = document.getElementById('fin-freelance-trigger');
        const subBreakdown = document.getElementById('fin-freelance-sub-breakdown');
        const caret = document.getElementById('fin-freelance-caret');
        if (trigger && subBreakdown && caret) {
            trigger.addEventListener('click', () => {
                subBreakdown.classList.toggle('hidden');
                const isOpen = !subBreakdown.classList.contains('hidden');
                caret.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
            });
        }
    }

    toggleModalFields() {
        const category = document.getElementById('fin-input-category')?.value;
        const groupDiscord = document.getElementById('fin-group-discord');
        const groupTransaction = document.getElementById('fin-group-transaction');
        
        const monthInput = document.getElementById('fin-input-month');
        const dateInput = document.getElementById('fin-input-date');

        if (category === 'discord') {
            groupDiscord?.classList.remove('hidden');
            groupTransaction?.classList.add('hidden');
            if (monthInput) monthInput.required = true;
            if (dateInput) dateInput.required = false;
        } else {
            groupDiscord?.classList.add('hidden');
            groupTransaction?.classList.remove('hidden');
            if (monthInput) monthInput.required = false;
            if (dateInput) dateInput.required = true;
        }
    }

    saveEntry() {
        const category = document.getElementById('fin-input-category')?.value;
        const amount = parseFloat(document.getElementById('fin-input-amount')?.value) || 0;
        
        let dateVal = '';
        let descVal = '';

        if (category === 'discord') {
            const mVal = document.getElementById('fin-input-month')?.value;
            if (!mVal) return;
            dateVal = `${mVal}-01`;
            
            const [yr, mn] = mVal.split('-');
            const dateObj = new Date(parseInt(yr), parseInt(mn) - 1, 1);
            const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            descVal = `Ingresos Discord - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
        } else {
            dateVal = document.getElementById('fin-input-date')?.value || getLocalISODate();
            descVal = (document.getElementById('fin-input-desc')?.value || '').trim();
            if (category === 'trading' && !descVal) {
                descVal = 'Operación de Trading';
            } else if (category === 'extraordinary' && !descVal) {
                descVal = 'Ingreso Extraordinario';
            }
        }

        const newEntry = {
            id: Date.now(),
            category,
            date: dateVal,
            amount,
            description: descVal
        };

        this.data.entries.push(newEntry);
        this.saveData();

        document.getElementById('finanzas-log-modal')?.classList.add('hidden');
        
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.render();
    }

    deleteEntry(id) {
        if (confirm('¿Seguro que deseas eliminar este ingreso?')) {
            this.data.entries = this.data.entries.filter(e => e.id !== id);
            this.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.render();
        }
    }

    getCombinedEntries() {
        const list = [...(this.data.entries || [])];
        
        const projHistory = this.app.projects?.history || [];
        projHistory.forEach(p => {
            const dateVal = p.deliveredDate || (p.deliveredAt ? p.deliveredAt.split('T')[0] : getLocalISODate());
            list.push({
                id: `proj-${p.id}`,
                category: 'freelance',
                source: p.source || 'workana',
                date: dateVal,
                amount: Number(p.budgetNet || 0),
                description: `${p.client} - ${p.project}`
            });
        });

        return list;
    }

    populateYearsSelector() {
        const yearSelect = document.getElementById('fin-year-select');
        if (!yearSelect) return;

        const combined = this.getCombinedEntries();
        const yearsSet = new Set();
        yearsSet.add(new Date().getFullYear());

        combined.forEach(e => {
            if (e.date) {
                const yr = parseInt(e.date.slice(0, 4));
                if (!isNaN(yr)) yearsSet.add(yr);
            }
        });

        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        const selected = yearSelect.value || String(new Date().getFullYear());

        yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
        yearSelect.value = sortedYears.includes(parseInt(selected)) ? selected : String(sortedYears[0]);
    }

    renderAnnualBreakdown() {
        const yearSelect = document.getElementById('fin-year-select');
        const tableBody = document.getElementById('fin-year-table-body');
        if (!yearSelect || !tableBody) return;

        const selectedYear = parseInt(yearSelect.value) || new Date().getFullYear();
        const combined = this.getCombinedEntries();
        
        const yearEntries = combined.filter(e => e.date && parseInt(e.date.slice(0, 4)) === selectedYear);

        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            monthIndex: i,
            freelance: 0,
            discord: 0,
            trading: 0,
            extraordinary: 0,
            total: 0
        }));

        yearEntries.forEach(e => {
            const monthIdx = parseInt(e.date.slice(5, 7)) - 1;
            if (monthIdx >= 0 && monthIdx < 12) {
                const amt = Number(e.amount || 0);
                if (e.category === 'freelance') monthlyData[monthIdx].freelance += amt;
                else if (e.category === 'discord') monthlyData[monthIdx].discord += amt;
                else if (e.category === 'trading') monthlyData[monthIdx].trading += amt;
                else if (e.category === 'extraordinary') monthlyData[monthIdx].extraordinary += amt;
                monthlyData[monthIdx].total += amt;
            }
        });

        let totFreelance = 0;
        let totDiscord = 0;
        let totTrading = 0;
        let totExtraordinary = 0;
        let totGrand = 0;

        tableBody.innerHTML = monthlyData.map(m => {
            totFreelance += m.freelance;
            totDiscord += m.discord;
            totTrading += m.trading;
            totExtraordinary += m.extraordinary;
            totGrand += m.total;

            const d = new Date(selectedYear, m.monthIndex, 1);
            const monthName = d.toLocaleDateString('es-AR', { month: 'long' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">
                    <td style="padding:10px 8px; font-weight:600; color:white;">${capitalizedMonth}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.freelance)}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.discord)}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.trading)}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.extraordinary)}</td>
                    <td style="padding:10px 8px; text-align:right; font-weight:bold; color:white;">${this.app.formatCurrency(m.total)}</td>
                </tr>
            `;
        }).join('');

        const tf = document.getElementById('fin-year-tot-freelance');
        const td = document.getElementById('fin-year-tot-discord');
        const tt = document.getElementById('fin-year-tot-trading');
        const te = document.getElementById('fin-year-tot-extraordinary');
        const tg = document.getElementById('fin-year-tot-grand');

        if (tf) tf.innerText = this.app.formatCurrency(totFreelance);
        if (td) td.innerText = this.app.formatCurrency(totDiscord);
        if (tt) tt.innerText = this.app.formatCurrency(totTrading);
        if (te) te.innerText = this.app.formatCurrency(totExtraordinary);
        if (tg) tg.innerText = this.app.formatCurrency(totGrand);
    }

    populateMonthsSelector(combinedEntries) {
        if (!this.monthSelect) return;
        const monthsSet = new Set();
        
        const currMonthStr = new Date().toISOString().slice(0, 7);
        monthsSet.add(currMonthStr);

        combinedEntries.forEach(e => {
            if (e.date) {
                monthsSet.add(e.date.slice(0, 7));
            }
        });

        const sortedMonths = Array.from(monthsSet).sort().reverse();
        const selected = this.monthSelect.value || currMonthStr;

        this.monthSelect.innerHTML = sortedMonths.map(m => {
            const [yr, mn] = m.split('-');
            const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
            const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
            return `<option value="${m}">${capitalized}</option>`;
        }).join('');

        if (sortedMonths.includes(selected)) {
            this.monthSelect.value = selected;
        } else {
            this.monthSelect.value = sortedMonths[0] || currMonthStr;
        }
    }

    render() {
        const combined = this.getCombinedEntries();
        const now = new Date();
        const currYear = now.getFullYear();
        const currMonthStr = now.toISOString().slice(0, 7);

        let monthSum = 0;
        let yearSum = 0;
        let totalSum = 0;

        combined.forEach(e => {
            const amount = Number(e.amount || 0);
            totalSum += amount;

            if (e.date) {
                const itemYear = parseInt(e.date.slice(0, 4));
                const itemMonthStr = e.date.slice(0, 7);

                if (itemYear === currYear) {
                    yearSum += amount;
                    if (itemMonthStr === currMonthStr) {
                        monthSum += amount;
                    }
                }
            }
        });

        const mEl = document.getElementById('fin-monthUSD');
        const yEl = document.getElementById('fin-yearUSD');
        const tEl = document.getElementById('fin-totalUSD');

        if (mEl) mEl.innerText = this.app.formatCurrency(monthSum);
        if (yEl) yEl.innerText = this.app.formatCurrency(yearSum);
        if (tEl) tEl.innerText = this.app.formatCurrency(totalSum);

        this.populateMonthsSelector(combined);
        this.renderBreakdownAndList();
    }

    renderBreakdownAndList() {
        const selectedMonth = this.monthSelect?.value;
        if (!selectedMonth) return;

        const combined = this.getCombinedEntries();
        const monthEntries = combined.filter(e => e.date && e.date.slice(0, 7) === selectedMonth);

        let catFreelance = 0;
        let catDiscord = 0;
        let catTrading = 0;
        let catExtraordinary = 0;
        let freelanceWorkana = 0;
        let freelanceExternal = 0;

        monthEntries.forEach(e => {
            const amt = Number(e.amount || 0);
            if (e.category === 'freelance') {
                catFreelance += amt;
                if (e.source === 'external') {
                    freelanceExternal += amt;
                } else {
                    freelanceWorkana += amt;
                }
            }
            else if (e.category === 'discord') catDiscord += amt;
            else if (e.category === 'trading') catTrading += amt;
            else if (e.category === 'extraordinary') catExtraordinary += amt;
        });

        const elWorkana = document.getElementById('fin-freelance-sub-workana');
        const elExternal = document.getElementById('fin-freelance-sub-external');
        if (elWorkana) elWorkana.innerText = this.app.formatCurrency(freelanceWorkana);
        if (elExternal) elExternal.innerText = this.app.formatCurrency(freelanceExternal);

        const totalMonth = catFreelance + catDiscord + catTrading + catExtraordinary;

        const mEl = document.getElementById('fin-monthUSD');
        if (mEl) mEl.innerText = this.app.formatCurrency(totalMonth);

        const labelEl = document.getElementById('fin-month-label');
        if (labelEl) {
            const [yr, mn] = selectedMonth.split('-');
            const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
            const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            labelEl.innerText = `Ingresos de ${label.charAt(0).toUpperCase() + label.slice(1)}`;
        }

        const pctFreelance = totalMonth > 0 ? (catFreelance / totalMonth) * 100 : 0;
        const pctDiscord = totalMonth > 0 ? (catDiscord / totalMonth) * 100 : 0;
        const pctTrading = totalMonth > 0 ? (catTrading / totalMonth) * 100 : 0;
        const pctExtraordinary = totalMonth > 0 ? (catExtraordinary / totalMonth) * 100 : 0;

        const cf = document.getElementById('fin-cat-freelance');
        const bf = document.getElementById('fin-bar-freelance');
        const cd = document.getElementById('fin-cat-discord');
        const bd = document.getElementById('fin-bar-discord');
        const ct = document.getElementById('fin-cat-trading');
        const bt = document.getElementById('fin-bar-trading');
        const ce = document.getElementById('fin-cat-extraordinary');
        const be = document.getElementById('fin-bar-extraordinary');

        if (cf) cf.innerText = `${this.app.formatCurrency(catFreelance)} (${pctFreelance.toFixed(0)}%)`;
        if (bf) bf.style.width = `${pctFreelance}%`;
        if (cd) cd.innerText = `${this.app.formatCurrency(catDiscord)} (${pctDiscord.toFixed(0)}%)`;
        if (bd) bd.style.width = `${pctDiscord}%`;
        if (ct) ct.innerText = `${this.app.formatCurrency(catTrading)} (${pctTrading.toFixed(0)}%)`;
        if (bt) bt.style.width = `${pctTrading}%`;
        if (ce) ce.innerText = `${this.app.formatCurrency(catExtraordinary)} (${pctExtraordinary.toFixed(0)}%)`;
        if (be) be.style.width = `${pctExtraordinary}%`;

        if (!this.listContainer) return;

        if (monthEntries.length === 0) {
            this.listContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay ingresos registrados en este mes.</p>';
            return;
        }

        monthEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

        this.listContainer.innerHTML = monthEntries.map(e => {
            let icon = 'ph-briefcase';
            let color = 'var(--primary-color)';
            let catName = 'Freelance';
            if (e.category === 'discord') { icon = 'ph-chat-circle'; color = 'var(--status-purple)'; catName = 'Discord'; }
            else if (e.category === 'trading') { icon = 'ph-chart-line-up'; color = 'var(--status-green)'; catName = 'Trading'; }
            else if (e.category === 'extraordinary') { icon = 'ph-gift'; color = 'var(--status-yellow)'; catName = 'Extraordinario'; }

            const dateObj = new Date(e.date);
            const dateStr = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

            const isManual = !String(e.id).startsWith('proj-');
            const deleteBtn = isManual 
                ? `<button class="btn-delete-fin-item" data-id="${e.id}" style="background:none; border:none; color:var(--status-red); cursor:pointer; padding:6px; display:flex; align-items:center;" title="Eliminar"><i class="ph ph-trash" style="font-size:1.15rem;"></i></button>`
                : `<span style="font-size: 0.7rem; color: var(--text-secondary); padding: 4px 8px; background: rgba(255,255,255,0.03); border:1px solid var(--surface-border); border-radius:4px;">Proyecto</span>`;

            return `
                <div class="card" style="margin:0; padding:12px 15px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(255,255,255,0.03); gap: 10px;">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                        <div class="icon-container" style="background: rgba(255,255,255,0.03); color: ${color}; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">
                            <i class="ph ${icon}" style="font-size:1.2rem;"></i>
                        </div>
                        <div style="min-width:0;">
                            <h4 style="margin:0; font-size:0.95rem; color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.description}</h4>
                            <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-secondary);">${catName} • ${dateStr}</p>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                        <strong style="color:var(--status-green); font-size:0.95rem;">+ ${this.app.formatCurrency(e.amount)}</strong>
                        ${deleteBtn}
                    </div>
                </div>
            `;
        }).join('');

        this.listContainer.querySelectorAll('.btn-delete-fin-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.deleteEntry(id);
            });
        });
    }
}
