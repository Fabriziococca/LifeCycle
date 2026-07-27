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
        
        this.realtimeChannel = null;
        this.isSyncing = false;
        this.pendingSync = false;
        this.pushSyncPromise = null;
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
    }

    setAccessGateState(state, message = '') {
        const isAuthenticated = state === 'authenticated';
        this.accessGate?.classList.toggle('hidden', isAuthenticated);
        this.appContainer?.classList.toggle('hidden', !isAuthenticated);
        document.body.classList.toggle('access-locked', !isAuthenticated);

        this.accessGateLoading?.classList.toggle('hidden', state !== 'loading');
        this.accessGateForm?.classList.toggle('hidden', state !== 'logged-out');
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
        sessionStorage.setItem('is_explicit_login', 'true');
        
        const { error } = await this.supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            sessionStorage.removeItem('is_explicit_login');
            this.setLoading(false);
            const message = error.message?.toLowerCase().includes('invalid login credentials')
                ? 'Correo o contraseña incorrectos.'
                : `No se pudo iniciar sesión: ${error.message}`;
            this.setAccessGateState('logged-out', message);
        }
    }

    async logout() {
        if (confirm("¿Estás seguro de que deseas cerrar sesión? Volverás a la pantalla de acceso.")) {
            this.setLoading(true, "Cerrando sesión...");
            await this.supabase.auth.signOut();
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
            
            // Check push subscription status
            await this.checkPushSubscriptionStatus();
            
            // Trigger sync check
            await this.checkAndSyncData();

            // Setup realtime subscription for cross-device updates
            this.setupRealtimeSubscription();
            this.setLoading(false);
            this.setAccessGateState('authenticated');
        } else {
            // Logged out
            if (this.authLoggedIn) this.authLoggedIn.classList.add('hidden');
            if (this.authLoggedOut) this.authLoggedOut.classList.remove('hidden');
            if (this.profileEmail) this.profileEmail.innerText = '';
            if (this.pushNotificationsCard) this.pushNotificationsCard.classList.add('hidden');

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

    gatherLocalData() {
        return {
            hygiene_tracker_data: localStorage.getItem('hygiene_tracker_data'),
            groomingData_v2: localStorage.getItem('groomingData_v2'),
            lensesStartTime: localStorage.getItem('lensesStartTime'),
            lensesHistory: localStorage.getItem('lensesHistory'),
            lensStock: localStorage.getItem('lensStock'),
            lensDate: localStorage.getItem('lensDate'),
            solutionDate: localStorage.getItem('solutionDate'),
            caseDate: localStorage.getItem('caseDate'),
            systaneDate: localStorage.getItem('systaneDate'),
            clothWashDate: localStorage.getItem('clothWashDate'),
            clothChangeDate: localStorage.getItem('clothChangeDate'),
            health_medical_data: localStorage.getItem('health_medical_data'),
            health_blood_tests: localStorage.getItem('health_blood_tests'),
            vehicle_odometer: localStorage.getItem('vehicle_odometer'),
            vehicle_maintenance_log: localStorage.getItem('vehicle_maintenance_log'),
            gym_records: localStorage.getItem('gym_records'),
            gym_routine: localStorage.getItem('gym_routine'),
            gym_routine_focus: localStorage.getItem('gym_routine_focus'),
            gym_sessions: localStorage.getItem('gym_sessions'),
            gym_meals: localStorage.getItem('gym_meals'),
            gym_general_meals: localStorage.getItem('gym_general_meals'),
            gym_supplements: localStorage.getItem('gym_supplements'),
            gym_weight: localStorage.getItem('gym_weight'),
            projectPulseData: localStorage.getItem('projectPulseData'),
            projectPulseHistory: localStorage.getItem('projectPulseHistory'),
            projectPulseSubscription: localStorage.getItem('projectPulseSubscription'),
            alerts_config: localStorage.getItem('alerts_config'),
            alerts_sent_log: localStorage.getItem('alerts_sent_log'),
            finanzasData: localStorage.getItem('finanzasData'),
            vehicle_tracker_data: localStorage.getItem('vehicle_tracker_data'),
            vehicle_issues: localStorage.getItem('vehicle_issues'),
            tareas_list: localStorage.getItem('tareas_list'),
            tareas_categories: localStorage.getItem('tareas_categories'),
            tareas_pinned_projects: localStorage.getItem('tareas_pinned_projects'),
            tareas_pinned_project_ids: localStorage.getItem('tareas_pinned_project_ids'),
            tareas_removed_project_ids: localStorage.getItem('tareas_removed_project_ids')
        };
    }

    areValuesEqual(val1, val2) {
        if (val1 === val2) return true;
        if (!val1 && !val2) return true; // both are null/undefined/empty
        if (!val1 || !val2) return false;
        
        try {
            const obj1 = typeof val1 === 'object' ? val1 : JSON.parse(val1);
            const obj2 = typeof val2 === 'object' ? val2 : JSON.parse(val2);
            return JSON.stringify(obj1) === JSON.stringify(obj2);
        } catch (e) {
            return String(val1).trim() === String(val2).trim();
        }
    }

    async checkAndSyncData() {
        if (!this.user) return;
        
        try {
            // 1. Read cloud data
            const { data, error } = await this.supabase
                .from('user_data')
                .select('data')
                .eq('user_id', this.user.id)
                .single();
                
            const cloudData = data?.data;
            const hasLocalData = this.hasAnyLocalData();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 means no row found
                console.error("Error fetching cloud data:", error);
                this.updateSyncBadge('error', "Error al obtener datos");
                return;
            }
            
            if (!cloudData) {
                // No data in cloud yet.
                if (hasLocalData) {
                    console.log("No data on cloud, uploading local data...");
                    await this.syncToCloud(false);
                } else {
                    await this.supabase.from('user_data').insert({
                        user_id: this.user.id,
                        data: {}
                    });
                    this.updateSyncBadge('synced', "Sincronizado");
                }
            } else {
                 // Cloud data exists! Compare normalized differences
                const local = this.gatherLocalData();
                let hasDifference = false;
                Object.keys(local).forEach(key => {
                    const cloudVal = cloudData[key] === undefined ? null : cloudData[key];
                    const localVal = local[key] === undefined ? null : local[key];
                    if (!this.areValuesEqual(cloudVal, localVal)) {
                        hasDifference = true;
                    }
                });

                if (!hasDifference) {
                    localStorage.removeItem('has_unsynced_local_changes');
                    this.updateSyncBadge('synced', "Sincronizado");
                    return;
                }

                // Si hay diferencias pero tenemos cambios locales pendientes de subir (ej: por falla de conexión anterior), los subimos
                const hasUnsynced = localStorage.getItem('has_unsynced_local_changes') === 'true';
                if (hasUnsynced && sessionStorage.getItem('is_explicit_login') !== 'true') {
                    console.log("[AuthSync] This device has unsynced local changes. Uploading to cloud...");
                    await this.syncToCloud(false);
                    return;
                }

                // Check if this was an explicit login action
                const isExplicitLogin = sessionStorage.getItem('is_explicit_login') === 'true';
                sessionStorage.removeItem('is_explicit_login');

                if (isExplicitLogin && hasLocalData) {
                    const confirmMerge = confirm(
                        "¡Sesión iniciada! Se encontraron diferencias entre los datos en la nube y los locales. \n\n" +
                        "¿Deseas CARGAR los datos de la nube y sobreescribir los locales?\n" +
                        "(Acepta para usar los datos de la nube. Cancela si deseas mantener los locales y sobreescribir la nube)."
                    );
                    
                    if (confirmMerge) {
                        this.restoreDataLocally(cloudData);
                        alert("Datos de la nube restaurados localmente.");
                        location.reload();
                    } else {
                        // Push local data to overwrite cloud
                        await this.syncToCloud(false);
                    }
                } else {
                    // Pull silently in the background on normal loads (no reload loop!)
                    this.restoreDataLocally(cloudData);
                }
            }
        } catch (err) {
            console.error("Sync data error:", err);
            this.updateSyncBadge('error', "Error de conexión");
        }
    }

    hasAnyLocalData() {
        const local = this.gatherLocalData();
        return Object.values(local).some(v => v !== null && v !== undefined && v !== '');
    }

    async syncToCloud(isManual = false) {
        if (!this.user || !this.supabase) return;
        
        // Registrar que tenemos cambios locales pendientes de subir
        localStorage.setItem('has_unsynced_local_changes', 'true');
        
        if (this.isSyncing) {
            this.pendingSync = true;
            return;
        }
        
        this.isSyncing = true;
        this.isRestoring = true;
        this.updateSyncBadge('syncing', "Sincronizando...");
        
        try {
            // 1. Obtener datos actuales en la nube para no sobreescribir alerts_sent_log
            const { data: cloudRow, error: cloudReadError } = await this.supabase
                .from('user_data')
                .select('data')
                .eq('user_id', this.user.id)
                .single();

            if (cloudReadError && cloudReadError.code !== 'PGRST116') {
                throw new Error(`No se pudo leer el estado cloud antes de sincronizar: ${cloudReadError.message}`);
            }
            
            const cloudData = cloudRow?.data || {};
            const localData = this.gatherLocalData();

            // Conservar metadatos que pertenecen al motor de alertas del servidor.
            if (cloudData.alerts_sent_log) {
                const cloudLogStr = typeof cloudData.alerts_sent_log === 'string'
                    ? cloudData.alerts_sent_log
                    : JSON.stringify(cloudData.alerts_sent_log);
                localData.alerts_sent_log = cloudLogStr;
                localStorage.setItem('alerts_sent_log', cloudLogStr);
            }
            if (cloudData.very_urgent_last_notified_at) {
                localData.very_urgent_last_notified_at = cloudData.very_urgent_last_notified_at;
            }
            
            const { error } = await this.supabase
                .from('user_data')
                .upsert({
                    user_id: this.user.id,
                    data: localData,
                    updated_at: new Date().toISOString()
                });
                
            if (error) {
                console.error("Sync to cloud error:", error);
                this.updateSyncBadge('error', "Error al guardar");
                if (isManual) alert("Error al sincronizar datos con la nube: " + error.message);
            } else {
                // Sincronización exitosa: limpiar bandera de cambios pendientes
                localStorage.removeItem('has_unsynced_local_changes');
                this.updateSyncBadge('synced', "Sincronizado");
                if (isManual) alert("¡Datos sincronizados correctamente con la nube!");
            }
        } catch (e) {
            console.error("Sync catch error:", e);
            this.updateSyncBadge('error', "Error de sincronización");
        } finally {
            this.isSyncing = false;
            this.isRestoring = false;
            if (this.pendingSync) {
                this.pendingSync = false;
                // Executing pending sync to send latest modifications
                this.syncToCloud(false);
            }
        }
    }

    restoreDataLocally(cloudData) {
        this.isRestoring = true;
        try {
            const localKeys = [
                'hygiene_tracker_data', 'groomingData_v2', 'lensesStartTime', 
                'lensesHistory', 'lensStock', 'lensDate', 'solutionDate', 
                'caseDate', 'systaneDate', 'clothWashDate', 'clothChangeDate', 
                'health_medical_data', 'health_blood_tests', 'vehicle_odometer', 
                'vehicle_maintenance_log', 'gym_records', 'gym_routine', 
                'gym_routine_focus', 'gym_sessions', 'gym_meals', 'gym_general_meals', 
                'gym_supplements', 'gym_weight', 'projectPulseData', 'projectPulseHistory', 
                'projectPulseSubscription', 'alerts_config', 'alerts_sent_log', 'finanzasData',
                'vehicle_tracker_data', 'vehicle_issues', 'tareas_list', 'tareas_categories',
                'tareas_pinned_projects', 'tareas_pinned_project_ids', 'tareas_removed_project_ids'
            ];
            localKeys.forEach(key => {
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
                        this.app.health.bloodTests = rawBlood ? JSON.parse(rawBlood) : [];
                    } catch (e) { console.error("Error parsing health data in sync:", e); }
                }
                if (this.app.vehicle) {
                    try {
                        this.app.vehicle.odometer = Number(localStorage.getItem('vehicle_odometer')) || 0;
                        const rawLog = localStorage.getItem('vehicle_maintenance_log');
                        this.app.vehicle.maintenanceLog = rawLog ? JSON.parse(rawLog) : [];
                        const rawTracker = localStorage.getItem('vehicle_tracker_data');
                        this.app.vehicle.trackerData = rawTracker ? JSON.parse(rawTracker) : {};
                        const rawIssues = localStorage.getItem('vehicle_issues');
                        this.app.vehicle.issues = rawIssues ? JSON.parse(rawIssues) : [];
                    } catch (e) { console.error("Error parsing vehicle log in sync:", e); }
                }
                if (this.app.gym) {
                    try { this.app.gym.loadData(); } catch (e) { console.error("Error reloading gym:", e); }
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
            if (this.app.notificationsCenter) {
                try { this.app.notificationsCenter.updateBadge(); } catch (e) { console.error("Error updating notifications badge:", e); }
            }
        } finally {
            this.isRestoring = false;
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
                if (newCloudData) {
                    const local = this.gatherLocalData();
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
            const { data: rows, error: readError } = await this.supabase
                .from('push_subscriptions')
                .select('id, subscription, created_at')
                .eq('user_id', this.user.id);

            if (readError) throw readError;

            const matchingRows = (rows || [])
                .filter(row => row.subscription?.endpoint === subscriptionJSON.endpoint)
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            if (matchingRows.length === 0) {
                const { error: insertError } = await this.supabase
                    .from('push_subscriptions')
                    .insert({
                        user_id: this.user.id,
                        subscription: subscriptionJSON
                    });

                if (insertError) throw insertError;
                return;
            }

            const [rowToKeep, ...duplicates] = matchingRows;
            const { error: updateError } = await this.supabase
                .from('push_subscriptions')
                .update({ subscription: subscriptionJSON })
                .eq('id', rowToKeep.id);

            if (updateError) throw updateError;

            if (duplicates.length > 0) {
                const { error: deleteError } = await this.supabase
                    .from('push_subscriptions')
                    .delete()
                    .in('id', duplicates.map(row => row.id));

                if (deleteError) throw deleteError;
                console.log(`[Push] Se eliminaron ${duplicates.length} registros duplicados de este dispositivo.`);
            }
        })();

        try {
            await this.pushSyncPromise;
        } finally {
            this.pushSyncPromise = null;
        }
    }

    async enablePushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert('Las notificaciones push no son compatibles con este navegador o dispositivo.');
            return;
        }

        try {
            // 1. Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('Permiso de notificaciones denegado.');
                return;
            }

            // 2. Get Service Worker registration
            const registration = await navigator.serviceWorker.ready;

            // 3. Get VAPID public key from backend config
            const vapidKey = this.config.vapidPublicKey;
            if (!vapidKey) {
                alert('No se pudo obtener la clave VAPID pública desde el backend.');
                return;
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

            // 5. Send subscription to Supabase directly (runs in user's authenticated context)
            const subscriptionJSON = subscription.toJSON();
            await this.persistPushSubscription(subscriptionJSON);

            // 6. Update UI
            alert('¡Notificaciones activadas con éxito en este dispositivo!');
            await this.checkPushSubscriptionStatus();

        } catch (e) {
            console.error('Error enabling push notifications:', e);
            let msg = 'Error al activar notificaciones: ' + e.message;
            if (e.message && (e.message.includes('push service error') || e.message.includes('Registration failed'))) {
                msg = '⚠️ Error del servicio Push del navegador (PC):\n\n' +
                      '1. Si usás el navegador BRAVE: andá a brave://settings/privacy y activá la opción "Usar servicios de Google para mensajería push" (o "Use Google Services for Push Messaging"), y luego reiniciá el navegador.\n\n' +
                      '2. Si estás en Windows: verificá en Inicio -> Configuración -> Sistema -> Notificaciones que las notificaciones de tu navegador estén activadas.\n\n' +
                      '3. Asegurate de no estar usando una ventana de incógnito o VPN que bloquee los servicios de notificaciones.';
            }
            alert(msg);
        }
    }

    async checkPushSubscriptionStatus() {
        if (!this.user) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            if (this.btnEnablePush) {
                this.btnEnablePush.disabled = true;
                this.btnEnablePush.innerText = 'Notificaciones No Compatibles';
            }
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                const subscriptionJSON = subscription.toJSON();
                await this.persistPushSubscription(subscriptionJSON);

                if (this.btnEnablePush) {
                    this.btnEnablePush.innerText = '🔔 Notificaciones Activas en este Dispositivo';
                    this.btnEnablePush.style.borderColor = 'var(--status-green)';
                    this.btnEnablePush.style.color = 'var(--status-green)';
                }
                this.btnTestPush?.classList.remove('hidden');
            } else {
                if (this.btnEnablePush) {
                    this.btnEnablePush.innerText = '🔔 Activar Notificaciones en este Dispositivo';
                    this.btnEnablePush.style.borderColor = '';
                    this.btnEnablePush.style.color = '';
                }
                this.btnTestPush?.classList.add('hidden');
            }
        } catch (e) {
            console.error('Error checking push subscription status:', e);
        }
    }

    async sendTestPushNotification() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                alert('No se encontró una suscripción activa en este dispositivo.');
                return;
            }

            const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
            if (sessionError || !session?.access_token) {
                alert('Tu sesión venció. Volvé a iniciar sesión antes de probar las notificaciones.');
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
                alert('Notificación de prueba enviada. Debería aparecer en este dispositivo.');
            } else {
                const statusText = result.statusCode ? ` (HTTP ${result.statusCode})` : '';
                alert(`${result.error || 'Error al enviar la notificación de prueba.'}${statusText}`);
            }
        } catch (e) {
            console.error('Error triggering test push:', e);
            alert('Error al probar: ' + e.message);
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
}
