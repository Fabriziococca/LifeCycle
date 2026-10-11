export function isProjectDeliveryPending(project) {
    return Boolean(project && !project.isDelivered && !project.isArbitration);
}

export function formatProjectDeadline(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Fecha no definida';
    const day = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(date);
    const calendar = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
    const time = new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(date);
    return `${day}, ${calendar} a las ${time} h`;
}
