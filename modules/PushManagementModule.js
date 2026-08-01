import { escapeHtml } from '../text-utils.mjs?v=20260727-safe-text';

function formatDateTime(value) {
    if (!value) return 'Sin actividad registrada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).format(date);
}

function inferBrowser(userAgent) {
    if (/Edg\//i.test(userAgent)) return 'Edge';
    if (/Firefox\//i.test(userAgent)) return 'Firefox';
    if (/CriOS\//i.test(userAgent)) return 'Chrome';
    if (/Chrome\//i.test(userAgent)) return 'Chrome';
    if (/Safari\//i.test(userAgent) && !/Chrome|Chromium|Android/i.test(userAgent)) return 'Safari';
    return 'Navegador';
}

function inferPlatform(userAgent) {
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    return 'Dispositivo';
}

export class PushManagementModule {
    constructor(authModule) {
        this.auth = authModule;
        this.app = authModule.app;
        this.devicesList = document.getElementById('push-devices-list');
        this.devicesNote = document.getElementById('push-devices-note');
        this.devicesRefresh = document.getElementById('push-devices-refresh');
        this.historyList = document.getElementById('push-history-list');
        this.historyNote = document.getElementById('push-history-note');
        this.historyRefresh = document.getElementById('push-history-refresh');
        this.historyFilter = document.getElementById('push-history-filter');
        this.healthStatus = document.getElementById('push-engine-status');
        this.diagnosticsButton = document.getElementById('btn-diagnose-push');
        this.diagnosticsResults = document.getElementById('push-diagnostics-results');
        this.devices = [];
        this.history = [];
        this.currentFingerprint = '';
        this.metadataAvailable = true;
        this.editingDeviceId = null;
        this.pendingDeleteId = null;
        this.busy = false;
        this.setupListeners();
    }

    setupListeners() {
        this.devicesRefresh?.addEventListener('click', () => this.loadDevices());
        this.historyRefresh?.addEventListener('click', () => this.loadHistory());
        this.historyFilter?.addEventListener('change', () => this.loadHistory());
        this.diagnosticsButton?.addEventListener('click', () => {
            this.runDiagnostics().catch(error => this.showError(error));
        });
        this.devicesList?.addEventListener('click', event => {
            this.handleDeviceAction(event).catch(error => this.showError(error));
        });
        this.historyList?.addEventListener('click', event => {
            this.handleHistoryAction(event).catch(error => this.showError(error));
        });
    }

    async getDeviceMetadata() {
        const userAgent = navigator.userAgent || '';
        let browser = inferBrowser(userAgent);
        try {
            if (await navigator.brave?.isBrave?.()) browser = 'Brave';
        } catch {}
        const platform = navigator.userAgentData?.platform
            || inferPlatform(userAgent);
        return {
            name: `${platform} · ${browser}`,
            platform,
            browser,
            userAgent
        };
    }

    async getAccessToken() {
        const { data: { session }, error } = await this.auth.supabase.auth.getSession();
        if (error || !session?.access_token) {
            throw new Error('La sesión venció. Volvé a iniciar sesión.');
        }
        return session.access_token;
    }

    async request(path, { method = 'GET', body, timeoutMs = 12000 } = {}) {
        const token = await this.getAccessToken();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(path, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                signal: controller.signal,
                cache: 'no-store'
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(result.error || `El servidor respondió HTTP ${response.status}.`);
                error.status = response.status;
                throw error;
            }
            return result;
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error('La consulta de notificaciones tardó demasiado en responder.');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async fingerprintEndpoint(endpoint) {
        if (!endpoint || !globalThis.crypto?.subtle) return '';
        const bytes = new TextEncoder().encode(endpoint);
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(digest)]
            .map(value => value.toString(16).padStart(2, '0'))
            .join('')
            .slice(0, 20);
    }

    async getCurrentSubscription() {
        if (!('serviceWorker' in navigator)) return null;
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.pushManager?.getSubscription?.() || null;
    }

    async checkCurrentRegistration(subscriptionJSON) {
        const device = await this.getDeviceMetadata();
        return this.request('/api/push/status', {
            method: 'POST',
            body: { subscription: subscriptionJSON, device }
        });
    }

    renderDiagnostics(steps) {
        if (!this.diagnosticsResults) return;
        const icons = {
            success: 'ph-check-circle',
            warning: 'ph-warning-circle',
            danger: 'ph-x-circle',
            neutral: 'ph-minus-circle'
        };
        this.diagnosticsResults.innerHTML = `
            <div class="push-diagnostics-heading">
                <strong>Diagnóstico de este dispositivo</strong>
                <small>La prueba no cambia configuraciones del navegador.</small>
            </div>
            <ol class="push-diagnostics-list">
                ${steps.map(step => `
                    <li class="${escapeHtml(step.state)}">
                        <i class="ph ${icons[step.state] || icons.neutral}"></i>
                        <span><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.detail)}</small></span>
                    </li>
                `).join('')}
            </ol>
        `;
        this.diagnosticsResults.classList.remove('hidden');
    }

    async runDiagnostics() {
        if (this.busy || !this.auth.user) return;
        this.busy = true;
        if (this.diagnosticsButton) {
            this.diagnosticsButton.disabled = true;
            this.diagnosticsButton.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Diagnosticando...';
        }
        const steps = [];
        const addStep = (label, state, detail) => {
            steps.push({ label, state, detail });
            this.renderDiagnostics(steps);
        };

        try {
            const metadata = await this.getDeviceMetadata();
            addStep(
                'Conexión segura',
                window.isSecureContext ? 'success' : 'danger',
                window.isSecureContext ? 'HTTPS está activo.' : 'Web Push requiere HTTPS.'
            );

            const apiSupported = 'Notification' in window
                && 'serviceWorker' in navigator
                && 'PushManager' in window;
            addStep(
                'Compatibilidad del navegador',
                apiSupported ? 'success' : 'danger',
                apiSupported
                    ? `${metadata.browser} en ${metadata.platform} admite Web Push.`
                    : 'Falta una API necesaria de notificaciones, Service Worker o Push.'
            );

            const permission = window.Notification?.permission || 'unsupported';
            addStep(
                'Permiso de notificaciones',
                permission === 'granted' ? 'success' : (permission === 'denied' ? 'danger' : 'warning'),
                permission === 'granted'
                    ? 'El permiso está concedido.'
                    : (permission === 'denied'
                        ? 'Está bloqueado desde el navegador o Windows.'
                        : 'Todavía no fue concedido; usá “Activar notificaciones”.')
            );

            let registration = null;
            if (apiSupported) {
                try {
                    registration = await this.auth.getPushServiceWorkerRegistration(6000);
                    addStep('Service Worker', 'success', 'El componente en segundo plano está activo.');
                } catch (error) {
                    addStep('Service Worker', 'danger', error.message || 'No quedó activo.');
                }
            } else {
                addStep('Service Worker', 'neutral', 'No se puede comprobar en este navegador.');
            }

            const subscription = await registration?.pushManager?.getSubscription?.() || null;
            addStep(
                'Suscripción local',
                subscription ? 'success' : 'warning',
                subscription
                    ? 'El navegador conserva una suscripción Push.'
                    : 'Este navegador todavía no generó una suscripción.'
            );

            let registrationState = null;
            if (subscription) {
                try {
                    registrationState = await this.checkCurrentRegistration(subscription.toJSON());
                    addStep(
                        'Registro en LifeCycle',
                        registrationState.registered ? 'success' : 'warning',
                        registrationState.registered
                            ? `El backend reconoce este dispositivo (${registrationState.registeredDevices} registrado(s)).`
                            : 'La suscripción existe localmente, pero falta registrarla en LifeCycle.'
                    );
                } catch (error) {
                    addStep('Registro en LifeCycle', 'danger', error.message);
                }
            } else {
                addStep('Registro en LifeCycle', 'neutral', 'Pendiente de crear la suscripción local.');
            }

            try {
                const response = await fetch('/api/health', { cache: 'no-store' });
                const health = await response.json();
                const configured = response.ok && health.notifications?.configured === true;
                addStep(
                    'Backend y credenciales Push',
                    configured ? 'success' : 'danger',
                    configured
                        ? 'Render, Supabase y VAPID están configurados.'
                        : 'El backend informa una configuración incompleta.'
                );
            } catch {
                addStep('Backend y credenciales Push', 'danger', 'No se pudo consultar el estado de Render.');
            }

            if (registrationState?.registered && registrationState.device?.id) {
                try {
                    await this.request(
                        `/api/push/devices/${encodeURIComponent(registrationState.device.id)}/test`,
                        { method: 'POST', timeoutMs: 20000 }
                    );
                    addStep(
                        'Prueba real',
                        'success',
                        'El proveedor Push aceptó el envío. Si apareció, confirmalo en el historial.'
                    );
                    await Promise.all([this.loadDevices(), this.loadHistory()]);
                } catch (error) {
                    const braveHint = metadata.browser === 'Brave'
                        ? ' Revisá “Usar servicios de Google para mensajería push” en Brave.'
                        : '';
                    addStep('Prueba real', 'danger', `${error.message}${braveHint}`);
                }
            } else {
                addStep('Prueba real', 'neutral', 'Se habilitará cuando este dispositivo esté registrado.');
            }
        } finally {
            this.busy = false;
            if (this.diagnosticsButton) {
                this.diagnosticsButton.disabled = false;
                this.diagnosticsButton.innerHTML = '<i class="ph ph-stethoscope"></i> Diagnosticar este dispositivo';
            }
        }
    }

    async refreshAll() {
        if (!this.auth.user || !this.auth.supabase) {
            this.clear();
            return;
        }
        await Promise.allSettled([
            this.loadDevices(),
            this.loadHistory(),
            this.loadHealth()
        ]);
    }

    clear() {
        this.devices = [];
        this.history = [];
        this.currentFingerprint = '';
        this.metadataAvailable = true;
        this.editingDeviceId = null;
        this.pendingDeleteId = null;
        this.diagnosticsResults?.classList.add('hidden');
        if (this.diagnosticsResults) this.diagnosticsResults.innerHTML = '';
        if (this.devicesList) this.devicesList.innerHTML = '<p class="push-manager-empty">Iniciá sesión para ver tus dispositivos.</p>';
        if (this.historyList) this.historyList.innerHTML = '<p class="push-manager-empty">Iniciá sesión para ver el historial.</p>';
    }

    async loadDevices() {
        if (!this.devicesList || !this.auth.user) return;
        this.devicesList.innerHTML = '<p class="push-manager-empty">Cargando dispositivos...</p>';
        try {
            const [result, subscription] = await Promise.all([
                this.request('/api/push/devices'),
                this.getCurrentSubscription().catch(() => null)
            ]);
            this.currentFingerprint = await this.fingerprintEndpoint(subscription?.endpoint || '');
            this.devices = Array.isArray(result.devices) ? result.devices : [];
            this.metadataAvailable = result.metadataAvailable !== false;
            this.renderDevices();
            if (this.devicesNote) {
                this.devicesNote.textContent = result.metadataAvailable === false
                    ? 'Los dispositivos funcionan, pero falta aplicar la migración para poder nombrarlos y ver métricas por equipo.'
                    : 'Revocar un equipo detiene sus avisos sin afectar los demás dispositivos.';
                this.devicesNote.className = `push-manager-note ${result.metadataAvailable === false ? 'warning' : ''}`;
            }
        } catch (error) {
            this.devicesList.innerHTML = `<p class="push-manager-empty error">${escapeHtml(error.message)}</p>`;
        }
    }

    renderDevices() {
        if (!this.devicesList) return;
        if (this.devices.length === 0) {
            this.devicesList.innerHTML = '<p class="push-manager-empty">Todavía no hay dispositivos registrados.</p>';
            return;
        }
        this.devicesList.innerHTML = this.devices.map(device => {
            const isCurrent = Boolean(
                this.currentFingerprint
                && device.endpointFingerprint === this.currentFingerprint
            );
            const isEditing = this.editingDeviceId === device.id;
            const pendingDelete = this.pendingDeleteId === device.id;
            const statusText = device.lastStatus === 'accepted'
                ? 'Último envío aceptado'
                : (device.lastStatus === 'failed' ? 'Último envío falló' : 'Sin pruebas registradas');
            const statusAt = device.lastStatus === 'accepted'
                ? device.lastSuccessAt
                : (device.lastStatus === 'failed' ? device.lastFailureAt : null);
            const statusClass = device.lastStatus === 'accepted'
                ? 'success'
                : (device.lastStatus === 'failed' ? 'danger' : 'neutral');
            if (pendingDelete) {
                return `
                    <article class="push-device-row confirm" data-device-id="${escapeHtml(device.id)}">
                        <div><strong>¿Revocar ${escapeHtml(device.name)}?</strong><small>Dejará de recibir avisos hasta que vuelvas a activarlo desde ese equipo.</small></div>
                        <div class="push-device-actions">
                            <button type="button" data-push-device-action="cancel-delete" data-device-id="${escapeHtml(device.id)}">Cancelar</button>
                            <button type="button" class="danger" data-push-device-action="confirm-delete" data-device-id="${escapeHtml(device.id)}">Revocar</button>
                        </div>
                    </article>
                `;
            }
            return `
                <article class="push-device-row ${isCurrent ? 'current' : ''}" data-device-id="${escapeHtml(device.id)}">
                    <div class="push-device-main">
                        <span class="push-device-icon"><i class="ph ${/Android|iOS/i.test(device.platform) ? 'ph-device-mobile' : 'ph-desktop'}"></i></span>
                        <span class="push-device-copy">
                            ${isEditing ? `
                                <input class="text-input push-device-name-input" maxlength="80" value="${escapeHtml(device.name)}" aria-label="Nombre del dispositivo">
                            ` : `<strong>${escapeHtml(device.name)}</strong>`}
                            <small>${escapeHtml(device.platform)} · ${escapeHtml(device.browser)}${isCurrent ? ' · Este dispositivo' : ''}</small>
                            <small class="push-device-status ${statusClass}">${escapeHtml(statusText)}${statusAt ? ` · ${escapeHtml(formatDateTime(statusAt))}` : ''}</small>
                            <small>Última conexión: ${escapeHtml(formatDateTime(device.lastSeenAt))}</small>
                        </span>
                    </div>
                    <div class="push-device-actions">
                        ${isEditing ? `
                            <button type="button" data-push-device-action="cancel-edit" data-device-id="${escapeHtml(device.id)}">Cancelar</button>
                            <button type="button" class="primary" data-push-device-action="save-name" data-device-id="${escapeHtml(device.id)}">Guardar</button>
                        ` : `
                            <button type="button" data-push-device-action="test" data-device-id="${escapeHtml(device.id)}" aria-label="Probar ${escapeHtml(device.name)}" data-tooltip="Enviar prueba a este dispositivo"><i class="ph ph-paper-plane-tilt"></i></button>
                            ${this.metadataAvailable ? `<button type="button" data-push-device-action="edit" data-device-id="${escapeHtml(device.id)}" aria-label="Renombrar ${escapeHtml(device.name)}" data-tooltip="Renombrar dispositivo"><i class="ph ph-pencil-simple"></i></button>` : ''}
                            <button type="button" class="danger" data-push-device-action="request-delete" data-device-id="${escapeHtml(device.id)}" aria-label="Revocar ${escapeHtml(device.name)}" data-tooltip="Revocar dispositivo"><i class="ph ph-trash"></i></button>
                        `}
                    </div>
                </article>
            `;
        }).join('');
        if (this.editingDeviceId) {
            requestAnimationFrame(() => {
                this.devicesList.querySelector(`[data-device-id="${CSS.escape(this.editingDeviceId)}"] .push-device-name-input`)?.focus();
            });
        }
    }

    async handleDeviceAction(event) {
        const button = event.target.closest('[data-push-device-action]');
        if (!button || this.busy) return;
        const action = button.dataset.pushDeviceAction;
        const deviceId = button.dataset.deviceId;
        if (action === 'edit') {
            this.editingDeviceId = deviceId;
            this.pendingDeleteId = null;
            this.renderDevices();
            return;
        }
        if (action === 'cancel-edit') {
            this.editingDeviceId = null;
            this.renderDevices();
            return;
        }
        if (action === 'request-delete') {
            this.pendingDeleteId = deviceId;
            this.editingDeviceId = null;
            this.renderDevices();
            return;
        }
        if (action === 'cancel-delete') {
            this.pendingDeleteId = null;
            this.renderDevices();
            return;
        }

        this.busy = true;
        button.disabled = true;
        try {
            if (action === 'test') {
                await this.request(`/api/push/devices/${encodeURIComponent(deviceId)}/test`, {
                    method: 'POST',
                    timeoutMs: 20000
                });
                await Promise.all([this.loadDevices(), this.loadHistory()]);
                await this.app.showMessage({
                    title: 'Prueba aceptada por Push',
                    message: 'El proveedor recibió la prueba. Revisá ese dispositivo y el historial para confirmar el resultado disponible.',
                    tone: 'success'
                });
            } else if (action === 'save-name') {
                const row = button.closest('.push-device-row');
                const name = row?.querySelector('.push-device-name-input')?.value?.trim();
                if (!name) throw new Error('Ingresá un nombre para el dispositivo.');
                await this.request(`/api/push/devices/${encodeURIComponent(deviceId)}`, {
                    method: 'PATCH',
                    body: { name }
                });
                this.editingDeviceId = null;
                await this.loadDevices();
                this.app.showToast?.('Nombre del dispositivo actualizado.');
            } else if (action === 'confirm-delete') {
                const result = await this.request(`/api/push/devices/${encodeURIComponent(deviceId)}`, {
                    method: 'DELETE'
                });
                if (
                    this.currentFingerprint
                    && result.endpointFingerprint === this.currentFingerprint
                ) {
                    const subscription = await this.getCurrentSubscription();
                    await subscription?.unsubscribe?.();
                }
                this.pendingDeleteId = null;
                await this.auth.checkPushSubscriptionStatus();
                await this.loadDevices();
                this.app.showToast?.('Dispositivo revocado.');
            }
        } finally {
            this.busy = false;
        }
    }

    async loadHistory() {
        if (!this.historyList || !this.auth.user) return;
        this.historyList.innerHTML = '<p class="push-manager-empty">Cargando historial...</p>';
        const status = this.historyFilter?.value || '';
        const query = new URLSearchParams({ limit: '50' });
        if (status) query.set('status', status);
        try {
            const result = await this.request(`/api/push/history?${query}`);
            this.history = Array.isArray(result.entries) ? result.entries : [];
            this.renderHistory(result.available !== false);
        } catch (error) {
            this.historyList.innerHTML = `<p class="push-manager-empty error">${escapeHtml(error.message)}</p>`;
        }
    }

    renderHistory(available) {
        if (!this.historyList) return;
        if (!available) {
            this.historyList.innerHTML = '<p class="push-manager-empty warning">El historial quedará disponible después de aplicar la migración de Supabase.</p>';
            if (this.historyNote) this.historyNote.textContent = 'Los avisos siguen funcionando; únicamente falta habilitar el registro histórico.';
            return;
        }
        if (this.historyNote) {
            this.historyNote.textContent = '“Aceptada” confirma que el servicio Push recibió el envío; los navegadores no confirman si la notificación fue vista.';
        }
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<p class="push-manager-empty">No hay envíos para este filtro.</p>';
            return;
        }
        const statusMeta = {
            accepted: { label: 'Aceptada por Push', icon: 'ph-check-circle', className: 'success' },
            failed: { label: 'Falló', icon: 'ph-warning-circle', className: 'danger' },
            expired: { label: 'Endpoint vencido', icon: 'ph-x-circle', className: 'danger' },
            no_devices: { label: 'Sin dispositivos', icon: 'ph-device-mobile-slash', className: 'warning' }
        };
        this.historyList.innerHTML = this.history.map(entry => {
            const meta = statusMeta[entry.status] || statusMeta.failed;
            const device = entry.status === 'no_devices'
                ? 'Cuenta sin dispositivos registrados'
                : (entry.device_name || `Dispositivo ${String(entry.endpoint_fingerprint || '').slice(0, 6)}`);
            const detail = entry.status === 'accepted'
                ? entry.body
                : (entry.error_message || entry.body || 'El proveedor rechazó el envío.');
            const confirmed = Boolean(entry.confirmed_at);
            return `
                <article class="push-history-row">
                    <span class="push-history-status ${meta.className}"><i class="ph ${meta.icon}"></i></span>
                    <span class="push-history-copy">
                        <strong>${escapeHtml(entry.title || entry.alert_key || 'Notificación')}</strong>
                        <small>${escapeHtml(detail || '')}</small>
                        <small>${escapeHtml(device)} · ${escapeHtml(formatDateTime(entry.attempted_at))}</small>
                        ${confirmed ? `<small class="push-history-confirmed"><i class="ph ph-eye"></i> Confirmada por vos · ${escapeHtml(formatDateTime(entry.confirmed_at))}</small>` : ''}
                    </span>
                    <span class="push-history-side">
                        <span class="push-history-badge ${meta.className}">${escapeHtml(meta.label)}</span>
                        ${entry.status === 'accepted' && !confirmed ? `
                            <button
                                type="button"
                                class="push-history-confirm"
                                data-push-history-action="confirm-seen"
                                data-history-id="${escapeHtml(String(entry.id))}"
                            ><i class="ph ph-eye"></i> La vi</button>
                        ` : ''}
                    </span>
                </article>
            `;
        }).join('');
    }

    async handleHistoryAction(event) {
        const button = event.target.closest('[data-push-history-action="confirm-seen"]');
        if (!button || this.busy) return;
        const historyId = button.dataset.historyId;
        if (!historyId) return;
        this.busy = true;
        button.disabled = true;
        try {
            await this.request(`/api/push/history/${encodeURIComponent(historyId)}/confirm`, {
                method: 'POST'
            });
            await this.loadHistory();
            this.app.showToast?.('Notificación confirmada como vista.');
        } finally {
            this.busy = false;
        }
    }

    async loadHealth() {
        if (!this.healthStatus) return;
        try {
            const response = await fetch('/api/health', { cache: 'no-store' });
            const result = await response.json();
            const state = result.notifications || {};
            if (!state.configured) {
                this.healthStatus.className = 'push-engine-status warning';
                this.healthStatus.textContent = 'El backend de notificaciones no está configurado completamente.';
            } else if (state.consecutiveFailures > 0) {
                this.healthStatus.className = 'push-engine-status danger';
                this.healthStatus.textContent = `El motor registró ${state.consecutiveFailures} fallo(s) consecutivo(s).`;
            } else {
                this.healthStatus.className = 'push-engine-status success';
                this.healthStatus.textContent = state.lastSuccessAt
                    ? `Motor operativo · última revisión correcta ${formatDateTime(state.lastSuccessAt)}.`
                    : 'Motor configurado; todavía no registró una revisión completa.';
            }
        } catch {
            this.healthStatus.className = 'push-engine-status warning';
            this.healthStatus.textContent = 'No se pudo consultar el estado del motor.';
        }
    }

    async showError(error) {
        await this.app.showMessage({
            title: 'No se pudo completar la acción',
            message: error?.message || 'Ocurrió un error administrando las notificaciones.',
            tone: 'danger'
        });
    }
}
