import { escapeHtml as esc } from './text-utils.mjs';

// Shared by the configurable Hygiene cards and client maintenance cycles.
export function cycleIdentity(name, icon, label) {
    return `<span class="custom-tracker-icon"><i class="ph ${esc(icon)}" aria-hidden="true"></i></span><div><h3>${esc(name)}</h3><span class="custom-tracker-status">${esc(label)}</span></div>`;
}
export function cycleMetrics({ elapsedDays, cadenceLabel, latestLabel, nextLabel, nextCaption = 'Próximo', progress, prediction = '' }) {
    return `<div class="custom-tracker-metric"><strong>${elapsedDays === null ? '--' : esc(elapsedDays)}</strong><span>${esc(cadenceLabel)}</span></div><div class="custom-tracker-dates"><span>Último <strong>${esc(latestLabel)}</strong></span><span>${esc(nextCaption)} <strong>${esc(nextLabel)}</strong></span></div><div class="custom-tracker-progress" aria-hidden="true"><span style="width: ${Math.min(100, Math.max(0, progress))}%"></span></div>${prediction ? `<p class="custom-tracker-prediction">${esc(prediction)}</p>` : ''}`;
}
