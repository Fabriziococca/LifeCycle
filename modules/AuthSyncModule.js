import {
    CLOUD_LOCAL_CLEAR_KEYS,
    CLOUD_RESTORE_KEYS,
    CLOUD_SERVER_MANAGED_KEYS,
    CLOUD_SYNC_KEYS,
    SYNC_PENDING_STORAGE_KEY
} from '../sync-config.mjs?v=20260729-project-templates';
import {
    areStoredValuesEqual,
    buildCloudPatch
} from '../sync-utils.mjs';
import { PushManagementModule } from './PushManagementModule.js?v=20260801-push-diagnostics';

function isMissingCloudRevisionSchema(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    return ['42703', 'PGRST204'].includes(code)
        || (message.includes('revision') && message.includes('user_data'));
}

export class AuthSyncModule {
    constructor(appController) {
        this.app = appController;
        this.supabase = null;
        this.user = null;
        this.config = null;
        
        // Dom Elements
        this.authLoading = document.getElementById('auth-loading');
        this.authLoggedOut = document.getElementById('auth-logged-out');
        this.authLoggedIn = document.getElementById('auth-logged-in');
        
        this.authForm = document.getElementById('auth-form');
        this.authEmail = document.getElementById('auth-email');
        this.authPassword = document.getElementById('auth-password');
        this.btnLogin = document.getElementById('btn-login');

        this.accessGate = document.getElementById('access-gate');
        this.accessGateLoading = document.getElementById('access-gate-loading');
        this.accessGateForm = document.getElementById('access-gate-form');
        this.accessOpenRegistration = document.getElementById('access-open-registration');
        this.accessRegistrationForm = document.getElementById('access-registration-form');
        this.accessRegistrationCode = document.getElementById('access-registration-code');
        this.accessRegistrationEmail = document.getElementById('access-registration-email');
        this.accessRegistrationPassword = document.getElementById('access-registration-password');
        this.accessRegistrationPasswordConfirm = document.getElementById('access-registration-password-confirm');
        this.accessRegistrationError = document.getElementById('access-registration-error');
        this.accessCancelRegistration = document.getElementById('access-cancel-registration');
        this.accessSubmitRegistration = document.getElementById('access-submit-registration');
        this.accessGateUnavailable = document.getElementById('access-gate-unavailable');
        this.accessGateUnavailableMessage = document.getElementById('access-gate-unavailable-message');
        this.accessGateMessage = document.getElementById('access-gate-message');
        this.accessGateError = document.getElementById('access-gate-error');
        this.accessEmail = document.getElementById('access-email');
        this.accessPassword = document.getElementById('access-password');
        this.accessRetry = document.getElementById('access-retry');
        this.appContainer = document.querySelector('main.container');
        
        this.profileEmail = document.getElementById('profile-email');
        this.syncStatusBadge = document.getElementById('sync-status-badge');
        this.btnSyncNow = document.getElementById('btn-sync-now');
        this.btnLogout = document.getElementById('btn-logout');
        
        this.pushNotificationsCard = document.getElementById('push-notifications-card');
        this.btnEnablePush = document.getElementById('btn-enable-push');
        this.btnTestPush = document.getElementById('btn-test-push');
        this.pushStatusMessage = document.getElementById('push-status-message');
        
        this.realtimeChannel = null;
        this.isSyncing = false;
        this.isRestoring = false;
        this.syncGeneration = 0;
        this.activeSyncPromise = null;
        this.pendingSyncKeys = this.loadPendingSyncKeys();
        this.syncFlushTimer = null;
        this.syncRetryTimer = null;
        this.realtimeRefreshTimer = null;
        this.cloudRevision = null;
        this.pushSyncPromise = null;
        this.pushManagement = new PushManagementModule(this);
        this.setupAccessGateListeners();
        this.init();
    }

    async init() {
        try {
            // 1. Fetch credentials from server config endpoint
            const res = await fetch('/api/config', { cache: 'no-store' });
            if (!res.ok) {
                throw new Error(`El servidor respondió HTTP ${res.status}`);
            }
            this.config = await res.json();
            
            if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
                throw new Error('La autenticación cloud no está configurada.');
            }
            this.accessOpenRegistration?.classList.toggle(
                'hidden',
                this.config.registrationEnabled !== true
            );
            
            // 2. Initialize Supabase client
            if (!window.supabase?.createClient) {
                throw new Error('No se pudo cargar el cliente de autenticación.');
            }
            this.supabase = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
            
            // 3. Bind UI listeners
            this.setupListeners();
            
            // 4. Initial session check
            const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
            if (sessionError) throw sessionError;
            await this.handleAuthStateChange(session?.user || null);
            
            // 5. Setup auth state change listener
            this.supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'TOKEN_REFRESHED') {
                    this.user = session?.user || this.user;
                    return;
                }

