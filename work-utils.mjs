import { validateMaintenance, maintenanceActive, maintenanceNoticeDue, maintenancePriority, isMaintenanceCycle } from './maintenance-utils.mjs';
import { validateRetainers, pendingRetainers } from './retainer-utils.mjs';
import { addDays } from './schedule-date-utils.mjs';
export const WORK_KEY = 'lifecycle_work';
export const WORK_SECTIONS = Object.freeze(['work-summary-section', 'work-clients-section', 'work-followups-section', 'work-reminders-section', 'projects-section', 'finanzas-section', 'suscripciones-section']);
export const WORK_NAV = Object.freeze({
    'work-summary-section': { label: 'Resumen', icon: 'ph-house-line' },
    'work-clients-section': { label: 'Clientes', icon: 'ph-users' },
    'work-followups-section': { label: 'Seguimientos', icon: 'ph-list-checks' }
});
export const WORK_ACTORS = Object.freeze({ me: 'Yo', client: 'Cliente', third: 'Tercero' });
export const WORK_SCOPES = Object.freeze({ all: 'Todas', work: 'Trabajo', personal: 'Personal', unclassified: 'Sin clasificar' });
export const followupPriority=(f,day=argentinaDate())=>maintenancePriority(f,day).high?'high':f.priority;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assert = (value, message) => { if (!value) throw new Error(message); };
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
export function emptyWork() { return { version: 1, revision: 0, clients: [], links: [], followups: [], notes: [], settings: { dailyEnabled: false, dailyTime: '15:00', financeScopes: {} } }; }
export function argentinaDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function validWorkDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const d = new Date(value + 'T12:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function validateWork(input) {
    assert(input && input.version === 1 && Number.isSafeInteger(input.revision) && input.revision >= 0, 'Versión de Trabajo no compatible.');
    for (const key of ['clients', 'links', 'followups', 'notes']) assert(Array.isArray(input[key]) && input[key].length <= 10000, 'Lista de Trabajo no válida: ' + key);
    const clients = new Set(), ids = new Set(), projects = new Set();
    const identity = x => { assert(x && ID.test(x.id) && !ids.has(x.id), 'Identificador duplicado o no válido.'); ids.add(x.id); };
    for (const c of input.clients) { identity(c); assert(text(c.name, 120, true) && text(c.contact || '', 300) && text(c.context || '', 2000) && typeof c.archived === 'boolean', 'Ficha de cliente no válida.'); clients.add(c.id); }
    for (const l of input.links) { assert(l && clients.has(l.clientId) && /^[a-zA-Z0-9_-]{1,100}$/.test(String(l.projectId)) && !projects.has(String(l.projectId)), 'Vínculo de proyecto no válido.'); projects.add(String(l.projectId)); }
    for (const c of input.clients) validateRetainers(c,input.links,ids);
    for (const f of input.followups) {
        identity(f);
        assert(clients.has(f.clientId) && text(f.title, 300, true) && Object.hasOwn(WORK_ACTORS, f.actor) && ['open', 'completed', 'cancelled'].includes(f.status) && ['normal', 'high'].includes(f.priority), 'Seguimiento no válido.');
        assert(!f.projectId || input.links.some(l => String(l.projectId) === String(f.projectId) && l.clientId === f.clientId), 'El proyecto no pertenece a este cliente.');
        assert((!f.reviewOn || validWorkDate(f.reviewOn)) && (!f.promisedOn || validWorkDate(f.promisedOn)) && typeof f.reminderEnabled === 'boolean' && /^([01]\d|2[0-3]):[0-5]\d$/.test(f.reminderTime), 'Fecha u horario de seguimiento no válido.');
        validateMaintenance(f);
    }
    for (const n of input.notes) { identity(n); assert(clients.has(n.clientId) && text(n.body, 4000, true) && ['note', 'pending', 'agreement'].includes(n.kind), 'Nota de cliente no válida.');assert(!n.projectId||input.links.some(l=>l.clientId===n.clientId&&l.projectId===n.projectId),'El proyecto de la nota no pertenece al cliente.'); }
    assert(input.settings && typeof input.settings.dailyEnabled === 'boolean' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.settings.dailyTime), 'Configuración de resumen no válida.');
    const scopes = input.settings.financeScopes;
    assert(scopes && typeof scopes === 'object' && !Array.isArray(scopes) && Object.keys(scopes).length <= 10000, 'Clasificación financiera no válida.');
    for (const [key, value] of Object.entries(scopes)) assert(!['__proto__', 'constructor', 'prototype'].includes(key) && key.length <= 180 && ['work', 'personal', 'unclassified'].includes(value), 'Ámbito financiero no válido.');
    return input;
}
export function readWork(raw) { return raw ? validateWork(typeof raw === 'string' ? JSON.parse(raw) : raw) : emptyWork(); }
export function workOverview(state, projects = [], now = new Date()) {
    const day = argentinaDate(now), active = new Set(state.clients.filter(c => !c.archived).map(c => c.id));
    const open = state.followups.filter(f => f.status === 'open' && active.has(f.clientId) && maintenanceActive(f));
    const due = open.filter(f => f.reviewOn && f.reviewOn <= day && (!f.maintenance || f.maintenance.repeatUntilDone!==false));
    const linked = new Set(state.links.filter(l => active.has(l.clientId)).map(l => String(l.projectId)));
    const list = projects.filter(p => linked.has(String(p.id)));
    const nextWeek = new Date(day + 'T12:00:00Z'); nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    const deliveries = list.filter(p => !p.isDelivered && !p.isArbitration && Number.isFinite(Date.parse(p.deadline)) && Date.parse(p.deadline) <= nextWeek.getTime());
    return { open, due, mine: due.filter(f => f.actor === 'me'), waiting: open.filter(f => f.actor !== 'me'), deliveries,
        balances: projects.filter(p=>state.links.some(l=>String(l.projectId)===String(p.id))).map(p => ({ project: p, remaining: Math.max(0, Number(p.budgetNet || 0) - (p.partialReleases || []).reduce((s, r) => s + Number(r.netAmount || 0), 0)) })).filter(x => x.remaining > 0.005) };
}
export function activeProjectCandidates(projects, links) {
    const used = new Set(links.map(l => String(l.projectId)));
    return projects.filter(p => !used.has(String(p.id))).map(p => ({ projectId: String(p.id), name: String(p.client || '').trim(), project: String(p.project || '') }));
}
export function financeWorkScope(item, scopes = {}) {
    if (item.origin === 'retainer') return 'work';
    if (item.origin === 'saylor' || item.sourceLabel === 'Saylor') return 'personal';
    if (item.sourceLabel === 'Proyecto' || /^proj-(?:partial-|final-)?/.test(String(item.id))) return 'work';
    return scopes[item.type + ':' + item.id] || 'unclassified';
}
export function workNotificationCandidates(state, now = new Date()) {
    const today=argentinaDate(now);
    return [addDays(today,-1),today].flatMap(day=>workNotificationCandidatesForDay(state,now,day));
}
function workNotificationCandidatesForDay(state,now,day) {
    const result = [], overview = workOverview(state, [], new Date(day+'T12:00:00Z'));
    const at = time => new Date(day + 'T' + time + ':00-03:00');
    const add = (key, time, title, body, followup = null, retainer = null) => {
        const scheduled = at(time), expires = new Date(scheduled.getTime() + 15 * 60000);
        if (now >= scheduled && now < expires) result.push({ key: key + ':' + day, scheduledAt: scheduled.toISOString(), expiresAt: expires.toISOString(), title, body, followup, retainer });
    };
    const bills=pendingRetainers(state,day);
    if (state.settings.dailyEnabled && (overview.due.length || bills.length)) add('work:daily', state.settings.dailyTime, 'Trabajo · resumen diario', overview.mine.length + ' acciones para vos · ' + overview.due.filter(f => f.actor !== 'me').length + ' esperas · '+bills.length+' cobros por confirmar.');
    for (const f of overview.open.filter(f=>f.reviewOn&&f.reviewOn<=day)) if (f.reminderEnabled) {
        if(f.maintenance){if(maintenanceNoticeDue(f,day))for(const time of f.maintenance.times)add(`work:maintenance:${f.id}:${f.maintenance.scheduleVersion}:${time.replace(':','')}`,time,(maintenancePriority(f,day).high?(isMaintenanceCycle(f)?'Vencido · ':'Prioridad alta · '):'')+(f.maintenance.pushTitle||'Trabajo · recordatorio'),f.title+' · '+state.clients.find(c=>c.id===f.clientId).name+(f.maintenance.instructions?' · '+f.maintenance.instructions.slice(0,240):''),f);}
        else add('work:followup:' + f.id, f.reminderTime, 'Trabajo · seguimiento', f.title, f);
    }
    for (const {client,retainer:r} of bills) if(r.reminderEnabled) for(const time of r.times)
        add(`work:retainer:${r.id}:${r.nextDue}:${r.scheduleVersion}:${time.replace(':','')}`,time,'Trabajo · cobro por confirmar',`¿${client.name} te pagó ${r.title}? Período ${r.nextDue}.`,null,{id:r.id,clientId:client.id});
    return result;
}
export function isWorkRetryRelevant(state,candidate,now=new Date()) {
    return workNotificationCandidates(state,now).some(n=>n.key===candidate.alert_key
        && Date.parse(n.scheduledAt)===Date.parse(candidate.scheduled_at)
        && n.title===candidate.title && n.body===candidate.body);
}
