require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const sharedRules = require('./shared_rules.json');
const {
    assertServerManagedUserDataPatch,
    buildCustomTrackerNotification,
    buildVehicleCatalogNotification,
    buildVehicleDocumentNotification,
    buildVehicleMaintenanceNotification,
    ensureCustomTrackerAlertConfigs,
    ensureVehicleCatalogAlertConfigs,
    formatExpiryStatus,
    getDuplicateSubscriptionRowIds,
    getLatestValidDate,
    getPendingVeryUrgentTasks,
    groupSubscriptionsByUser,
    isExpiredPushError,
    isIntervalReminderDue,
    normalizeIntervalHours,
    parseJsonValue
} = require('./notification-utils');
const {
    extractBearerToken,
    isBlockedStaticPath,
    isValidPushSubscription,
    safeEqualStrings
} = require('./security-utils');

// Búfer en memoria para depuración de logs en Render
const logBuffer = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function getArgentinaTimestamp() {
    try {
        return new Date().toLocaleString('es-AR', { 
            timeZone: 'America/Argentina/Buenos_Aires',
            hour12: false 
        });
    } catch (e) {
        return new Date().toISOString();
    }
}

function addToLogBuffer(type, args) {
    const timestamp = getArgentinaTimestamp();
    const msg = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        if (typeof arg === 'object') {
            try { return JSON.stringify(arg); } catch (e) { return '[Object]'; }
        }
        return String(arg);
    }).join(' ');
    logBuffer.push(`[${timestamp}] [${type}] ${msg}`);
    if (logBuffer.length > 200) {
        logBuffer.shift();
    }
}

console.log = (...args) => {
    addToLogBuffer('INFO', args);
    originalLog.apply(console, args);
};
console.error = (...args) => {
    addToLogBuffer('ERROR', args);
    originalError.apply(console, args);
};
console.warn = (...args) => {
    addToLogBuffer('WARN', args);
    originalWarn.apply(console, args);
};


const app = express();
const configuredPort = Number.parseInt(process.env.PORT || '', 10);
const PORT = Number.isInteger(configuredPort)
    && configuredPort >= 0
    && configuredPort <= 65535
    ? configuredPort
    : 3000;
const notificationRuntimeState = {
    running: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDurationMs: null,
    lastTrigger: null,
    consecutiveFailures: 0,
    engines: {
        recurring: null,
        configured: null
    }
};
const transientDeliveryState = {
    daily: new Map(),
    interval: new Map()
};

function setBoundedDeliveryState(map, key, value, maxEntries = 1000) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > maxEntries) {
        map.delete(map.keys().next().value);
    }
}

function wasSentForDate(userId, alertKey, dateStr) {
    return transientDeliveryState.daily.get(`${userId}:${alertKey}`) === dateStr;
}

function rememberSentForDate(userId, alertKey, dateStr) {
    setBoundedDeliveryState(
        transientDeliveryState.daily,
        `${userId}:${alertKey}`,
        dateStr
    );
}

function getLastIntervalDelivery(userId, reminderKey) {
    return transientDeliveryState.interval.get(`${userId}:${reminderKey}`) || null;
}

function rememberIntervalDelivery(userId, reminderKey, timestamp) {
    setBoundedDeliveryState(
        transientDeliveryState.interval,
        `${userId}:${reminderKey}`,
        timestamp,
        200
    );
}

// Configurar Web Push VAPID de forma segura (sin hardcodear en Git)
let publicKey = process.env.VAPID_PUBLIC_KEY;
let privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
    const keysPath = path.join(__dirname, 'vapid-keys.json');
    if (fs.existsSync(keysPath)) {
        try {
            const fileData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
            publicKey = fileData.publicKey;
            privateKey = fileData.privateKey;
        } catch (err) {
            console.error("Error reading vapid-keys.json:", err);
        }
    }
    
    if (!publicKey || !privateKey) {
        console.log("Generating new VAPID keys for local development...");
        const newKeys = webpush.generateVAPIDKeys();
        publicKey = newKeys.publicKey;
        privateKey = newKeys.privateKey;
        try {
            fs.writeFileSync(keysPath, JSON.stringify(newKeys, null, 2), 'utf8');
            console.log("VAPID keys saved to vapid-keys.json (ignored by git).");
        } catch (err) {
            console.error("Error writing vapid-keys.json:", err);
        }
    }
}

webpush.setVapidDetails(
    'mailto:contacto@fabriziococca.com',
    publicKey,
    privateKey
);

// Inicializar Supabase Client (bypasea RLS usando Service Role si está disponible)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
    console.warn("⚠️ Advertencia: SUPABASE_URL no está configurada. Supabase no estará disponible en el backend.");
} else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ Advertencia: SUPABASE_SERVICE_ROLE_KEY no está configurada en Render. Las políticas RLS bloquearán las notificaciones en segundo plano.");
}

const ALERT_DEFINITION_KEYS = [
    'esponja_africana', 'toalla_mano', 'toalla_cuerpo', 'sabanas', 'funda_almohada',
    'alfombra_bano', 'cepillo_dientes', 'dentista', 'compu_limpieza_int',
    'compu_pasta_termica', 'botella_vidrio', 'pelo', 'barba', 'axilas',
    'hoja_gillette', 'pecho_panza', 'brazos', 'piernas', 'intimas', 'unas_manos',
    'unas_pies', 'lenses_droplets', 'lenses_case', 'lenses_solution',
    'lenses_replace', 'glasses_cloth_wash', 'glasses_cloth_replace', 'vehicle_oil',
    'vehicle_align', 'vehicle_rot', 'vehicle_replace', 'vehicle_issues_check',
    'vehicle_docs_check', 'vehicle_fluids_check', 'vitamina_d', 'creatine', 'salmon',
    'neck', 'weigh_in', 'laundry', 'robot', 'workana', 'projects_check',
    'tareas_urgentes_check', 'very_urgent_tasks'
];

const RECURRING_ALERT_DEFAULTS = {
    creatine: { enabled: true, time: '23:00', days: [1, 2, 3, 4, 5, 6, 0] },
    salmon: { enabled: true, time: '17:00', days: [0] },
    neck: { enabled: true, time: '23:30', days: [5, 6] },
    weigh_in: { enabled: true, time: '08:00', days: [1, 2, 3, 4, 5, 6, 0] },
    laundry: { enabled: true, time: '10:00', days: [1, 2, 3, 4, 5, 6, 0] }
};

const MORNING_ALERT_KEYS = new Set([
    'projects_check',
    'vehicle_issues_check',
    'vehicle_docs_check',
    'vehicle_fluids_check',
    'tareas_urgentes_check'
]);

function getDefaultAlertConfig(key, oldReminders = {}) {
    if (key === 'robot') {
        return { enabled: true, time: '23:00', days: [], interval_hours: 6 };
    }
    if (key === 'very_urgent_tasks') {
        return { enabled: true, time: '09:00', days: [], interval_hours: 4 };
    }
    if (RECURRING_ALERT_DEFAULTS[key]) {
        const legacy = oldReminders[key] || {};
        const defaults = RECURRING_ALERT_DEFAULTS[key];
        return {
            enabled: legacy.enabled ?? defaults.enabled,
            time: legacy.time || defaults.time,
            days: Array.isArray(legacy.days) ? legacy.days : defaults.days
        };
    }
    return {
        enabled: true,
        time: MORNING_ALERT_KEYS.has(key) ? '09:00' : '23:00',
        days: []
    };
}

function ensureAlertConfigs(alertsConfig, oldReminders = {}) {
    let changed = false;

    ALERT_DEFINITION_KEYS.forEach(key => {
        const defaults = getDefaultAlertConfig(key, oldReminders);
        if (!alertsConfig[key]) {
            alertsConfig[key] = defaults;
            changed = true;
            return;
        }

        Object.entries(defaults).forEach(([field, defaultValue]) => {
            if (alertsConfig[key][field] === undefined) {
                alertsConfig[key][field] = defaultValue;
                changed = true;
            }
        });

        if (!Array.isArray(alertsConfig[key].days)) {
            alertsConfig[key].days = defaults.days;
            changed = true;
        }
    });

    return changed;
}

