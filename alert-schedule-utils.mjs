/**
 * alert-schedule-utils.mjs
 * Utilidades compartidas para gestión y normalización de horarios múltiples de notificación.
 * Cumple con las reglas de Fase B (Tandas 6 a 10).
 */

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const MAX_ALERT_TIMES_PER_DAY = 6;
export const DEFAULT_ALERT_TIME = '09:00';

/**
 * Normaliza uno o varios horarios garantizando:
 * 1. Formato estricto HH:mm (24h).
 * 2. Deduplicación y orden cronológico.
 * 3. Límite máximo de horarios por día (1 a 6).
 * 4. Compatibilidad hacia atrás: devuelve { time, times } donde time === times[0].
 *
 * @param {string|string[]|{time?: string, times?: string[]}} input
 * @param {string} [fallback='09:00']
 * @returns {{ time: string, times: string[] }}
 */
export function normalizeAlertTimes(input, fallback = DEFAULT_ALERT_TIME) {
    const safeFallback = typeof fallback === 'string' && TIME_PATTERN.test(fallback)
        ? fallback
        : DEFAULT_ALERT_TIME;

    let candidates = [];

    if (Array.isArray(input)) {
        candidates = input;
    } else if (input && typeof input === 'object') {
        if (Array.isArray(input.times)) {
            candidates = input.times;
        } else if (typeof input.time === 'string') {
            candidates = [input.time];
        }
    } else if (typeof input === 'string') {
        // Soporta formatos separados por coma: "09:00, 20:00"
        candidates = input.split(',').map(s => s.trim());
    }

    const validTimes = [];
    const seen = new Set();

    for (const raw of candidates) {
        const str = String(raw || '').trim();
        if (TIME_PATTERN.test(str) && !seen.has(str)) {
            seen.add(str);
            validTimes.push(str);
            if (validTimes.length >= MAX_ALERT_TIMES_PER_DAY) break;
        }
    }

    // Ordenar cronológicamente HH:mm
    validTimes.sort((a, b) => a.localeCompare(b));

    if (validTimes.length === 0) {
        validTimes.push(safeFallback);
    }

    return {
        time: validTimes[0],
        times: validTimes
    };
}

/**
 * Formatea una lista de horarios para presentación en interfaces de usuario.
 * Ej: ["09:00", "20:00"] -> "09:00 y 20:00"
 *     ["08:00", "14:00", "20:00"] -> "08:00, 14:00 y 20:00"
 *
 * @param {string[]} times
 * @returns {string}
 */
export function formatAlertTimes(times) {
    const list = Array.isArray(times) ? times.filter(t => TIME_PATTERN.test(t)) : [];
    if (list.length === 0) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} y ${list[1]}`;
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}

/**
 * Retorna la clave identificadora única de envío para una hora específica.
 * @param {string} baseKey
 * @param {string} time
 * @returns {string}
 */
export function getScheduleDeliveryKey(baseKey, time) {
    if (!baseKey) return '';
    if (!time || !TIME_PATTERN.test(time)) return baseKey;
    return `${baseKey}@${time}`;
}

/**
 * Elige un horario válido que todavía no esté usado. Devuelve null al alcanzar
 * el máximo; nunca duplica silenciosamente un horario existente.
 */
export function getSuggestedAlertTime(times = []) {
    const used = new Set(normalizeAlertTimes(times).times);
    const preferred = ['09:00', '14:00', '20:00', '22:00', '08:00', '12:00', '16:00', '18:00', '21:00', '23:00'];
    const suggestion = preferred.find(time => !used.has(time));
    if (suggestion && used.size < MAX_ALERT_TIMES_PER_DAY) return suggestion;
    return null;
}

/**
 * Renderiza un editor reutilizable de horarios con soporte para agregar y quitar horas.
 *
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string[]} options.times - Lista inicial de horarios (HH:mm)
 * @param {Function} options.onChange - Callback invocado con la lista actualizada de horarios
 * @param {number} [options.min=1]
 * @param {number} [options.max=6]
 * @param {string} [options.label='Horarios de aviso']
 * @returns {{ getTimes: () => string[], setTimes: (newTimes: string[]) => void }}
 */
export function renderAlertTimesEditor(container, {
    times = [DEFAULT_ALERT_TIME],
    onChange = () => {},
    min = 1,
    max = MAX_ALERT_TIMES_PER_DAY,
    label = 'Horarios de aviso'
} = {}) {
    if (!container) return { getTimes: () => [], setTimes: () => {} };

    let currentTimes = normalizeAlertTimes(times).times;

    const render = () => {
        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'alert-times-editor-wrapper';

        const labelElem = document.createElement('label');
        labelElem.className = 'alert-times-label';
        labelElem.textContent = label;
        wrapper.appendChild(labelElem);

        const listContainer = document.createElement('div');
        listContainer.className = 'alert-times-list';

        currentTimes.forEach((t, index) => {
            const row = document.createElement('div');
            row.className = 'alert-time-row';

            const input = document.createElement('input');
            input.type = 'time';
            input.className = 'text-input alert-time-input';
            input.value = t;
            input.setAttribute('aria-label', `${label} #${index + 1}`);
            input.addEventListener('change', (e) => {
                const val = e.target.value;
                if (TIME_PATTERN.test(val)) {
                    currentTimes[index] = val;
                    currentTimes = normalizeAlertTimes(currentTimes).times;
                    render();
                    onChange(currentTimes);
                }
            });

            row.appendChild(input);

            if (currentTimes.length > min) {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'icon-btn is-danger btn-remove-time';
                removeBtn.setAttribute('aria-label', 'Eliminar este horario');
                removeBtn.setAttribute('title', 'Eliminar horario');
                removeBtn.innerHTML = '<i class="ph ph-trash"></i>';
                removeBtn.addEventListener('click', () => {
                    currentTimes.splice(index, 1);
                    currentTimes = normalizeAlertTimes(currentTimes).times;
                    render();
                    onChange(currentTimes);
                });
                row.appendChild(removeBtn);
            }

            listContainer.appendChild(row);
        });

        wrapper.appendChild(listContainer);

        if (currentTimes.length < max) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'btn btn-secondary btn-add-time';
            addBtn.innerHTML = '<i class="ph ph-plus"></i> Agregar horario';
            addBtn.style.marginTop = '6px';
            addBtn.style.fontSize = '0.8rem';
            addBtn.style.padding = '4px 10px';
            addBtn.addEventListener('click', () => {
                // Generar siguiente horario sugerido (ej. +4 horas o 20:00)
                const nextTime = getSuggestedAlertTime(currentTimes);
                if (!nextTime) return;
                currentTimes.push(nextTime);
                currentTimes = normalizeAlertTimes(currentTimes).times;
                render();
                onChange(currentTimes);
            });
            wrapper.appendChild(addBtn);
        }

        container.appendChild(wrapper);
    };

    render();

    return {
        getTimes: () => [...currentTimes],
        setTimes: (newTimes) => {
            currentTimes = normalizeAlertTimes(newTimes).times;
            render();
            onChange(currentTimes);
        }
    };
}
