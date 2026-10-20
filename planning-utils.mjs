import { CHARGING_KEY, emptyCharging, validateCharging } from './charging-utils.mjs';
import { APPOINTMENTS_KEY, emptyAppointments, validateAppointments } from './appointments-utils.mjs';
export const SAYLOR_KEY = 'lifecycle_saylor';
export const FACULTY_KEY = 'lifecycle_faculty';
export const PLANNING_KEYS = [SAYLOR_KEY, FACULTY_KEY, CHARGING_KEY, APPOINTMENTS_KEY];
export const planningId = prefix => `${prefix}_${crypto.randomUUID()}`;
export function emptyPlanning(key) {
    if(key===CHARGING_KEY)return emptyCharging();
    if(key===APPOINTMENTS_KEY)return emptyAppointments();
    return key === SAYLOR_KEY ? { version: 1, revision: 0, campaigns: [] }
        : { version: 1, revision: 0, subjects: [], events: [], tasks: [] };
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
export function readPlanning(value, key) {
    if (value == null || value === '') return emptyPlanning(key);
    const result = typeof value === 'string' ? JSON.parse(value) : structuredClone(value);
    return validatePlanning(result, key);
}
export function localDate(value = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}
export function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
        && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
}
export function moneyMinor(value, signed = false) {
    const text = String(value).trim().replace(',', '.');
    assert((signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(text), 'Usá un importe con hasta dos decimales.');
    const minor = Math.round(Number(text) * 100);
    assert(Number.isSafeInteger(minor) && Math.abs(minor) <= 100_000_000_000, 'Importe fuera de rango.');
    return minor;
}
export function percentBps(value) {
    const bps = moneyMinor(value, true);
    assert(bps >= -10000 && bps <= 1_000_000, 'El porcentaje debe estar entre -100 y 10.000.');
    return bps;
}
export function saylorTotals(campaign) {
    const active = campaign.loads.filter(load => !load.voidedAt);
    const total = destination => active.filter(load => !destination || load.destination === destination)
        .reduce((sum, load) => sum + load.quantity, 0);
    const bullets = total();
    return { bullets, remaining: 90 - bullets, position: total('position'), margin: total('margin'),
        contributedMinor: bullets * campaign.bulletMinor,
        positionMinor: total('position') * campaign.bulletMinor,
        marginMinor: total('margin') * campaign.bulletMinor,
        magazines: [0,1,2].map(i => Math.max(0, Math.min(30, bullets - 30*i))) };
}
export function closeSaylor(campaign, input) {
    const totals = saylorTotals(campaign);
    const basis = input.basis === 'position' ? 'position' : 'all';
    const baseMinor = basis === 'position' ? totals.positionMinor : totals.contributedMinor;
    assert(baseMinor > 0, 'Registrá aportes antes de cerrar la operación.');
    const bps = percentBps(input.percent);
    const calculatedMinor = Math.sign(bps) * Math.round(baseMinor * Math.abs(bps) / 10000);
    const actual = input.actual !== undefined && String(input.actual).trim() !== '';
    const profitMinor = actual ? moneyMinor(input.actual, true) : calculatedMinor;
    assert(Number.isSafeInteger(profitMinor) && Math.abs(profitMinor) <= 100_000_000_000, 'Resultado fuera de rango.');
    assert(validDate(input.date) && input.date <= localDate(), 'Elegí una fecha de cierre válida, hasta hoy.');
    assert(input.date >= campaign.startedOn && campaign.loads.filter(x=>!x.voidedAt).every(x=>x.date <= input.date), 'El cierre no puede ser anterior a los aportes.');
    return { basis, baseMinor, percentBps: bps, calculatedMinor, profitMinor, actual, date: input.date };
}
export function saylorMovements(value) {
    const data = readPlanning(value, SAYLOR_KEY);
    return data.campaigns.filter(c => c.status === 'closed' && c.closure?.profitMinor).map(c => ({
        id: `saylor:${c.id}`, origin: 'saylor', source: 'saylor', category: 'trading',
        date: c.closure.date, description: `Saylor · ${c.name}${c.closure.actual ? ' · resultado declarado' : ' · resultado calculado'}`,
        amount: Math.abs(c.closure.profitMinor) / 100, nativeCurrency: 'USD', nativeAmountMinor: Math.abs(c.closure.profitMinor), exchangeRate: 1,
        resultType: c.closure.profitMinor > 0 ? 'income' : 'expense', accountId: null
    }));
}
export function facultyDueAt(event) {
    return `${event.date}T${event.time}:00-03:00`;
}
export function facultyState(event, now = new Date()) {
    const due = new Date(facultyDueAt(event));
    const today = localDate(now);
    const days = Math.round((Date.parse(`${event.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
    const past = now.getTime() >= due.getTime();
    return { days, past, label: event.status === 'done' ? (event.type === 'tp' ? 'Entregado' : 'Realizado')
        : event.status === 'cancelled' ? 'Cancelado' : past ? (event.type === 'tp' ? 'Entrega pendiente' : 'Pendiente de resultado')
        : days === 0 ? 'Hoy' : `Faltan ${days} días` };
}
export function dueFacultyNotices(value, now = new Date()) {
    const data = readPlanning(value, FACULTY_KEY);
    const today = localDate(now);
    return data.events.flatMap(event => {
        const state = facultyState(event, now);
        if (event.status !== 'pending' || event.paused || state.past || state.days > event.leadDays) return [];
        const attempt = new Date(`${today}T${event.noticeTime}:00-03:00`);
        // The existing scheduler runs every five minutes. Never send a stale daily notice.
        if (now < attempt || now - attempt > 15 * 60_000) return [];
        const subject = data.subjects.find(s=>s.id === event.subjectId);
        if (!subject || subject.archived) return [];
        return [{ event, subject, scheduledAt: attempt.toISOString(), expiresAt: new Date(Math.min(+attempt + 15*60_000, Date.parse(facultyDueAt(event)))).toISOString(),
            alertKey: `faculty:${event.id}:${event.scheduleVersion}:${today}:${event.noticeTime.replace(':','')}` }];
    });
}
export function validatePlanning(data, key) {
    if(key===CHARGING_KEY)return validateCharging(data);
    if(key===APPOINTMENTS_KEY)return validateAppointments(data);
    assert(PLANNING_KEYS.includes(key) && data && data.version === 1 && Number.isSafeInteger(data.revision) && data.revision >= 0, 'Versión del seguimiento no compatible.');
    const text = (value,max=120) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
    const collection = (items,max,prefix) => {
        assert(Array.isArray(items) && items.length <= max, 'Demasiados registros en el seguimiento.');
        const ids = new Set();
        items.forEach(item=> { assert(item && new RegExp(`^${prefix}_[a-z0-9-]{3,90}$`,'i').test(item.id || '') && !ids.has(item.id), 'Identificador inválido o duplicado.'); ids.add(item.id); });
    };
    if (key === SAYLOR_KEY) {
        collection(data.campaigns, 500, 'sc');
        data.campaigns.forEach(c=> {
            assert(text(c.name) && Number.isSafeInteger(c.bulletMinor) && c.bulletMinor > 0 && c.bulletMinor <= 1_000_000_000 && validDate(c.startedOn) && c.startedOn <= localDate() && ['active','closed'].includes(c.status), 'Operación Saylor inválida.');
            assert(!c.exchange || text(c.exchange,80), 'Exchange inválido.');
            collection(c.loads, 500, 'sl');
            c.loads.forEach(l=>assert(Number.isInteger(l.quantity) && l.quantity >= 1 && l.quantity <= 90 && ['position','margin'].includes(l.destination) && validDate(l.date) && l.date <= localDate() && l.date >= c.startedOn && (!l.voidedAt || Number.isFinite(Date.parse(l.voidedAt))), 'Recarga inválida.'));
            assert(saylorTotals(c).bullets <= 90, 'La recarga supera las noventa balas disponibles.');
            if (c.status === 'closed') {
                assert(c.closure && Number.isSafeInteger(c.closure.profitMinor), 'Falta el resultado del cierre.');
                const expected = closeSaylor(c, { basis:c.closure.basis,percent:c.closure.percentBps/100,date:c.closure.date,actual:c.closure.actual ? c.closure.profitMinor/100 : '' });
                assert(Object.entries(expected).every(([field,value]) => c.closure[field] === value), 'El cierre no coincide con los aportes.');
            } else assert(!c.closure, 'Una operación abierta no tiene cierre.');
        });
    } else {
        collection(data.subjects, 100, 'fs'); collection(data.events, 1000, 'fe'); collection(data.tasks, 2000, 'ft');
        data.subjects.forEach(s=>assert(text(s.name) && typeof s.archived === 'boolean' && typeof s.teacher === 'string' && s.teacher.length<=120 && typeof s.term === 'string' && s.term.length<=60, 'Materia inválida.'));
        const subjects = new Set(data.subjects.map(s=>s.id));
        data.events.forEach(e=>assert(subjects.has(e.subjectId) && text(e.name) && ['parcial','final','recuperatorio','tp','otro'].includes(e.type) && validDate(e.date)
            && /^([01]\d|2[0-3]):[0-5]\d$/.test(e.time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(e.noticeTime)
            && Number.isInteger(e.leadDays) && e.leadDays>=0 && e.leadDays<=365 && Number.isInteger(e.scheduleVersion) && e.scheduleVersion>=1
            && ['pending','done','cancelled'].includes(e.status) && typeof e.paused === 'boolean'
            && typeof e.notes === 'string' && e.notes.length<=2000 && (e.grade === '' || (Number.isFinite(Number(e.grade)) && Number(e.grade)>=0 && Number(e.grade)<=10)), 'Evaluación inválida.'));
        data.tasks.forEach(t=>assert(subjects.has(t.subjectId) && text(t.name,300) && typeof t.done === 'boolean', 'Pendiente inválido.'));
    }
    assert(JSON.stringify(data).length <= 2_000_000, 'El seguimiento superó su tamaño máximo. Exportá el historial antes de continuar.');
    return data;
}