                this.handleAuthStateChange(session?.user || null).catch(error => {
                    console.error('Error aplicando el cambio de sesión:', error);
                    this.showUnavailableMode('No se pudo validar la sesión. Reintentá la conexión.');
                });
            });
            
        } catch (err) {
            console.error("Error initializing Supabase:", err);
            this.showUnavailableMode('No se pudo conectar con el acceso seguro de LifeCycle.');
        }
    }

    setupAccessGateListeners() {
        this.accessGateForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.login(this.accessEmail?.value, this.accessPassword?.value);
        });

        this.accessRetry?.addEventListener('click', () => {
            window.location.reload();
        });

        this.accessOpenRegistration?.addEventListener('click', () => {
            if (this.config?.registrationEnabled !== true) return;
            this.setRegistrationError('');
            this.setAccessGateState('register');
            requestAnimationFrame(() => this.accessRegistrationCode?.focus());
        });

        this.accessCancelRegistration?.addEventListener('click', () => {
            this.resetRegistrationForm();
            this.setAccessGateState('logged-out');
        });

        this.accessRegistrationForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.registerInvitedAccount();
        });
    }

    setAccessGateState(state, message = '') {
        const isAuthenticated = state === 'authenticated';
        this.accessGate?.classList.toggle('hidden', isAuthenticated);
        this.appContainer?.classList.toggle('hidden', !isAuthenticated);
        document.body.classList.toggle('access-locked', !isAuthenticated);
        if (isAuthenticated) {
            requestAnimationFrame(() => this.app.refreshNavigationHints?.());
        }

        this.accessGateLoading?.classList.toggle('hidden', state !== 'loading');
        this.accessGateForm?.classList.toggle('hidden', state !== 'logged-out');
        this.accessRegistrationForm?.classList.toggle('hidden', state !== 'register');
        this.accessGateUnavailable?.classList.toggle('hidden', state !== 'unavailable');

        if (this.accessGateMessage && message) {
            this.accessGateMessage.textContent = message;
        }
        if (this.accessGateUnavailableMessage && state === 'unavailable' && message) {
            this.accessGateUnavailableMessage.textContent = message;
        }

        if (this.accessGateError) {
            this.accessGateError.textContent = state === 'logged-out' ? message : '';
            this.accessGateError.classList.toggle('hidden', state !== 'logged-out' || !message);
        }
    }

    setRegistrationError(message = '') {
        if (!this.accessRegistrationError) return;
        this.accessRegistrationError.textContent = message;
        this.accessRegistrationError.classList.toggle('hidden', !message);
    }

    resetRegistrationForm() {
        this.accessRegistrationForm?.reset();
        this.setRegistrationError('');
    }

    async registerInvitedAccount() {
        const accessCode = this.accessRegistrationCode?.value || '';
        const email = (this.accessRegistrationEmail?.value || '').trim();
        const password = this.accessRegistrationPassword?.value || '';
        const passwordConfirm = this.accessRegistrationPasswordConfirm?.value || '';

        if (password !== passwordConfirm) {
            this.setRegistrationError('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 12) {
            this.setRegistrationError('La contraseña debe tener al menos 12 caracteres.');
            return;
        }

        this.setRegistrationError('');
        if (this.accessSubmitRegistration) this.accessSubmitRegistration.disabled = true;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessCode, email, password }),
                cache: 'no-store',
                credentials: 'same-origin'
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.setRegistrationError(
                    result.error || 'No se pudo crear la cuenta. Intentá nuevamente.'
                );
                return;
            }

            if (this.accessRegistrationCode) this.accessRegistrationCode.value = '';
            if (this.accessRegistrationPasswordConfirm) this.accessRegistrationPasswordConfirm.value = '';
            await this.login(email, password);
        } catch (error) {
            console.error('Error creando la cuenta invitada:', error);
            this.setRegistrationError('No se pudo conectar con el registro. Intentá nuevamente.');
        } finally {
            if (this.accessSubmitRegistration) this.accessSubmitRegistration.disabled = false;
        }
    }

    showUnavailableMode(message) {
        this.authLoading?.classList.add('hidden');
        this.authLoggedOut?.classList.add('hidden');
        this.authLoggedIn?.classList.add('hidden');
        this.setAccessGateState('unavailable', message);
    }

    setupListeners() {
        // Form Submit handles Login
        this.authForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const action = e.submitter?.id; // 'btn-login'
            if (action === 'btn-login') {
                await this.login();
            }
        });

        // Logout Button Click
        this.btnLogout?.addEventListener('click', async () => {
            await this.logout();
        });

        // Manual Sync Button Click
        this.btnSyncNow?.addEventListener('click', async () => {
            await this.syncToCloud(true);
        });

        // Push Notifications Click Listeners
        this.btnEnablePush?.addEventListener('click', async () => {
            await this.enablePushNotifications();
        });

        this.btnTestPush?.addEventListener('click', async () => {
            await this.sendTestPushNotification();
        });

        // Sincronización automática al enfocar la pestaña o cambiar visibilidad para mantener múltiples dispositivos al día
        window.addEventListener('focus', () => {
            if (this.user) {
                this.checkAndSyncData().catch(e => console.error("Error on focus sync:", e));
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.user) {
                this.checkAndSyncData().catch(e => console.error("Error on visibility sync:", e));
            }
        });

        // Chequeo periódico de sincronización cada 60 segundos en segundo plano
        setInterval(() => {
            if (this.user && !this.isSyncing) {
                this.checkAndSyncData().catch(e => console.error("Error on periodic sync:", e));
            }
        }, 60 * 1000);
    }

    async login(emailValue, passwordValue) {
        const email = (emailValue || this.authEmail?.value || '').trim();
        const password = passwordValue || this.authPassword?.value;
        if (!email || !password) return;
        
        this.setLoading(true, "Iniciando sesión...");
        
        const { error } = await this.supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            this.setLoading(false);
            const message = error.message?.toLowerCase().includes('invalid login credentials')
                ? 'Correo o contraseña incorrectos.'
                : `No se pudo iniciar sesión: ${error.message}`;
            this.setAccessGateState('logged-out', message);
        }
    }

    async logout() {
        const confirmed = await this.app.confirmAction({
            title: 'Cerrar sesión',
            message: 'Volverás a la pantalla de acceso y tus datos locales de esta sesión se limpiarán.',
            tone: 'warning',
            confirmLabel: 'Cerrar sesión'
        });
        if (confirmed) {
            this.setLoading(true, "Cerrando sesión...");
            const { error } = await this.supabase.auth.signOut();
            if (error) {
                console.error('Error cerrando sesión:', error);
                await this.app.showMessage({
                    title: 'No se pudo cerrar la sesión',
                    message: error.message,
                    tone: 'danger'
                });
                this.setLoading(false);
                this.setAccessGateState('authenticated');
                return;
            }

            this.clearLocalUserData();
            location.reload();
        }
    }

    async handleAuthStateChange(user) {
        this.user = user;
        
        if (user) {
            this.setAccessGateState('loading', 'Sincronizando tus datos...');

            // Logged in
            if (this.authLoggedOut) this.authLoggedOut.classList.add('hidden');
            if (this.authLoggedIn) this.authLoggedIn.classList.remove('hidden');
            if (this.profileEmail) this.profileEmail.innerText = user.email;
            if (this.pushNotificationsCard) this.pushNotificationsCard.classList.remove('hidden');
            
            // Supabase is the source of truth. Do not reveal the app until cloud data is ready.
            const cloudReady = await this.checkAndSyncData();
            if (!cloudReady) {
                throw new Error('No se pudo cargar el estado principal desde Supabase.');
            }

            // Setup realtime subscription for cross-device updates
            this.setupRealtimeSubscription();
            this.setLoading(false);
            this.setAccessGateState('authenticated');

            // Push is optional and must never block access to cloud data.
            this.checkPushSubscriptionStatus().catch(error => {
                console.error('[Push] No se pudo comprobar el estado del dispositivo:', error);
            });
            this.pushManagement.refreshAll().catch(error => {
                console.error('[Push] No se pudo cargar la administración de notificaciones:', error);
            });
        } else {
            // Logged out
            this.clearLocalUserData();
            if (this.authLoggedIn) this.authLoggedIn.classList.add('hidden');
            if (this.authLoggedOut) this.authLoggedOut.classList.remove('hidden');
            if (this.profileEmail) this.profileEmail.innerText = '';
            if (this.pushNotificationsCard) this.pushNotificationsCard.classList.add('hidden');
            this.pushManagement.clear();

            // Unsubscribe from channels
            if (this.realtimeChannel) {
                this.supabase.removeChannel(this.realtimeChannel);
                this.realtimeChannel = null;
            }

            this.setLoading(false);
            this.setAccessGateState('logged-out');
        }
    }

    setLoading(isLoading, text = "") {
        if (isLoading) {
            this.setAccessGateState('loading', text);
            if (this.authLoading) {
                this.authLoading.classList.remove('hidden');
                this.authLoading.querySelector('p').innerHTML = `
                    <i class="ph ph-circle-notch" style="animation: spin 1s linear infinite; font-size: 1.25rem;"></i> ${text}
                `;
            }
            this.authLoggedOut?.classList.add('hidden');
            this.authLoggedIn?.classList.add('hidden');
        } else {
            this.authLoading?.classList.add('hidden');
        }
    }

    loadPendingSyncKeys() {
        try {
            const parsed = JSON.parse(localStorage.getItem(SYNC_PENDING_STORAGE_KEY) || '[]');
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.filter(key => CLOUD_SYNC_KEYS.includes(key)));
        } catch (error) {
            console.warn('[Cloud Sync] No se pudo leer la cola local pendiente:', error);
            return new Set();
        }
    }

    persistPendingSyncKeys() {
        if (this.pendingSyncKeys.size === 0) {
            localStorage.removeItem(SYNC_PENDING_STORAGE_KEY);
            return;
        }

        localStorage.setItem(
            SYNC_PENDING_STORAGE_KEY,
            JSON.stringify([...this.pendingSyncKeys])
        );
    }

    clearLocalUserData() {
        this.syncGeneration += 1;
        this.activeSyncPromise = null;
        this.isSyncing = false;
        this.isRestoring = true;
        try {
            clearTimeout(this.syncFlushTimer);
            clearTimeout(this.syncRetryTimer);
            clearTimeout(this.realtimeRefreshTimer);
            this.syncFlushTimer = null;
            this.syncRetryTimer = null;
            this.realtimeRefreshTimer = null;
            CLOUD_LOCAL_CLEAR_KEYS.forEach(key => localStorage.removeItem(key));
            this.pendingSyncKeys.clear();
            this.cloudRevision = null;
            localStorage.removeItem(SYNC_PENDING_STORAGE_KEY);
            localStorage.removeItem('has_unsynced_local_changes');
            sessionStorage.removeItem('is_explicit_login');
        } finally {
            this.isRestoring = false;
        }
    }

    gatherLocalData(keys = CLOUD_SYNC_KEYS) {
        return Object.fromEntries(
            keys.map(key => [key, localStorage.getItem(key)])
        );
    }

    areValuesEqual(val1, val2) {
        return areStoredValuesEqual(val1, val2);
    }

    queueKeySync(key) {
        if (!CLOUD_SYNC_KEYS.includes(key) || !this.user) return;

        this.pendingSyncKeys.add(key);
        this.persistPendingSyncKeys();
        this.updateSyncBadge('syncing', 'Guardando cambios...');

        clearTimeout(this.syncFlushTimer);
        this.syncFlushTimer = setTimeout(() => {
            this.flushPendingKeySync().catch(error => {
                console.error('[Cloud Sync] Error en guardado diferido:', error);
            });
        }, 700);
    }

    async flushPendingKeySync(isManual = false) {
        if (!this.user || !this.supabase) return false;

        clearTimeout(this.syncFlushTimer);
        clearTimeout(this.syncRetryTimer);
        this.syncRetryTimer = null;

        if (this.activeSyncPromise) {
            const activeResult = await this.activeSyncPromise;
            if (!this.user || !this.supabase) return false;
            if (!activeResult) {
                if (isManual) {
                    void this.app.showMessage({
                        title: 'Cambios pendientes',
                        message: 'LifeCycle volverá a intentar guardarlos automáticamente.',
                        tone: 'warning'
                    });
                }
                return false;
            }
            if (this.pendingSyncKeys.size > 0) {
                return this.flushPendingKeySync(isManual);
            }
            return true;
        }

        if (this.pendingSyncKeys.size === 0) {
            this.updateSyncBadge('synced', 'Sincronizado');
            return true;
        }

        const keysToSync = [...this.pendingSyncKeys];
        keysToSync.forEach(key => this.pendingSyncKeys.delete(key));
        this.persistPendingSyncKeys();

        const syncGeneration = this.syncGeneration;
        const syncUserId = this.user.id;
        const isCurrentSession = () => (
            this.syncGeneration === syncGeneration
            && this.user?.id === syncUserId
        );
        let operation;
        operation = (async () => {
            this.isSyncing = true;
            this.updateSyncBadge('syncing', 'Sincronizando...');

            try {
                const { updates, deleteKeys } = buildCloudPatch(
                    keysToSync,
                    key => localStorage.getItem(key)
                );

                const { error } = await this.supabase.rpc('merge_user_data_keys', {
                    p_updates: updates,
                    p_delete_keys: deleteKeys
                });
                if (error) throw error;

                if (!isCurrentSession()) return false;
                if (Number.isSafeInteger(this.cloudRevision)) {
                    this.cloudRevision += 1;
                }
                localStorage.removeItem('has_unsynced_local_changes');
                this.updateSyncBadge('synced', 'Sincronizado');
                return true;
            } catch (error) {
                if (!isCurrentSession()) return false;
                keysToSync.forEach(key => this.pendingSyncKeys.add(key));
                this.persistPendingSyncKeys();
                this.updateSyncBadge('error', 'Cambios pendientes');
                console.error('[Cloud Sync] No se pudieron guardar las claves modificadas:', error);

                this.syncRetryTimer = setTimeout(() => {
                    this.flushPendingKeySync().catch(retryError => {
                        console.error('[Cloud Sync] Falló el reintento:', retryError);
                    });
                }, 15 * 1000);

                if (isManual) {
                    void this.app.showMessage({
                        title: 'No se pudieron guardar los cambios',
                        message: error.message,
                        tone: 'danger'
                    });
                }
                return false;
            } finally {
                if (this.activeSyncPromise === operation) {
                    this.activeSyncPromise = null;
                    this.isSyncing = false;
                }
                if (
                    isCurrentSession()
                    && this.pendingSyncKeys.size > 0
                    && !this.syncRetryTimer
                ) {
                    this.syncFlushTimer = setTimeout(() => {
                        this.flushPendingKeySync().catch(error => {
                            console.error('[Cloud Sync] Error procesando cambios nuevos:', error);
                        });
                    }, 200);
                }
            }
        })();

        this.activeSyncPromise = operation;
        return operation;
    }

    async checkAndSyncData({ skipPendingFlush = false } = {}) {
        if (!this.user || !this.supabase) return false;

        try {
            if (!skipPendingFlush && this.pendingSyncKeys.size > 0) {
                const pendingSaved = await this.flushPendingKeySync();
                if (!pendingSaved) return false;
            }

            let revisionAvailable = true;
            let { data, error } = await this.supabase
                .from('user_data')
                .select('data, updated_at, revision')
                .eq('user_id', this.user.id)
                .maybeSingle();

            if (error && isMissingCloudRevisionSchema(error)) {
                revisionAvailable = false;
                ({ data, error } = await this.supabase
                    .from('user_data')
                    .select('data, updated_at')
                    .eq('user_id', this.user.id)
                    .maybeSingle());
            }
            if (error) throw error;

            const parsedRevision = Number(data?.revision);
            this.cloudRevision = revisionAvailable && Number.isSafeInteger(parsedRevision)
                ? parsedRevision
                : null;

            let cloudData = data?.data;
            if (!data) {
                const { error: createError } = await this.supabase.rpc('merge_user_data_keys', {
                    p_updates: {},
                    p_delete_keys: []
                });
                if (createError) throw createError;
                cloudData = {};
                this.cloudRevision = revisionAvailable ? 1 : null;
            }

            // Internal scheduler state belongs only to the backend and should not remain cached.
            CLOUD_SERVER_MANAGED_KEYS.forEach(key => localStorage.removeItem(key));

            const localData = this.gatherLocalData(CLOUD_RESTORE_KEYS);
            const hasDifference = CLOUD_RESTORE_KEYS.some(key => {
                const cloudValue = cloudData[key] === undefined ? null : cloudData[key];
                return !this.areValuesEqual(cloudValue, localData[key]);
            });

            if (hasDifference) {
                this.restoreDataLocally(cloudData);
            }

            localStorage.removeItem('has_unsynced_local_changes');
            sessionStorage.removeItem('is_explicit_login');
            this.updateSyncBadge('synced', 'Sincronizado');
            return true;
        } catch (error) {
            console.error('[Cloud Sync] Error obteniendo la fuente cloud:', error);
            this.updateSyncBadge('error', 'Error de conexión');
            return false;
        }
    }

    async syncToCloud(isManual = false) {
        if (!this.user || !this.supabase) return false;

        if (this.pendingSyncKeys.size === 0) {
            if (isManual) {
                const refreshed = await this.checkAndSyncData({ skipPendingFlush: true });
                await this.app.showMessage({
                    title: refreshed ? 'Datos actualizados' : 'No se pudieron actualizar los datos',
                    message: refreshed
                        ? 'LifeCycle ya tiene la versión más reciente de la nube.'
                        : 'Revisá tu conexión e intentá nuevamente.',
                    tone: refreshed ? 'success' : 'danger'
                });
                return refreshed;
            }
            return true;
        }

        const saved = await this.flushPendingKeySync(isManual);
        if (saved && isManual) {
            this.app.showToast('Cambios sincronizados correctamente.');
        }
        return saved;
    }

    restoreDataLocally(cloudData) {
        let migratedTrackers = false;
        this.isRestoring = true;
        try {
            CLOUD_RESTORE_KEYS.forEach(key => {
                let val = cloudData[key];
                if (val !== null && val !== undefined) {
                    if (typeof val === 'object') {
                        val = JSON.stringify(val);
                    }
                    localStorage.setItem(key, val);
                } else {
                    localStorage.removeItem(key);
                }
            });

            // Reload in-memory data for all modules from localStorage first (isolated blocks)
            try {
                if (this.app.hygiene) {
                    try { this.app.hygiene.data = this.app.hygiene.loadData(); } catch (e) { console.error("Error reloading hygiene:", e); }
                }
                if (this.app.customTrackers) {
                    try {
                        migratedTrackers = this.app.customTrackers.reload();
                    } catch (e) {
                        console.error("Error reloading custom trackers:", e);
                    }
                }
                if (this.app.grooming) {
                    try { this.app.grooming.data = this.app.grooming.loadData(); } catch (e) { console.error("Error reloading grooming:", e); }
                }
                if (this.app.lenses) {
                    try { this.app.lenses.loadDatesAndStock(); } catch (e) { console.error("Error reloading lenses:", e); }
                }
                if (this.app.health) {
                    try {
                        const rawMed = localStorage.getItem('health_medical_data');
                        this.app.health.medicalData = rawMed ? JSON.parse(rawMed) : { dentista: { lastVisit: null, frequencyMonths: 6, history: [] }, oculista: { lastVisit: null, frequencyMonths: 6, history: [] } };
                        const rawBlood = localStorage.getItem('health_blood_tests');
                        const parsedBlood = rawBlood ? JSON.parse(rawBlood) : [];
                        this.app.health.bloodTests = Array.isArray(parsedBlood) ? parsedBlood : [];
                        this.app.health.bindLegacyStudiesToTracker?.();
                    } catch (e) { console.error("Error parsing health data in sync:", e); }
                }
                if (this.app.vehicle) {
                    try {
                        this.app.vehicle.reloadDataFromStorage();
                    } catch (e) { console.error("Error parsing vehicle log in sync:", e); }
                }
                if (this.app.gym) {
                    try {
                        this.app.gym.loadData();
                        this.app.gym.syncActiveSessionUI();
                    } catch (e) { console.error("Error reloading gym:", e); }
                }
                if (this.app.projects) {
                    try { this.app.projects.loadData(); } catch (e) { console.error("Error reloading projects:", e); }
                }
                if (this.app.finanzas) {
                    try { this.app.finanzas.data = this.app.finanzas.loadData(); } catch (e) { console.error("Error reloading finanzas:", e); }
                }
                if (this.app.tareas) {
                    try { this.app.tareas.loadData(); } catch (e) { console.error("Error reloading tareas:", e); }
                }
                if (this.app.alerts) {
                    try { this.app.alerts.loadData(); } catch (e) { console.error("Error reloading alerts:", e); }
                }
            } catch (e) {
                console.error("Critical error reloading in-memory data during silent sync:", e);
            }

            // Trigger UI updates for all active modules dynamically (isolated blocks)
            if (this.app.hygiene) {
                try { this.app.hygiene.render(); } catch (e) { console.error("Error rendering hygiene:", e); }
            }
            if (this.app.grooming) {
                try { this.app.grooming.render(); } catch (e) { console.error("Error rendering grooming:", e); }
            }
            if (this.app.lenses) {
                try {
                    this.app.lenses.updateUI();
                    this.app.lenses.renderHistory();
                } catch (e) { console.error("Error rendering lenses:", e); }
            }
            if (this.app.health) {
                try { this.app.health.render(); } catch (e) { console.error("Error rendering health:", e); }
            }
            if (this.app.vehicle) {
                try { this.app.vehicle.render(); } catch (e) { console.error("Error rendering vehicle:", e); }
            }
            if (this.app.gym) {
                try { this.app.gym.render(); } catch (e) { console.error("Error rendering gym:", e); }
            }
            if (this.app.projects) {
                try { this.app.projects.render(); } catch (e) { console.error("Error rendering projects:", e); }
            }
            if (this.app.finanzas) {
                try { this.app.finanzas.render(); } catch (e) { console.error("Error rendering finanzas:", e); }
            }
            if (this.app.tareas) {
                try { this.app.tareas.render(); } catch (e) { console.error("Error rendering tareas:", e); }
            }
            if (this.app.alerts) {
                try { this.app.alerts.render(); } catch (e) { console.error("Error rendering alerts:", e); }
            }
            if (this.app.customTrackers) {
                try { this.app.customTrackers.renderAll(); } catch (e) { console.error("Error rendering custom trackers:", e); }
            }
            if (this.app.notificationsCenter) {
                try { this.app.notificationsCenter.updateBadge(); } catch (e) { console.error("Error updating notifications badge:", e); }
            }
        } finally {
            this.isRestoring = false;
        }
        if (migratedTrackers) {
            this.queueKeySync('hygiene_tracker_data');
        }
    }

    updateSyncBadge(state, text) {
        if (!this.syncStatusBadge) return;
        
        this.syncStatusBadge.className = 'badge';
        if (state === 'synced') {
            this.syncStatusBadge.classList.add('green');
            this.syncStatusBadge.innerHTML = `<i class="ph ph-cloud-check" style="font-size:1rem; margin-right:4px;"></i> ${text}`;
        } else if (state === 'syncing') {
            this.syncStatusBadge.classList.add('orange');
            this.syncStatusBadge.innerHTML = `<i class="ph ph-circle-notch" style="animation: spin 1s linear infinite; font-size:1rem; margin-right:4px;"></i> ${text}`;
        } else if (state === 'error') {
            this.syncStatusBadge.classList.add('red');
            this.syncStatusBadge.innerHTML = `<i class="ph ph-cloud-warning" style="font-size:1rem; margin-right:4px;"></i> ${text}`;
        }
    }

    getOwnedMedicalFilePath(filePath) {
        if (!this.user || !this.supabase) {
            throw new Error("Usuario no autenticado");
        }

        const normalizedPath = typeof filePath === 'string' ? filePath.trim() : '';
        const expectedPrefix = `${this.user.id}/`;
        if (
            !normalizedPath
            || !normalizedPath.startsWith(expectedPrefix)
            || normalizedPath.includes('..')
            || normalizedPath.includes('\\')
        ) {
            throw new Error('La ruta del archivo médico no es válida para esta cuenta.');
        }

        return normalizedPath;
    }

    getMedicalFileExtension(file) {
        const knownExtensions = {
            'application/pdf': 'pdf',
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/heic': 'heic',
            'image/heif': 'heif'
        };

        const extension = knownExtensions[file.type];
        if (!extension) {
            throw new Error('El formato del archivo médico no está permitido.');
        }

        return extension;
    }

    async uploadMedicalFile(fileId, file) {
        if (!this.user || !this.supabase) {
            throw new Error("Usuario no autenticado");
        }
        const allowedMimeTypes = new Set([
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif'
        ]);
        if (!file || !allowedMimeTypes.has(file.type)) {
            throw new Error('Solo se permiten archivos PDF, JPG, PNG, WebP, HEIC o HEIF.');
        }
        if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 15 * 1024 * 1024) {
            throw new Error('El archivo debe pesar entre 1 byte y 15 MB.');
        }

        const safeFileId = String(fileId || '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 100);
        if (!safeFileId) {
            throw new Error('No se pudo generar un identificador seguro para el archivo.');
        }
        
        const extension = this.getMedicalFileExtension(file);
        const filePath = `${this.user.id}/${safeFileId}.${extension}`;
        
        const { data, error } = await this.supabase.storage
            .from('blood-tests')
            .upload(filePath, file, {
                cacheControl: '3600',
                contentType: file.type,
                upsert: false
            });
            
        if (error) {
            throw error;
        }

        return data?.path || filePath;
    }

    async createSignedMedicalFileUrl(filePath) {
        const ownedPath = this.getOwnedMedicalFilePath(filePath);
        const { data, error } = await this.supabase.storage
            .from('blood-tests')
            .createSignedUrl(ownedPath, 5 * 60);

        if (error || !data?.signedUrl) {
            throw error || new Error('Supabase no devolvió una URL temporal.');
        }

        return data.signedUrl;
    }

    async deleteMedicalFile(filePath) {
        const ownedPath = this.getOwnedMedicalFilePath(filePath);
        const { error } = await this.supabase.storage
            .from('blood-tests')
            .remove([ownedPath]);

        if (error) {
            throw error;
        }
    }

    setupRealtimeSubscription() {
        if (!this.user || !this.supabase) return;
        
        // Remove existing channel if any
        if (this.realtimeChannel) {
            this.supabase.removeChannel(this.realtimeChannel);
        }
        
        this.realtimeChannel = this.supabase
            .channel(`user-data-channel-${this.user.id}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'user_data',
                filter: `user_id=eq.${this.user.id}`
            }, payload => {
                const newCloudData = payload.new?.data;
                const realtimeRevision = Number(payload.new?.revision);
                if (Number.isSafeInteger(realtimeRevision)) {
                    this.cloudRevision = realtimeRevision;
                }
                if (newCloudData) {
                    if (this.isSyncing || this.pendingSyncKeys.size > 0) {
                        clearTimeout(this.realtimeRefreshTimer);
                        this.realtimeRefreshTimer = setTimeout(() => {
                            this.checkAndSyncData().catch(error => {
                                console.error('[Cloud Sync] Error refrescando después de Realtime:', error);
                            });
                        }, 1000);
                        return;
                    }

                    const local = this.gatherLocalData(CLOUD_RESTORE_KEYS);
                    let changed = false;
                    Object.keys(local).forEach(key => {
                        const cloudVal = newCloudData[key] === undefined ? null : newCloudData[key];
                        const localVal = local[key] === undefined ? null : local[key];
                        if (!this.areValuesEqual(cloudVal, localVal)) {
                            changed = true;
                        }
                    });
                    
                    if (changed) {
                        console.log("Realtime sync: differences detected, updating local state silently.");
                        this.restoreDataLocally(newCloudData);
                    }
                }
            })
            .subscribe();
    }

    async persistPushSubscription(subscriptionJSON) {
        if (!this.user || !this.supabase || !subscriptionJSON?.endpoint) {
            throw new Error('No hay una sesión o suscripción Push válida.');
        }

        if (this.pushSyncPromise) return this.pushSyncPromise;

        this.pushSyncPromise = (async () => {
            const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
            if (sessionError || !session?.access_token) {
                throw new Error('La sesión venció. Volvé a iniciar sesión para registrar este dispositivo.');
            }

            const device = await this.pushManagement.getDeviceMetadata();
            let lastError;
            for (let attempt = 0; attempt < 2; attempt++) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);

                try {
                    const response = await fetch('/api/subscribe', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ subscription: subscriptionJSON, device }),
                        signal: controller.signal
                    });
                    const result = await response.json().catch(() => ({}));

                    if (response.ok) return result;

                    const error = new Error(
                        result.error || `El servidor rechazó el registro Push (HTTP ${response.status}).`
                    );
                    error.status = response.status;
                    throw error;
                } catch (error) {
                    lastError = error?.name === 'AbortError'
                        ? new Error('El registro Push tardó demasiado en responder.')
                        : error;

                    const canRetry = attempt === 0
                        && (!error?.status || error.status >= 500);
                    if (!canRetry) break;
                    await new Promise(resolve => setTimeout(resolve, 500));
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            throw lastError || new Error('No se pudo registrar este dispositivo para notificaciones.');
        })();

        try {
            return await this.pushSyncPromise;
        } finally {
            this.pushSyncPromise = null;
        }
    }

    setPushStatus(state, message) {
        if (!this.pushStatusMessage) return;
        this.pushStatusMessage.className = `push-status ${state}`;
        this.pushStatusMessage.textContent = message;
    }

    getPushSupportIssue() {
        if (!window.isSecureContext) {
            return 'Las notificaciones requieren una conexión HTTPS segura.';
        }
        if (!('Notification' in window)) {
            return 'Este navegador no ofrece la API de notificaciones.';
        }
        if (!('serviceWorker' in navigator)) {
            return 'Este navegador no admite Service Workers.';
        }
        if (!('PushManager' in window)) {
            return 'Este navegador no admite notificaciones Push web.';
        }
        return null;
    }

    async getPushServiceWorkerRegistration(timeoutMs = 10000) {
        const existingRegistration = await navigator.serviceWorker.getRegistration();
        if (existingRegistration?.active) {
            return existingRegistration;
        }

        let timeoutId;
        try {
            return await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error('El Service Worker no quedó listo dentro del tiempo esperado.'));
                    }, timeoutMs);
                })
            ]);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    getPushErrorMessage(error) {
        const rawMessage = String(error?.message || error || '');
        const normalizedMessage = rawMessage.toLowerCase();

        if (window.Notification?.permission === 'denied' || error?.name === 'NotAllowedError') {
            return 'El navegador bloqueó las notificaciones. Habilitalas para este sitio desde el candado de la barra de direcciones y comprobá que Windows permita notificaciones para el navegador.';
        }
        if (
            error?.name === 'AbortError'
            || normalizedMessage.includes('push service')
            || normalizedMessage.includes('registration failed')
        ) {
            return 'El servicio Push del navegador rechazó el registro. Si usás Brave, habilitá “Usar servicios de Google para mensajería push”; en cualquier navegador, comprobá las notificaciones de Windows y evitá el modo incógnito.';
        }
        if (normalizedMessage.includes('service worker')) {
            return 'El componente de notificaciones no terminó de iniciar. Recargá la aplicación y volvé a intentarlo.';
        }
        return rawMessage
            ? `No se pudieron activar las notificaciones: ${rawMessage}`
            : 'No se pudieron activar las notificaciones en este dispositivo.';
    }

    async enablePushNotifications() {
        const supportIssue = this.getPushSupportIssue();
        if (supportIssue) {
            this.setPushStatus('error', supportIssue);
            await this.app.showMessage({
                title: 'Notificaciones no disponibles',
                message: supportIssue,
                tone: 'danger'
            });
            return;
        }

        if (Notification.permission === 'denied') {
            const message = this.getPushErrorMessage({ name: 'NotAllowedError' });
            this.setPushStatus('error', message);
            await this.app.showMessage({
                title: 'Permiso de notificaciones bloqueado',
                message,
                tone: 'warning'
            });
            return;
        }

        if (this.btnEnablePush) this.btnEnablePush.disabled = true;
        this.setPushStatus('checking', 'Activando notificaciones en este dispositivo...');

        try {
            // 1. Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                const message = permission === 'denied'
                    ? this.getPushErrorMessage({ name: 'NotAllowedError' })
                    : 'No se otorgó permiso para mostrar notificaciones.';
                this.setPushStatus('error', message);
                await this.app.showMessage({
                    title: 'No se activaron las notificaciones',
                    message,
                    tone: 'warning'
                });
                return;
            }

            // 2. Get Service Worker registration
            const registration = await this.getPushServiceWorkerRegistration();

            // 3. Get VAPID public key from backend config
            const vapidKey = this.config.vapidPublicKey;
            if (!vapidKey) {
                throw new Error('El backend no entregó la clave pública necesaria.');
            }

            // Convert VAPID key to Uint8Array
            const convertedVapidKey = this.urlBase64ToUint8Array(vapidKey);

            // 4. Reutilizar la suscripción del dispositivo si ya existe.
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                });
            }

            // 5. Register the device through the authenticated backend endpoint.
            const subscriptionJSON = subscription.toJSON();
            await this.persistPushSubscription(subscriptionJSON);

            // 6. Update UI
            await this.checkPushSubscriptionStatus();
            await this.pushManagement.refreshAll();
            await this.app.showMessage({
                title: 'Notificaciones activadas',
                message: 'Este dispositivo quedó registrado correctamente.',
                tone: 'success'
            });

        } catch (e) {
            console.error('Error enabling push notifications:', e);
            const message = this.getPushErrorMessage(e);
            this.setPushStatus('error', message);
            await this.app.showMessage({
                title: 'No se pudieron activar las notificaciones',
                message,
                tone: 'danger'
            });
        } finally {
            if (this.btnEnablePush) this.btnEnablePush.disabled = false;
        }
    }

    async checkPushSubscriptionStatus() {
        if (!this.user) return;
        const supportIssue = this.getPushSupportIssue();
        if (supportIssue) {
            if (this.btnEnablePush) {
                this.btnEnablePush.disabled = true;
                this.btnEnablePush.innerText = 'Notificaciones no compatibles';
            }
            this.btnTestPush?.classList.add('hidden');
            this.setPushStatus('error', supportIssue);
            return;
        }

        if (Notification.permission === 'denied') {
            if (this.btnEnablePush) {
                this.btnEnablePush.disabled = false;
                this.btnEnablePush.innerText = 'Permiso bloqueado: ver cómo habilitarlo';
            }
            this.btnTestPush?.classList.add('hidden');
            this.setPushStatus('error', this.getPushErrorMessage({ name: 'NotAllowedError' }));
            return;
        }

        this.setPushStatus('checking', 'Comprobando este dispositivo...');

        try {
            const registration = await this.getPushServiceWorkerRegistration();
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                let registeredDevices = null;
                let registrationVerified = false;
                let registrationKnown = false;
                try {
                    const subscriptionJSON = subscription.toJSON();
                    const registrationState = await this.pushManagement.checkCurrentRegistration(subscriptionJSON);
                    registeredDevices = Number(registrationState?.registeredDevices);
                    registrationVerified = registrationState?.registered === true;
                    registrationKnown = true;
                } catch (syncError) {
                    console.warn('[Push] No se pudo verificar la suscripción con el servidor:', syncError);
                }

                if (this.btnEnablePush) {
                    this.btnEnablePush.innerText = registrationVerified
                        ? '🔔 Notificaciones Activas en este Dispositivo'
                        : (registrationKnown
                            ? '🔔 Registrar este dispositivo'
                            : '🔔 Reintentar comprobación');
                    this.btnEnablePush.style.borderColor = registrationVerified
                        ? 'var(--status-green)'
                        : 'var(--status-yellow)';
                    this.btnEnablePush.style.color = registrationVerified
                        ? 'var(--status-green)'
                        : 'var(--status-yellow)';
                }
                this.btnTestPush?.classList.toggle('hidden', !registrationVerified);
                this.setPushStatus(
                    registrationVerified ? 'active' : 'warning',
                    registrationVerified
                        ? (
                            Number.isInteger(registeredDevices) && registeredDevices > 0
                                ? `Este dispositivo está listo. Dispositivos registrados: ${registeredDevices}.`
                                : 'Este dispositivo está registrado y listo para recibir avisos.'
                        )
                        : (registrationKnown
                            ? 'El navegador conserva una suscripción local, pero este dispositivo no figura activo en LifeCycle. Presioná el botón para registrarlo nuevamente.'
                            : 'El navegador conserva una suscripción local, pero no se pudo consultar al servidor. Podés reintentar sin perder la configuración del dispositivo.')
                );
            } else {
                if (this.btnEnablePush) {
                    this.btnEnablePush.innerText = '🔔 Activar Notificaciones en este Dispositivo';
                    this.btnEnablePush.disabled = false;
                    this.btnEnablePush.style.borderColor = '';
                    this.btnEnablePush.style.color = '';
                }
                this.btnTestPush?.classList.add('hidden');
                this.setPushStatus(
                    'inactive',
                    Notification.permission === 'granted'
                        ? 'El permiso existe, pero este dispositivo todavía no está registrado.'
                        : 'Las notificaciones todavía no están activadas en este dispositivo.'
                );
            }
        } catch (e) {
            console.error('Error checking push subscription status:', e);
            this.setPushStatus('error', this.getPushErrorMessage(e));
        }
    }

    async sendTestPushNotification() {
        try {
            const registration = await this.getPushServiceWorkerRegistration();
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                await this.app.showMessage({
                    title: 'Dispositivo no registrado',
                    message: 'No se encontró una suscripción activa en este dispositivo.',
                    tone: 'warning'
                });
                return;
            }

            this.setPushStatus('checking', 'Enviando una notificación de prueba...');
            if (this.btnTestPush) this.btnTestPush.disabled = true;

            const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
            if (sessionError || !session?.access_token) {
                await this.app.showMessage({
                    title: 'La sesión venció',
                    message: 'Volvé a iniciar sesión antes de probar las notificaciones.',
                    tone: 'warning'
                });
                this.setAccessGateState('logged-out');
                return;
            }

            const res = await fetch('/api/test-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });
            const result = await res.json().catch(() => ({}));

            if (res.ok) {
                this.setPushStatus('active', 'Prueba enviada correctamente a este dispositivo.');
                await this.pushManagement.refreshAll();
                await this.app.showMessage({
                    title: 'Prueba enviada',
                    message: 'La notificación debería aparecer en este dispositivo.',
                    tone: 'success'
                });
            } else {
                const statusText = result.statusCode ? ` (HTTP ${result.statusCode})` : '';
                this.setPushStatus('error', `${result.error || 'El servicio Push rechazó la prueba.'}${statusText}`);
                await this.app.showMessage({
                    title: 'La prueba fue rechazada',
                    message: `${result.error || 'Error al enviar la notificación de prueba.'}${statusText}`,
                    tone: 'danger'
                });
            }
        } catch (e) {
            console.error('Error triggering test push:', e);
            const message = this.getPushErrorMessage(e);
            this.setPushStatus('error', message);
            await this.app.showMessage({
                title: 'No se pudo enviar la prueba',
                message,
                tone: 'danger'
            });
        } finally {
            if (this.btnTestPush) this.btnTestPush.disabled = false;
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    refreshPushManagement() {
        return this.pushManagement.refreshAll();
    }
}
