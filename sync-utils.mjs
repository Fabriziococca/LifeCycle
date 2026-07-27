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
