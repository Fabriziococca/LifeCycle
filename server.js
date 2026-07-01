require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

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
        console.log("Generating new VAPID keys...");
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
app.use(express.static(__dirname));

// Config endpoint to secure credentials and send VAPID key
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
        vapidPublicKey: publicKey
    });
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
    await checkAndSendDailyReminders();
    res.json({ success: true, message: 'Revisión de recordatorios ejecutada.' });
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
// Tarea Programada: Chequeo Diario a las 23:00 Argentina Time (UTC-3)
// ==========================================================================
let lastNotifiedDate = '';

setInterval(() => {
    const now = new Date();
    // Convertir la hora a la zona horaria de Argentina (Buenos Aires)
    const argTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const hour = argTime.getHours();
    const dateStr = argTime.toISOString().split('T')[0];

    // Chequeo diario a las 23:00 (Higiene, Lentes, Cuidado Corporal)
    if (hour === 23 && lastNotifiedDate !== dateStr) {
        lastNotifiedDate = dateStr;
        console.log(`[Reminders] Iniciando chequeo de alertas diarias para la fecha ${dateStr} a las 23:00 hora de Argentina`);
        checkAndSendDailyReminders();
    }

    // Chequear alertas del robot aspiradora cada 5 minutos
    checkAndSendRobotReminders();

    // Chequear recordatorios personalizados dinámicos cada 5 minutos
    checkAndSendCustomReminders();
}, 5 * 60 * 1000); // Chequea cada 5 minutos

