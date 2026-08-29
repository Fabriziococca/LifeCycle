export function areStoredValuesEqual(firstValue, secondValue) {
    if (firstValue === secondValue) return true;
    if (!firstValue && !secondValue) return true;
    if (!firstValue || !secondValue) return false;

    try {
        const firstParsed = typeof firstValue === 'object'
            ? firstValue
            : JSON.parse(firstValue);
        const secondParsed = typeof secondValue === 'object'
            ? secondValue
            : JSON.parse(secondValue);
        return JSON.stringify(firstParsed) === JSON.stringify(secondParsed);
    } catch {
        return String(firstValue).trim() === String(secondValue).trim();
    }
}

export function buildCloudPatch(keys, readStoredValue) {
    if (!Array.isArray(keys)) {
        throw new TypeError('keys must be an array');
    }
    if (typeof readStoredValue !== 'function') {
        throw new TypeError('readStoredValue must be a function');
    }

    const updates = {};
    const deleteKeys = [];

    [...new Set(keys)].forEach(key => {
        const value = readStoredValue(key);
        if (value === null) {
            deleteKeys.push(key);
        } else {
            updates[key] = value;
        }
    });

    return { updates, deleteKeys };
}

export function isPermanentSyncPolicyError(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    return code === '54000'
        || message.includes('lifecycle synchronized data limit exceeded')
        || message.includes('lifecycle resource limit exceeded');
}

export function getSyncPolicyErrorMessage(error) {
    if (!isPermanentSyncPolicyError(error)) {
        return String(error?.message || 'No se pudieron guardar los cambios.');
    }

    const details = String(error?.details || '').toLowerCase();
    if (details.includes('resource_key=custom_modules')) {
        return 'Tu cuenta alcanzó el límite de módulos personalizados. '
            + 'Eliminá definitivamente un módulo archivado antes de reintentar.';
    }
    if (details.includes('resource_key=tracker_cards')) {
        return 'Tu cuenta alcanzó el límite de tarjetas configurables. '
            + 'Eliminá definitivamente una tarjeta archivada antes de reintentar.';
    }
    return 'Tu información supera el límite seguro de sincronización. '
        + 'Los cambios quedan pendientes para que puedas reducir contenido antes de reintentar.';
}
