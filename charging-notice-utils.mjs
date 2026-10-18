const keyPattern = /^charging:(cd_[a-z0-9-]{3,90}):(cs_[a-z0-9-]{3,90}):(\d+)$/i;

export function chargingHistoryPrefix(deviceId) {
    if (typeof deviceId !== 'string' || !/^cd_[a-z0-9-]{3,90}$/i.test(deviceId)) return null;
    return `charging:${deviceId}:`;
}

// Combine the latest logical notice across devices and its one safe retry.
// A provider acceptance is never upgraded to a receipt or display.
export function latestChargingNotice(entries, deviceId) {
    const rows = (Array.isArray(entries) ? entries : []).filter(row => {
        const match = keyPattern.exec(row.alert_key || '');
        return match?.[1] === deviceId && Number.isFinite(Date.parse(row.attempted_at));
    }).sort((a,b) => Date.parse(b.attempted_at) - Date.parse(a.attempted_at));
    if (!rows.length) return null;
    const latest = rows[0], group = rows.filter(row => row.alert_key === latest.alert_key);
    const endpoints = new Map();
    const rank = row => row.displayed_at ? 7 : row.received_at && !row.discarded_at ? 6 : row.status === 'accepted' ? 5 : row.status === 'pending' ? 4 : row.status === 'unknown' ? 3 : 2;
    for (const row of group) {
        const endpoint = row.endpoint_fingerprint || `row-${row.id}`;
        if (!endpoints.has(endpoint) || rank(row) > rank(endpoints.get(endpoint))) endpoints.set(endpoint,row);
    }
    const attempts = [...endpoints.values()];
    const displayed = attempts.filter(row => row.displayed_at).length;
    const received = attempts.filter(row => row.received_at && !row.discarded_at).length;
    const failed = new Set(group.filter(row => row.status === 'failed').map(row=>row.endpoint_fingerprint || `row-${row.id}`)).size;
    let tone = 'warning', label = 'Resultado sin confirmar';
    if (displayed) {tone='success';label=`Mostrado en ${displayed} ${displayed===1?'dispositivo':'dispositivos'}`;}
    else if (received) {label='Recibido · visualización sin confirmar';}
    else if (attempts.some(row => row.discarded_at)) label='Aviso descartado por vencimiento';
    else if (attempts.some(row => row.status === 'accepted')) label='Enviado · recepción sin confirmar';
    else if (attempts.some(row => row.status === 'pending')) label='Envío en curso';
    else if (attempts.some(row => row.status === 'no_devices')) {tone='danger';label='Sin dispositivos para recibir avisos';}
    else if (failed) {tone='danger';label='No se pudo enviar';}
    else if (attempts.some(row => row.status === 'expired')) label='Aviso vencido';
    return {label,tone,sessionId:keyPattern.exec(latest.alert_key)[2],attemptedAt:latest.attempted_at,
        scheduledAt:latest.scheduled_at || null,failed,
        partial:rows.length===100 && rows.at(-1).alert_key===latest.alert_key};
}