async function mergeServerUserDataKeys(userId, updates) {
    if (!supabase) {
        throw new Error('Supabase no está disponible.');
    }
    if (!userId) throw new TypeError('El identificador de usuario es obligatorio.');
    assertServerManagedUserDataPatch(updates);

    const { error } = await supabase.rpc('merge_server_user_data_keys', {
        p_user_id: userId,
        p_updates: updates
    });

    if (error) throw error;
}

async function deleteSubscriptionRows(rowIds, reason) {
    const uniqueIds = [...new Set((rowIds || []).filter(Boolean))];
    if (!supabase || uniqueIds.length === 0) return 0;

    const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', uniqueIds);

    if (error) {
        console.error(`[Push] No se pudieron eliminar ${uniqueIds.length} suscripciones (${reason}):`, error.message);
        return 0;
    }

    console.log(`[Push] Se eliminaron ${uniqueIds.length} suscripciones (${reason}).`);
    return uniqueIds.length;
}

async function cleanupDuplicateSubscriptions(subscriptionGroups) {
    const duplicateIds = getDuplicateSubscriptionRowIds(subscriptionGroups);
    return deleteSubscriptionRows(duplicateIds, 'duplicadas');
}

async function sendPushToSubscriptions({
    userId,
    subscriptions,
    payload,
    context,
    delayMs = 0
}) {
    let successCount = 0;
    let failureCount = 0;
    let staleCount = 0;

    for (const item of subscriptions || []) {
        try {
            await webpush.sendNotification(item.subscription, payload);
            successCount++;
        } catch (error) {
            failureCount++;
            const statusCode = error?.statusCode || error?.status || 'sin estado';
            console.error(`[Push] Falló '${context}' para usuario ${userId} (HTTP ${statusCode}):`, error?.message || error);

            if (isExpiredPushError(error)) {
                staleCount += await deleteSubscriptionRows(item.rowIds, `endpoint vencido HTTP ${statusCode}`);
            }
        }

        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log(`[Push] Resultado '${context}' para usuario ${userId}: ${successCount} enviados, ${failureCount} fallidos, ${staleCount} filas vencidas eliminadas.`);
    return { successCount, failureCount, staleCount };
}

// Rate Limiter integrado y liviano (sin dependencias npm)
const ipCounts = {};
const rateLimitResetTimer = setInterval(() => {
    // Resetear contadores de IP cada 15 minutos para evitar fugas de memoria
    for (const ip in ipCounts) {
        delete ipCounts[ip];
    }
}, 15 * 60 * 1000);
rateLimitResetTimer.unref?.();

const rateLimiter = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    ipCounts[ip] = (ipCounts[ip] || 0) + 1;
    if (ipCounts[ip] > 100) {
        console.warn(`[Security] IP bloqueada temporalmente por exceso de peticiones: ${ip}`);
        return res.status(429).json({ error: 'Demasiadas solicitudes. Por favor, intentá de nuevo más tarde.' });
    }
    next();
};

// Middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});
app.use(express.json({ limit: '32kb' }));
app.use('/api/', rateLimiter);
app.use((req, res, next) => {
    if (isBlockedStaticPath(req.path)) {
        return res.status(404).type('text/plain').send('Not found');
    }
    next();
});
app.use(express.static(__dirname, {
    dotfiles: 'deny',
    maxAge: '7d', // Cache static assets for 7 days by default
    setHeaders: (res, filePath) => {
        if (
            filePath.endsWith('.html')
            || filePath.includes('sw.js')
            || filePath.endsWith('.js')
            || filePath.endsWith('.mjs')
            || filePath.endsWith('.css')
        ) {
            // HTML, JS modules, CSS and the Service Worker must revalidate on every load.
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.endsWith('.json') || filePath.endsWith('.png') || filePath.endsWith('.ico')) {
            // JSON and images cached for 1 week
            res.setHeader('Cache-Control', 'public, max-age=604800');
        }
    }
}));

// Config endpoint to secure credentials and send VAPID key
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
        vapidPublicKey: publicKey
    });
});

app.get('/api/rules', (req, res) => {
    res.json(sharedRules);
});

app.get('/api/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        status: 'ok',
        commit: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7),
        notifications: {
            configured: Boolean(
                supabase
                && publicKey
                && privateKey
            ),
            running: notificationRuntimeState.running,
            lastAttemptAt: notificationRuntimeState.lastAttemptAt,
            lastSuccessAt: notificationRuntimeState.lastSuccessAt,
            lastFailureAt: notificationRuntimeState.lastFailureAt,
            consecutiveFailures: notificationRuntimeState.consecutiveFailures
        }
    });
});

async function requireSupabaseUser(req, res, next) {
    if (!supabase) {
        return res.status(503).json({ error: 'Autenticación no disponible en el servidor.' });
    }

    const accessToken = extractBearerToken(req.headers.authorization);
    if (!accessToken) {
        return res.status(401).json({ error: 'Se requiere una sesión válida.' });
    }

    try {
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (error || !data?.user) {
            return res.status(401).json({ error: 'La sesión venció o no es válida.' });
        }

        req.authenticatedUser = data.user;
        next();
    } catch (error) {
        console.error('[Security] Error validando sesión Supabase:', error);
        res.status(503).json({ error: 'No se pudo validar la sesión en este momento.' });
    }
}

async function getSubscriptionRowsForUser(userId) {
    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, subscription, created_at')
        .eq('user_id', userId);

    if (error) throw error;
    return data || [];
}

// Endpoint autenticado para registrar o reparar una suscripción Push.
app.post('/api/subscribe', requireSupabaseUser, async (req, res) => {
    const { subscription } = req.body;
    if (!isValidPushSubscription(subscription)) {
        return res.status(400).json({ error: 'La suscripción Push no es válida.' });
    }

    const userId = req.authenticatedUser.id;

    try {
        const rows = await getSubscriptionRowsForUser(userId);
        const matchingRows = rows
            .filter(row => row.subscription?.endpoint === subscription.endpoint)
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        if (matchingRows.length === 0) {
            const { error } = await supabase
                .from('push_subscriptions')
                .insert({ user_id: userId, subscription });
            if (error) throw error;
        } else {
            const [rowToKeep, ...duplicates] = matchingRows;
            const { error: updateError } = await supabase
                .from('push_subscriptions')
                .update({ subscription })
                .eq('id', rowToKeep.id)
                .eq('user_id', userId);
            if (updateError) throw updateError;

            if (duplicates.length > 0) {
                const { error: deleteError } = await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', userId)
                    .in('id', duplicates.map(row => row.id));
                if (deleteError) throw deleteError;
            }
        }

        const registeredDevices = new Set([
            ...rows
                .map(row => row.subscription?.endpoint)
                .filter(Boolean),
            subscription.endpoint
        ]).size;

        res.json({ success: true, registeredDevices });
    } catch (error) {
        console.error('[Push] Error guardando suscripción autenticada:', error);
        res.status(500).json({ error: 'No se pudo guardar la suscripción Push.' });
    }
});

// Endpoint para probar notificaciones push de inmediato (5 segundos de delay)
app.post('/api/test-push', requireSupabaseUser, async (req, res) => {
    const { subscription } = req.body;
    if (!isValidPushSubscription(subscription)) {
        return res.status(400).json({ error: 'La suscripción Push no es válida.' });
    }

    let matchingRows;
    try {
        const rows = await getSubscriptionRowsForUser(req.authenticatedUser.id);
        matchingRows = rows.filter(row => row.subscription?.endpoint === subscription.endpoint);
    } catch (error) {
        console.error('[Push] No se pudo verificar la propiedad de la suscripción:', error);
        return res.status(500).json({ error: 'No se pudo verificar la suscripción Push.' });
    }

    if (matchingRows.length === 0) {
        return res.status(403).json({ error: 'Esta suscripción no pertenece a la sesión actual.' });
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        await webpush.sendNotification(subscription, JSON.stringify({
            title: '🔔 LifeCycle Test',
            body: '¡Excelente! Las notificaciones push en segundo plano están funcionando correctamente.',
            url: '/'
        }));
        console.log('Test push sent successfully.');
        res.json({ success: true, message: 'Notificación de prueba enviada.' });
    } catch (error) {
        const statusCode = error?.statusCode || error?.status || null;
        console.error('Error sending test push:', error);

        if (isExpiredPushError(error)) {
            await deleteSubscriptionRows(
                matchingRows.map(row => row.id),
                `prueba Push vencida HTTP ${statusCode}`
            );
        }

        res.status(502).json({
            error: 'El servicio Push rechazó la notificación de prueba.',
            statusCode
        });
    }
});

