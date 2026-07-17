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
        this.btnSignup = document.getElementById('btn-signup');
        
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
        this.init();
    }

    async init() {
        try {
            // 1. Fetch credentials from server config endpoint
            const res = await fetch('/api/config');
            this.config = await res.json();
            
            if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
                console.log("Supabase credentials not configured in backend. Running in offline/localStorage mode.");
                this.showOfflineMode();
                return;
            }
            
            // 2. Initialize Supabase client
            this.supabase = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
            
            // 3. Bind UI listeners
            this.setupListeners();
            
            // 4. Initial session check
            const { data: { session } } = await this.supabase.auth.getSession();
            this.handleAuthStateChange(session?.user || null);
            
            // 5. Setup auth state change listener
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.handleAuthStateChange(session?.user || null);
            });
            
        } catch (err) {
            console.error("Error initializing Supabase:", err);
            this.showOfflineMode();
        }
    }

    showOfflineMode() {
        this.authLoading?.classList.add('hidden');
        this.authLoggedOut?.classList.add('hidden');
        this.authLoggedIn?.classList.add('hidden');
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

        // Signup Button Click
        this.btnSignup?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.signup();
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
    }

    async login() {
        const email = this.authEmail?.value;
        const password = this.authPassword?.value;
        if (!email || !password) return;
        
        this.setLoading(true, "Iniciando sesión...");
        sessionStorage.setItem('is_explicit_login', 'true');
        
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            alert("Error al iniciar sesión: " + error.message);
            sessionStorage.removeItem('is_explicit_login');
            this.setLoading(false);
        }
    }

    async signup() {
        const email = this.authEmail?.value;
        const password = this.authPassword?.value;
        if (!email || !password) return;
        
        if (password.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        
        this.setLoading(true, "Creando cuenta...");
        sessionStorage.setItem('is_explicit_login', 'true');
        
        const { data, error } = await this.supabase.auth.signUp({ email, password });
        
        if (error) {
            alert("Error al registrarse: " + error.message);
            sessionStorage.removeItem('is_explicit_login');
            this.setLoading(false);
        } else {
            alert("¡Registro exitoso! Si se configuró confirmación por correo, revisa tu casilla. De lo contrario, ya has iniciado sesión.");
            this.setLoading(false);
        }
    }

    async logout() {
        if (confirm("¿Estás seguro de que deseas cerrar sesión? Volverás al modo local sin conexión.")) {
            this.setLoading(true, "Cerrando sesión...");
            await this.supabase.auth.signOut();
            location.reload();
        }
    }

    async handleAuthStateChange(user) {
        this.user = user;
        this.setLoading(false);
        
        if (user) {
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
        }
    }

    setLoading(isLoading, text = "") {
        if (isLoading) {
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
            tareas_categories: localStorage.getItem('tareas_categories')
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
                let hasLocalOnlyData = false;
                Object.keys(local).forEach(key => {
                    const cloudVal = cloudData[key] === undefined ? null : cloudData[key];
                    const localVal = local[key] === undefined ? null : local[key];
                    if (!this.areValuesEqual(cloudVal, localVal)) {
                        hasDifference = true;
                        if ((cloudVal === null || cloudVal === undefined) && (localVal !== null && localVal !== undefined)) {
                            hasLocalOnlyData = true;
                        }
                    }
                });

                if (!hasDifference) {
                    this.updateSyncBadge('synced', "Sincronizado");
                    return;
                }

                // Si hay diferencias pero son datos locales nuevos (que no existen en la nube), los subimos
                if (hasLocalOnlyData && sessionStorage.getItem('is_explicit_login') !== 'true') {
                    console.log("Local has new data not present in cloud. Uploading...");
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
        
        if (this.isSyncing) {
            this.pendingSync = true;
            return;
        }
        
        this.isSyncing = true;
        this.isRestoring = true;
        this.updateSyncBadge('syncing', "Sincronizando...");
        
        try {
            // 1. Obtener datos actuales en la nube para no sobreescribir alerts_sent_log
            const { data: cloudRow } = await this.supabase
                .from('user_data')
                .select('data')
                .eq('user_id', this.user.id)
                .single();
            
            const cloudData = cloudRow?.data || {};
            const localData = this.gatherLocalData();

            // Fusionar alerts_sent_log para conservar el log de alertas del servidor
            if (cloudData.alerts_sent_log) {
                const cloudLogStr = typeof cloudData.alerts_sent_log === 'string'
                    ? cloudData.alerts_sent_log
                    : JSON.stringify(cloudData.alerts_sent_log);
                localData.alerts_sent_log = cloudLogStr;
                localStorage.setItem('alerts_sent_log', cloudLogStr);
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
                'gym_supplements', 'gym_weight', 'projectPulseData', 'projectPulseHistory', 'projectPulseSubscription', 'alerts_config', 'alerts_sent_log', 'finanzasData'
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

    // Upload helper for files
    async uploadFile(fileId, file) {
        if (!this.user || !this.supabase) {
            throw new Error("Usuario no autenticado");
        }
        
        const filePath = `${this.user.id}/${fileId}_${file.name}`;
        
        const { data, error } = await this.supabase.storage
            .from('blood-tests')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });
            
        if (error) {
            throw error;
        }
        
        // Get public URL
        const { data: { publicUrl } } = this.supabase.storage
            .from('blood-tests')
            .getPublicUrl(filePath);
            
        return publicUrl;
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

            // 4. Subscribe to Push Manager
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // 5. Send subscription to Supabase directly (runs in user's authenticated context)
            const subscriptionJSON = subscription.toJSON();
            
            try {
                // Clean up old subscriptions for the same endpoint to avoid duplicates
                await this.supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', this.user.id)
                    .eq('subscription->endpoint', subscriptionJSON.endpoint);
            } catch (err) {
                console.warn("Error cleaning up old subscription:", err);
            }

            const { error: dbError } = await this.supabase
                .from('push_subscriptions')
                .insert({
                    user_id: this.user.id,
                    subscription: subscriptionJSON
                });

            if (dbError) throw dbError;

            // 6. Update UI
            alert('¡Notificaciones activadas con éxito en este dispositivo!');
            await this.checkPushSubscriptionStatus();

        } catch (e) {
            console.error('Error enabling push notifications:', e);
            alert('Error al activar notificaciones: ' + e.message);
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
                // Sincronización silenciosa en segundo plano (Auto-Heal)
                (async () => {
                    try {
                        await this.supabase
                            .from('push_subscriptions')
                            .delete()
                            .eq('user_id', this.user.id)
                            .eq('subscription->endpoint', subscriptionJSON.endpoint);
                            
                        await this.supabase
                            .from('push_subscriptions')
                            .insert({
                                user_id: this.user.id,
                                subscription: subscriptionJSON
                            });
                    } catch (err) {
                        console.warn("Silent subscription auto-heal sync failed:", err);
                    }
                })();

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

            const res = await fetch('/api/test-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });

            if (res.ok) {
                alert('Notificación de prueba programada. Bloquea tu celular o quédate en espera; llegará en 5 segundos.');
            } else {
                alert('Error al programar la notificación de prueba.');
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
