import { validDay, validTime, validateTimes, argentinaDay, addDays, addMonths, dayDistance } from './schedule-date-utils.mjs';
import { validateReminderSchedule, nextReminderDay, describeRecurringSchedule, matchesRecurringSchedule } from './recurring-reminder-utils.mjs';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export function validateMaintenance(item) {
    const m=item.maintenance;
    if(m===undefined)return item;
    assert(m && m.version===1 && Number.isSafeInteger(m.scheduleVersion) && m.scheduleVersion>=1 && item.actor==='me' && item.status==='open' && validDay(item.reviewOn), 'Rutina de mantenimiento no válida.');
    assert(typeof m.instructions==='string' && m.instructions.length<=2000 && typeof m.paused==='boolean' && typeof m.archived==='boolean', 'Configuración de mantenimiento no válida.');
    validateTimes(m.times); assert(validTime(item.reminderTime) && item.reminderTime===m.times[0], 'Horario principal de mantenimiento no válido.');
    const c=m.cadence;
    assert(c && ['interval','weekly','scheduled'].includes(c.type) && validDay(c.anchorDate), 'Frecuencia no válida.');
    if(c.type==='scheduled')validateReminderSchedule(c.schedule);
    if(c.type==='interval')assert(Number.isInteger(c.every)&&c.every>=1&&c.every<=365&&['days','weeks','months'].includes(c.unit)&&['completion','calendar'].includes(c.anchor), 'Intervalo de mantenimiento no válido.');
    else if(c.type==='weekly')assert(Array.isArray(c.days)&&c.days.length>=1&&c.days.length<=7&&new Set(c.days).size===c.days.length&&c.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6), 'Elegí los días de la semana.');
    assert(m.completed===undefined||typeof m.completed==='boolean','Estado de realización no válido.');
    assert(m.repeatUntilDone===undefined||typeof m.repeatUntilDone==='boolean','Repetición de avisos no válida.');
    assert(m.escalationDays===undefined||(Number.isInteger(m.escalationDays)&&m.escalationDays>=1&&m.escalationDays<=3650&&m.repeatUntilDone!==false),'La prioridad alta necesita entre 1 y 3650 días de atraso y seguimiento hasta realizarla.');
    assert(m.pushTitle===undefined||(typeof m.pushTitle==='string'&&m.pushTitle.length<=100),'Título de aviso no válido.');
    assert(Array.isArray(m.history)&&m.history.length<=2000, 'El historial llegó al límite. Exportalo antes de continuar.');
    const ids=new Set();
    for(const h of m.history) {
        assert(h&&typeof h.id==='string'&&/^mh_[a-z0-9-]{3,90}$/i.test(h.id)&&!ids.has(h.id)&&validDay(h.doneOn)&&h.doneOn<=argentinaDay()&&validDay(h.dueOn)&&typeof h.note==='string'&&h.note.length<=2000&&Number.isFinite(Date.parse(h.recordedAt)), 'Registro de mantenimiento no válido.');
        ids.add(h.id);
    }
    return item;
}
export const maintenanceActive=f=>!f.maintenance || (!f.maintenance.paused&&!f.maintenance.archived&&!f.maintenance.completed);
// Escalation is relative to the current due date, so completion moves both
// thresholds together without rewriting history or creating another reminder.
export function maintenancePriority(item, day=argentinaDay()) {
    const m=item.maintenance;
    const highOn=m?.escalationDays===undefined?null:addDays(item.reviewOn,m.escalationDays);
    const high=!!(highOn&&maintenanceActive(item)&&m.repeatUntilDone!==false&&day>=highOn);
    return {high,highOn};
}
export function maintenanceSchedule(item) {
    const c=item.maintenance.cadence;
    if(c.type==='scheduled')return c.schedule;
    if(c.type==='weekly')return {type:'weekly',days:c.days};
    return {type:'interval',startDate:c.anchorDate,every:c.every,unit:c.unit};
}
export function maintenanceNoticeDue(item,day) {
    if(!maintenanceActive(item)||item.reviewOn>day)return false;
    if(item.maintenance.repeatUntilDone!==false)return true;
    const d=new Date(day+'T12:00:00Z');
    return matchesRecurringSchedule(maintenanceSchedule(item),{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),dayOfWeek:d.getUTCDay()});
}
export function alignMaintenanceDate(cadence,day) {
    if(cadence.type!=='weekly')return day;
    for(let i=0;i<7;i++){const next=addDays(day,i);if(cadence.days.includes(new Date(next+'T12:00:00Z').getUTCDay()))return next;}
    throw new Error('Elegí al menos un día de revisión.');
}
export function nextMaintenanceDate(item, doneOn) {
    const c=item.maintenance.cadence;
    if(c.type==='scheduled')return nextReminderDay(c.schedule,doneOn>item.reviewOn?doneOn:item.reviewOn,{inclusive:false});
    if(c.type==='weekly') {
        const base=doneOn>item.reviewOn?doneOn:item.reviewOn;
        for(let i=1;i<=7;i++) {const next=addDays(base,i);if(c.days.includes(new Date(next+'T12:00:00Z').getUTCDay()))return next;}
    }
    const increment=(date,n)=>c.unit==='months'?addMonths(date,c.every*n):addDays(date,c.every*n*(c.unit==='weeks'?7:1));
    if(c.anchor==='completion')return increment(doneOn,1);
    // Fixed cadence stays anchored to its original calendar date, including
    // month-end. Missed periods become one pending review, never a backlog.
    const threshold=doneOn>item.reviewOn?doneOn:item.reviewOn;
    let n=c.unit==='months'?Math.max(1,Math.floor(dayDistance(c.anchorDate,threshold)/(31*c.every))):Math.max(1,Math.floor(dayDistance(c.anchorDate,threshold)/(c.every*(c.unit==='weeks'?7:1))));
    while(increment(c.anchorDate,n)<=threshold)n++;
    return increment(c.anchorDate,n);
}
export function completeMaintenance(item,{id,doneOn,note='',now=new Date()}) {
    validateMaintenance(item);
    assert(item.maintenance && maintenanceActive(item),'Reactivá la rutina antes de registrar una realización.');
    assert(validDay(doneOn)&&doneOn<=argentinaDay(now),'Elegí una fecha de realización válida, hasta hoy.');
    if(item.maintenance.history.some(h=>h.id===id))return item;
    assert(!item.maintenance.history.some(h=>h.doneOn>doneOn), 'La fecha no puede ser anterior a la última realización.');
    const next=structuredClone(item);
    next.maintenance.history.unshift({id,doneOn,dueOn:item.reviewOn,note,recordedAt:now.toISOString()});
    const upcoming=nextMaintenanceDate(item,doneOn);
    if(upcoming)next.reviewOn=upcoming;else next.maintenance.completed=true;
    next.updatedAt=now.toISOString();next.maintenance.scheduleVersion++;
    return validateMaintenance(next);
}
export function maintenanceDescription(m) {
    if(m.cadence.type==='scheduled')return describeRecurringSchedule(m.cadence.schedule);
    if(m.cadence.type==='weekly')return 'Días: '+m.cadence.days.map(d=>['dom','lun','mar','mié','jue','vie','sáb'][d]).join(', ');
    const c=m.cadence, unit=(c.every===1?{days:'día',weeks:'semana',months:'mes'}:{days:'días',weeks:'semanas',months:'meses'})[c.unit];
    return `Cada ${c.every} ${unit} · ${c.anchor==='completion'?'desde la realización':'calendario fijo'}`;
}