// ==========================================================================
// Función de Análisis de Datos y Envío de Alertas
// ==========================================================================
async function checkAndSendDailyReminders() {
    if (!supabase) return;
    
    try {
        console.log("[Reminders] Consultando datos de Supabase...");
        const { data: usersData, error: dbError } = await supabase.from('user_data').select('*');
        const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*');

        if (dbError) throw dbError;
        if (subError) throw subError;

        if (!usersData || usersData.length === 0) return;
        if (!subs || subs.length === 0) return;

        // Agrupar suscripciones por user_id
        const subsByUser = {};
        subs.forEach(s => {
            if (!subsByUser[s.user_id]) subsByUser[s.user_id] = [];
            subsByUser[s.user_id].push(s.subscription);
        });

        for (const userRow of usersData) {
            const userId = userRow.user_id;
            const userSubscriptions = subsByUser[userId];
            if (!userSubscriptions || userSubscriptions.length === 0) continue;

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

            const alerts = [];

            // 1. HIGIENE
            const hygieneData = data.hygiene_tracker_data || {};
            const itemsConfig = [
                { id: 'esponja_africana', name: 'Esponja Africana', limit: 30, type: 'wash' },
                { id: 'toalla_mano', name: 'Toalla de Mano', limit: 4, type: 'wash' },
                { id: 'toalla_cuerpo', name: 'Toalla de Cuerpo', limit: 8, type: 'wash' },
                { id: 'sabanas', name: 'Sábanas (Completas)', limit: 8, type: 'wash' },
                { id: 'funda_almohada', name: 'Funda de Almohada', limit: 4, type: 'wash' },
                { id: 'cepillo_dientes', name: 'Cepillo de Dientes', limit: 90, type: 'change' },
                { id: 'celular', name: 'Celular (Funda y Pantalla)', limit: 7, type: 'clean' },
                { id: 'computadora', name: 'Computadora (Teclado y Ext.)', limit: 15, type: 'clean' },
                { id: 'mouse', name: 'Mouse (Limpieza)', limit: 21, type: 'clean' },
                { id: 'auriculares', name: 'Auriculares (Limpieza)', limit: 45, type: 'clean' },
                { id: 'pad_cepillado', name: 'Pad XL (Cepillado en seco)', limit: 21, type: 'brush' },
                { id: 'pad_lavado', name: 'Pad XL (Lavado a fondo)', limit: 90, type: 'wash' }
            ];

            itemsConfig.forEach(item => {
                const dateStr = hygieneData[item.id];
                if (dateStr) {
                    const elapsed = getDaysElapsed(dateStr);
                    if (elapsed !== null && elapsed >= item.limit) {
                        const actionText = item.type === 'wash' ? 'lavarla' : item.type === 'change' ? 'cambiarlo' : item.type === 'brush' ? 'cepillarlo' : 'limpiarlo';
                        alerts.push(`🧼 ${item.name}: Pasaron ${elapsed} días, sugerimos ${actionText}.`);
                    }
                }
            });

            // 2. CUIDADO
            const groomingData = data.groomingData_v2 || {};
            // Barba
            const barbaHistory = groomingData['barba'] || [];
            if (barbaHistory.length > 0) {
                const elapsed = getDaysElapsed(barbaHistory[0]);
                if (elapsed !== null && elapsed >= 4) {
                    alerts.push(`🧔 Barba: Sugerencia de afeitado (pasaron ${elapsed} días).`);
                }
            }
            // Hoja Gillette
            const gilletteHistory = groomingData['hoja_gillette'] || [];
            if (gilletteHistory.length > 0) {
                const elapsed = getDaysElapsed(gilletteHistory[0]);
                if (elapsed !== null && elapsed > 40) {
                    alerts.push(`🪒 Hoja Gillette: Sugerimos cambiarla (pasaron ${elapsed} días).`);
                }
            }

            // Pelo
            const peloHistory = groomingData['pelo'] || [];
            if (peloHistory.length > 0) {
                const elapsed = getDaysElapsed(peloHistory[0]);
                if (elapsed !== null && elapsed >= 20) {
                    alerts.push(`💇 Pelo: Ya pasaron ${elapsed} días, te deberías cortar el pelo.`);
                }
            }

            // Axilas
            const axilasHistory = groomingData['axilas'] || [];
            if (axilasHistory.length > 0) {
                const elapsed = getDaysElapsed(axilasHistory[0]);
                if (elapsed !== null && elapsed >= 30) {
                    alerts.push(`🪒 Axilas: Tiempo de rebajar el vello (hace ${elapsed} días).`);
                }
            }

            // 3. LENTES
            const lensLimits = {
                lenses: { name: 'Lentes en uso', limit: 60, action: 'cambiarlos' },
                solution: { name: 'Solución abierta', limit: 90, action: 'cambiarla' },
                case: { name: 'Estuche de lentes', limit: 90, action: 'cambiarlo' },
                systane: { name: 'Gotas Systane', limit: 90, action: 'cambiarlas' },
                clothWash: { name: 'Gamuza (Lavado)', limit: 15, action: 'lavarla' },
                clothChange: { name: 'Gamuza (Cambio)', limit: 270, action: 'cambiarla' }
            };

            Object.keys(lensLimits).forEach(key => {
                const limitInfo = lensLimits[key];
                const dateKey = key === 'lenses' ? 'lensDate' : key === 'solution' ? 'solutionDate' : key === 'case' ? 'caseDate' : key === 'systane' ? 'systaneDate' : key === 'clothWash' ? 'clothWashDate' : 'clothChangeDate';
                const dateStr = data[dateKey];
                if (dateStr) {
                    const elapsed = getDaysElapsed(dateStr);
                    if (elapsed !== null && elapsed >= limitInfo.limit) {
                        alerts.push(`👁️ Lentes (${limitInfo.name}): Pasaron ${elapsed} días, sugerimos ${limitInfo.action}.`);
                    }
                }
            });

            // 4. SALUD (Dentista)
            const healthData = data.health_medical_data || {};
            const dentista = healthData.dentista || {};
            if (dentista.lastVisit) {
                const elapsed = getDaysElapsed(dentista.lastVisit);
                const limit = (dentista.frequencyMonths || 6) * 30;
                if (elapsed !== null && elapsed >= limit) {
                    alerts.push(`🩺 Salud (Dentista): Sugerimos realizar tu visita periódica (pasaron ${elapsed} días).`);
                }
            }

            // 5. VEHÍCULO
            const currentOdo = Number(data.vehicle_odometer) || 0;
            const maintenanceLog = data.vehicle_maintenance_log || [];

            const lastOil = maintenanceLog.find(m => m.type === 'Aceite y Filtros');
            if (lastOil) {
                const remainingKm = (lastOil.km + 10000) - currentOdo;
                const daysElapsed = getDaysElapsed(lastOil.date);
                const remainingDays = 365 - (daysElapsed || 0);
                if (remainingKm <= 0 || remainingDays <= 0) {
                    alerts.push(`🚗 Vehículo: Mantenimiento urgente de Aceite y Filtros sugerido.`);
                }
            }

            const lastAlign = maintenanceLog.find(m => m.type === 'Alineación & Balanceo');
            if (lastAlign) {
                const remainingKm = (lastAlign.km + 10000) - currentOdo;
                if (remainingKm <= 0) {
                    alerts.push(`🚗 Vehículo: Alineación & Balanceo vencido.`);
                }
            }

            const lastRot = maintenanceLog.find(m => m.type === 'Rotación de Neumáticos');
            if (lastRot) {
                const remainingKm = (lastRot.km + 10000) - currentOdo;
                if (remainingKm <= 0) {
                    alerts.push(`🚗 Vehículo: Rotación de Neumáticos vencida.`);
                }
            }

            const lastReplace = maintenanceLog.find(m => m.type === 'Reemplazo de Neumáticos');
            if (lastReplace) {
                const remainingKm = (lastReplace.km + 60000) - currentOdo;
                if (remainingKm <= 0) {
                    alerts.push(`🚗 Vehículo: Cambio de Neumáticos vencido.`);
                }
            }

            // 6. GIMNASIO (Nutrición - Vitamina D)
            const gymSupplements = data.gym_supplements || {};
            const vitDHistory = gymSupplements.vit_d_history || [];
            if (vitDHistory.length > 0) {
                const lastTake = new Date(vitDHistory[0].date);
                const interval = gymSupplements.vit_d_days_interval || 30;
                const nextTake = new Date(lastTake.getTime() + interval * 24 * 60 * 60 * 1000);
                const remainingDays = Math.ceil((nextTake - new Date()) / 86400000);
                if (remainingDays <= 0) {
                    alerts.push(`💊 Nutrición (Vitamina D): Debes tomar tu suplemento ahora.`);
                }
            }

            // 7. PROYECTOS
            const projects = data.projectPulseData || [];
            projects.forEach(p => {
                if (p.timerStart || p.accepted) {
                    const acceptedDate = new Date(p.accepted);
                    const totalDays = p.days || 1;
                    const elapsedMs = new Date() - acceptedDate;
                    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
                    const percentage = elapsedDays / totalDays;
                    const daysLeft = Math.ceil(totalDays - elapsedDays);

                    if (percentage >= 0.90 || daysLeft <= 1) {
                        alerts.push(`⏳ Proyecto '${p.project}' de '${p.client}' vence urgente en ${daysLeft} días.`);
                    } else if (percentage >= 0.75) {
                        alerts.push(`⏳ Proyecto '${p.project}' de '${p.client}' vence pronto en ${daysLeft} días.`);
                    } else if (percentage >= 0.50) {
                        alerts.push(`⏳ Proyecto '${p.project}' de '${p.client}' vence en ${daysLeft} días.`);
                    }
                }
            });

            // Enviar alerta agrupada si existen notificaciones
            if (alerts.length > 0) {
                const payload = JSON.stringify({
                    title: '⚠️ LifeCycle: Pendientes urgentes',
                    body: alerts.slice(0, 3).join('\n') + (alerts.length > 3 ? `\n...y ${alerts.length - 3} recordatorios más.` : ''),
                    url: '/'
                });

                console.log(`[Reminders] Enviando push a ${userSubscriptions.length} suscripciones para el usuario ${userId}`);
                for (const sub of userSubscriptions) {
                    try {
                        await webpush.sendNotification(sub, payload);
                    } catch (pushErr) {
                        console.error(`Error de envío push a ${userId}:`, pushErr.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error al ejecutar chequeo de recordatorios:", err);
    }
}

function getDaysElapsed(dateString) {
    if (!dateString) return null;
    const start = new Date(dateString);
    start.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = today - start;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
        
        if (!usersData || usersData.length === 0) return;
        if (!subs || subs.length === 0) return;
        
        // Agrupar suscripciones por user_id
        const subsByUser = {};
        subs.forEach(s => {
            if (!subsByUser[s.user_id]) subsByUser[s.user_id] = [];
            subsByUser[s.user_id].push(s.subscription);
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

// ==========================================================================
// Tareas Dinámicas y Recordatorios Personalizados
// ==========================================================================
async function checkAndSendCustomReminders() {
    if (!supabase) return;
    try {
        const now = new Date();
        const argTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const hour = argTime.getHours();
        const minutes = argTime.getMinutes();
        const dayOfWeek = argTime.getDay(); // 0 = Domingo, etc.
        const dateStr = argTime.toISOString().split('T')[0];

        // Obtener usuarios y sus suscripciones
        const { data: usersData, error: dbError } = await supabase.from('user_data').select('*');
        const { data: subs, error: subError } = await supabase.from('push_subscriptions').select('*');
        
        if (dbError || subError || !usersData || !subs) return;
        
        // Agrupar suscripciones por user_id
        const subsByUser = {};
        for (const sub of subs) {
            if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
            subsByUser[sub.user_id].push(sub.subscription);
        }

        for (const userRow of usersData) {
            const userId = userRow.user_id;
            const data = userRow.data || {};
            
            // Leer configuración de gym_supplements
            let supplements = {};
            if (data.gym_supplements) {
                try {
                    supplements = JSON.parse(data.gym_supplements);
                } catch(e) {
                    continue;
                }
            }
            
            const customReminders = supplements.custom_reminders;
            if (!customReminders) continue;

            const userSubs = subsByUser[userId] || [];
            if (userSubs.length === 0) continue;

            // Tipos de recordatorios dinámicos y sus textos por defecto
            const reminderTypes = [
                { key: 'creatine', title: '💪 Creatina', defaultBody: '¡No te olvides de tomar la creatina de hoy!' },
                { key: 'salmon', title: '🐟 Salmón & Omega 3', defaultBody: 'Recordá sacar el salmón para mañana lunes para comer Omega 3.' },
                { key: 'neck', title: '💪 Entrenamiento de Cuello', defaultBody: 'Recordá entrenar el cuello hoy (1 vez por semana).' }
            ];

            if (!data.custom_reminders_log) {
                data.custom_reminders_log = {};
            }

            let dataChanged = false;

            for (const rInfo of reminderTypes) {
                const reminder = customReminders[rInfo.key];
                if (reminder && reminder.enabled) {
                    const days = reminder.days || [];
                    const time = reminder.time || '';
                    if (days.includes(dayOfWeek) && time) {
                        const [remHour, remMin] = time.split(':').map(Number);
                        // Tolerancia de 5 minutos porque el cron corre cada 5 minutos
                        if (hour === remHour && minutes >= remMin && minutes < remMin + 5) {
                            const lastSentDate = data.custom_reminders_log[rInfo.key];
                            if (lastSentDate !== dateStr) {
                                console.log(`[Custom Reminder] Enviando push flotante ${rInfo.key} a usuario ${userId}`);
                                const payload = JSON.stringify({
                                    title: rInfo.title,
                                    body: rInfo.defaultBody,
                                    url: '/'
                                });

                                for (const sub of userSubs) {
                                    try {
                                        await webpush.sendNotification(sub, payload);
                                    } catch (err) {
                                        console.error(`[Custom Reminder] Falló enviar push de ${rInfo.key}:`, err.message);
                                    }
                                }

                                data.custom_reminders_log[rInfo.key] = dateStr;
                                dataChanged = true;
                            }
                        }
                    }
                }
            }

            if (dataChanged) {
                // Guardar actualización de log en Supabase
                await supabase
                    .from('user_data')
                    .update({ data: data })
                    .eq('user_id', userId);
            }
        }
    } catch(err) {
        console.error("Error en checkAndSendCustomReminders:", err);
    }
}

