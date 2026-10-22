// Commercial maintenance is saved with Work's revision, including its receipts.
// Finance derives receipts from this source; no second write can create duplicates.
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const check = (ok, message) => { if (!ok) throw new Error(message); };
const text = (s, max, required = false) => typeof s === 'string' && s.length <= max && (!required || !!s.trim());
const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(Date.parse(s+'T12:00:00Z')) && new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s;
const cents = n => Number.isSafeInteger(n) && n > 0 && n <= 100000000000;
export const retainerList = state => (state?.clients || []).flatMap(client => (client.retainers || []).map(retainer => ({ client, retainer })));
export const pendingRetainers = (state, day) => retainerList(state).filter(({client,retainer:r}) => !client.archived && !r.archived && !r.paused && r.nextDue <= day);
export const retainerMoney = (minor, currency) => new Intl.NumberFormat('es-AR',{style:'currency',currency}).format(minor/100)+' '+currency;
export function billingDate(month, day) {
    check(/^\d{4}-\d{2}$/.test(month) && Number.isInteger(day) && day >= 1 && day <= 31, 'Día de cobro no válido.');
    const [y,m] = month.split('-').map(Number), last = new Date(Date.UTC(y,m,0)).getUTCDate();
    return `${month}-${String(Math.min(day,last)).padStart(2,'0')}`;
}
export function nextBillingDate(due, day) {
    check(date(due), 'Fecha de cobro no válida.');
    const d = new Date(due+'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+1);
    return billingDate(d.toISOString().slice(0,7),day);
}
export function validateRetainers(client, links, ids = new Set()) {
    if (client.retainers === undefined) return;
    check(Array.isArray(client.retainers) && client.retainers.length <= 200, 'Lista de mantenimientos no válida.');
    for (const r of client.retainers) {
        check(r && ID.test(r.id) && !ids.has(r.id), 'Identificador de mantenimiento duplicado o no válido.'); ids.add(r.id);
        check(r.version === 1 && Number.isSafeInteger(r.scheduleVersion) && r.scheduleVersion > 0 && text(r.title,120,true) && text(r.tasks,4000), 'Mantenimiento mensual no válido.');
        check(['USD','ARS'].includes(r.currency) && cents(r.amountMinor), 'Importe de mantenimiento no válido.');
        check(Number.isInteger(r.billingDay) && r.billingDay >= 1 && r.billingDay <= 31 && date(r.nextDue) && billingDate(r.nextDue.slice(0,7),r.billingDay) === r.nextDue, 'Fecha y día de cobro no coinciden.');
        check(['paused','archived','reminderEnabled'].every(k => typeof r[k] === 'boolean') && Array.isArray(r.times) && r.times.length > 0 && r.times.length <= 6 && new Set(r.times).size === r.times.length && r.times.every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)), 'Avisos de mantenimiento no válidos.');
        check(Array.isArray(r.projectIds) && new Set(r.projectIds).size === r.projectIds.length && r.projectIds.every(p=>links.some(l=>l.clientId===client.id && l.projectId===p)), 'Vinculá primero los proyectos al cliente.');
        check(Array.isArray(r.payments) && r.payments.length <= 2400, 'Historial de cobros no válido.');
        const receipts = new Set(), periods = new Set();
        for (const p of r.payments) {
            check(p && ID.test(p.id) && !receipts.has(p.id) && date(p.dueOn) && date(p.receivedOn) && Number.isInteger(p.billingDay) && p.billingDay>=1 && p.billingDay<=31 && text(p.title,120,true) && text(p.clientName,120,true), 'Recibo de mantenimiento no válido.'); receipts.add(p.id);
            check(['USD','ARS'].includes(p.currency) && cents(p.amountMinor) && Number.isFinite(p.exchangeRate) && p.exchangeRate >= .000001 && p.exchangeRate <= 1000000 && (p.currency !== 'USD' || p.exchangeRate === 1), 'Importe o cotización del cobro no válido.');
            check(Array.isArray(p.projectIds) && p.projectIds.every(x=>/^[a-zA-Z0-9_-]{1,100}$/.test(x)) && text(p.accountId || '',100), 'Referencias del cobro no válidas.');
            check(!p.voidedAt || Number.isFinite(Date.parse(p.voidedAt)), 'Anulación no válida.');
            if (!p.voidedAt) { check(!periods.has(p.dueOn), 'Ese período ya tiene un cobro confirmado.'); periods.add(p.dueOn); }
        }
        check(!periods.has(r.nextDue), 'El próximo período ya está cobrado.');
    }
}
export function confirmRetainer(r, {id, dueOn, receivedOn, today, exchangeRate = 1, accountId = '', clientName}) {
    if (r.payments.some(p=>p.dueOn===dueOn && !p.voidedAt)) return structuredClone(r);
    check(!r.paused && !r.archived && dueOn === r.nextDue && dueOn <= today, 'Este período todavía no está pendiente o cambió. Volvé a abrirlo.');
    check(date(receivedOn) && receivedOn <= today && receivedOn >= dueOn, 'Elegí una fecha de recepción desde el vencimiento hasta hoy.');
    check(ID.test(id) && Number.isFinite(exchangeRate) && exchangeRate >= .000001 && exchangeRate <= 1000000 && (r.currency !== 'USD' || exchangeRate === 1), 'Cotización no válida.');
    const receipt = { id, dueOn, receivedOn, billingDay:r.billingDay, title:r.title, clientName, amountMinor:r.amountMinor, currency:r.currency, exchangeRate, accountId, projectIds:[...r.projectIds] };
    return {...r, nextDue:nextBillingDate(dueOn,r.billingDay), scheduleVersion:r.scheduleVersion+1, payments:[...r.payments,receipt]};
}
export function voidLastRetainerPayment(r, id, now = new Date()) {
    const last = r.payments.filter(p=>!p.voidedAt).at(-1);
    check(last?.id === id, 'Sólo podés anular el último cobro vigente de este mantenimiento.');
    return {...r, nextDue:last.dueOn, billingDay:last.billingDay,
        scheduleVersion:r.scheduleVersion+1, payments:r.payments.map(p=>p.id===id?{...p,voidedAt:now.toISOString()}:p)};
}
export function retainerMovements(state) {
    return retainerList(state).flatMap(({client,retainer:r})=>r.payments.filter(p=>!p.voidedAt).map(p=>({
        id:'retainer-'+p.id, date:p.receivedOn, category:'freelance', amount:p.amountMinor/100/p.exchangeRate,
        description:`${p.clientName} · ${p.title} · período ${p.dueOn}`, origin:'retainer', clientId:client.id, retainerId:r.id,
        projectIds:p.projectIds, nativeCurrency:p.currency, nativeAmountMinor:p.amountMinor, exchangeRate:p.exchangeRate, accountId:p.accountId
    })));
}
// Moving a project never moves a client's task/note/payment history to someone else.
export function relinkProject(state, projectId, clientId) {
    check(!clientId || state.clients.some(c=>c.id===clientId && !c.archived), 'Elegí un cliente activo.');
    const next = structuredClone(state), old = next.links.find(l=>l.projectId===projectId);
    if (old?.clientId === clientId) return next;
    next.links = next.links.filter(l=>l.projectId!==projectId);
    if (clientId) next.links.push({projectId,clientId});
    for (const f of [...next.followups,...next.notes]) if (f.projectId===projectId) f.projectId='';
    for (const c of next.clients) for (const r of c.retainers || []) r.projectIds=r.projectIds.filter(p=>p!==projectId);
    return next;
}