// Middleware de autenticación para endpoints administrativos
const checkAdminToken = (req, res, next) => {
    const token = req.headers['x-admin-token'] || req.query.token;
    const secret = process.env.ADMIN_TOKEN;

    if (!secret) {
        console.error('[Security] ADMIN_TOKEN no está configurado; endpoint administrativo bloqueado.');
        return res.status(503).json({ error: 'Los endpoints administrativos no están configurados.' });
    }

    if (!safeEqualStrings(token, secret)) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.warn(`[Security] Intento de acceso no autorizado a endpoint administrativo desde IP: ${ip}`);
        return res.status(401).json({ error: 'No autorizado. Se requiere un token válido.' });
    }
    next();
};

// Endpoint manual para disparar la revisión de recordatorios
app.get('/api/check-reminders', checkAdminToken, async (req, res) => {
    try {
        const result = await runScheduledAlertChecks({
            forceAll: true,
            trigger: 'admin'
        });
        res.json({
            success: true,
            message: 'Revisión completa de recordatorios ejecutada (forzada para pruebas).',
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'La revisión de recordatorios terminó con errores.'
        });
    }
});

app.get('/api/admin/logs', checkAdminToken, (req, res) => {
    res.type('text/plain').send(logBuffer.join('\n'));
});

app.get('/api/admin/notification-status', checkAdminToken, async (req, res) => {
    const database = {
        userRows: null,
        subscriptionRows: null,
        uniqueEndpoints: null,
        usersWithSubscriptions: null
    };

    if (supabase) {
        try {
            const [
                { data: usersData, error: usersError },
                { data: subscriptions, error: subscriptionsError }
            ] = await Promise.all([
                supabase.from('user_data').select('user_id'),
                supabase
                    .from('push_subscriptions')
                    .select('id, user_id, subscription, created_at')
            ]);

            if (usersError) throw usersError;
            if (subscriptionsError) throw subscriptionsError;

            const grouped = groupSubscriptionsByUser(subscriptions || []);
            database.userRows = usersData?.length || 0;
            database.subscriptionRows = subscriptions?.length || 0;
            database.uniqueEndpoints = Object.values(grouped)
                .reduce((total, entries) => total + entries.length, 0);
            database.usersWithSubscriptions = Object.keys(grouped).length;
        } catch (error) {
            console.error('[Push Status] No se pudo consultar el estado de suscripciones:', error);
        }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
        configured: {
            supabase: Boolean(supabase),
            serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
            vapid: Boolean(publicKey && privateKey)
        },
        scheduler: notificationRuntimeState,
        database
    });
});

// Endpoint manual de prueba para disparar alerta de robot inmediatamente si está sucio
app.get('/api/test-robot-reminder', checkAdminToken, async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase no configurado' });
    
    try {
        const { data: usersData } = await supabase.from('user_data').select('*');
        const { data: subs } = await supabase.from('push_subscriptions').select('*');
        
        if (!usersData || usersData.length === 0) return res.json({ success: true, message: 'No hay usuarios' });
        if (!subs || subs.length === 0) return res.json({ success: true, message: 'No hay suscripciones' });
        
        const subsByUser = groupSubscriptionsByUser(subs);
        
        let sentCount = 0;
        for (const userRow of usersData) {
            const data = userRow.data || {};
            const hygieneData = parseJsonValue(data.hygiene_tracker_data, {});
            
            const robot = hygieneData.robot_cleaner;
            if (robot && robot.status === 'dirty') {
                const userSubs = subsByUser[userRow.user_id] || [];
                const payload = JSON.stringify({
                    title: '🤖 Robot Aspiradora (Prueba)',
                    body: 'El robot sigue sucio. ¡Acordate de lavarlo! (Forzado desde test)',
                    url: '/'
                });
                const result = await sendPushToSubscriptions({
                    userId: userRow.user_id,
                    subscriptions: userSubs,
                    payload,
                    context: 'prueba de robot'
                });
                sentCount += result.successCount;
            }
        }
        res.json({ success: true, notificationsSent: sentCount });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback to index.html for SPA/PWA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
const httpServer = app.listen(PORT, () => {
    const address = httpServer.address();
    const activePort = typeof address === 'object' && address
        ? address.port
        : PORT;
    console.log(`LifeCycle backend running on port ${activePort}`);
});

// ==========================================================================
// Utilidad: Obtener Fecha y Hora de Argentina (UTC-3) sin errores de DST
// ==========================================================================
function getArgentinaTime() {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
    });
    
    const parts = formatter.formatToParts(new Date());
    const t = {};
    parts.forEach(p => t[p.type] = p.value);
    
    const year = parseInt(t.year, 10);
    const month = parseInt(t.month, 10);
    const day = parseInt(t.day, 10);
    const hour = parseInt(t.hour, 10);
    const minutes = parseInt(t.minute, 10);
    const dateStr = `${t.year}-${t.month}-${t.day}`;
    
    const utcDate = new Date(Date.UTC(
        year,
        month - 1,
        day
    ));
    const dayOfWeek = utcDate.getUTCDay();
    
    return { year, month, day, hour, minutes, dayOfWeek, dateStr };
}

// ==========================================================================
// Tarea Programada: chequeo completo cada cinco minutos
// ==========================================================================
let scheduledAlertCheckRunning = false;

async function runScheduledAlertChecks({
    forceAll = false,
    trigger = 'scheduler'
} = {}) {
    if (scheduledAlertCheckRunning) {
        console.warn('[Alert Scheduler] Se omitió un ciclo porque el anterior todavía está en ejecución.');
        return {
            skipped: true,
            reason: 'already-running'
        };
    }

    scheduledAlertCheckRunning = true;
    notificationRuntimeState.running = true;
    notificationRuntimeState.lastAttemptAt = new Date().toISOString();
    notificationRuntimeState.lastTrigger = trigger;
    const startedAt = Date.now();
    const engineResults = {};
    const errors = [];

    try {
        const engines = [
            ['recurring', () => checkAndSendRobotReminders(forceAll)],
            ['configured', () => checkAndSendAllAlerts(forceAll)]
        ];

        for (const [name, run] of engines) {
            try {
                await run();
                engineResults[name] = {
                    ok: true,
                    completedAt: new Date().toISOString()
                };
            } catch (error) {
                engineResults[name] = {
                    ok: false,
                    completedAt: new Date().toISOString()
                };
                errors.push(error);
                console.error(`[Alert Scheduler] Falló el motor '${name}':`, error);
            }
        }

        notificationRuntimeState.engines = engineResults;
        notificationRuntimeState.lastDurationMs = Date.now() - startedAt;

        if (errors.length > 0) {
            notificationRuntimeState.lastFailureAt = new Date().toISOString();
            notificationRuntimeState.consecutiveFailures += 1;
            throw new AggregateError(errors, 'Uno o más motores de notificaciones fallaron.');
        }

        notificationRuntimeState.lastSuccessAt = new Date().toISOString();
        notificationRuntimeState.consecutiveFailures = 0;
        return {
            skipped: false,
            trigger,
            forceAll,
            durationMs: notificationRuntimeState.lastDurationMs,
            engines: engineResults
        };
    } finally {
        scheduledAlertCheckRunning = false;
        notificationRuntimeState.running = false;
    }
}

const scheduledAlertTimer = setInterval(() => {
    runScheduledAlertChecks().catch(error => {
        console.error('[Alert Scheduler] Error no controlado:', error);
    });
}, 5 * 60 * 1000);
scheduledAlertTimer.unref?.();

// Ejecutar un primer control poco después de cada despliegue/reinicio.
const initialAlertTimer = setTimeout(() => {
    runScheduledAlertChecks({ trigger: 'startup' }).catch(error => {
        console.error('[Alert Scheduler] Error en control inicial:', error);
    });
}, 10 * 1000);
initialAlertTimer.unref?.();

