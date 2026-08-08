import {
    getLocalISODate,
    getLocalISOMonth,
    parseDateLocal
} from '../utils.js';
import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';
import { getCompactCurrencyDisplayParts } from '../finance-display-utils.mjs?v=20260808-finance-display';
import {
    advanceFinanceRecurringRule,
    buildFinanceRecurringRule,
    getDueFinanceRecurringRules,
    hasRecordedFinanceOccurrence,
    normalizeFinanceRecurringRules,
    removeFinanceRecurringRule,
    upsertFinanceRecurringRule
} from '../finance-recurring-utils.mjs?v=20260729-finance-recurring';
import { buildProjectIncomeMovements } from '../project-income-utils.mjs?v=20260808-project-income';

export class FinanzasModule {
    constructor(appController) {
        this.app = appController;
        this.data = this.loadData();
        this.currentProjectId = null;
        this.activeTab = this.app.uiState?.financeTab || 'income';
        this.pendingRecurringContext = null;
        this.editingRecurringRuleId = null;
        this.recurringModalReturnFocus = null;

        this.monthSelect = document.getElementById('finanzas-month-select');
        this.listContainer = document.getElementById('finanzasList');

        this.init();
    }

    activateFinanceTab(tabId, { persist = true, render = true } = {}) {
        const nextTab = tabId === 'expense' ? 'expense' : 'income';
        const tabIncome = document.getElementById('btnFinTabIncome');
        const tabExpense = document.getElementById('btnFinTabExpense');
        const isIncome = nextTab === 'income';
        this.activeTab = nextTab;

        tabIncome?.classList.toggle('active', isIncome);
        tabExpense?.classList.toggle('active', !isIncome);
        if (tabIncome) {
            tabIncome.style.background = isIncome ? 'rgba(255,255,255,0.05)' : 'none';
            tabIncome.style.color = isIncome ? 'white' : 'var(--text-secondary)';
            tabIncome.setAttribute('aria-pressed', String(isIncome));
        }
        if (tabExpense) {
            tabExpense.style.background = isIncome ? 'none' : 'rgba(255,255,255,0.05)';
            tabExpense.style.color = isIncome ? 'var(--text-secondary)' : 'white';
            tabExpense.setAttribute('aria-pressed', String(!isIncome));
        }

        document.getElementById('btnOpenFinanzasModal')
            ?.classList.toggle('hidden', !isIncome);
        document.getElementById('btnOpenFinanzasExpenseModal')
            ?.classList.toggle('hidden', isIncome);

        const sectionTitle = document.getElementById('fin-section-title');
        const listTitle = document.getElementById('fin-list-title');
        if (sectionTitle) {
            sectionTitle.innerText = isIncome
                ? 'Distribución de Ingresos'
                : 'Distribución de Gastos';
        }
        if (listTitle) {
            listTitle.innerText = isIncome
                ? 'Transacciones del Mes'
                : 'Gastos del Mes';
        }

        if (persist) this.app.saveUiState?.({ financeTab: nextTab });
        if (render) this.renderBreakdownAndList();
    }

    loadData() {
        const raw = localStorage.getItem('finanzasData');
        const defaultData = { entries: [], expenses: [], recurringRules: [] };
        if (!raw) return defaultData;
        try {
            const parsed = JSON.parse(raw) || {};
            if (!parsed.entries) parsed.entries = [];
            if (!parsed.expenses) parsed.expenses = [];
            parsed.recurringRules = normalizeFinanceRecurringRules(parsed.recurringRules);
            return parsed;
        } catch (e) {
            console.error("Error parsing finanzas data:", e);
            return defaultData;
        }
    }

    saveData() {
        localStorage.setItem('finanzasData', JSON.stringify(this.data));
    }

    formatAmount(amount) {
        return this.app.formatFinancialAmount?.(amount)
            || this.app.formatCurrency(amount);
    }

    getFinanceRecurringRuleById(ruleId) {
        const id = String(ruleId || '');
        return (this.data.recurringRules || []).find(rule => rule.id === id) || null;
    }

