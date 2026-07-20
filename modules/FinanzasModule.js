import { getLocalISODate } from '../utils.js';

export class FinanzasModule {
    constructor(appController) {
        this.app = appController;
        this.data = this.loadData();
        this.currentProjectId = null;
        this.activeTab = 'income'; // 'income' o 'expense'

        this.monthSelect = document.getElementById('finanzas-month-select');
        this.listContainer = document.getElementById('finanzasList');

        this.init();
    }

    loadData() {
        const raw = localStorage.getItem('finanzasData');
        const defaultData = { entries: [], expenses: [] };
        if (!raw) return defaultData;
        try {
            const parsed = JSON.parse(raw) || {};
            if (!parsed.entries) parsed.entries = [];
            if (!parsed.expenses) parsed.expenses = [];
            return parsed;
        } catch (e) {
            console.error("Error parsing finanzas data:", e);
            return defaultData;
        }
    }

    saveData() {
        localStorage.setItem('finanzasData', JSON.stringify(this.data));
    }

    init() {
        // Pestañas (Income vs Expense)
        const tabIncome = document.getElementById('btnFinTabIncome');
        const tabExpense = document.getElementById('btnFinTabExpense');

        tabIncome?.addEventListener('click', () => {
            this.activeTab = 'income';
            tabIncome.classList.add('active');
            tabIncome.style.background = 'rgba(255,255,255,0.05)';
            tabIncome.style.color = 'white';

            tabExpense?.classList.remove('active');
            if (tabExpense) {
                tabExpense.style.background = 'none';
                tabExpense.style.color = 'var(--text-secondary)';
            }

            document.getElementById('btnOpenFinanzasModal')?.classList.remove('hidden');
            document.getElementById('btnOpenFinanzasExpenseModal')?.classList.add('hidden');
            document.getElementById('fin-section-title').innerText = 'Distribución de Ingresos';
            document.getElementById('fin-list-title').innerText = 'Transacciones del Mes';

            this.renderBreakdownAndList();
        });

        tabExpense?.addEventListener('click', () => {
            this.activeTab = 'expense';
            tabExpense.classList.add('active');
            tabExpense.style.background = 'rgba(255,255,255,0.05)';
            tabExpense.style.color = 'white';

            tabIncome?.classList.remove('active');
            if (tabIncome) {
                tabIncome.style.background = 'none';
                tabIncome.style.color = 'var(--text-secondary)';
            }

            document.getElementById('btnOpenFinanzasModal')?.classList.add('hidden');
            document.getElementById('btnOpenFinanzasExpenseModal')?.classList.remove('hidden');
            document.getElementById('fin-section-title').innerText = 'Distribución de Gastos';
            document.getElementById('fin-list-title').innerText = 'Gastos del Mes';

            this.renderBreakdownAndList();
        });

        // Modal de Registro de Ingresos
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

        // Modal de Registro de Gastos
        const btnOpenExpenseModal = document.getElementById('btnOpenFinanzasExpenseModal');
        const expenseModal = document.getElementById('finanzas-expense-modal');
        const cancelExpenseBtn = document.getElementById('fin-expense-cancel');
        const expenseForm = document.getElementById('finanzas-expense-form');
        const expenseCategorySelect = document.getElementById('fin-expense-category');
        const customCategoryGroup = document.getElementById('fin-expense-group-custom');

        btnOpenExpenseModal?.addEventListener('click', () => {
            expenseForm?.reset();
            const dateInp = document.getElementById('fin-expense-date');
            if (dateInp) dateInp.value = getLocalISODate();
            customCategoryGroup?.classList.add('hidden');
            expenseModal?.classList.remove('hidden');
        });

        cancelExpenseBtn?.addEventListener('click', () => {
            expenseModal?.classList.add('hidden');
        });

        expenseCategorySelect?.addEventListener('change', () => {
            if (expenseCategorySelect.value === 'custom') {
                customCategoryGroup?.classList.remove('hidden');
                const customInput = document.getElementById('fin-expense-custom-name');
                if (customInput) customInput.required = true;
            } else {
                customCategoryGroup?.classList.add('hidden');
                const customInput = document.getElementById('fin-expense-custom-name');
                if (customInput) customInput.required = false;
            }
        });

        expenseForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveExpenseEntry();
        });

        // Selector del mes global
        this.monthSelect?.addEventListener('change', () => {
            this.renderBreakdownAndList();
        });

        // Listeners para modal de desglose anual de ingresos
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

        // Listeners para modal de desglose anual de gastos
        const btnOpenExpenseYear = document.getElementById('btnOpenFinExpenseYearDetails');
        const expenseYearModal = document.getElementById('finanzas-expense-year-details-modal');
        const closeExpenseYearBtn = document.getElementById('fin-expense-year-modal-close');
        const expenseYearSelect = document.getElementById('fin-expense-year-select');

        btnOpenExpenseYear?.addEventListener('click', () => {
            this.populateExpenseYearsSelector();
            this.renderExpenseAnnualBreakdown();
            expenseYearModal?.classList.remove('hidden');
        });

        closeExpenseYearBtn?.addEventListener('click', () => {
            expenseYearModal?.classList.add('hidden');
        });

        expenseYearSelect?.addEventListener('change', () => {
            this.renderExpenseAnnualBreakdown();
        });
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
        const amountInput = parseFloat(document.getElementById('fin-input-amount')?.value) || 0;
        const currency = document.getElementById('fin-input-currency')?.value || 'USD';

        let amount = amountInput;
        if (currency === 'ARS') {
            const rate = parseFloat(localStorage.getItem('lemon_usdt_ars_rate')) || 1530;
            amount = amountInput / rate;
        }

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

    saveExpenseEntry() {
        const categorySelect = document.getElementById('fin-expense-category')?.value;
        const customName = (document.getElementById('fin-expense-custom-name')?.value || '').trim();
        const amountInput = parseFloat(document.getElementById('fin-expense-amount')?.value) || 0;
        const currency = document.getElementById('fin-expense-currency')?.value || 'USD';
        const dateVal = document.getElementById('fin-expense-date')?.value || getLocalISODate();
        const descVal = (document.getElementById('fin-expense-desc')?.value || '').trim();

        let amount = amountInput;
        if (currency === 'ARS') {
            const rate = parseFloat(localStorage.getItem('lemon_usdt_ars_rate')) || 1530;
            amount = amountInput / rate;
        }

        let category = categorySelect;
        if (categorySelect === 'custom' && customName) {
            category = customName;
        }

        const newExpense = {
            id: Date.now(),
            category,
            date: dateVal,
            amount,
            description: descVal
        };

        this.data.expenses.push(newExpense);
        this.saveData();

        document.getElementById('finanzas-expense-modal')?.classList.add('hidden');

        this.app.auth?.syncToCloud(false).catch(() => {});
        this.render();
    }

    deleteExpense(id) {
        if (confirm('¿Seguro que deseas eliminar este gasto?')) {
            this.data.expenses = this.data.expenses.filter(e => e.id !== id);
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

    getCategoryColor(categoryKeyOrName, index) {
        const fixed = {
            freelance: 'var(--primary-color)',
            discord: 'var(--status-purple)',
            trading: 'var(--status-green)',
            extraordinary: 'var(--status-yellow)',
            comida: '#10b981',
            vehiculo: '#f43f5e',
            servicios: '#06b6d4',
            salud: '#8b5cf6',
            ocio: 'var(--status-yellow)',
            otros: 'var(--text-secondary)'
        };
        if (fixed[categoryKeyOrName]) return fixed[categoryKeyOrName];
        const hue = (index * 137.5) % 360;
        return `hsl(${hue}, 75%, 60%)`;
    }

    drawDonutChart(segments, totalFormatted) {
        const elDonut = document.getElementById('fin-donut-chart');
        const elValue = document.getElementById('fin-donut-center-value');
        const elLabel = document.getElementById('fin-donut-center-label');

        if (!elDonut) return;

        if (this.activeTab === 'income') {
            elLabel.innerText = 'Ingresado';
            elValue.style.color = 'var(--status-green)';
        } else {
            elLabel.innerText = 'Gastado';
            elValue.style.color = 'var(--status-orange)';
        }
        elValue.innerText = totalFormatted;

        if (segments.length === 0) {
            elDonut.style.background = 'conic-gradient(var(--surface-border) 0% 100%)';
            return;
        }

        let conicParts = [];
        let cumulativePercent = 0;

        segments.forEach(seg => {
            const start = cumulativePercent.toFixed(1);
            cumulativePercent += seg.percent;
            const end = cumulativePercent.toFixed(1);
            conicParts.push(`${seg.color} ${start}% ${end}%`);
        });

        elDonut.style.background = `conic-gradient(${conicParts.join(', ')})`;
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

    populateExpenseYearsSelector() {
        const yearSelect = document.getElementById('fin-expense-year-select');
        if (!yearSelect) return;

        const expenses = this.data.expenses || [];
        const yearsSet = new Set();
        yearsSet.add(new Date().getFullYear());

        expenses.forEach(e => {
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

    renderExpenseAnnualBreakdown() {
        const yearSelect = document.getElementById('fin-expense-year-select');
        const tableBody = document.getElementById('fin-expense-year-table-body');
        if (!yearSelect || !tableBody) return;

        const selectedYear = parseInt(yearSelect.value) || new Date().getFullYear();
        const expenses = this.data.expenses || [];

        const yearExpenses = expenses.filter(e => e.date && parseInt(e.date.slice(0, 4)) === selectedYear);

        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            monthIndex: i,
            comida: 0,
            vehiculo: 0,
            servicios: 0,
            salud: 0,
            ocio: 0,
            otros: 0,
            total: 0
        }));

        yearExpenses.forEach(e => {
            const monthIdx = parseInt(e.date.slice(5, 7)) - 1;
            if (monthIdx >= 0 && monthIdx < 12) {
                const amt = Number(e.amount || 0);
                const cat = e.category;
                if (cat === 'comida') monthlyData[monthIdx].comida += amt;
                else if (cat === 'vehiculo') monthlyData[monthIdx].vehiculo += amt;
                else if (cat === 'servicios') monthlyData[monthIdx].servicios += amt;
                else if (cat === 'salud') monthlyData[monthIdx].salud += amt;
                else if (cat === 'ocio') monthlyData[monthIdx].ocio += amt;
                else monthlyData[monthIdx].otros += amt;

                monthlyData[monthIdx].total += amt;
            }
        });

        let totComida = 0;
        let totVehiculo = 0;
        let totServicios = 0;
        let totSalud = 0;
        let totOcio = 0;
        let totOtros = 0;
        let totGrand = 0;

        tableBody.innerHTML = monthlyData.map(m => {
            totComida += m.comida;
            totVehiculo += m.vehiculo;
            totServicios += m.servicios;
            totSalud += m.salud;
            totOcio += m.ocio;
            totOtros += m.otros;
            totGrand += m.total;

            const d = new Date(selectedYear, m.monthIndex, 1);
            const monthName = d.toLocaleDateString('es-AR', { month: 'long' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);">
                    <td style="padding:10px 8px; font-weight:600; color:white;">${capitalizedMonth}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.comida)}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.vehiculo)}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.servicios)}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.salud)}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.ocio)}</td>
                    <td style="padding:10px 8px; text-align:right;">${this.app.formatCurrency(m.otros)}</td>
                    <td style="padding:10px 8px; text-align:right; font-weight:bold; color:white;">${this.app.formatCurrency(m.total)}</td>
                </tr>
            `;
        }).join('');

        const tc = document.getElementById('fin-expense-year-tot-comida');
        const tv = document.getElementById('fin-expense-year-tot-vehiculo');
        const ts = document.getElementById('fin-expense-year-tot-servicios');
        const tsl = document.getElementById('fin-expense-year-tot-salud');
        const to = document.getElementById('fin-expense-year-tot-ocio');
        const tot = document.getElementById('fin-expense-year-tot-otros');
        const tg = document.getElementById('fin-expense-year-tot-grand');

        if (tc) tc.innerText = this.app.formatCurrency(totComida);
        if (tv) tv.innerText = this.app.formatCurrency(totVehiculo);
        if (ts) ts.innerText = this.app.formatCurrency(totServicios);
        if (tsl) tsl.innerText = this.app.formatCurrency(totSalud);
        if (to) to.innerText = this.app.formatCurrency(totOcio);
        if (tot) tot.innerText = this.app.formatCurrency(totOtros);
        if (tg) tg.innerText = this.app.formatCurrency(totGrand);
    }

    populateMonthsSelector(combinedIncomes, expenses) {
        if (!this.monthSelect) return;
        const monthsSet = new Set();

        const currMonthStr = new Date().toISOString().slice(0, 7);
        monthsSet.add(currMonthStr);

        combinedIncomes.forEach(e => {
            if (e.date) monthsSet.add(e.date.slice(0, 7));
        });
        expenses.forEach(e => {
            if (e.date) monthsSet.add(e.date.slice(0, 7));
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
        const expenses = this.data.expenses || [];
        const now = new Date();
        const currYear = now.getFullYear();
        const currMonthStr = now.toISOString().slice(0, 7);

        let monthIncomeSum = 0;
        let yearIncomeSum = 0;

        combined.forEach(e => {
            const amount = Number(e.amount || 0);
            if (e.date) {
                const itemYear = parseInt(e.date.slice(0, 4));
                const itemMonthStr = e.date.slice(0, 7);

                if (itemYear === currYear) {
                    yearIncomeSum += amount;
                    if (itemMonthStr === currMonthStr) {
                        monthIncomeSum += amount;
                    }
                }
            }
        });

        let monthExpenseSum = 0;
        let yearExpenseSum = 0;

        expenses.forEach(e => {
            const amount = Number(e.amount || 0);
            if (e.date) {
                const itemYear = parseInt(e.date.slice(0, 4));
                const itemMonthStr = e.date.slice(0, 7);

                if (itemYear === currYear) {
                    yearExpenseSum += amount;
                    if (itemMonthStr === currMonthStr) {
                        monthExpenseSum += amount;
                    }
                }
            }
        });

        const monthBalance = monthIncomeSum - monthExpenseSum;
        const yearBalance = yearIncomeSum - yearExpenseSum;

        const mInc = document.getElementById('fin-month-income');
        const mExp = document.getElementById('fin-month-expense');
        const mBal = document.getElementById('fin-month-balance');
        const yInc = document.getElementById('fin-year-income');
        const yExp = document.getElementById('fin-year-expense');
        const yBal = document.getElementById('fin-year-balance');

        if (mInc) mInc.innerText = this.app.formatCurrency(monthIncomeSum);
        if (mExp) mExp.innerText = this.app.formatCurrency(monthExpenseSum);
        if (mBal) {
            mBal.innerText = this.app.formatCurrency(monthBalance);
            const card = document.getElementById('fin-month-balance-card');
            if (card) {
                card.style.borderColor = monthBalance >= 0 ? 'var(--status-green)' : 'var(--status-red)';
                mBal.style.color = monthBalance >= 0 ? 'var(--status-green)' : 'var(--status-red)';
            }
        }

        if (yInc) yInc.innerText = this.app.formatCurrency(yearIncomeSum);
        if (yExp) yExp.innerText = this.app.formatCurrency(yearExpenseSum);
        if (yBal) {
            yBal.innerText = this.app.formatCurrency(yearBalance);
            const card = document.getElementById('fin-year-balance-card');
            if (card) {
                card.style.borderColor = yearBalance >= 0 ? 'var(--status-green)' : 'var(--status-red)';
                yBal.style.color = yearBalance >= 0 ? 'var(--status-green)' : 'var(--status-red)';
            }
        }

        this.populateMonthsSelector(combined, expenses);
        this.renderBreakdownAndList();
    }

    renderBreakdownAndList() {
        const selectedMonth = this.monthSelect?.value;
        if (!selectedMonth) return;

        const [yr, mn] = selectedMonth.split('-');
        const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
        const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        const capitalizedMonth = label.charAt(0).toUpperCase() + label.slice(1);

        if (this.activeTab === 'income') {
            this.renderIncomeBreakdownAndList(selectedMonth, capitalizedMonth);
        } else {
            this.renderExpenseBreakdownAndList(selectedMonth, capitalizedMonth);
        }
    }

    renderIncomeBreakdownAndList(selectedMonth, capitalizedMonth) {
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

        const totalMonth = catFreelance + catDiscord + catTrading + catExtraordinary;

        const labelEl = document.getElementById('fin-month-income-label');
        if (labelEl) {
            labelEl.innerText = `Ingresos de ${capitalizedMonth}`;
        }

        const pctFreelance = totalMonth > 0 ? (catFreelance / totalMonth) * 100 : 0;
        const pctDiscord = totalMonth > 0 ? (catDiscord / totalMonth) * 100 : 0;
        const pctTrading = totalMonth > 0 ? (catTrading / totalMonth) * 100 : 0;
        const pctExtraordinary = totalMonth > 0 ? (catExtraordinary / totalMonth) * 100 : 0;

        const segments = [];
        if (catFreelance > 0) segments.push({ percent: pctFreelance, color: 'var(--primary-color)' });
        if (catDiscord > 0) segments.push({ percent: pctDiscord, color: 'var(--status-purple)' });
        if (catTrading > 0) segments.push({ percent: pctTrading, color: 'var(--status-green)' });
        if (catExtraordinary > 0) segments.push({ percent: pctExtraordinary, color: 'var(--status-yellow)' });

        this.drawDonutChart(segments, this.app.formatCurrency(totalMonth));

        const breakdownHtml = `
            <!-- Freelance -->
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div id="fin-freelance-trigger" style="display:flex; justify-content:space-between; font-size:0.9rem; cursor:pointer; user-select:none;">
                    <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
                        <i class="ph ph-caret-right" id="fin-freelance-caret" style="transition: transform 0.2s;"></i>
                        <i class="ph ph-briefcase" style="color:var(--primary-color);"></i> Freelance (Proyectos)
                    </span>
                    <strong style="color:white;">${this.app.formatCurrency(catFreelance)} (${pctFreelance.toFixed(0)}%)</strong>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${pctFreelance}%; background:var(--primary-color); border-radius:4px; transition:width 0.3s;"></div>
                </div>
                <!-- Sub-desglose freelance -->
                <div id="fin-freelance-sub-breakdown" class="hidden" style="padding-left: 20px; font-size: 0.8rem; display: flex; flex-direction: column; gap: 8px; margin-top: 4px; border-left: 2px solid rgba(255,255,255,0.05); margin-left: 6px;">
                    <div style="display:flex; justify-content:space-between; width: 100%;">
                        <span style="color:var(--text-secondary);">💻 Workana:</span>
                        <strong style="color:white;">${this.app.formatCurrency(freelanceWorkana)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; width: 100%;">
                        <span style="color:var(--text-secondary);">🌍 Externo (LinkedIn/Otros):</span>
                        <strong style="color:white;">${this.app.formatCurrency(freelanceExternal)}</strong>
                    </div>
                </div>
            </div>
            <!-- Discord -->
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><i class="ph ph-chat-circle" style="color:var(--status-purple);"></i> Discord (Negocio)</span>
                    <strong style="color:white;">${this.app.formatCurrency(catDiscord)} (${pctDiscord.toFixed(0)}%)</strong>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${pctDiscord}%; background:var(--status-purple); border-radius:4px; transition:width 0.3s;"></div>
                </div>
            </div>
            <!-- Trading -->
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><i class="ph ph-chart-line-up" style="color:var(--status-green);"></i> Trading</span>
                    <strong style="color:white;">${this.app.formatCurrency(catTrading)} (${pctTrading.toFixed(0)}%)</strong>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${pctTrading}%; background:var(--status-green); border-radius:4px; transition:width 0.3s;"></div>
                </div>
            </div>
            <!-- Extraordinarios -->
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><i class="ph ph-gift" style="color:var(--status-yellow);"></i> Ingresos Extraordinarios</span>
                    <strong style="color:white;">${this.app.formatCurrency(catExtraordinary)} (${pctExtraordinary.toFixed(0)}%)</strong>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${pctExtraordinary}%; background:var(--status-yellow); border-radius:4px; transition:width 0.3s;"></div>
                </div>
            </div>
        `;

        document.getElementById('fin-categories-breakdown').innerHTML = breakdownHtml;

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

    renderExpenseBreakdownAndList(selectedMonth, capitalizedMonth) {
        const expenses = this.data.expenses || [];
        const monthExpenses = expenses.filter(e => e.date && e.date.slice(0, 7) === selectedMonth);

        const expenseCategoryConfig = {
            comida: { name: 'Comida & Supermercado', color: '#10b981', icon: 'ph-shopping-cart' },
            vehiculo: { name: 'Vehículo & Nafta', color: '#f43f5e', icon: 'ph-car' },
            servicios: { name: 'Servicios & Suscripciones', color: '#06b6d4', icon: 'ph-credit-card' },
            salud: { name: 'Salud & Farmacia', color: '#8b5cf6', icon: 'ph-first-aid' },
            ocio: { name: 'Salidas & Ocio', color: 'var(--status-yellow)', icon: 'ph-beer-bottle' },
            otros: { name: 'Otros', color: 'var(--text-secondary)', icon: 'ph-dots-three-circle' }
        };

        const grouped = {};
        monthExpenses.forEach(e => {
            const cat = e.category || 'otros';
            grouped[cat] = (grouped[cat] || 0) + Number(e.amount || 0);
        });

        const totalMonthExpense = Object.values(grouped).reduce((a, b) => a + b, 0);

        const labelEl = document.getElementById('fin-month-expense-label');
        if (labelEl) {
            labelEl.innerText = `Gastos de ${capitalizedMonth}`;
        }

        const sortedExpenseCategories = Object.entries(grouped).sort((a, b) => b[1] - a[1]);

        const segments = [];
        sortedExpenseCategories.forEach(([cat, amount], idx) => {
            const pct = totalMonthExpense > 0 ? (amount / totalMonthExpense) * 100 : 0;
            const color = this.getCategoryColor(cat, idx);
            segments.push({ percent: pct, color: color });
        });

        this.drawDonutChart(segments, this.app.formatCurrency(totalMonthExpense));

        let breakdownHtml = '';
        if (sortedExpenseCategories.length === 0) {
            breakdownHtml = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay gastos registrados en este mes.</p>';
        } else {
            breakdownHtml = sortedExpenseCategories.map(([cat, amount], idx) => {
                const meta = expenseCategoryConfig[cat] || {
                    name: cat.charAt(0).toUpperCase() + cat.slice(1),
                    color: this.getCategoryColor(cat, idx),
                    icon: 'ph-tag'
                };
                const pct = totalMonthExpense > 0 ? (amount / totalMonthExpense) * 100 : 0;
                return `
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                            <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
                                <i class="ph ${meta.icon}" style="color:${meta.color};"></i> ${meta.name}
                            </span>
                            <strong style="color:white;">${this.app.formatCurrency(amount)} (${pct.toFixed(0)}%)</strong>
                        </div>
                        <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background:${meta.color}; border-radius:4px; transition:width 0.3s;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('fin-categories-breakdown').innerHTML = breakdownHtml;

        if (!this.listContainer) return;

        if (monthExpenses.length === 0) {
            this.listContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay gastos registrados en este mes.</p>';
            return;
        }

        monthExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        this.listContainer.innerHTML = monthExpenses.map(e => {
            const cat = e.category || 'otros';
            const meta = expenseCategoryConfig[cat] || {
                name: cat.charAt(0).toUpperCase() + cat.slice(1),
                color: this.getCategoryColor(cat, 9),
                icon: 'ph-tag'
            };

            const dateObj = new Date(e.date);
            const dateStr = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

            return `
                <div class="card" style="margin:0; padding:12px 15px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(255,255,255,0.03); gap: 10px;">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                        <div class="icon-container" style="background: rgba(255,255,255,0.03); color: ${meta.color}; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">
                            <i class="ph ${meta.icon}" style="font-size:1.2rem;"></i>
                        </div>
                        <div style="min-width:0;">
                            <h4 style="margin:0; font-size:0.95rem; color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.description}</h4>
                            <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-secondary);">${meta.name} • ${dateStr}</p>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                        <strong style="color:var(--status-orange); font-size:0.95rem;">- ${this.app.formatCurrency(e.amount)}</strong>
                        <button class="btn-delete-fin-expense-item" data-id="${e.id}" style="background:none; border:none; color:var(--status-red); cursor:pointer; padding:6px; display:flex; align-items:center;" title="Eliminar"><i class="ph ph-trash" style="font-size:1.15rem;"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        this.listContainer.querySelectorAll('.btn-delete-fin-expense-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.deleteExpense(id);
            });
        });
    }
}
