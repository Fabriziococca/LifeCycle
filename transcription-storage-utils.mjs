const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function removeSessionAudioObjects(bucket, userId, sessionId) {
    if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(sessionId)) {
        throw new Error('No se puede limpiar audio sin una cuenta y sesión válidas.');
    }
    const prefix = `${userId}/${sessionId}`;
    const paths = [];
    // Enumerate before deleting so offset pagination cannot skip objects. This
    // includes outputs from a crash before their metadata transaction committed.
    for (let offset = 0; ; offset += 100) {
        if (offset >= 10000) throw new Error('Demasiados archivos para una limpieza segura.');
        const { data, error } = await bucket.list(prefix, {
            limit: 100, offset, sortBy: { column: 'name', order: 'asc' }
        });
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('No se pudo comprobar el inventario de audio.');
        for (const item of data) {
            const name = String(item?.name || '');
            if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)
                || (item.id === null && item.metadata === null)) {
                throw new Error('El inventario contiene una ruta de audio inesperada.');
            }
            paths.push(`${prefix}/${name}`);
        }
        if (data.length < 100) break;
    }
    for (let index = 0; index < paths.length; index += 100) {
        const { error } = await bucket.remove(paths.slice(index, index + 100));
        if (error) throw error;
    }
    return paths.length;
}