    getFinanceRecurringCategoryLabel(type, category) {
        const labels = {
            income: {
                discord: 'Discord',
                trading: 'Trading',
                extraordinary: 'Ingreso extraordinario'
            },
            expense: {
                comida: 'Comida & Supermercado',
                vehiculo: 'Vehículo & Nafta',
                servicios: 'Servicios & Suscripciones',
                salud: 'Salud & Farmacia',
                ocio: 'Salidas & Ocio',
                otros: 'Otros'
            }
        };
        return labels[type]?.[category]
            || (category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Otros');
    }

    formatFinanceRecurringAmount(rule) {
        if (this.app.isFinancialAmountsHidden?.()) return '••••••';
        const locale = rule.currency === 'ARS' ? 'es-AR' : 'en-US';
        const value = new Intl.NumberFormat(locale, {
            minimumFractionDigits: rule.currency === 'ARS' ? 0 : 2,
            maximumFractionDigits: rule.currency === 'ARS' ? 0 : 2
        }).format(rule.amount);
        return `${rule.currency} ${value}`;
    }

    formatFinanceRecurringDate(dateValue) {
        const date = parseDateLocal(dateValue);
        return date
            ? date.toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            })
            : dateValue;
    }

    getFinanceRecurringFrequencyLabel(intervalMonths) {
        if (intervalMonths === 1) return 'mensual';
        if (intervalMonths === 12) return 'anual';
        return `cada ${intervalMonths} meses`;
    }

    clearPendingRecurringRegistration() {
        this.pendingRecurringContext = null;
        const incomeNote = document.getElementById('fin-log-recurring-context');
        const expenseNote = document.getElementById('fin-expense-recurring-context');
        const incomeSave = document.getElementById('fin-log-save');
        const expenseSave = document.getElementById('fin-expense-save');

        incomeNote?.classList.add('hidden');
        expenseNote?.classList.add('hidden');
        if (incomeNote) incomeNote.textContent = '';
        if (expenseNote) expenseNote.textContent = '';
        if (incomeSave) incomeSave.textContent = 'Guardar Ingreso';
        if (expenseSave) expenseSave.textContent = 'Guardar Gasto';
    }

    renderFinanceRecurringCategoryOptions(selectedCategory = null) {
        const typeSelect = document.getElementById('finance-recurring-type');
        const categorySelect = document.getElementById('finance-recurring-category');
        if (!typeSelect || !categorySelect) return;

        const type = typeSelect.value === 'income' ? 'income' : 'expense';
        const options = type === 'income'
            ? [
                ['discord', 'Discord (Negocio)'],
                ['trading', 'Trading'],
                ['extraordinary', 'Ingreso extraordinario']
            ]
            : [
                ['comida', 'Comida & Supermercado'],
                ['vehiculo', 'Vehículo & Nafta'],
                ['servicios', 'Servicios & Suscripciones'],
                ['salud', 'Salud & Farmacia'],
                ['ocio', 'Salidas & Ocio'],
                ['otros', 'Otros'],
                ['custom', '+ Categoría personalizada']
            ];

        const fixedValues = options.map(([value]) => value);
        const targetValue = fixedValues.includes(selectedCategory)
            ? selectedCategory
            : (type === 'expense' && selectedCategory ? 'custom' : options[0][0]);

        categorySelect.innerHTML = options
            .map(([value, label]) => (
                `<option value="${value}">${escapeHtml(label)}</option>`
            ))
            .join('');
        categorySelect.value = targetValue;

        const customInput = document.getElementById('finance-recurring-custom-category');
        if (customInput && targetValue === 'custom' && selectedCategory) {
            customInput.value = selectedCategory;
        }
        this.updateFinanceRecurringCustomCategoryVisibility();
    }

    updateFinanceRecurringCustomCategoryVisibility() {
        const type = document.getElementById('finance-recurring-type')?.value;
        const category = document.getElementById('finance-recurring-category')?.value;
        const group = document.getElementById('finance-recurring-custom-category-group');
        const input = document.getElementById('finance-recurring-custom-category');
        const show = type === 'expense' && category === 'custom';
        group?.classList.toggle('hidden', !show);
        if (input) input.required = show;
    }

    resetFinanceRecurringForm() {
        this.editingRecurringRuleId = null;
        const form = document.getElementById('finance-recurring-form');
        form?.reset();

        const type = document.getElementById('finance-recurring-type');
        const nextDate = document.getElementById('finance-recurring-next-date');
        const custom = document.getElementById('finance-recurring-custom-category');
        const title = document.getElementById('finance-recurring-form-title');
        const save = document.getElementById('finance-recurring-save');
        const reset = document.getElementById('finance-recurring-form-reset');
        const error = document.getElementById('finance-recurring-form-error');

        if (type) type.value = 'expense';
        if (nextDate) nextDate.value = getLocalISODate();
        if (custom) custom.value = '';
        if (title) title.textContent = 'Nuevo movimiento';
        if (save) save.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar recurrente';
        reset?.classList.add('hidden');
        error?.classList.add('hidden');
        if (error) error.textContent = '';
        this.renderFinanceRecurringCategoryOptions();
    }

    openFinanceRecurringModal(returnFocusElement = null) {
        const modal = document.getElementById('finance-recurring-modal');
        if (!modal) return;
        this.recurringModalReturnFocus = returnFocusElement || document.activeElement;
        this.resetFinanceRecurringForm();
        this.renderFinanceRecurringManager();
        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('finance-recurring-name')?.focus(), 0);
    }

    closeFinanceRecurringModal() {
        document.getElementById('finance-recurring-modal')?.classList.add('hidden');
        this.resetFinanceRecurringForm();
        const returnFocus = this.recurringModalReturnFocus;
        this.recurringModalReturnFocus = null;
        setTimeout(() => returnFocus?.focus?.(), 0);
    }

    saveFinanceRecurringRule() {
        const type = document.getElementById('finance-recurring-type')?.value || 'expense';
        const categoryValue = document.getElementById('finance-recurring-category')?.value || 'otros';
        const customCategory = document.getElementById('finance-recurring-custom-category')?.value?.trim() || '';
        const category = type === 'expense' && categoryValue === 'custom'
            ? customCategory
            : categoryValue;
        const nextDueDate = document.getElementById('finance-recurring-next-date')?.value || '';
        const existing = this.getFinanceRecurringRuleById(this.editingRecurringRuleId);
        const error = document.getElementById('finance-recurring-form-error');

        const showError = message => {
            if (!error) return;
            error.textContent = message;
            error.classList.remove('hidden');
        };
        error?.classList.add('hidden');
        if (error) error.textContent = '';

        if (!category) {
            showError('Escribí el nombre de la categoría personalizada.');
            document.getElementById('finance-recurring-custom-category')?.focus();
            return;
        }

        try {
            const rule = buildFinanceRecurringRule({
                id: existing?.id,
                type,
                name: document.getElementById('finance-recurring-name')?.value || '',
                category,
                description: document.getElementById('finance-recurring-description')?.value || '',
                amount: document.getElementById('finance-recurring-amount')?.value,
                currency: document.getElementById('finance-recurring-currency')?.value || 'USD',
                intervalMonths: document.getElementById('finance-recurring-interval')?.value || 1,
                anchorDay: Number(nextDueDate.slice(8, 10)),
                nextDueDate,
                active: existing?.active !== false,
                createdAt: existing?.createdAt
            }, {
                id: existing?.id || `finance-recurring-${Date.now()}-${this.data.recurringRules.length + 1}`
            });

            this.data.recurringRules = upsertFinanceRecurringRule(
                this.data.recurringRules,
                rule
            );
            this.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.renderFinanceRecurringManager();
            this.renderFinanceRecurringDuePanel();
            this.resetFinanceRecurringForm();
            this.app.showToast?.(
                existing
                    ? `Movimiento ${rule.name} actualizado.`
                    : `Movimiento ${rule.name} creado.`
            );
        } catch (saveError) {
            showError(saveError.message);
        }
    }

    editFinanceRecurringRule(ruleId) {
        const rule = this.getFinanceRecurringRuleById(ruleId);
        if (!rule) return;
        this.editingRecurringRuleId = rule.id;

        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.value = String(value ?? '');
        };
        setValue('finance-recurring-name', rule.name);
        setValue('finance-recurring-type', rule.type);
        this.renderFinanceRecurringCategoryOptions(rule.category);
        setValue('finance-recurring-description', rule.description);
        setValue('finance-recurring-amount', rule.amount);
        setValue('finance-recurring-currency', rule.currency);
        setValue('finance-recurring-interval', rule.intervalMonths);
        setValue('finance-recurring-next-date', rule.nextDueDate);

        const title = document.getElementById('finance-recurring-form-title');
        const save = document.getElementById('finance-recurring-save');
        const reset = document.getElementById('finance-recurring-form-reset');
        if (title) title.textContent = `Editar ${rule.name}`;
        if (save) save.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar cambios';
        reset?.classList.remove('hidden');
        document.getElementById('finance-recurring-name')?.focus();
    }

    toggleFinanceRecurringRule(ruleId) {
        const rule = this.getFinanceRecurringRuleById(ruleId);
        if (!rule) return;
        this.data.recurringRules = upsertFinanceRecurringRule(
            this.data.recurringRules,
            {
                ...rule,
                active: !rule.active,
                updatedAt: new Date().toISOString()
            }
        );
        this.saveData();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.renderFinanceRecurringManager();
        this.renderFinanceRecurringDuePanel();
        this.app.showToast?.(
            `${rule.name} ${rule.active ? 'pausado' : 'reactivado'}.`
        );
    }

    deleteFinanceRecurringRule(ruleId) {
        const rule = this.getFinanceRecurringRuleById(ruleId);
        if (!rule) return;

        this.data.recurringRules = removeFinanceRecurringRule(
            this.data.recurringRules,
            rule.id
        );
        if (this.editingRecurringRuleId === rule.id) {
            this.resetFinanceRecurringForm();
        }
        this.saveData();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.renderFinanceRecurringManager();
        this.renderFinanceRecurringDuePanel();
        this.app.showUndo(`Movimiento recurrente ${rule.name} eliminado.`, () => {
            this.data.recurringRules = upsertFinanceRecurringRule(
                this.data.recurringRules,
                rule
            );
            this.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.renderFinanceRecurringManager();
            this.renderFinanceRecurringDuePanel();
        });
    }

    renderFinanceRecurringManager() {
        const list = document.getElementById('finance-recurring-list');
        const count = document.getElementById('finance-recurring-count');
        if (!list || !count) return;
        const rules = this.data.recurringRules || [];
        const activeCount = rules.filter(rule => rule.active).length;
        count.textContent = `${rules.length} ${rules.length === 1 ? 'movimiento' : 'movimientos'} · ${activeCount} ${activeCount === 1 ? 'activo' : 'activos'}`;

        if (!rules.length) {
            list.innerHTML = `
                <div class="project-template-empty">
                    <i class="ph ph-arrows-clockwise" style="font-size:1.5rem;"></i>
                    <p style="margin:0.45rem 0 0;">Todavía no configuraste movimientos recurrentes.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = rules.map(rule => {
            const typeLabel = rule.type === 'income' ? 'Ingreso' : 'Gasto';
            const categoryLabel = this.getFinanceRecurringCategoryLabel(rule.type, rule.category);
            const nextDate = this.formatFinanceRecurringDate(rule.nextDueDate);
            const frequency = this.getFinanceRecurringFrequencyLabel(rule.intervalMonths);
            const statusLabel = rule.active ? 'Activo' : 'Pausado';

            return `
                <article class="finance-recurring-list-item ${rule.active ? '' : 'is-paused'}">
                    <div class="finance-recurring-list-copy">
                        <strong>${escapeHtml(rule.name)}</strong>
                        <span>${escapeHtml(typeLabel)} · ${escapeHtml(categoryLabel)} · ${escapeHtml(this.formatFinanceRecurringAmount(rule))}</span>
                        <span>Próximo: ${escapeHtml(nextDate)} · ${escapeHtml(frequency)}</span>
                    </div>
                    <div class="finance-recurring-list-actions">
                        <span class="finance-recurring-status">${statusLabel}</span>
                        <button
                            type="button"
                            class="icon-action-button finance-recurring-edit"
                            data-rule-id="${escapeHtml(rule.id)}"
                            aria-label="Editar movimiento ${escapeHtml(rule.name)}"
                            data-tooltip="Editar recurrente"
                        >
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button
                            type="button"
                            class="icon-action-button finance-recurring-toggle"
                            data-rule-id="${escapeHtml(rule.id)}"
                            aria-label="${rule.active ? 'Pausar' : 'Reactivar'} movimiento ${escapeHtml(rule.name)}"
                            data-tooltip="${rule.active ? 'Pausar recurrente' : 'Reactivar recurrente'}"
                        >
                            <i class="ph ${rule.active ? 'ph-pause' : 'ph-play'}"></i>
                        </button>
                        <button
                            type="button"
                            class="icon-action-button finance-recurring-delete"
                            data-rule-id="${escapeHtml(rule.id)}"
                            aria-label="Eliminar movimiento ${escapeHtml(rule.name)}"
                            data-tooltip="Eliminar recurrente"
                        >
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        list.querySelectorAll('.finance-recurring-edit').forEach(button => {
            button.addEventListener('click', () => {
                this.editFinanceRecurringRule(button.dataset.ruleId);
            });
        });
        list.querySelectorAll('.finance-recurring-toggle').forEach(button => {
            button.addEventListener('click', () => {
                this.toggleFinanceRecurringRule(button.dataset.ruleId);
            });
        });
        list.querySelectorAll('.finance-recurring-delete').forEach(button => {
            button.addEventListener('click', () => {
                this.deleteFinanceRecurringRule(button.dataset.ruleId);
            });
        });
    }

    renderFinanceRecurringDuePanel() {
        const panel = document.getElementById('fin-recurring-due-panel');
        const list = document.getElementById('fin-recurring-due-list');
        const copy = document.getElementById('fin-recurring-due-copy');
        if (!panel || !list || !copy) return;

        const dueRules = getDueFinanceRecurringRules(
            this.data.recurringRules,
            getLocalISODate()
        );
        panel.classList.toggle('hidden', dueRules.length === 0);
        if (!dueRules.length) {
            list.innerHTML = '';
            return;
        }

        copy.textContent = `${dueRules.length} ${dueRules.length === 1 ? 'movimiento necesita' : 'movimientos necesitan'} tu confirmación.`;
        list.innerHTML = dueRules.map(rule => {
            const typeLabel = rule.type === 'income' ? 'Ingreso' : 'Gasto';
            return `
                <article class="finance-recurring-due-item">
                    <div class="finance-recurring-due-copy">
                        <strong>${escapeHtml(rule.name)}</strong>
                        <span>${escapeHtml(typeLabel)} · ${escapeHtml(this.formatFinanceRecurringAmount(rule))} · previsto para ${escapeHtml(this.formatFinanceRecurringDate(rule.nextDueDate))}</span>
                    </div>
                    <button
                        type="button"
                        class="finance-recurring-confirm"
                        data-rule-id="${escapeHtml(rule.id)}"
                    >
                        Revisar y registrar
                    </button>
                </article>
            `;
        }).join('');

        list.querySelectorAll('.finance-recurring-confirm').forEach(button => {
            button.addEventListener('click', () => {
                this.openFinanceRecurringRegistration(button.dataset.ruleId);
            });
        });
    }

    openFinanceRecurringRegistration(ruleId) {
        const rule = this.getFinanceRecurringRuleById(ruleId);
        if (!rule) return;
        this.clearPendingRecurringRegistration();
        this.pendingRecurringContext = {
            ruleId: rule.id,
            occurrenceDate: rule.nextDueDate
        };

        const noteText = `Confirmando "${rule.name}" previsto para ${this.formatFinanceRecurringDate(rule.nextDueDate)}. Podés corregir los datos antes de guardar.`;

        if (rule.type === 'income') {
            const form = document.getElementById('finanzas-log-form');
            form?.reset();
            const category = document.getElementById('fin-input-category');
            const month = document.getElementById('fin-input-month');
            const date = document.getElementById('fin-input-date');
            const description = document.getElementById('fin-input-desc');
            const amount = document.getElementById('fin-input-amount');
            const currency = document.getElementById('fin-input-currency');
            const note = document.getElementById('fin-log-recurring-context');
            const save = document.getElementById('fin-log-save');

            if (category) category.value = rule.category;
            this.toggleModalFields();
            if (month) month.value = rule.nextDueDate.slice(0, 7);
            if (date) date.value = rule.nextDueDate;
            if (description) description.value = rule.description;
            if (amount) amount.value = String(rule.amount);
            if (currency) currency.value = rule.currency;
            if (note) {
                note.textContent = noteText;
                note.classList.remove('hidden');
            }
            if (save) save.textContent = 'Confirmar Ingreso';
            document.getElementById('finanzas-log-modal')?.classList.remove('hidden');
            amount?.focus();
            return;
        }

        const form = document.getElementById('finanzas-expense-form');
        form?.reset();
        const category = document.getElementById('fin-expense-category');
        const customGroup = document.getElementById('fin-expense-group-custom');
        const custom = document.getElementById('fin-expense-custom-name');
        const date = document.getElementById('fin-expense-date');
        const description = document.getElementById('fin-expense-desc');
        const amount = document.getElementById('fin-expense-amount');
        const currency = document.getElementById('fin-expense-currency');
        const note = document.getElementById('fin-expense-recurring-context');
        const save = document.getElementById('fin-expense-save');
        const fixedExpenseCategories = new Set([
            'comida',
            'vehiculo',
            'servicios',
            'salud',
            'ocio',
            'otros'
        ]);

        if (category) {
            category.value = fixedExpenseCategories.has(rule.category)
                ? rule.category
                : 'custom';
        }
        const isCustom = !fixedExpenseCategories.has(rule.category);
        customGroup?.classList.toggle('hidden', !isCustom);
        if (custom) {
            custom.value = isCustom ? rule.category : '';
            custom.required = isCustom;
        }
        if (date) date.value = rule.nextDueDate;
        if (description) description.value = rule.description;
        if (amount) amount.value = String(rule.amount);
        if (currency) currency.value = rule.currency;
        if (note) {
            note.textContent = noteText;
            note.classList.remove('hidden');
        }
        if (save) save.textContent = 'Confirmar Gasto';
        document.getElementById('finanzas-expense-modal')?.classList.remove('hidden');
        amount?.focus();
    }

    advanceFinanceRecurringAfterRecord(context) {
        if (!context) return;
        const rule = this.getFinanceRecurringRuleById(context.ruleId);
        if (!rule) return;
        const advanced = advanceFinanceRecurringRule(rule, {
            occurrenceDate: context.occurrenceDate
        });
        this.data.recurringRules = upsertFinanceRecurringRule(
            this.data.recurringRules,
            advanced
        );
    }

    init() {
        // Pestañas (Income vs Expense)
        const tabIncome = document.getElementById('btnFinTabIncome');
        const tabExpense = document.getElementById('btnFinTabExpense');

        tabIncome?.addEventListener('click', () => {
            this.activateFinanceTab('income');
        });

        tabExpense?.addEventListener('click', () => {
            this.activateFinanceTab('expense');
        });

        // Modal de Registro de Ingresos
        const btnOpenModal = document.getElementById('btnOpenFinanzasModal');
        const modal = document.getElementById('finanzas-log-modal');
        const cancelBtn = document.getElementById('fin-log-cancel');
        const form = document.getElementById('finanzas-log-form');
        const categorySelect = document.getElementById('fin-input-category');

        btnOpenModal?.addEventListener('click', () => {
            this.clearPendingRecurringRegistration();
            form?.reset();
            const dateInp = document.getElementById('fin-input-date');
            const monthInp = document.getElementById('fin-input-month');
            if (dateInp) dateInp.value = getLocalISODate();
            if (monthInp) monthInp.value = getLocalISOMonth();

            this.toggleModalFields();
            modal?.classList.remove('hidden');
        });

        cancelBtn?.addEventListener('click', () => {
            modal?.classList.add('hidden');
            this.clearPendingRecurringRegistration();
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
            this.clearPendingRecurringRegistration();
            expenseForm?.reset();
            const dateInp = document.getElementById('fin-expense-date');
            if (dateInp) dateInp.value = getLocalISODate();
            customCategoryGroup?.classList.add('hidden');
            expenseModal?.classList.remove('hidden');
        });

        cancelExpenseBtn?.addEventListener('click', () => {
            expenseModal?.classList.add('hidden');
            this.clearPendingRecurringRegistration();
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

        const recurringManageButton = document.getElementById('btnManageFinanceRecurring');
        const recurringModal = document.getElementById('finance-recurring-modal');
        const recurringCloseButton = document.getElementById('finance-recurring-close');
        const recurringForm = document.getElementById('finance-recurring-form');
        const recurringType = document.getElementById('finance-recurring-type');
        const recurringCategory = document.getElementById('finance-recurring-category');
        const recurringResetButton = document.getElementById('finance-recurring-form-reset');

        recurringManageButton?.addEventListener('click', () => {
            this.openFinanceRecurringModal(recurringManageButton);
        });
        recurringCloseButton?.addEventListener('click', () => {
            this.closeFinanceRecurringModal();
        });
        recurringModal?.addEventListener('click', event => {
            if (event.target === recurringModal) this.closeFinanceRecurringModal();
        });
        recurringModal?.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeFinanceRecurringModal();
            }
        });
        recurringType?.addEventListener('change', () => {
            this.renderFinanceRecurringCategoryOptions();
        });
        recurringCategory?.addEventListener('change', () => {
            this.updateFinanceRecurringCustomCategoryVisibility();
        });
        recurringResetButton?.addEventListener('click', () => {
            this.resetFinanceRecurringForm();
        });
        recurringForm?.addEventListener('submit', event => {
            event.preventDefault();
            this.saveFinanceRecurringRule();
        });

        // Selector del mes global
        this.monthSelect?.addEventListener('change', () => {
            this.app.saveUiState?.({ financeMonth: this.monthSelect.value });
            this.renderBreakdownAndList();
        });

        // Listeners para modal de desglose anual de ingresos
        const btnOpenYear = document.getElementById('btnOpenFinYearDetails');
        const yearModal = document.getElementById('finanzas-year-details-modal');
        const closeYearBtn = document.getElementById('fin-year-modal-close');
        const yearSelect = document.getElementById('fin-year-select');
        const yearCategorySelect = document.getElementById('fin-year-category-select');

        btnOpenYear?.addEventListener('click', () => {
            this.populateYearsSelector();
            this.renderAnnualBreakdown();
            yearModal?.classList.remove('hidden');
            requestAnimationFrame(() => yearSelect?.focus());
        });

        closeYearBtn?.addEventListener('click', () => {
            yearModal?.classList.add('hidden');
            btnOpenYear?.focus();
        });

        yearSelect?.addEventListener('change', () => {
            this.renderAnnualBreakdown();
        });
        yearCategorySelect?.addEventListener('change', () => {
            this.renderAnnualBreakdown();
        });
        yearModal?.addEventListener('click', event => {
            if (event.target === yearModal) yearModal.classList.add('hidden');
        });
        yearModal?.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                yearModal.classList.add('hidden');
                btnOpenYear?.focus();
            }
        });

        // Listeners para modal de desglose anual de gastos
        const btnOpenExpenseYear = document.getElementById('btnOpenFinExpenseYearDetails');
        const expenseYearModal = document.getElementById('finanzas-expense-year-details-modal');
        const closeExpenseYearBtn = document.getElementById('fin-expense-year-modal-close');
        const expenseYearSelect = document.getElementById('fin-expense-year-select');
        const expenseYearCategorySelect = document.getElementById('fin-expense-year-category-select');

        btnOpenExpenseYear?.addEventListener('click', () => {
            this.populateExpenseYearsSelector();
            this.renderExpenseAnnualBreakdown();
            expenseYearModal?.classList.remove('hidden');
            requestAnimationFrame(() => expenseYearSelect?.focus());
        });

        closeExpenseYearBtn?.addEventListener('click', () => {
            expenseYearModal?.classList.add('hidden');
            btnOpenExpenseYear?.focus();
        });

        expenseYearSelect?.addEventListener('change', () => {
            this.renderExpenseAnnualBreakdown();
        });
        expenseYearCategorySelect?.addEventListener('change', () => {
            this.renderExpenseAnnualBreakdown();
        });
        expenseYearModal?.addEventListener('click', event => {
            if (event.target === expenseYearModal) expenseYearModal.classList.add('hidden');
        });
        expenseYearModal?.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                expenseYearModal.classList.add('hidden');
                btnOpenExpenseYear?.focus();
            }
        });

        this.activateFinanceTab(this.activeTab, {
            persist: false,
            render: false
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

    async saveEntry() {
        const recurringContext = this.pendingRecurringContext
            ? { ...this.pendingRecurringContext }
            : null;
        if (
            recurringContext
            && hasRecordedFinanceOccurrence(
                this.data,
                recurringContext.ruleId,
                recurringContext.occurrenceDate
            )
        ) {
            this.advanceFinanceRecurringAfterRecord(recurringContext);
            this.saveData();
            document.getElementById('finanzas-log-modal')?.classList.add('hidden');
            this.clearPendingRecurringRegistration();
            this.render();
            this.app.showToast?.('Ese ingreso ya estaba registrado; se corrigió su próxima fecha.');
            return;
        }

        const category = document.getElementById('fin-input-category')?.value;
        const amountInput = parseFloat(document.getElementById('fin-input-amount')?.value) || 0;
        const currency = document.getElementById('fin-input-currency')?.value || 'USD';

        let amount = amountInput;
        if (currency === 'ARS') {
            const rate = this.app.getValidCachedLemonRate() ?? await this.app.fetchLemonRate();
            if (rate === null) {
                await this.app.showMessage({
                    title: 'Cotización no disponible',
                    message: 'El ingreso no fue guardado para evitar una conversión incorrecta de ARS.',
                    tone: 'danger'
                });
                return;
            }
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
            description: descVal,
            ...(recurringContext ? {
                recurringRuleId: recurringContext.ruleId,
                recurringOccurrence: recurringContext.occurrenceDate
            } : {})
        };

        this.data.entries.push(newEntry);
        this.advanceFinanceRecurringAfterRecord(recurringContext);
        this.saveData();

        document.getElementById('finanzas-log-modal')?.classList.add('hidden');
        this.clearPendingRecurringRegistration();

        this.app.auth?.syncToCloud(false).catch(() => {});
        this.render();
    }

    async deleteEntry(id) {
        const entry = this.data.entries.find(item => item.id === id);
        if (!entry) return;
        const confirmed = await this.app.confirmAction({
            title: 'Eliminar ingreso',
            message: 'Este cobro dejará de formar parte de los totales y balances.',
            tone: 'danger',
            details: [
                { label: 'Detalle', value: entry.description || 'Sin descripción' },
                { label: 'Monto', value: this.formatAmount(entry.amount) },
                { label: 'Fecha', value: this.formatFinanceRecurringDate(entry.date) },
                {
                    label: 'Categoría',
                    value: this.getFinanceRecurringCategoryLabel('income', entry.category)
                }
            ],
            cancelLabel: 'Conservar ingreso',
            confirmLabel: 'Eliminar ingreso',
            closeOnBackdrop: false
        });
        if (!confirmed) return;

        const index = this.data.entries.findIndex(item => item.id === id);
        if (index < 0) return;
        const deletedEntry = this.data.entries[index];
        this.data.entries.splice(index, 1);
        this.saveData();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.render();
        this.app.showUndo('Ingreso eliminado.', () => {
            this.data.entries.splice(index, 0, deletedEntry);
            this.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.render();
        });
    }

    async saveExpenseEntry() {
        const recurringContext = this.pendingRecurringContext
            ? { ...this.pendingRecurringContext }
            : null;
        if (
            recurringContext
            && hasRecordedFinanceOccurrence(
                this.data,
                recurringContext.ruleId,
                recurringContext.occurrenceDate
            )
        ) {
            this.advanceFinanceRecurringAfterRecord(recurringContext);
            this.saveData();
            document.getElementById('finanzas-expense-modal')?.classList.add('hidden');
            this.clearPendingRecurringRegistration();
            this.render();
            this.app.showToast?.('Ese gasto ya estaba registrado; se corrigió su próxima fecha.');
            return;
        }

        const categorySelect = document.getElementById('fin-expense-category')?.value;
        const customName = (document.getElementById('fin-expense-custom-name')?.value || '').trim();
        const amountInput = parseFloat(document.getElementById('fin-expense-amount')?.value) || 0;
        const currency = document.getElementById('fin-expense-currency')?.value || 'USD';
        const dateVal = document.getElementById('fin-expense-date')?.value || getLocalISODate();
        const descVal = (document.getElementById('fin-expense-desc')?.value || '').trim();

        let amount = amountInput;
        if (currency === 'ARS') {
            const rate = this.app.getValidCachedLemonRate() ?? await this.app.fetchLemonRate();
            if (rate === null) {
                await this.app.showMessage({
                    title: 'Cotización no disponible',
                    message: 'El gasto no fue guardado para evitar una conversión incorrecta de ARS.',
                    tone: 'danger'
                });
                return;
            }
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
            description: descVal,
            ...(recurringContext ? {
                recurringRuleId: recurringContext.ruleId,
                recurringOccurrence: recurringContext.occurrenceDate
            } : {})
        };

        this.data.expenses.push(newExpense);
        this.advanceFinanceRecurringAfterRecord(recurringContext);
        this.saveData();

        document.getElementById('finanzas-expense-modal')?.classList.add('hidden');
        this.clearPendingRecurringRegistration();

        this.app.auth?.syncToCloud(false).catch(() => {});
        this.render();
    }

    async deleteExpense(id) {
        const expense = this.data.expenses.find(item => item.id === id);
        if (!expense) return;
        const confirmed = await this.app.confirmAction({
            title: 'Eliminar gasto',
            message: 'Este gasto dejará de formar parte de los totales y balances.',
            tone: 'danger',
            details: [
                { label: 'Detalle', value: expense.description || 'Sin descripción' },
                { label: 'Monto', value: this.formatAmount(expense.amount) },
                { label: 'Fecha', value: this.formatFinanceRecurringDate(expense.date) },
                {
                    label: 'Categoría',
                    value: this.getFinanceRecurringCategoryLabel('expense', expense.category)
                }
            ],
            cancelLabel: 'Conservar gasto',
            confirmLabel: 'Eliminar gasto',
            closeOnBackdrop: false
        });
        if (!confirmed) return;

        const index = this.data.expenses.findIndex(item => item.id === id);
        if (index < 0) return;
        const deletedExpense = this.data.expenses[index];
        this.data.expenses.splice(index, 1);
        this.saveData();
        this.app.auth?.syncToCloud(false).catch(() => {});
        this.render();
        this.app.showUndo('Gasto eliminado.', () => {
            this.data.expenses.splice(index, 0, deletedExpense);
            this.saveData();
            this.app.auth?.syncToCloud(false).catch(() => {});
            this.render();
        });
    }

    getCombinedEntries() {
        const list = [...(this.data.entries || [])];

        const projectMovements = buildProjectIncomeMovements({
            activeProjects: this.app.projects?.projects || [],
            historyProjects: this.app.projects?.history || [],
            fallbackDate: getLocalISODate()
        });
        projectMovements.forEach(movement => {
            list.push({
                id: movement.id,
                category: 'freelance',
                source: movement.source,
                date: movement.date,
                amount: movement.amount,
                description: movement.description
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

    drawDonutChart(segments, totalAmount) {
        const elDonut = document.getElementById('fin-donut-chart');
        const elValue = document.getElementById('fin-donut-center-value');
        const elCurrency = document.getElementById('fin-donut-center-currency');
        const elAmount = document.getElementById('fin-donut-center-amount');
        const elLabel = document.getElementById('fin-donut-center-label');

        if (!elDonut || !elValue || !elCurrency || !elAmount || !elLabel) return;

        if (this.activeTab === 'income') {
            elLabel.innerText = 'Ingresado';
            elValue.style.color = 'var(--status-green)';
        } else {
            elLabel.innerText = 'Gastado';
            elValue.style.color = 'var(--status-orange)';
        }
        const preferredCurrency = localStorage.getItem('preferred_currency') || 'USD';
        const amountsHidden = this.app.isFinancialAmountsHidden?.() === true;
        const exactValue = this.formatAmount(totalAmount);
        const compactValue = amountsHidden
            ? { currency: '', amount: '••••••' }
            : getCompactCurrencyDisplayParts(totalAmount, {
                currency: preferredCurrency,
                arsRate: preferredCurrency === 'ARS'
                    ? this.app.getCurrencyMultiplier?.()
                    : null
            });
        elCurrency.innerText = compactValue.currency;
        elAmount.innerText = compactValue.amount;
        elValue.dataset.amountLength = compactValue.amount.length > 9
            ? 'long'
            : (compactValue.amount.length > 6 ? 'medium' : 'short');
        elValue.title = exactValue;
        elValue.setAttribute('aria-label', exactValue);

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

    getAnnualMonthState(selectedYear, monthIndex) {
        const now = new Date();
        const selectedIndex = (selectedYear * 12) + monthIndex;
        const currentIndex = (now.getFullYear() * 12) + now.getMonth();
        return {
            isCurrent: selectedIndex === currentIndex,
            isFuture: selectedIndex > currentIndex
        };
    }

    applyAnnualCategoryFilter(modalId, selectedCategory) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.dataset.categoryFilter = selectedCategory;
        modal.querySelectorAll('[data-annual-category]').forEach(cell => {
            cell.classList.toggle(
                'hidden',
                selectedCategory !== 'all'
                    && cell.dataset.annualCategory !== selectedCategory
            );
        });
    }

    renderAnnualMobileList({
        containerId,
        selectedYear,
        monthlyData,
        entries,
        categories,
        selectedCategory,
        getEntryCategory,
        tone
    }) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const visibleCategories = selectedCategory === 'all'
            ? categories
            : categories.filter(category => category.key === selectedCategory);
        const sign = tone === 'expense' ? '-' : '+';

        container.innerHTML = monthlyData.map(month => {
            const date = new Date(selectedYear, month.monthIndex, 1);
            const monthName = date.toLocaleDateString('es-AR', { month: 'long' });
            const title = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            const { isCurrent, isFuture } = this.getAnnualMonthState(
                selectedYear,
                month.monthIndex
            );
            const total = selectedCategory === 'all'
                ? month.total
                : Number(month[selectedCategory] || 0);
            const monthEntries = entries.filter(entry => {
                if (!entry.date || parseInt(entry.date.slice(0, 4)) !== selectedYear) {
                    return false;
                }
                if (parseInt(entry.date.slice(5, 7)) - 1 !== month.monthIndex) {
                    return false;
                }
                return selectedCategory === 'all'
                    || getEntryCategory(entry) === selectedCategory;
            });
            const categoryRows = visibleCategories.map(category => `
                <div>
                    <span>${escapeHtml(category.label)}</span>
                    <strong>${this.formatAmount(month[category.key])}</strong>
                </div>
            `).join('');
            const movementRows = monthEntries.length > 0
                ? monthEntries
                    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                    .map(entry => {
                        const parsedDate = parseDateLocal(entry.date);
                        const dateLabel = parsedDate
                            ? parsedDate.toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: 'short'
                            })
                            : entry.date;
                        return `
                            <div class="finance-annual-mobile-movement">
                                <span>
                                    <strong>${escapeHtml(entry.description || 'Sin descripción')}</strong>
                                    <small>${escapeHtml(dateLabel || '-')}</small>
                                </span>
                                <b>${sign} ${this.formatAmount(entry.amount)}</b>
                            </div>
                        `;
                    }).join('')
                : '<p class="finance-annual-mobile-empty">Sin movimientos registrados.</p>';

            return `
                <details class="finance-annual-mobile-month${isCurrent ? ' is-current' : ''}${isFuture ? ' is-future' : ''}"${isCurrent ? ' open' : ''}>
                    <summary>
                        <span>
                            <strong>${escapeHtml(title)}</strong>
                            ${isCurrent ? '<small>En curso</small>' : (isFuture ? '<small>Futuro</small>' : '')}
                        </span>
                        <b>${this.formatAmount(total)}</b>
                    </summary>
                    <div class="finance-annual-mobile-detail">
                        <div class="finance-annual-mobile-categories">${categoryRows}</div>
                        <div class="finance-annual-mobile-movements">
                            <h5>Movimientos</h5>
                            ${movementRows}
                        </div>
                    </div>
                </details>
            `;
        }).join('');
    }

    renderAnnualBreakdown() {
        const yearSelect = document.getElementById('fin-year-select');
        const categorySelect = document.getElementById('fin-year-category-select');
        const tableBody = document.getElementById('fin-year-table-body');
        if (!yearSelect || !categorySelect || !tableBody) return;

        const selectedYear = parseInt(yearSelect.value) || new Date().getFullYear();
        const selectedCategory = categorySelect.value || 'all';
        const combined = this.getCombinedEntries();
        const yearEntries = combined.filter(e => e.date && parseInt(e.date.slice(0, 4)) === selectedYear);
        const categories = [
            { key: 'freelance', label: 'Freelance' },
            { key: 'discord', label: 'Discord' },
            { key: 'trading', label: 'Trading' },
            { key: 'extraordinary', label: 'Extraordinario' }
        ];
        const categoryKeys = new Set(categories.map(category => category.key));
        const getEntryCategory = entry => categoryKeys.has(entry.category)
            ? entry.category
            : 'extraordinary';

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
                monthlyData[monthIdx][getEntryCategory(e)] += amt;
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
            const { isCurrent, isFuture } = this.getAnnualMonthState(
                selectedYear,
                m.monthIndex
            );
            const filteredTotal = selectedCategory === 'all'
                ? m.total
                : m[selectedCategory];

            return `
                <tr class="finance-annual-row${isCurrent ? ' is-current' : ''}${isFuture ? ' is-future' : ''}">
                    <td>${escapeHtml(capitalizedMonth)}${isCurrent ? '<span>En curso</span>' : ''}</td>
                    <td data-annual-category="freelance">${this.formatAmount(m.freelance)}</td>
                    <td data-annual-category="discord">${this.formatAmount(m.discord)}</td>
                    <td data-annual-category="trading">${this.formatAmount(m.trading)}</td>
                    <td data-annual-category="extraordinary">${this.formatAmount(m.extraordinary)}</td>
                    <td class="finance-annual-total">${this.formatAmount(filteredTotal)}</td>
                </tr>
            `;
        }).join('');

        const tf = document.getElementById('fin-year-tot-freelance');
        const td = document.getElementById('fin-year-tot-discord');
        const tt = document.getElementById('fin-year-tot-trading');
        const te = document.getElementById('fin-year-tot-extraordinary');
        const tg = document.getElementById('fin-year-tot-grand');

        if (tf) tf.innerText = this.formatAmount(totFreelance);
        if (td) td.innerText = this.formatAmount(totDiscord);
        if (tt) tt.innerText = this.formatAmount(totTrading);
        if (te) te.innerText = this.formatAmount(totExtraordinary);
        if (tg) {
            const selectedTotal = {
                freelance: totFreelance,
                discord: totDiscord,
                trading: totTrading,
                extraordinary: totExtraordinary
            }[selectedCategory];
            tg.innerText = this.formatAmount(
                selectedCategory === 'all' ? totGrand : selectedTotal
            );
        }

        this.applyAnnualCategoryFilter(
            'finanzas-year-details-modal',
            selectedCategory
        );
        this.renderAnnualMobileList({
            containerId: 'fin-year-mobile-list',
            selectedYear,
            monthlyData,
            entries: yearEntries,
            categories,
            selectedCategory,
            getEntryCategory,
            tone: 'income'
        });
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
        const categorySelect = document.getElementById('fin-expense-year-category-select');
        const tableBody = document.getElementById('fin-expense-year-table-body');
        if (!yearSelect || !categorySelect || !tableBody) return;

        const selectedYear = parseInt(yearSelect.value) || new Date().getFullYear();
        const selectedCategory = categorySelect.value || 'all';
        const expenses = this.data.expenses || [];
        const yearExpenses = expenses.filter(e => e.date && parseInt(e.date.slice(0, 4)) === selectedYear);
        const categories = [
            { key: 'comida', label: 'Comida' },
            { key: 'vehiculo', label: 'Vehículo' },
            { key: 'servicios', label: 'Servicios' },
            { key: 'salud', label: 'Salud' },
            { key: 'ocio', label: 'Ocio' },
            { key: 'otros', label: 'Otros' }
        ];
        const categoryKeys = new Set(categories
            .filter(category => category.key !== 'otros')
            .map(category => category.key));
        const getEntryCategory = entry => categoryKeys.has(entry.category)
            ? entry.category
            : 'otros';

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
                monthlyData[monthIdx][getEntryCategory(e)] += amt;
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
            const { isCurrent, isFuture } = this.getAnnualMonthState(
                selectedYear,
                m.monthIndex
            );
            const filteredTotal = selectedCategory === 'all'
                ? m.total
                : m[selectedCategory];

            return `
                <tr class="finance-annual-row${isCurrent ? ' is-current' : ''}${isFuture ? ' is-future' : ''}">
                    <td>${escapeHtml(capitalizedMonth)}${isCurrent ? '<span>En curso</span>' : ''}</td>
                    <td data-annual-category="comida">${this.formatAmount(m.comida)}</td>
                    <td data-annual-category="vehiculo">${this.formatAmount(m.vehiculo)}</td>
                    <td data-annual-category="servicios">${this.formatAmount(m.servicios)}</td>
                    <td data-annual-category="salud">${this.formatAmount(m.salud)}</td>
                    <td data-annual-category="ocio">${this.formatAmount(m.ocio)}</td>
                    <td data-annual-category="otros">${this.formatAmount(m.otros)}</td>
                    <td class="finance-annual-total">${this.formatAmount(filteredTotal)}</td>
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

        if (tc) tc.innerText = this.formatAmount(totComida);
        if (tv) tv.innerText = this.formatAmount(totVehiculo);
        if (ts) ts.innerText = this.formatAmount(totServicios);
        if (tsl) tsl.innerText = this.formatAmount(totSalud);
        if (to) to.innerText = this.formatAmount(totOcio);
        if (tot) tot.innerText = this.formatAmount(totOtros);
        if (tg) {
            const selectedTotal = {
                comida: totComida,
                vehiculo: totVehiculo,
                servicios: totServicios,
                salud: totSalud,
                ocio: totOcio,
                otros: totOtros
            }[selectedCategory];
            tg.innerText = this.formatAmount(
                selectedCategory === 'all' ? totGrand : selectedTotal
            );
        }

        this.applyAnnualCategoryFilter(
            'finanzas-expense-year-details-modal',
            selectedCategory
        );
        this.renderAnnualMobileList({
            containerId: 'fin-expense-year-mobile-list',
            selectedYear,
            monthlyData,
            entries: yearExpenses,
            categories,
            selectedCategory,
            getEntryCategory,
            tone: 'expense'
        });
    }

    populateMonthsSelector(combinedIncomes, expenses) {
        if (!this.monthSelect) return;
        const monthsSet = new Set();

        const currMonthStr = getLocalISOMonth();
        monthsSet.add(currMonthStr);

        combinedIncomes.forEach(e => {
            if (e.date) monthsSet.add(e.date.slice(0, 7));
        });
        expenses.forEach(e => {
            if (e.date) monthsSet.add(e.date.slice(0, 7));
        });

        const sortedMonths = Array.from(monthsSet).sort().reverse();
        const selected = this.monthSelect.value
            || this.app.uiState?.financeMonth
            || currMonthStr;

        this.monthSelect.innerHTML = sortedMonths.map(m => {
            const [yr, mn] = m.split('-');
            const d = new Date(parseInt(yr), parseInt(mn) - 1, 1);
            const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
            return `<option value="${escapeHtml(m)}">${escapeHtml(capitalized)}</option>`;
        }).join('');

        if (sortedMonths.includes(selected)) {
            this.monthSelect.value = selected;
        } else {
            this.monthSelect.value = sortedMonths[0] || currMonthStr;
        }
    }

    render() {
        this.renderFinanceRecurringDuePanel();
        const combined = this.getCombinedEntries();
        const expenses = this.data.expenses || [];
        const now = new Date();
        const currYear = now.getFullYear();
        const currMonthStr = getLocalISOMonth(now);

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

        if (mInc) mInc.innerText = this.formatAmount(monthIncomeSum);
        if (mExp) mExp.innerText = this.formatAmount(monthExpenseSum);
        if (mBal) {
            mBal.innerText = this.formatAmount(monthBalance);
            const card = document.getElementById('fin-month-balance-card');
            if (card) {
                card.style.borderColor = monthBalance >= 0 ? 'var(--status-green)' : 'var(--status-red)';
                mBal.style.color = monthBalance >= 0 ? 'var(--status-green)' : 'var(--status-red)';
            }
        }

        if (yInc) yInc.innerText = this.formatAmount(yearIncomeSum);
        if (yExp) yExp.innerText = this.formatAmount(yearExpenseSum);
        if (yBal) {
            yBal.innerText = this.formatAmount(yearBalance);
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

        if (this.activeTab === 'income') {
            this.renderIncomeBreakdownAndList(selectedMonth);
        } else {
            this.renderExpenseBreakdownAndList(selectedMonth);
        }
    }

    renderIncomeBreakdownAndList(selectedMonth) {
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

        const pctFreelance = totalMonth > 0 ? (catFreelance / totalMonth) * 100 : 0;
        const pctDiscord = totalMonth > 0 ? (catDiscord / totalMonth) * 100 : 0;
        const pctTrading = totalMonth > 0 ? (catTrading / totalMonth) * 100 : 0;
        const pctExtraordinary = totalMonth > 0 ? (catExtraordinary / totalMonth) * 100 : 0;

        const segments = [];
        if (catFreelance > 0) segments.push({ percent: pctFreelance, color: 'var(--primary-color)' });
        if (catDiscord > 0) segments.push({ percent: pctDiscord, color: 'var(--status-purple)' });
        if (catTrading > 0) segments.push({ percent: pctTrading, color: 'var(--status-green)' });
        if (catExtraordinary > 0) segments.push({ percent: pctExtraordinary, color: 'var(--status-yellow)' });

        this.drawDonutChart(segments, totalMonth);

        const breakdownHtml = `
            <!-- Freelance -->
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div id="fin-freelance-trigger" style="display:flex; justify-content:space-between; font-size:0.9rem; cursor:pointer; user-select:none;">
                    <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
                        <i class="ph ph-caret-right" id="fin-freelance-caret" style="transition: transform 0.2s;"></i>
                        <i class="ph ph-briefcase" style="color:var(--primary-color);"></i> Freelance (Proyectos)
                    </span>
                    <strong style="color:white;">${this.formatAmount(catFreelance)} (${pctFreelance.toFixed(0)}%)</strong>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${pctFreelance}%; background:var(--primary-color); border-radius:4px; transition:width 0.3s;"></div>
                </div>
                <!-- Sub-desglose freelance -->
                <div id="fin-freelance-sub-breakdown" class="hidden" style="padding-left: 20px; font-size: 0.8rem; display: flex; flex-direction: column; gap: 8px; margin-top: 4px; border-left: 2px solid rgba(255,255,255,0.05); margin-left: 6px;">
                    <div style="display:flex; justify-content:space-between; width: 100%;">
                        <span style="color:var(--text-secondary);">💻 Workana:</span>
                        <strong style="color:white;">${this.formatAmount(freelanceWorkana)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; width: 100%;">
                        <span style="color:var(--text-secondary);">🌍 Externo (LinkedIn/Otros):</span>
                        <strong style="color:white;">${this.formatAmount(freelanceExternal)}</strong>
                    </div>
                </div>
            </div>
            <!-- Discord -->
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><i class="ph ph-chat-circle" style="color:var(--status-purple);"></i> Discord (Negocio)</span>
                    <strong style="color:white;">${this.formatAmount(catDiscord)} (${pctDiscord.toFixed(0)}%)</strong>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${pctDiscord}%; background:var(--status-purple); border-radius:4px; transition:width 0.3s;"></div>
                </div>
            </div>
            <!-- Trading -->
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><i class="ph ph-chart-line-up" style="color:var(--status-green);"></i> Trading</span>
                    <strong style="color:white;">${this.formatAmount(catTrading)} (${pctTrading.toFixed(0)}%)</strong>
                </div>
                <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${pctTrading}%; background:var(--status-green); border-radius:4px; transition:width 0.3s;"></div>
                </div>
            </div>
            <!-- Extraordinarios -->
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><i class="ph ph-gift" style="color:var(--status-yellow);"></i> Ingresos Extraordinarios</span>
                    <strong style="color:white;">${this.formatAmount(catExtraordinary)} (${pctExtraordinary.toFixed(0)}%)</strong>
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

            const dateObj = parseDateLocal(e.date);
            const dateStr = dateObj
                ? dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                : e.date;
            const safeDescription = escapeHtml(e.description || 'Sin descripción');
            const safeDate = escapeHtml(dateStr || '-');
            const safeId = escapeHtml(e.id);

            const isManual = !String(e.id).startsWith('proj-');
            const deleteBtn = isManual
                ? `<button type="button" class="btn-delete-fin-item icon-btn icon-btn-sm is-danger" data-id="${safeId}" data-tooltip="Eliminar ingreso" aria-label="Eliminar ingreso ${safeDescription}"><i class="ph ph-trash" aria-hidden="true"></i></button>`
                : `<span style="font-size: 0.7rem; color: var(--text-secondary); padding: 4px 8px; background: rgba(255,255,255,0.03); border:1px solid var(--surface-border); border-radius:4px;">Proyecto</span>`;

            return `
                <div class="card" style="margin:0; padding:12px 15px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(255,255,255,0.03); gap: 10px;">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                        <div class="icon-container" style="background: rgba(255,255,255,0.03); color: ${color}; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">
                            <i class="ph ${icon}" style="font-size:1.2rem;"></i>
                        </div>
                        <div style="min-width:0;">
                            <h4 style="margin:0; font-size:0.95rem; color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeDescription}</h4>
                            <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-secondary);">${catName} • ${safeDate}</p>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                        <strong style="color:var(--status-green); font-size:0.95rem;">+ ${this.formatAmount(e.amount)}</strong>
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

    renderExpenseBreakdownAndList(selectedMonth) {
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

        const grouped = Object.create(null);
        monthExpenses.forEach(e => {
            const cat = e.category || 'otros';
            grouped[cat] = (grouped[cat] || 0) + Number(e.amount || 0);
        });

        const totalMonthExpense = Object.values(grouped).reduce((a, b) => a + b, 0);

        const sortedExpenseCategories = Object.entries(grouped).sort((a, b) => b[1] - a[1]);

        const segments = [];
        sortedExpenseCategories.forEach(([cat, amount], idx) => {
            const pct = totalMonthExpense > 0 ? (amount / totalMonthExpense) * 100 : 0;
            const color = this.getCategoryColor(cat, idx);
            segments.push({ percent: pct, color: color });
        });

        this.drawDonutChart(segments, totalMonthExpense);

        let breakdownHtml = '';
        if (sortedExpenseCategories.length === 0) {
            breakdownHtml = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No hay gastos registrados en este mes.</p>';
        } else {
            breakdownHtml = sortedExpenseCategories.map(([cat, amount], idx) => {
                const meta = (Object.hasOwn(expenseCategoryConfig, cat) && expenseCategoryConfig[cat]) || {
                    name: cat.charAt(0).toUpperCase() + cat.slice(1),
                    color: this.getCategoryColor(cat, idx),
                    icon: 'ph-tag'
                };
                const pct = totalMonthExpense > 0 ? (amount / totalMonthExpense) * 100 : 0;
                return `
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                            <span style="color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
                                <i class="ph ${meta.icon}" style="color:${meta.color};"></i> ${escapeHtml(meta.name)}
                            </span>
                            <strong style="color:white;">${this.formatAmount(amount)} (${pct.toFixed(0)}%)</strong>
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
            const meta = (Object.hasOwn(expenseCategoryConfig, cat) && expenseCategoryConfig[cat]) || {
                name: cat.charAt(0).toUpperCase() + cat.slice(1),
                color: this.getCategoryColor(cat, 9),
                icon: 'ph-tag'
            };

            const dateObj = parseDateLocal(e.date);
            const dateStr = dateObj
                ? dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                : e.date;
            const safeDescription = escapeHtml(e.description || 'Sin descripción');
            const safeCategoryName = escapeHtml(meta.name);
            const safeDate = escapeHtml(dateStr || '-');
            const safeId = escapeHtml(e.id);

            return `
                <div class="card" style="margin:0; padding:12px 15px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(255,255,255,0.03); gap: 10px;">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                        <div class="icon-container" style="background: rgba(255,255,255,0.03); color: ${meta.color}; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">
                            <i class="ph ${meta.icon}" style="font-size:1.2rem;"></i>
                        </div>
                        <div style="min-width:0;">
                            <h4 style="margin:0; font-size:0.95rem; color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeDescription}</h4>
                            <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-secondary);">${safeCategoryName} • ${safeDate}</p>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                        <strong style="color:var(--status-orange); font-size:0.95rem;">- ${this.formatAmount(e.amount)}</strong>
                        <button type="button" class="btn-delete-fin-expense-item icon-btn icon-btn-sm is-danger" data-id="${safeId}" data-tooltip="Eliminar gasto" aria-label="Eliminar gasto ${safeDescription}"><i class="ph ph-trash" aria-hidden="true"></i></button>
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
