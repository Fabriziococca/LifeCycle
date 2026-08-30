import {
    getAppResourceCapacity,
    getResourceCapacityNotice,
    getResourceLimitMessage
} from './resource-policy.mjs';

export function checkResourceCreationCapacity({
    app,
    resourceKey,
    currentCount,
    requestedCount = 1,
    errorElement = null
}) {
    const capacity = getAppResourceCapacity(
        app,
        resourceKey,
        currentCount,
        requestedCount
    );
    if (capacity.allowed) return capacity;

    const message = getResourceLimitMessage(resourceKey, capacity.limit);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        errorElement.setAttribute?.('role', 'alert');
    } else if (typeof app?.showMessage === 'function') {
        void app.showMessage({
            title: 'Límite alcanzado',
            message,
            tone: 'warning'
        });
    } else {
        app?.showToast?.(message);
    }
    return null;
}

export function appendResourceCapacityNotice(
    successMessage,
    resourceKey,
    capacity,
    requestedCount = 1
) {
    const notice = getResourceCapacityNotice(
        resourceKey,
        capacity,
        requestedCount
    );
    return notice ? `${successMessage} ${notice}` : successMessage;
}
