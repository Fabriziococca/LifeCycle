require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const sharedRules = require('./shared_rules.json');

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
const PORT = process.env.PORT || 3000;

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

// Rate Limiter integrado y liviano (sin dependencias npm)
const ipCounts = {};
setInterval(() => {
    // Resetear contadores de IP cada 15 minutos para evitar fugas de memoria
    for (const ip in ipCounts) {
        delete ipCounts[ip];
    }
}, 15 * 60 * 1000);

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
app.use(express.json());
app.use('/api/', rateLimiter);
app.use(express.static(__dirname, {
    maxAge: '7d', // Cache static assets for 7 days by default
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.includes('sw.js') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            // HTML, JS, CSS files and Service Worker must not be cached strongly to guarantee updates
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

// Endpoint para recibir suscripciones push (se guardan directamente en Supabase, pero este endpoint sirve por si acaso)
app.post('/api/subscribe', async (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) return res.status(400).json({ error: 'Datos incompletos' });
    if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor' });

    try {
        const { error } = await supabase.from('push_subscriptions').upsert({
            user_id: userId,
            subscription: subscription
        });
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error("Error saving subscription:", e);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint para probar notificaciones push de inmediato (5 segundos de delay)
app.post('/api/test-push', (req, res) => {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Falta la suscripción' });

    setTimeout(async () => {
        try {
            await webpush.sendNotification(subscription, JSON.stringify({
                title: '🔔 LifeCycle Test',
                body: '¡Excelente! Las notificaciones push en segundo plano están funcionando correctamente.',
                url: '/'
            }));
            console.log("Test push sent successfully.");
        } catch (err) {
            console.error("Error sending test push:", err);
        }
    }, 5000);

    res.json({ success: true, message: 'Notificación de prueba programada para dentro de 5 segundos.' });
});

// Middleware de autenticación para endpoints administrativos
const checkAdminToken = (req, res, next) => {
    const token = req.query.token;
    const secret = process.env.ADMIN_TOKEN || 'fallback-dev-token';
    if (!token || token !== secret) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.warn(`[Security] Intento de acceso no autorizado a endpoint administrativo desde IP: ${ip}`);
        return res.status(401).json({ error: 'No autorizado. Se requiere un token válido.' });
    }
    next();
};

// Endpoint manual para disparar la revisión de recordatorios
app.get('/api/check-reminders', checkAdminToken, async (req, res) => {
    await checkAndSendAllAlerts(true);
    res.json({ success: true, message: 'Revisión de recordatorios ejecutada (forzada para pruebas).' });
});

app.get('/api/admin/logs', checkAdminToken, (req, res) => {
    res.type('text/plain').send(logBuffer.join('\n'));
});

// Endpoint manual de prueba para disparar alerta de robot inmediatamente si está sucio
app.get('/api/test-robot-reminder', checkAdminToken, async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase no configurado' });
    
    try {
        const { data: usersData } = await supabase.from('user_data').select('*');
        const { data: subs } = await supabase.from('push_subscriptions').select('*');
        
        if (!usersData || usersData.length === 0) return res.json({ success: true, message: 'No hay usuarios' });
        if (!subs || subs.length === 0) return res.json({ success: true, message: 'No hay suscripciones' });
        
        const subsByUser = {};
        subs.forEach(s => {
            if (!subsByUser[s.user_id]) subsByUser[s.user_id] = [];
            subsByUser[s.user_id].push(s.subscription);
        });
        
        let sentCount = 0;
        for (const userRow of usersData) {
            const data = userRow.data || {};
            let hygieneData = {};
            if (data.hygiene_tracker_data) {
                try { hygieneData = JSON.parse(data.hygiene_tracker_data); } catch(e) { continue; }
            }
            
            const robot = hygieneData.robot_cleaner;
            if (robot && robot.status === 'dirty') {
                const userSubs = subsByUser[userRow.user_id] || [];
                const payload = JSON.stringify({
                    title: '🤖 Robot Aspiradora (Prueba)',
                    body: 'El robot sigue sucio. ¡Acordate de lavarlo! (Forzado desde test)',
                    url: '/'
                });
                for (const sub of userSubs) {
                    try {
                        await webpush.sendNotification(sub, payload);
                        sentCount++;
                    } catch (err) {}
                }
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
app.listen(PORT, () => {
    console.log(`LifeCycle backend running on port ${PORT}`);
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
    
    const hour = parseInt(t.hour, 10);
    const minutes = parseInt(t.minute, 10);
    const dateStr = `${t.year}-${t.month}-${t.day}`;
    
    const utcDate = new Date(Date.UTC(
        parseInt(t.year, 10),
        parseInt(t.month, 10) - 1,
        parseInt(t.day, 10)
    ));
    const dayOfWeek = utcDate.getUTCDay();
    
    return { hour, minutes, dayOfWeek, dateStr };
}

// ==========================================================================
// Tarea Programada: Chequeo Diario a las 23:00 Argentina Time (UTC-3)
// ==========================================================================
let lastNotifiedDate = '';

setInterval(() => {
    // Chequear alertas del robot aspiradora cada 5 minutos
    checkAndSendRobotReminders();

    // Chequear todas las alertas unificadas y dinámicas cada 5 minutos
    checkAndSendAllAlerts();
}, 5 * 60 * 1000); 

// ==========================================================================
// Motor Unificado y Dinámico de Alertas (Gestor de Alertas)
// ==========================================================================
async function checkAndSendAllAlerts(forceAll = false) {
    if (!supabase) return;
    try {
        const { hour, minutes, dayOfWeek, dateStr } = getArgentinaTime();

        const { data: usersData, error: dbError } = await supabase.from('user_data').select('*');
        const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*');

        if (dbError) throw dbError;
        if (subError) throw subError;

        console.log(`[Alert Engine] Tick: checking alerts (forceAll: ${forceAll}). Time in Argentina: ${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}, Day: ${dayOfWeek}, Date: ${dateStr}. Subscriptions found: ${subs ? subs.length : 0}`);

        if (!usersData || usersData.length === 0) return;
        if (!subs || subs.length === 0) return;

        // Agrupar suscripciones por user_id (evitando endpoints duplicados)
        const subsByUser = {};
        subs.forEach(s => {
            if (!s.subscription || !s.subscription.endpoint) return;
            if (!subsByUser[s.user_id]) subsByUser[s.user_id] = [];
            
            const alreadyAdded = subsByUser[s.user_id].some(existing => existing.endpoint === s.subscription.endpoint);
            if (!alreadyAdded) {
                subsByUser[s.user_id].push(s.subscription);
            }
        });

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

            let configFilled = false;

            // Migrar automáticamente si no existe alerts_config o está vacío
            if (Object.keys(alertsConfig).length === 0) {
                let gymSupplements = {};
                if (data.gym_supplements) {
                    try { gymSupplements = typeof data.gym_supplements === 'string' ? JSON.parse(data.gym_supplements) : data.gym_supplements; } catch(e) {}
                }
                const oldReminders = gymSupplements.custom_reminders || {};
                
                // Valores iniciales y migrados
                const defaultTimes = {
                    creatine: { enabled: oldReminders.creatine?.enabled ?? true, time: oldReminders.creatine?.time || '23:00', days: oldReminders.creatine?.days || [1,2,3,4,5,6,0] },
                    salmon: { enabled: oldReminders.salmon?.enabled ?? true, time: oldReminders.salmon?.time || '17:00', days: oldReminders.salmon?.days || [0] },
                    neck: { enabled: oldReminders.neck?.enabled ?? true, time: oldReminders.neck?.time || '23:30', days: oldReminders.neck?.days || [5,6] }
                };

                const definitions = [
                    'esponja_africana', 'toalla_mano', 'toalla_cuerpo', 'sabanas', 'funda_almohada', 'alfombra_bano',
                    'cepillo_dientes', 'dentista', 'pelo', 'barba', 'axilas', 'hoja_gillette', 'lenses_droplets', 'lenses_case',
                    'lenses_solution', 'lenses_replace', 'glasses_cloth_wash', 'glasses_cloth_replace', 'vehicle_oil',
                    'vehicle_align', 'vehicle_rot', 'vehicle_replace', 'vitamina_d', 'robot', 'workana',
                    'pecho_panza', 'brazos', 'piernas', 'intimas', 'projects_check',
                    'vehicle_issues_check', 'vehicle_docs_check', 'vehicle_fluids_check', 'tareas_urgentes_check'
                ];

                definitions.forEach(k => {
                    if (k === 'projects_check' || k === 'vehicle_issues_check' || k === 'vehicle_docs_check' || k === 'vehicle_fluids_check' || k === 'tareas_urgentes_check') {
                        alertsConfig[k] = { enabled: true, time: '09:00', days: [] };
                    } else {
                        alertsConfig[k] = { enabled: true, time: '23:00', days: [] };
                    }
                });
                Object.keys(defaultTimes).forEach(k => {
                    alertsConfig[k] = defaultTimes[k];
                });
                configFilled = true;
            } else {
                // Rellenar dinámicamente llaves faltantes (como hoja_gillette)
                const definitions = [
                    'esponja_africana', 'toalla_mano', 'toalla_cuerpo', 'sabanas', 'funda_almohada', 'alfombra_bano',
                    'cepillo_dientes', 'dentista', 'pelo', 'barba', 'axilas', 'hoja_gillette', 'lenses_droplets', 'lenses_case',
                    'lenses_solution', 'lenses_replace', 'glasses_cloth_wash', 'glasses_cloth_replace', 'vehicle_oil',
                    'vehicle_align', 'vehicle_rot', 'vehicle_replace', 'vitamina_d', 'robot', 'workana',
                    'creatine', 'salmon', 'neck', 'pecho_panza', 'brazos', 'piernas', 'intimas', 'projects_check',
                    'vehicle_issues_check', 'vehicle_docs_check', 'vehicle_fluids_check', 'tareas_urgentes_check'
                ];
                definitions.forEach(k => {
                    if (!alertsConfig[k]) {
                        if (k === 'creatine') alertsConfig[k] = { enabled: true, time: '23:00', days: [1,2,3,4,5,6,0] };
                        else if (k === 'salmon') alertsConfig[k] = { enabled: true, time: '17:00', days: [0] };
                        else if (k === 'neck') alertsConfig[k] = { enabled: true, time: '23:30', days: [5,6] };
                        else if (k === 'projects_check' || k === 'vehicle_issues_check' || k === 'vehicle_docs_check' || k === 'vehicle_fluids_check' || k === 'tareas_urgentes_check') {
                            alertsConfig[k] = { enabled: true, time: '09:00', days: [] };
                        } else {
                            alertsConfig[k] = { enabled: true, time: '23:00', days: [] };
                        }
                        configFilled = true;
                    }
                });
                if (configFilled) {
                    data.alerts_config = alertsConfig;
                }
            }

            // Inicializar log de envíos diarios si no existe
            if (!data.alerts_sent_log) {
                data.alerts_sent_log = {};
            }

            let dataChanged = configFilled;

            // Procesar cada alerta definida
            for (const key of Object.keys(alertsConfig)) {
                const conf = alertsConfig[key];
                if (!conf || !conf.enabled) continue;

                // Verificar coincidencia de horario (si es igual o posterior en el día de hoy)
                const [remHour, remMin] = (conf.time || '23:00').split(':').map(Number);
                const currentMinutes = hour * 60 + minutes;
                const scheduledMinutes = remHour * 60 + remMin;
                const isTimeMatch = currentMinutes >= scheduledMinutes;

                if (forceAll || isTimeMatch) {
                    // Verificar si ya fue enviada hoy para evitar spam en el mismo día
                    if (!forceAll && data.alerts_sent_log[key] === dateStr) continue;

                    // Si es una alerta periódica/recurrente, verificar día de la semana
                    const isRecurring = ['creatine', 'salmon', 'neck'].includes(key);
                    if (isRecurring && !forceAll && (!conf.days || !conf.days.includes(dayOfWeek))) continue;

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
                    const currentOdo = Number(data.vehicle_odometer) || 0;
                    const gymSupplements = parseJSONField(data.gym_supplements, {});

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
                            const tracker = data.vehicle_tracker_data || {};
                            if (tracker.dniExpDate) {
                                const dniDays = getDaysUntil(tracker.dniExpDate);
                                if (dniDays !== null && dniDays <= 30 && dniDays > 0) {
                                    shouldNotify = true;
                                    title = '📄 Vencimiento DNI';
                                    body = `Tu DNI vence en ${dniDays} días (${tracker.dniExpDate}).`;
                                }
                            }
                            if (tracker.licenseExpDate) {
                                const licDays = getDaysUntil(tracker.licenseExpDate);
                                if (licDays !== null && licDays <= 30 && licDays > 0) {
                                    shouldNotify = true;
                                    title = '🚗 Vencimiento Registro';
                                    body = `Tu registro de conducir vence en ${licDays} días (${tracker.licenseExpDate}).`;
                                }
                            }
                            if (tracker.insuranceExpDate) {
                                const insDays = getDaysUntil(tracker.insuranceExpDate);
                                if (insDays !== null && insDays <= 7 && insDays > 0) {
                                    shouldNotify = true;
                                    title = '🚗 Vencimiento Seguro';
                                    body = `Tu seguro debe renovarse en ${insDays} días (${tracker.insuranceExpDate}).`;
                                }
                            }
                            if (tracker.vtvExpDate) {
                                const vtvDays = getDaysUntil(tracker.vtvExpDate);
                                if (vtvDays !== null && vtvDays <= 30 && vtvDays > 0) {
                                    shouldNotify = true;
                                    title = '🚗 Vencimiento VTV';
                                    body = `Tu VTV vence en ${vtvDays} días (${tracker.vtvExpDate}).`;
                                }
                            }
                            break;
                        case 'vehicle_fluids_check':
                            const trk = data.vehicle_tracker_data || {};
                            if (trk.refrigeranteDate) {
                                const limitDays = sharedRules.vehicle?.fluids?.refrigerante?.days || 90;
                                const refElapsed = getDaysElapsed(trk.refrigeranteDate);
                                if (refElapsed !== null && refElapsed >= limitDays) {
                                    shouldNotify = true;
                                    title = '🚗 Mantenimiento: Refrigerante';
                                    body = `Pasaron ${refElapsed} días desde la última revisión de refrigerante.`;
                                }
                            }
                            if (trk.sapitoDate) {
                                const limitDays = sharedRules.vehicle?.fluids?.sapito?.days || 45;
                                const sapElapsed = getDaysElapsed(trk.sapitoDate);
                                if (sapElapsed !== null && sapElapsed >= limitDays) {
                                    shouldNotify = true;
                                    title = '🚗 Mantenimiento: Sapito';
                                    body = `Pasaron ${sapElapsed} días desde la última revisión del limpiavidrios.`;
                                }
                            }
                            if (trk.extintorDate) {
                                const limitDays = sharedRules.vehicle?.fluids?.extintor?.days_until_expiry || 30;
                                const extDays = getDaysUntil(trk.extintorDate);
                                if (extDays !== null && extDays <= limitDays && extDays > 0) {
                                    shouldNotify = true;
                                    title = '🧯 Mantenimiento: Extintor';
                                    body = `El extintor vence en ${extDays} días (${trk.extintorDate}).`;
                                }
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

                        // Otros
                        case 'workana':
                            const sub = data.projectPulseSubscription;
                            if (sub && sub.startDate && sub.cycle) {
                                const start = new Date(sub.startDate + 'T12:00:00');
                                const expiry = new Date(start);
                                expiry.setMonth(expiry.getMonth() + parseInt(sub.cycle));
                                
                                const today = new Date();
                                today.setHours(0,0,0,0);
                                const expiryDay = new Date(expiry);
                                expiryDay.setHours(0,0,0,0);
                                const diffTime = expiryDay - today;
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                
                                if (diffDays <= 7 && diffDays > 2) {
                                    shouldNotify = true;
                                    title = '💳 Suscripción Workana';
                                    body = `Che, en ${diffDays} días tu suscripción va a vencer, acordate de renovarla o de hacer algo al respecto.`;
                                } else if (diffDays <= 2) {
                                    shouldNotify = true;
                                    title = '💳 Suscripción Workana';
                                    body = `Vencimiento crítico en ${diffDays} días (${expiry.toLocaleDateString('es-AR')}).`;
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
                                            if (forceAll || data.alerts_sent_log[logKey] !== dateStr) {
                                                const projTitle = `💼 Proyecto: ${p.project}`;
                                                const daysRemaining = Math.max(0, Math.floor(remainingMs / 86400000));
                                                const projBody = `El proyecto de ${p.client} se encuentra en estado ${stateLabel}. Quedan ${daysRemaining} días.`;
                                                
                                                console.log(`[Alert Engine] Enviando push de proyecto '${projTitle}' a usuario ${userId}`);
                                                const payload = JSON.stringify({
                                                    title: projTitle,
                                                    body: projBody,
                                                    url: '/'
                                                });
                                                
                                                for (const sub of userSubs) {
                                                    try {
                                                        await webpush.sendNotification(sub, payload);
                                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                                    } catch (err) {
                                                        console.error(`[Alert Engine] Falló enviar push de proyecto:`, err.message);
                                                    }
                                                }
                                                
                                                if (!forceAll) {
                                                    data.alerts_sent_log[logKey] = dateStr;
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
                                if (p.tasks && !p.isDelivered) {
                                    const pTasks = p.tasks.filter(t => !t.completed && t.urgency === 'urgente');
                                    pTasks.forEach(t => {
                                        pendingUrgentProjectTasks.push({ client: p.client, text: t.text });
                                    });
                                }
                            }

                            const totalUrgent = pendingUrgentGeneral.length + pendingUrgentProjectTasks.length;
                            if (totalUrgent > 0) {
                                shouldNotify = true;
                                title = '📌 Tareas Urgentes Pendientes';
                                if (pendingUrgentGeneral.length > 0 && pendingUrgentProjectTasks.length > 0) {
                                    body = `Tenés ${pendingUrgentGeneral.length} generales y ${pendingUrgentProjectTasks.length} de proyectos sin completar.`;
                                } else if (pendingUrgentGeneral.length > 0) {
                                    body = `Tenés ${pendingUrgentGeneral.length} tareas generales urgentes sin completar.`;
                                } else {
                                    body = `Tenés ${pendingUrgentProjectTasks.length} tareas urgentes de proyectos sin completar.`;
                                }
                            }
                            break;
                    }

                    if (shouldNotify && title && body) {
                        console.log(`[Alert Engine] Enviando push de '${title}' a usuario ${userId}`);
                        const payload = JSON.stringify({
                            title: title,
                            body: body,
                            url: '/'
                        });

                        for (const sub of userSubs) {
                            try {
                                await webpush.sendNotification(sub, payload);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // Evitar saturación de Google FCM y espaciar entrega
                            } catch (err) {
                                console.error(`[Alert Engine] Falló enviar push de ${key}:`, err.message);
                            }
                        }

                        if (!forceAll) {
                            data.alerts_sent_log[key] = dateStr;
                            dataChanged = true;
                        }
                    }
                }
            }

            // Guardar si hubo cambios y no es forzado
            let shouldSaveConfig = false;
            if (!data.alerts_config) {
                data.alerts_config = JSON.stringify(alertsConfig);
                shouldSaveConfig = true;
            }

            if ((dataChanged || shouldSaveConfig) && !forceAll) {
                await supabase
                    .from('user_data')
                    .update({ data: data })
                    .eq('user_id', userId);
            }
        }
    } catch (err) {
        console.error("Error al ejecutar el motor de alertas unificadas:", err);
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
async function checkAndSendRobotReminders() {
    if (!supabase) return;
    
    try {
        const { data: usersData, error: dbError } = await supabase.from('user_data').select('*');
        const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*');
        
        if (dbError) throw dbError;
        if (subError) throw subError;
        
        console.log(`[Robot Reminder Engine] Tick: checking robot status. Subscriptions found: ${subs ? subs.length : 0}`);
        
        if (!usersData || usersData.length === 0) return;
        if (!subs || subs.length === 0) return;
        
        // Agrupar suscripciones por user_id (evitando endpoints duplicados)
        const subsByUser = {};
        subs.forEach(s => {
            if (!s.subscription || !s.subscription.endpoint) return;
            if (!subsByUser[s.user_id]) subsByUser[s.user_id] = [];
            
            const alreadyAdded = subsByUser[s.user_id].some(existing => existing.endpoint === s.subscription.endpoint);
            if (!alreadyAdded) {
                subsByUser[s.user_id].push(s.subscription);
            }
        });
        
        const now = new Date();
        
        for (const userRow of usersData) {
            const userId = userRow.user_id;
            const data = userRow.data || {};
            
            let hygieneData = {};
            if (data.hygiene_tracker_data) {
                try {
                    hygieneData = JSON.parse(data.hygiene_tracker_data);
                } catch(e) {
                    continue;
                }
            }
            
            const robot = hygieneData.robot_cleaner;
            if (robot && robot.status === 'dirty') {
                const markedDirtyAt = new Date(robot.marked_dirty_at);
                const lastNotifiedAt = robot.last_notified_at ? new Date(robot.last_notified_at) : null;
                
                const timeToCheck = lastNotifiedAt || markedDirtyAt;
                const diffMs = now - timeToCheck;
                const sixHoursMs = 6 * 60 * 60 * 1000;
                
                if (diffMs >= sixHoursMs) {
                    console.log(`[Robot Reminder] Enviando alerta a usuario ${userId} (sucio desde hace ${Math.floor((now - markedDirtyAt) / 60000)} minutos)`);
                    
                    const userSubs = subsByUser[userId] || [];
                    if (userSubs.length === 0) continue;
                    
                    const payload = JSON.stringify({
                        title: '🤖 Robot Aspiradora',
                        body: 'El robot sigue sucio. ¡Acordate de lavarlo!',
                        url: '/'
                    });
                    
                    for (const sub of userSubs) {
                        try {
                            await webpush.sendNotification(sub, payload);
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Evitar saturación de Google FCM y espaciar entrega
                        } catch (err) {
                            console.error(`[Robot Reminder] Falló enviar push a suscripción:`, err.message);
                        }
                    }
                    
                    // Actualizar last_notified_at
                    robot.last_notified_at = now.toISOString();
                    data.hygiene_tracker_data = JSON.stringify(hygieneData);
                    
                    // Guardar de vuelta en Supabase
                    const { error: updateErr } = await supabase
                        .from('user_data')
                        .update({ data: data })
                        .eq('user_id', userId);
                        
                    if (updateErr) {
                        console.error(`[Robot Reminder] Error al actualizar base de datos para usuario ${userId}:`, updateErr);
                    }
                }
            }
        }
    } catch(err) {
        console.error("Error en checkAndSendRobotReminders:", err);
    }
}