// ==========================================================================
// Motor Unificado y Dinámico de Alertas (Gestor de Alertas)
// ==========================================================================
async function checkAndSendAllAlerts(forceAll = false) {
    if (!supabase) {
        throw new Error('Supabase no está disponible para el motor de alertas configuradas.');
    }
    try {
        const { year, month, day, hour, minutes, dayOfWeek, dateStr } = getArgentinaTime();

        const { data: usersData, error: dbError } = await supabase.from('user_data').select('*');
        const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*');

        if (dbError) throw dbError;
        if (subError) throw subError;

        console.log(`[Notification Engine] Tick: checking configured notifications (forceAll: ${forceAll}). Time in Argentina: ${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}, Day: ${dayOfWeek}, Date: ${dateStr}. Subscriptions found: ${subs ? subs.length : 0}`);

        if (!usersData || usersData.length === 0) return;
        if (!subs || subs.length === 0) return;

        // Agrupar por usuario y endpoint. Se conserva la fila más reciente de cada dispositivo.
        const subsByUser = groupSubscriptionsByUser(subs);
        await cleanupDuplicateSubscriptions(subsByUser);

        for (const userRow of usersData) {
            const userId = userRow.user_id;
            const userSubs = subsByUser[userId] || [];
            if (userSubs.length === 0) continue;

            const rawData = userRow.data || {};
            // Parsear campos si vienen en formato string JSON
            const data = {};
            Object.keys(rawData).forEach(key => {
                const val = rawData[key];
                if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                    try { data[key] = JSON.parse(val); } catch(e) { data[key] = val; }
                } else {
                    data[key] = val;
                }
            });

            // Cargar o inicializar alerts_config
            let alertsConfig = {};
            if (data.alerts_config) {
                try {
                    alertsConfig = typeof data.alerts_config === 'string' ? JSON.parse(data.alerts_config) : data.alerts_config;
                } catch(e) {}
            }

            const gymSupplements = parseJsonValue(data.gym_supplements, {});
            const oldReminders = gymSupplements?.custom_reminders || {};
            ensureAlertConfigs(alertsConfig, oldReminders);
            ensureCustomTrackerAlertConfigs(
                alertsConfig,
                parseJsonValue(data.hygiene_tracker_data, {})
            );
            ensureVehicleCatalogAlertConfigs(
                alertsConfig,
                parseJsonValue(data.vehicle_tracker_data, {})
            );

            // Inicializar log de envíos diarios si no existe
            if (!data.alerts_sent_log) {
                data.alerts_sent_log = {};
            }

            let dataChanged = false;
            const sentLogUpdates = {};

            // Procesar cada alerta definida
            for (const key of Object.keys(alertsConfig)) {
                const conf = alertsConfig[key];
                if (!conf || !conf.enabled) continue;
                // Estas dos alertas dependen de intervalos desde el último envío,
                // no de una hora diaria. Se procesan en el motor repetitivo.
                if (key === 'robot' || key === 'very_urgent_tasks') continue;

                // Definir los candidatos a evaluar (ayer y hoy para tolerancia a medianoche y reinicios)
                const [remHour, remMin] = (conf.time || '23:00').split(':').map(Number);
                const candidates = [];

                // 1. Ayer
                const yesterdayDate = new Date(year, month - 1, day - 1);
                const yesterdayYear = yesterdayDate.getFullYear();
                const yesterdayMonth = String(yesterdayDate.getMonth() + 1).padStart(2, '0');
                const yesterdayDay = String(yesterdayDate.getDate()).padStart(2, '0');
                const yesterdayDateStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
                const yesterdayDayOfWeek = (dayOfWeek + 6) % 7;
                const schedYesterday = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), remHour, remMin, 0);
                candidates.push({
                    dateStr: yesterdayDateStr,
                    dayOfWeek: yesterdayDayOfWeek,
                    schedDateObj: schedYesterday
                });

                // 2. Hoy
                const schedToday = new Date(year, month - 1, day, remHour, remMin, 0);
                candidates.push({
                    dateStr: dateStr,
                    dayOfWeek: dayOfWeek,
                    schedDateObj: schedToday
                });

                // Virtual Date de Argentina actual para comparación
                const nowArg = new Date(year, month - 1, day, hour, minutes, 0);

                for (const candidate of candidates) {
                    // Verificar si ya fue enviada hoy para evitar spam en el mismo día
                    const usesItemLevelLog = key === 'projects_check' || key === 'tareas_urgentes_check';
                    if (
                        !forceAll
                        && !usesItemLevelLog
                        && (
                            data.alerts_sent_log[key] === candidate.dateStr
                            || wasSentForDate(userId, key, candidate.dateStr)
                        )
                    ) {
                        continue;
                    }

                    // Si es una alerta periódica/recurrente, verificar día de la semana
                    const isRecurring = ['creatine', 'salmon', 'neck', 'weigh_in', 'laundry'].includes(key);
                    if (isRecurring && !forceAll && (!conf.days || !conf.days.includes(candidate.dayOfWeek))) continue;

                    // Verificar si ya pasó la hora programada en Argentina
                    const timePassed = nowArg >= candidate.schedDateObj;
                    if (!timePassed && !forceAll) continue;

                    // Si es el candidato de ayer, verificar ventana de gracia de 6 horas
                    if (candidate.dateStr !== dateStr) {
                        const msSinceScheduled = nowArg - candidate.schedDateObj;
                        if (msSinceScheduled > 6 * 60 * 60 * 1000) continue; // Ventana de gracia superada (6 horas)
                        if (msSinceScheduled < 0) continue;
                    }

                    let shouldNotify = false;
                    let title = '';
                    let body = '';

                    const parseJSONField = (field, defaultVal) => {
                        if (!field) return defaultVal;
                        if (typeof field === 'string') {
                            try {
                                return JSON.parse(field);
                            } catch (e) {
                                console.error(`[Alert Engine] Error parsing JSON field:`, e);
                                return defaultVal;
                            }
                        }
                        return field;
                    };

                    const hygieneData = parseJSONField(data.hygiene_tracker_data, {});
                    const groomingData = parseJSONField(data.groomingData_v2, {});
                    const healthData = parseJSONField(data.health_medical_data, {});
                    const dentista = healthData.dentista || {};
                    const maintenanceLog = parseJSONField(data.vehicle_maintenance_log, []);
                    const vehicleTrackerData = parseJSONField(data.vehicle_tracker_data, {});
                    const currentOdo = Number(data.vehicle_odometer) || 0;
                    const gymSupplements = parseJSONField(data.gym_supplements, {});

                    const vehicleCatalogNotification = buildVehicleCatalogNotification(
                        key,
                        vehicleTrackerData,
                        currentOdo,
                        getDaysElapsed,
                        getDaysUntil
                    );
                    const customTrackerNotification = vehicleCatalogNotification?.handled
                        ? null
                        : buildCustomTrackerNotification(
                            key,
                            hygieneData,
                            getDaysElapsed
                        );
                    if (vehicleCatalogNotification?.handled) {
                        shouldNotify = vehicleCatalogNotification.shouldNotify === true;
                        title = vehicleCatalogNotification.title;
                        body = vehicleCatalogNotification.body;
                    } else if (customTrackerNotification?.handled) {
                        shouldNotify = customTrackerNotification.shouldNotify === true;
                        title = customTrackerNotification.title;
                        body = customTrackerNotification.body;
                    } else {
                        switch(key) {
                        // Higiene
                        case 'esponja_africana':
                            if (hygieneData.esponja_africana) {
                                const val = hygieneData.esponja_africana;
                                const history = Array.isArray(val) ? val : [val];
                                if (history.length > 0) {
                                    const elapsed = getDaysElapsed(history[0]);
                                    const limit = sharedRules.hygiene?.esponja_africana?.limits?.red || 30;
                                    if (elapsed >= limit) { shouldNotify = true; title = '🧼 Esponja Africana'; body = `Pasaron ${elapsed} días, recordá lavarla.`; }
                                }
                            }
                            break;
                        case 'toalla_mano':
                            if (hygieneData.toalla_mano) {
                                const elapsed = getDaysElapsed(hygieneData.toalla_mano);
                                const limit = sharedRules.hygiene?.toalla_mano?.limits?.red || 4;
                                if (elapsed >= limit) { shouldNotify = true; title = '🧼 Toalla de Mano'; body = `Pasaron ${elapsed} días, recordá lavarla.`; }
                            }
                            break;
                        case 'toalla_cuerpo':
                            if (hygieneData.toalla_cuerpo) {
                                const elapsed = getDaysElapsed(hygieneData.toalla_cuerpo);
                                const limit = sharedRules.hygiene?.toalla_cuerpo?.limits?.red || 8;
                                if (elapsed >= limit) { shouldNotify = true; title = '🧼 Toalla de Cuerpo'; body = `Pasaron ${elapsed} días, recordá lavarla.`; }
                            }
                            break;
                        case 'sabanas':
                            if (hygieneData.sabanas) {
                                const elapsed = getDaysElapsed(hygieneData.sabanas);
                                const limit = sharedRules.hygiene?.sabanas?.limits?.red || 8;
                                if (elapsed >= limit) { shouldNotify = true; title = '🧼 Sábanas'; body = `Pasaron ${elapsed} días, recordá lavarlas.`; }
                            }
                            break;
                        case 'funda_almohada':
                            if (hygieneData.funda_almohada) {
                                const elapsed = getDaysElapsed(hygieneData.funda_almohada);
                                const limit = sharedRules.hygiene?.funda_almohada?.limits?.red || 4;
                                if (elapsed >= limit) { shouldNotify = true; title = '🧼 Funda de Almohada'; body = `Pasaron ${elapsed} días, recordá lavarla.`; }
                            }
                            break;
                        case 'alfombra_bano':
                            if (hygieneData.alfombra_bano) {
                                const elapsed = getDaysElapsed(hygieneData.alfombra_bano);
                                const limit = sharedRules.hygiene?.alfombra_bano?.limits?.red || 15;
                                if (elapsed >= limit) { shouldNotify = true; title = '🧼 Alfombra de Baño'; body = `Pasaron ${elapsed} días, recordá lavarla.`; }
                            }
                            break;
                        case 'cepillo_dientes':
                            if (hygieneData.cepillo_dientes) {
                                const val = hygieneData.cepillo_dientes;
                                const history = Array.isArray(val) ? val : [val];
                                if (history.length > 0) {
                                    const elapsed = getDaysElapsed(history[0]);
                                    const limit = sharedRules.hygiene?.cepillo_dientes?.limits?.red || 90;
                                    if (elapsed >= limit) { shouldNotify = true; title = '🪥 Cepillo de Dientes'; body = `Pasaron ${elapsed} días, recordá cambiarlo.`; }
                                }
                            }
                            break;
                        case 'dentista':
                            if (dentista.lastVisit) {
                                const elapsed = getDaysElapsed(dentista.lastVisit);
                                const limit = (dentista.frequencyMonths || 6) * 30;
                                if (elapsed >= limit) { shouldNotify = true; title = '🩺 Control Dentista'; body = `Pasaron ${elapsed} días, sugerimos realizar tu visita periódica.`; }
                            }
                            break;
                        case 'compu_limpieza_int':
                            if (hygieneData.compu_limpieza_int) {
                                const val = hygieneData.compu_limpieza_int;
                                const history = Array.isArray(val) ? val : [val];
                                if (history.length > 0) {
                                    const elapsed = getDaysElapsed(history[0]);
                                    const limit = sharedRules.hygiene?.compu_limpieza_int?.limits?.red || 180;
                                    if (elapsed >= limit) { shouldNotify = true; title = '💻 Computadora (Limpieza Int.)'; body = `Pasaron ${elapsed} días, recordá limpiar tu PC por dentro.`; }
                                }
                            }
                            break;
                        case 'compu_pasta_termica':
                            if (hygieneData.compu_pasta_termica) {
                                const val = hygieneData.compu_pasta_termica;
                                const history = Array.isArray(val) ? val : [val];
                                if (history.length > 0) {
                                    const elapsed = getDaysElapsed(history[0]);
                                    const limit = sharedRules.hygiene?.compu_pasta_termica?.limits?.red || 360;
                                    if (elapsed >= limit) { shouldNotify = true; title = '🧪 Computadora (Pasta Térmica)'; body = `Pasaron ${elapsed} días, recordá cambiar la pasta térmica de tu PC.`; }
                                }
                            }
                            break;
                        case 'botella_vidrio':
                            if (hygieneData.botella_vidrio) {
                                const val = hygieneData.botella_vidrio;
                                const history = Array.isArray(val) ? val : [val];
                                if (history.length > 0) {
                                    const elapsed = getDaysElapsed(history[0]);
                                    const limit = sharedRules.hygiene?.botella_vidrio?.limits?.red || 30;
                                    if (elapsed >= limit) {
                                        shouldNotify = true;
                                        title = '💧 Botella de Vidrio';
                                        body = `Pasaron ${elapsed} días, recordá lavar la botella.`;
                                    }
                                }
                            }
                            break;


                        // Cuidado Corporal
                        case 'pelo':
                            const peloHistory = groomingData.pelo || [];
                            if (peloHistory.length > 0) {
                                const elapsed = getDaysElapsed(peloHistory[0]);
                                const limit = sharedRules.grooming?.pelo?.limits?.red || 20;
                                if (elapsed >= limit) { shouldNotify = true; title = '💇 Corte de Pelo'; body = `Ya pasaron ${elapsed} días, te deberías cortar el pelo.`; }
                            }
                            break;
                        case 'barba':
                            const barbaHistory = groomingData.barba || [];
                            if (barbaHistory.length > 0) {
                                const elapsed = getDaysElapsed(barbaHistory[0]);
                                const limit = sharedRules.grooming?.barba?.limits?.red || 4;
                                if (elapsed >= limit) { shouldNotify = true; title = '🧔 Afeitado de Barba'; body = `Sugerencia de afeitado (pasaron ${elapsed} días).`; }
                            }
                            break;
                        case 'axilas':
                            const axilasHistory = groomingData.axilas || [];
                            if (axilasHistory.length > 0) {
                                const elapsed = getDaysElapsed(axilasHistory[0]);
                                const limit = sharedRules.grooming?.axilas?.limits?.red || 30;
                                if (elapsed >= limit) { shouldNotify = true; title = '🪒 Depilación Axilas'; body = `Tiempo de rebajar el vello (hace ${elapsed} días).`; }
                            }
                            break;
                        case 'hoja_gillette':
                            const gilletteHistory = groomingData.hoja_gillette || [];
                            if (gilletteHistory.length > 0) {
                                const elapsed = getDaysElapsed(gilletteHistory[0]);
                                const limit = sharedRules.grooming?.hoja_gillette?.limits?.red || 30;
                                if (elapsed >= limit) { shouldNotify = true; title = '🪒 Hoja Gillette'; body = `Sugerimos cambiar la hoja (pasaron ${elapsed} días).`; }
                            }
                            break;
                        case 'pecho_panza':
                            const ppHistory = groomingData.pecho_panza || [];
                            if (ppHistory.length > 0) {
                                const elapsed = getDaysElapsed(ppHistory[0]);
                                const limit = sharedRules.grooming?.pecho_panza?.limits?.red || 60;
                                if (elapsed >= limit) { shouldNotify = true; title = '✂️ Depilación: Pecho y Panza'; body = `Ya pasaron ${elapsed} días, recordá depilarte pecho y panza.`; }
                            }
                            break;
                        case 'brazos':
                            const brazosHistory = groomingData.brazos || [];
                            if (brazosHistory.length > 0) {
                                const elapsed = getDaysElapsed(brazosHistory[0]);
                                const limit = sharedRules.grooming?.brazos?.limits?.red || 180;
                                if (elapsed >= limit) { shouldNotify = true; title = '✂️ Depilación: Brazos'; body = `Ya pasaron ${elapsed} días, recordá depilarte los brazos.`; }
                            }
                            break;
                        case 'piernas':
                            const piernasHistory = groomingData.piernas || [];
                            if (piernasHistory.length > 0) {
                                const elapsed = getDaysElapsed(piernasHistory[0]);
                                const limit = sharedRules.grooming?.piernas?.limits?.red || 120;
                                if (elapsed >= limit) { shouldNotify = true; title = '✂️ Depilación: Piernas'; body = `Ya pasaron ${elapsed} días, recordá depilarte las piernas.`; }
                            }
                            break;
                        case 'intimas':
                            const intimasHistory = groomingData.intimas || [];
                            if (intimasHistory.length > 0) {
                                const elapsed = getDaysElapsed(intimasHistory[0]);
                                const limit = sharedRules.grooming?.intimas?.limits?.red || 30;
                                if (elapsed >= limit) { shouldNotify = true; title = '✂️ Depilación: Zonas Íntimas'; body = `Ya pasaron ${elapsed} días, recordá depilarte las zonas íntimas.`; }
                            }
                            break;
                        case 'unas_manos':
                            const unasManosHistory = groomingData.unas_manos || [];
                            if (unasManosHistory.length > 0) {
                                const elapsed = getDaysElapsed(unasManosHistory[0]);
                                const limit = sharedRules.grooming?.unas_manos?.limits?.red || 18;
                                if (elapsed >= limit) { shouldNotify = true; title = '💅 Cortar Uñas de Manos'; body = `Pasaron ${elapsed} días, recordá cortarte las uñas de las manos.`; }
                            }
                            break;
                        case 'unas_pies':
                            const unasPiesHistory = groomingData.unas_pies || [];
                            if (unasPiesHistory.length > 0) {
                                const elapsed = getDaysElapsed(unasPiesHistory[0]);
                                const limit = sharedRules.grooming?.unas_pies?.limits?.red || 50;
                                if (elapsed >= limit) { shouldNotify = true; title = '👣 Cortar Uñas de Pies'; body = `Pasaron ${elapsed} días, recordá cortarte las uñas de los pies.`; }
                            }
                            break;

                        // Lentes
                        case 'lenses_droplets':
                            if (data.systaneDate) {
                                const elapsed = getDaysElapsed(data.systaneDate);
                                const limit = sharedRules.lenses?.systane || 90;
                                if (elapsed >= limit) { shouldNotify = true; title = '👁️ Gotas de Ojos'; body = `Systane abierta hace ${elapsed} días, sugerimos cambiarla.`; }
                            }
                            break;
                        case 'lenses_case':
                            if (data.caseDate) {
                                const elapsed = getDaysElapsed(data.caseDate);
                                const limit = sharedRules.lenses?.case || 90;
                                if (elapsed >= limit) { shouldNotify = true; title = '👁️ Estuche de Lentes'; body = `Estuche en uso hace ${elapsed} días, sugerimos cambiarlo.`; }
                            }
                            break;
                        case 'lenses_solution':
                            if (data.solutionDate) {
                                const elapsed = getDaysElapsed(data.solutionDate);
                                const limit = sharedRules.lenses?.solution || 90;
                                if (elapsed >= limit) { shouldNotify = true; title = '👁️ Solución de Lentes'; body = `Solución abierta hace ${elapsed} días, sugerimos cambiarla.`; }
                            }
                            break;
                        case 'lenses_replace':
                            if (data.lensDate) {
                                const elapsed = getDaysElapsed(data.lensDate);
                                const limit = sharedRules.lenses?.lenses || 60;
                                if (elapsed >= limit) { shouldNotify = true; title = '👁️ Reemplazo de Lentes'; body = `Lentes en uso hace ${elapsed} días, sugerimos cambiarlos.`; }
                            }
                            break;
                        case 'glasses_cloth_wash':
                            if (data.clothWashDate) {
                                const elapsed = getDaysElapsed(data.clothWashDate);
                                const limit = sharedRules.lenses?.clothWash || 15;
                                if (elapsed >= limit) { shouldNotify = true; title = '👓 Lavado Paño Anteojos'; body = `Gamuza en uso hace ${elapsed} días, sugerimos lavarla.`; }
                            }
                            break;
                        case 'glasses_cloth_replace':
                            if (data.clothChangeDate) {
                                const elapsed = getDaysElapsed(data.clothChangeDate);
                                const limit = sharedRules.lenses?.clothChange || 270;
                                if (elapsed >= limit) { shouldNotify = true; title = '👓 Reemplazo Paño Anteojos'; body = `Gamuza en uso hace ${elapsed} días, sugerimos cambiarla.`; }
                            }
                            break;

                        // Vehículo
                        case 'vehicle_oil':
                            const lastOil = maintenanceLog.find(m => m.type === 'Aceite y Filtros');
                            if (lastOil) {
                                const limitKm = sharedRules.vehicle?.oil?.km || 10000;
                                const limitDays = sharedRules.vehicle?.oil?.days || 365;
                                const remainingKm = (lastOil.km + limitKm) - currentOdo;
                                const daysElapsed = getDaysElapsed(lastOil.date);
                                const remainingDays = limitDays - (daysElapsed || 0);
                                if (remainingKm <= 0 || remainingDays <= 0) { shouldNotify = true; title = '🚗 Aceite y Filtros'; body = 'Mantenimiento urgente de Aceite y Filtros sugerido.'; }
                            }
                            break;
                        case 'vehicle_align':
                            const lastAlign = maintenanceLog.find(m => m.type === 'Alineación & Balanceo');
                            if (lastAlign) {
                                const limitKm = sharedRules.vehicle?.align?.km || 10000;
                                const remainingKm = (lastAlign.km + limitKm) - currentOdo;
                                if (remainingKm <= 0) { shouldNotify = true; title = '🚗 Alineación & Balanceo'; body = 'Alineación & Balanceo vencido.'; }
                            }
                            break;
                        case 'vehicle_rot':
                            const lastRot = maintenanceLog.find(m => m.type === 'Rotación de Neumáticos');
                            if (lastRot) {
                                const limitKm = sharedRules.vehicle?.rot?.km || 10000;
                                const remainingKm = (lastRot.km + limitKm) - currentOdo;
                                if (remainingKm <= 0) { shouldNotify = true; title = '🚗 Rotación de Neumáticos'; body = 'Rotación de Neumáticos vencida.'; }
                            }
                            break;
                        case 'vehicle_replace':
                            const lastReplace = maintenanceLog.find(m => m.type === 'Reemplazo de Neumáticos');
                            if (lastReplace) {
                                const limitKm = sharedRules.vehicle?.replace?.km || 60000;
                                const remainingKm = (lastReplace.km + limitKm) - currentOdo;
                                if (remainingKm <= 0) { shouldNotify = true; title = '🚗 Reemplazo de Neumáticos'; body = 'Cambio de Neumáticos vencido.'; }
                            }
                            break;
                        case 'vehicle_issues_check':
                            const activeIssuesList = data.vehicle_issues || [];
                            const highCount = activeIssuesList.filter(i => i.urgency === 'alta' && !i.resolvedAt).length;
                            if (highCount > 0) {
                                const sample = activeIssuesList.find(i => i.urgency === 'alta' && !i.resolvedAt);
                                shouldNotify = true;
                                title = '🚗 Fallas del Auto';
                                body = `Tenés ${highCount} fallas urgentes pendientes (ej: ${sample.title}).`;
                            }
                            break;
                        case 'vehicle_docs_check':
                            const tracker = vehicleTrackerData;
                            const documentReminder = buildVehicleDocumentNotification(tracker, getDaysUntil);
                            if (documentReminder) {
                                shouldNotify = true;
                                title = documentReminder.title;
                                body = documentReminder.body;
                            }
                            break;
                        case 'vehicle_fluids_check':
                            const trk = vehicleTrackerData;
                            const maintenanceReminder = buildVehicleMaintenanceNotification(
                                trk,
                                sharedRules,
                                getDaysElapsed,
                                getDaysUntil
                            );
                            if (maintenanceReminder) {
                                shouldNotify = true;
                                title = maintenanceReminder.title;
                                body = maintenanceReminder.body;
                            }
                            break;

                        // Nutrición & Suplementos
                        case 'vitamina_d':
                            const vitDHistory = gymSupplements.vit_d_history || [];
                            if (vitDHistory.length > 0) {
                                const lastTakeStr = vitDHistory[0].date;
                                const lastParts = lastTakeStr.split('T')[0].split('-');
                                if (lastParts.length === 3) {
                                    const interval = gymSupplements.vit_d_days_interval || 30;
                                    const nextTakeDate = new Date(Date.UTC(parseInt(lastParts[0]), parseInt(lastParts[1]) - 1, parseInt(lastParts[2]) + interval));
                                    const nextTakeStr = nextTakeDate.toISOString().split('T')[0];
                                    const remainingDays = getDaysUntil(nextTakeStr);
                                    if (remainingDays !== null && remainingDays <= 0) {
                                        shouldNotify = true;
                                        title = '💊 Vitamina D';
                                        body = `Debes tomar tu suplemento ahora (${remainingDays === 0 ? 'hoy te toca' : 'vencido hace ' + Math.abs(remainingDays) + ' días'}).`;
                                    }
                                }
                            }
                            break;
                        case 'creatine':
                            shouldNotify = true;
                            title = '💪 Creatina';
                            body = '¡No te olvides de tomar la creatina de hoy!';
                            break;
                        case 'salmon':
                            shouldNotify = true;
                            title = '🐟 Salmón & Omega 3';
                            body = 'Recordá sacar el salmón para mañana lunes para comer Omega 3.';
                            break;
                        case 'neck':
                            shouldNotify = true;
                            title = '💪 Entrenamiento de Cuello';
                            body = 'Recordá entrenar el cuello hoy (1 vez por semana).';
                            break;
                        case 'weigh_in':
                            shouldNotify = true;
                            title = '⚖️ Control de Peso';
                            body = '¡Buen día! No te olvides de pesarte hoy antes de desayunar.';
                            break;
                        case 'laundry':
                            shouldNotify = true;
                            title = '🧺 Lavarropas';
                            body = '¡No te olvides de poner a lavar la ropa en el lavarropas hoy!';
                            break;

                        // Otros
                        case 'robot':
                            if (hygieneData.robot_cleaner && hygieneData.robot_cleaner.status === 'dirty') {
                                const markedAt = hygieneData.robot_cleaner.marked_dirty_at;
                                const elapsedHours = markedAt ? Math.floor((nowArg - new Date(markedAt)) / (3600 * 1000)) : 0;
                                shouldNotify = true;
                                title = '🤖 Robot Aspiradora';
                                body = `El robot lleva sucio ${elapsedHours}hs. Recordá lavarlo.`;
                            }
                            break;
                        case 'workana':
                            const sub = data.projectPulseSubscription;
                            if (sub && sub.startDate && sub.cycle) {
                                const start = new Date(sub.startDate + 'T12:00:00');
                                const expiry = new Date(start);
                                expiry.setMonth(expiry.getMonth() + parseInt(sub.cycle));
                                const diffDays = getDaysUntil(expiry.toISOString());
                                
                                if (diffDays <= 7 && diffDays > 2) {
                                    shouldNotify = true;
                                    title = '💳 Suscripción Workana';
                                    body = `Che, en ${diffDays} días tu suscripción va a vencer, acordate de renovarla o de hacer algo al respecto.`;
                                } else if (diffDays <= 2) {
                                    shouldNotify = true;
                                    title = '💳 Suscripción Workana';
                                    body = `${formatExpiryStatus('Tu suscripción de Workana', diffDays)} (${expiry.toLocaleDateString('es-AR')}).`;
                                }
                            }
                            break;
                        case 'projects_check':
                            const projectsData = typeof data.projectPulseData === 'string'
                                ? JSON.parse(data.projectPulseData || '[]')
                                : (data.projectPulseData || []);
                            
                            for (const p of projectsData) {
                                if (!p.isDelivered && !p.isArbitration) {
                                    const now = new Date();
                                    const deadline = new Date(p.deadline);
                                    const accepted = new Date(p.accepted);
                                    const remainingMs = deadline - now;
                                    const totalMs = deadline - accepted;
                                    
                                    if (totalMs > 0) {
                                        const remPct = (remainingMs / totalMs) * 100;
                                        let state = 'green';
                                        let stateLabel = '';
                                        if (remainingMs <= 0 || remPct <= 10) {
                                            state = 'red';
                                            stateLabel = 'CRÍTICO';
                                        } else if (remPct <= 30) {
                                            state = 'orange';
                                            stateLabel = 'NARANJA';
                                        } else if (remPct <= 50) {
                                            state = 'yellow';
                                            stateLabel = 'AMARILLO';
                                        }
                                        
                                        if (state !== 'green') {
                                            const logKey = `project_${p.id}_${state}`;
                                            if (
                                                forceAll
                                                || (
                                                    data.alerts_sent_log[logKey] !== candidate.dateStr
                                                    && !wasSentForDate(userId, logKey, candidate.dateStr)
                                                )
                                            ) {
                                                const projTitle = `💼 Proyecto: ${p.project}`;
                                                const daysRemaining = Math.max(0, Math.floor(remainingMs / 86400000));
                                                const projBody = `El proyecto de ${p.client} se encuentra en estado ${stateLabel}. Quedan ${daysRemaining} días.`;
                                                
                                                console.log(`[Alert Engine] Enviando push de proyecto '${projTitle}' a usuario ${userId}`);
                                                const payload = JSON.stringify({
                                                    title: projTitle,
                                                    body: projBody,
                                                    url: '/'
                                                });

                                                const result = await sendPushToSubscriptions({
                                                    userId,
                                                    subscriptions: userSubs,
                                                    payload,
                                                    context: `proyecto ${p.id}`,
                                                    delayMs: 250
                                                });

                                                if (!forceAll && result.successCount > 0) {
                                                    rememberSentForDate(userId, logKey, candidate.dateStr);
                                                    data.alerts_sent_log[logKey] = candidate.dateStr;
                                                    sentLogUpdates[logKey] = candidate.dateStr;
                                                    dataChanged = true;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            break;
                        case 'tareas_urgentes_check':
                            const tasksList = typeof data.tareas_list === 'string'
                                ? JSON.parse(data.tareas_list || '[]')
                                : (data.tareas_list || []);
                            
                            const pendingUrgentGeneral = tasksList.filter(t => !t.completed && t.urgency === 'urgente');

                            const projectsDataForTasks = typeof data.projectPulseData === 'string'
                                ? JSON.parse(data.projectPulseData || '[]')
                                : (data.projectPulseData || []);
                            
                            const pendingUrgentProjectTasks = [];
                            for (const p of projectsDataForTasks) {
                                if (p.tasks) {
                                    const pTasks = p.tasks.filter(t => !t.completed && t.urgency === 'urgente');
                                    pTasks.forEach(t => {
                                        pendingUrgentProjectTasks.push({
                                            client: p.client,
                                            project: p.project,
                                            text: t.text,
                                            id: t.id
                                        });
                                    });
                                }
                            }

                            // Función para limpiar y truncar texto largo sin romper el mensaje
                            const formatTaskBody = (rawText) => {
                                if (!rawText) return 'Sin descripción';
                                const clean = String(rawText).replace(/\s+/g, ' ').trim();
                                if (clean.length > 140) {
                                    return clean.substring(0, 137) + '...';
                                }
                                return clean;
                            };

                            const allUrgentItems = [];

                            // 1. Tareas Generales
                            pendingUrgentGeneral.forEach(t => {
                                const catTag = t.category ? ` (${t.category})` : '';
                                allUrgentItems.push({
                                    id: `gen_${t.id || Math.random()}`,
                                    title: `📌 Tarea Urgente${catTag}`,
                                    body: formatTaskBody(t.text)
                                });
                            });

                            // 2. Tareas de Proyectos (Freelance)
                            pendingUrgentProjectTasks.forEach(t => {
                                let projLabel = '';
                                if (t.client && t.project) {
                                    projLabel = ` (${t.client} - ${t.project})`;
                                } else if (t.client) {
                                    projLabel = ` (${t.client})`;
                                } else if (t.project) {
                                    projLabel = ` (${t.project})`;
                                } else {
                                    projLabel = ' (Proyecto)';
                                }

                                if (projLabel.length > 35) {
                                    projLabel = projLabel.substring(0, 32) + '...)';
                                }

                                allUrgentItems.push({
                                    id: `proj_task_${t.id || Math.random()}`,
                                    title: `📌 Tarea Urgente${projLabel}`,
                                    body: formatTaskBody(t.text)
                                });
                            });

                            if (allUrgentItems.length > 0) {
                                for (const item of allUrgentItems) {
                                    const itemLogKey = `tareas_urgentes_${item.id}`;
                                    if (
                                        forceAll
                                        || (
                                            data.alerts_sent_log[itemLogKey] !== candidate.dateStr
                                            && !wasSentForDate(userId, itemLogKey, candidate.dateStr)
                                        )
                                    ) {
                                        console.log(`[Alert Engine] Enviando push individual de tarea urgente '${item.title}' a usuario ${userId}`);
                                        const payload = JSON.stringify({
                                            title: item.title,
                                            body: item.body,
                                            url: '/'
                                        });

                                        const result = await sendPushToSubscriptions({
                                            userId,
                                            subscriptions: userSubs,
                                            payload,
                                            context: `tarea urgente ${item.id}`,
                                            delayMs: 250
                                        });

                                        if (!forceAll && result.successCount > 0) {
                                            rememberSentForDate(userId, itemLogKey, candidate.dateStr);
                                            data.alerts_sent_log[itemLogKey] = candidate.dateStr;
                                            sentLogUpdates[itemLogKey] = candidate.dateStr;
                                            dataChanged = true;
                                        }
                                    }
                                }
                            }
                            break;
                        }
                    }

                    if (shouldNotify && title && body) {
                        console.log(`[Alert Engine] Enviando push de '${title}' a usuario ${userId}`);
                        const payload = JSON.stringify({
                            title: title,
                            body: body,
                            url: '/'
                        });

                        const result = await sendPushToSubscriptions({
                            userId,
                            subscriptions: userSubs,
                            payload,
                            context: key,
                            delayMs: 250
                        });

                        if (!forceAll && result.successCount > 0) {
                            rememberSentForDate(userId, key, candidate.dateStr);
                            data.alerts_sent_log[key] = candidate.dateStr;
                            sentLogUpdates[key] = candidate.dateStr;
                            dataChanged = true;
                        }
                    }

                    // Detener la evaluación de otros candidatos para esta alerta una vez procesada
                    break;
                }
            }

            // Persistir solo el log interno del servidor para no pisar cambios del usuario.
            if (dataChanged && !forceAll) {
                try {
                    await mergeServerUserDataKeys(userId, {
                        alerts_sent_log: sentLogUpdates
                    });
                } catch (updateError) {
                    console.error(`[Alert Engine] No se pudo guardar el estado de alertas para usuario ${userId}:`, updateError.message);
                }
            }
        }
    } catch (err) {
        console.error("Error al ejecutar el motor de alertas unificadas:", err);
        throw err;
    }
}

function getDaysElapsed(dateString) {
    if (!dateString) return null;
    const { dateStr } = getArgentinaTime();
    
    const startParts = dateString.split('T')[0].split('-');
    if (startParts.length !== 3) return null;
    const startUTC = new Date(Date.UTC(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2])));
    
    const todayParts = dateStr.split('-');
    const todayUTC = new Date(Date.UTC(parseInt(todayParts[0]), parseInt(todayParts[1]) - 1, parseInt(todayParts[2])));
    
    const diffTime = todayUTC - startUTC;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getDaysUntil(dateString) {
    if (!dateString) return null;
    const { dateStr } = getArgentinaTime();
    
    const targetParts = dateString.split('T')[0].split('-');
    if (targetParts.length !== 3) return null;
    const targetUTC = new Date(Date.UTC(parseInt(targetParts[0]), parseInt(targetParts[1]) - 1, parseInt(targetParts[2])));
    
    const todayParts = dateStr.split('-');
    const todayUTC = new Date(Date.UTC(parseInt(todayParts[0]), parseInt(todayParts[1]) - 1, parseInt(todayParts[2])));
    
    const diffTime = targetUTC - todayUTC;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ==========================================================================
// Recordatorios del Robot Aspiradora (cada 6 horas)
// ==========================================================================
async function checkAndSendRobotReminders(forceAll = false) {
    if (!supabase) {
        throw new Error('Supabase no está disponible para el motor de alertas repetitivas.');
    }
    
    try {
        const { data: usersData, error: dbError } = await supabase.from('user_data').select('*');
        const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*');
        
        if (dbError) throw dbError;
        if (subError) throw subError;
        
        console.log(`[Robot Reminder Engine] Tick: checking robot status. Subscriptions found: ${subs ? subs.length : 0}`);
        
        if (!usersData || usersData.length === 0) return;
        if (!subs || subs.length === 0) return;
        
        const subsByUser = groupSubscriptionsByUser(subs);
        
        const now = new Date();
        
        for (const userRow of usersData) {
            const userId = userRow.user_id;
            const data = userRow.data || {};
            
            const hygieneData = parseJsonValue(data.hygiene_tracker_data, {});
            const alertsConfig = parseJsonValue(data.alerts_config, {});
            
            const robot = hygieneData.robot_cleaner;
            const isRobotEnabled = alertsConfig.robot?.enabled !== false;
            if (isRobotEnabled && robot && robot.status === 'dirty') {
                const intervalHours = normalizeIntervalHours(alertsConfig.robot?.interval_hours, 6);

                const markedDirtyAt = new Date(robot.marked_dirty_at);
                if (!Number.isFinite(markedDirtyAt.getTime())) {
                    console.warn(`[Robot Reminder] Se ignoró un ciclo inválido para usuario ${userId}.`);
                } else {
                    const timeToCheck = getLatestValidDate([
                        markedDirtyAt,
                        robot.last_notified_at,
                        data.robot_last_notified_at,
                        getLastIntervalDelivery(userId, 'robot')
                    ]) || markedDirtyAt;
                    
                    if (isIntervalReminderDue({
                        now,
                        lastNotifiedAt: timeToCheck,
                        intervalHours,
                        force: forceAll
                    })) {
                        const elapsedHours = Math.floor((now - markedDirtyAt) / (3600 * 1000));
                        console.log(`[Robot Reminder] Enviando alerta a usuario ${userId} (sucio desde hace ${elapsedHours} hs, intervalo ${intervalHours}hs)`);

                        const userSubs = subsByUser[userId] || [];
                        if (userSubs.length > 0) {
                            const payload = JSON.stringify({
                                title: '🤖 Robot Aspiradora',
                                body: `El robot lleva sucio ${elapsedHours}hs. Recordá lavarlo.`,
                                url: '/'
                            });

                            const result = await sendPushToSubscriptions({
                                userId,
                                subscriptions: userSubs,
                                payload,
                                context: 'robot aspiradora',
                                delayMs: 250
                            });

                            if (!forceAll && result.successCount > 0) {
                                rememberIntervalDelivery(userId, 'robot', now.toISOString());
                                try {
                                    await mergeServerUserDataKeys(userId, {
                                        robot_last_notified_at: now.toISOString()
                                    });
                                } catch (updateErr) {
                                    console.error(`[Robot Reminder] Error al actualizar base de datos para usuario ${userId}:`, updateErr);
                                }
                            }
                        }
                    }
                }
            }

            // 2. Chequear tareas MUY URGENTES (repetitivas e infinitas hasta completarse)
            const veryUrgentConf = alertsConfig.very_urgent_tasks;
            const isVeryUrgentEnabled = veryUrgentConf?.enabled !== false;
            if (isVeryUrgentEnabled) {
                const intervalHours = normalizeIntervalHours(veryUrgentConf?.interval_hours, 4);
                const pendingVeryUrgent = getPendingVeryUrgentTasks(data);
                
                if (pendingVeryUrgent.length > 0) {
                    const lastVeryUrgentDelivery = getLatestValidDate([
                        data.very_urgent_last_notified_at,
                        getLastIntervalDelivery(userId, 'very_urgent_tasks')
                    ]);
                    if (isIntervalReminderDue({
                        now,
                        lastNotifiedAt: lastVeryUrgentDelivery,
                        intervalHours,
                        force: forceAll
                    })) {
                        const userSubs = subsByUser[userId] || [];
                        if (userSubs.length > 0) {
                            const taskNames = pendingVeryUrgent.slice(0, 2).map(t => t.text).join(', ');
                            const countText = pendingVeryUrgent.length > 2 ? ` (+${pendingVeryUrgent.length - 2} más)` : '';
                            const payload = JSON.stringify({
                                title: `🔥 ${pendingVeryUrgent.length} Tarea(s) Muy Urgente(s)`,
                                body: `${taskNames}${countText}. Recordá realizarla(s).`,
                                url: '/'
                            });

                            const result = await sendPushToSubscriptions({
                                userId,
                                subscriptions: userSubs,
                                payload,
                                context: 'tareas muy urgentes',
                                delayMs: 250
                            });

                            if (!forceAll && result.successCount > 0) {
                                rememberIntervalDelivery(
                                    userId,
                                    'very_urgent_tasks',
                                    now.toISOString()
                                );
                                try {
                                    await mergeServerUserDataKeys(userId, {
                                        very_urgent_last_notified_at: now.toISOString()
                                    });
                                } catch (updateError) {
                                    console.error(`[Very Urgent] No se pudo guardar el último envío para usuario ${userId}:`, updateError.message);
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch(err) {
        console.error("Error en checkAndSendRobotReminders:", err);
        throw err;
    }
}

module.exports = {
    app,
    getLastIntervalDelivery,
    httpServer,
    notificationRuntimeState,
    rememberIntervalDelivery,
    rememberSentForDate,
    wasSentForDate,
    runScheduledAlertChecks
};
