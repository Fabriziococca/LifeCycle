export const ARGENTINA_ZONE = 'America/Argentina/Buenos_Aires';
export const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function validDay(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && Number.isFinite(Date.parse(value + 'T12:00:00Z'))
        && new Date(value + 'T12:00:00Z').toISOString().slice(0,10) === value;
}
export function argentinaDay(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ARGENTINA_ZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
}
export const dayDistance = (from, to) => Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
export function addDays(day, count) {
    const value = new Date(day+'T12:00:00Z'); value.setUTCDate(value.getUTCDate()+count);
    return value.toISOString().slice(0,10);
}
export function addMonths(day, count) {
    const value = new Date(day+'T12:00:00Z'), original = value.getUTCDate();
    value.setUTCDate(1); value.setUTCMonth(value.getUTCMonth()+count);
    const last = new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth()+1,0)).getUTCDate();
    value.setUTCDate(Math.min(original,last)); return value.toISOString().slice(0,10);
}
export function validateTimes(times) {
    if (!Array.isArray(times) || times.length<1 || times.length>6 || times.some(t=>!validTime(t)) || new Set(times).size!==times.length)
        throw new Error('Elegí entre uno y seis horarios distintos.');
    return times;
}
export function parseTimes(value) {
    return validateTimes(String(value).split(/[,;\s]+/).filter(Boolean).sort());
}
