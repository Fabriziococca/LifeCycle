import { validDay, validTime, validateTimes, argentinaDay, dayDistance } from './schedule-date-utils.mjs';
export const APPOINTMENTS_KEY='lifecycle_appointments';
export const emptyAppointments=()=>({version:1,revision:0,events:[]});
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export function validateAppointments(data) {
    assert(data&&data.version===1&&Number.isSafeInteger(data.revision)&&data.revision>=0&&Array.isArray(data.events)&&data.events.length<=1000,'Agenda de turnos no válida.');
    const ids=new Set();
    for(const e of data.events) {
        assert(e&&/^ha_[a-z0-9-]{3,90}$/i.test(e.id||'')&&!ids.has(e.id),'Identificador de turno inválido o duplicado.');ids.add(e.id);
        for(const [key,max,required] of [['name',120,true],['professional',120],['location',300],['notes',2000],['trackerId',120]])
            assert(typeof e[key]==='string'&&e[key].length<=max&&(!required||e[key].trim().length),'Datos de turno no válidos.');
        assert(['consultation','study'].includes(e.kind)&&validDay(e.date)&&validTime(e.time)&&['pending','done','cancelled'].includes(e.status)&&typeof e.paused==='boolean'&&typeof e.archived==='boolean'&&Number.isSafeInteger(e.scheduleVersion)&&e.scheduleVersion>=1,'Fecha o estado de turno no válido.');
        assert(Array.isArray(e.stages)&&e.stages.length>=1&&e.stages.length<=4,'Configurá entre uno y cuatro tramos de aviso.');
        const leads=new Set();
        for(const s of e.stages) {assert(Number.isInteger(s.days)&&s.days>=0&&s.days<=365&&!leads.has(s.days),'Los tramos deben tener días distintos, entre 0 y 365.');leads.add(s.days);validateTimes(s.times);}
        if(e.status==='done')assert(validDay(e.completedOn)&&e.completedOn<=argentinaDay(),'Elegí una fecha de realización válida.');
    }
    assert(JSON.stringify(data).length<=2000000,'La agenda superó su tamaño máximo. Exportá el historial.');
    return data;
}
export const appointmentDueAt=e=>new Date(`${e.date}T${e.time}:00-03:00`);
export function appointmentState(e,now=new Date()) {
    const days=dayDistance(argentinaDay(now),e.date), past=now>=appointmentDueAt(e);
    const stage=[...e.stages].sort((a,b)=>a.days-b.days).find(s=>days<=s.days);
    const label=e.status==='done'?'Realizado':e.status==='cancelled'?'Cancelado':past?'Confirmar asistencia':days===0?'Hoy':`Faltan ${days} días`;
    return {days,past,stage,label,tone:e.status!=='pending'||e.archived?'gray':past||days===0?'red':days<=7?'orange':stage?'yellow':'green'};
}
export function appointmentNotificationCandidates(value,now=new Date()) {
    const data=validateAppointments(value==null?emptyAppointments():typeof value==='string'?JSON.parse(value):value), day=argentinaDay(now),result=[];
    for(const event of data.events) {
        const {past,stage}=appointmentState(event,now);
        if(event.status!=='pending'||event.paused||event.archived||past||!stage)continue;
        for(const time of stage.times) {
            const scheduled=new Date(`${day}T${time}:00-03:00`), expires=new Date(Math.min(+scheduled+15*60000,+appointmentDueAt(event)));
            if(now<scheduled||now>=expires)continue;
            result.push({event,key:`appointment:${event.id}:${event.scheduleVersion}:${day}:${time.replace(':','')}`,scheduledAt:scheduled.toISOString(),expiresAt:expires.toISOString(),title:'Salud · turno',body:`${event.name} · ${event.date} a las ${event.time}${event.location?' · '+event.location:''}`});
        }
    }
    return result;
}
export function isAppointmentRetryRelevant(value,candidate,now=new Date()) {
    return appointmentNotificationCandidates(value,now).some(n=>n.key===candidate.alert_key&&Date.parse(n.scheduledAt)===Date.parse(candidate.scheduled_at)&&n.title===candidate.title&&n.body===candidate.body);
}
