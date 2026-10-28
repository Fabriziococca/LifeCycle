import { escapeHtml as esc } from '../text-utils.mjs';
import { validateTimes } from '../schedule-date-utils.mjs';

// Native time controls and the same add/remove interaction in every scheduler.
export function timeSlotRow(time, { name = '', className = '', removable = true, label = 'Horario de aviso' } = {}) {
    return `<div class="schedule-time-row"><input type="time" class="text-input ${esc(className)}" ${name ? `name="${esc(name)}"` : ''} value="${esc(time)}" aria-label="${esc(label)}" required>${removable ? '<button type="button" class="icon-btn" data-remove-time aria-label="Eliminar horario"><i class="ph ph-trash" aria-hidden="true"></i></button>' : ''}</div>`;
}
export function timeSlotsEditor(times, name) {
    return `<div class="schedule-times" data-time-slots data-time-name="${esc(name)}"><div data-time-rows>${times.map((time, i) => timeSlotRow(time, { name, removable: i > 0 })).join('')}</div><button type="button" class="btn btn-secondary" data-add-time>+ Horario</button></div>`;
}
export const readTimeSlots = (form, name) => validateTimes(form.getAll(name));
export function bindTimeSlotsEditor(root) {
    const update = host => {
        host.querySelector('[data-add-time]').disabled = host.querySelectorAll('input[type=time]').length >= 6;
    };
    root.querySelectorAll('[data-time-slots]').forEach(update);
    root.addEventListener('click', event => {
        const host = event.target.closest('[data-time-slots]');
        if (!host || !root.contains(host)) return;
        if (event.target.closest('[data-add-time]') && host.querySelectorAll('input[type=time]').length < 6) {
            const used = new Set([...host.querySelectorAll('input')].map(input => input.value));
            const time = ['18:00', '22:00', '09:00', '12:00', '15:00', '08:00', '20:00'].find(t => !used.has(t));
            host.querySelector('[data-time-rows]').insertAdjacentHTML('beforeend', timeSlotRow(time, { name: host.dataset.timeName }));
            host.querySelector('[data-time-rows]').lastElementChild.querySelector('input').focus();
        }
        if (event.target.closest('[data-remove-time]') && host.querySelectorAll('input').length > 1) {
            event.target.closest('.schedule-time-row').remove();
            host.querySelector('[data-add-time]').focus();
        }
        update(host);
    });
}
