// Funciones globales de asistencia de fechas locales para evitar desfases UTC
export function getLocalISODate() {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
}

export function parseDateLocal(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
        if (val.includes('-') && !val.includes('T')) {
            return new Date(val.replace(/-/g, '/'));
        }
        return new Date(val);
    }
    return new Date(val);
}

export class DateUtils {
    static getDaysElapsed(dateString) {
        if (!dateString) return null;
        const lastWashed = parseDateLocal(dateString);
        if (!lastWashed) return null;
        lastWashed.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - lastWashed);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    }

    static formatFriendlyDate(dateInput, neverLabel = 'Nunca (Nuevo)') {
        if (!dateInput) return neverLabel;
        const date = parseDateLocal(dateInput);
        if (!date) return neverLabel;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateCompare = new Date(date);
        dateCompare.setHours(0, 0, 0, 0);
        
        if (dateCompare.getTime() === today.getTime()) return 'Hoy';
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (dateCompare.getTime() === yesterday.getTime()) return 'Ayer';

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (dateCompare.getTime() === tomorrow.getTime()) return 'Mañana';

        const currentYear = today.getFullYear();
        const displayOptions = dateCompare.getFullYear() !== currentYear 
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : { month: 'short', day: 'numeric' };
            
        return date.toLocaleDateString('es-ES', displayOptions);
    }

    static formatInputDate(dateStr, neverLabel = 'Nunca') {
        if (!dateStr) return neverLabel;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    }

    static formatDateTime(dateInput, emptyLabel = '-') {
        if (!dateInput) return emptyLabel;
        const d = new Date(dateInput);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hr = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hr}:${min}`;
    }
}

// Configuración de ítems de Higiene (LifeCycle)
export const itemsConfig = [
    {
        id: 'esponja_africana',
        name: 'Esponja Africana',
        icon: 'ph-sparkle',
        limits: { yellow: 11, orange: 15, red: 30 },
        type: 'wash',
        category: 'cuidado_personal',
        instructions: [
            { step: 'Lavado a mano', text: 'Remojar la esponja en agua tibia y frotar con abundante jabón blanco (neutro) a mano para disolver la grasitud y remover bacterias.' },
            { step: 'Sin lavarropas', text: 'NO lavar en lavarropas ni usar suavizantes o lavandina, ya que dañan y estiran las fibras elásticas del tejido de nylon.' },
            { step: 'Enjuague y Secado', text: 'Enjuagar con agua limpia, escurrir bien apretando sin retorcer con fuerza, y colgar estirada en un lugar seco y ventilado.' }
        ]
    },
    {
        id: 'toalla_mano',
        name: 'Toalla de Mano',
        icon: 'ph-hand-palm',
        limits: { yellow: 2, orange: 3, red: 4 },
        type: 'wash',
        category: 'dormitorio_bano'
    },
    {
        id: 'toalla_cuerpo',
        name: 'Toalla de Cuerpo',
        icon: 'ph-drop',
        limits: { yellow: 5, orange: 7, red: 8 },
        type: 'wash',
        category: 'dormitorio_bano'
    },
    {
        id: 'sabanas',
        name: 'Sábanas (Completas)',
        icon: 'ph-bed',
        limits: { yellow: 5, orange: 7, red: 8 },
        type: 'wash',
        category: 'dormitorio_bano'
    },
    {
        id: 'funda_almohada',
        name: 'Funda de Almohada',
        icon: 'ph-moon',
        limits: { yellow: 2, orange: 3, red: 4 },
        type: 'wash',
        category: 'dormitorio_bano'
    },
    {
        id: 'cepillo_dientes',
        name: 'Cepillo de Dientes',
        icon: 'ph-tooth',
        limits: { yellow: 75, orange: 85, red: 90 },
        type: 'change',
        category: 'cuidado_personal'
    },
    {
        id: 'celular',
        name: 'Celular (Funda y Pantalla)',
        icon: 'ph-phone',
        limits: { yellow: 3, orange: 5, red: 7 },
        type: 'clean',
        category: 'tecnologia',
        instructions: [
            { step: 'Acción', text: 'Rocía el limpiador de pantallas Compitt en un paño de microfibra óptico tipo gamuza.' },
            { step: 'Técnica', text: 'Pasa el paño suavemente en movimientos rectos para eliminar huellas y grasitud. Nunca apliques el líquido directo sobre el vidrio ni uses alcohol común.' },
            { step: 'Acción', text: 'Retira la funda del teléfono. Humedece una microfibra multiuso con alcohol isopropílico.' },
            { step: 'Técnica', text: 'Frota todo el cuerpo interno y externo para cortar la grasitud pegada. Si está muy sucia, lavala en la bacha con agua y una gota de jabón blanco neutro. Secala al 100% antes de volver a colocarla.' }
        ]
    },
    {
        id: 'computadora',
        name: 'Computadora (Teclado y Ext.)',
        icon: 'ph-laptop',
        limits: { yellow: 7, orange: 11, red: 15 },
        type: 'clean',
        category: 'tecnologia',
        group: 'computadora',
        groupName: 'Computadora',
        groupIcon: 'ph-laptop',
        subName: 'Teclado y Ext.',
        instructions: [
            { step: 'Teclado y Puertos', text: 'Usa la perita de aire y los cepillos del kit 20 en 1 para sacar el polvo flotante de las ranuras.' },
            { step: 'Chasis y Plásticos', text: 'Humedece una microfibra multiuso con alcohol isopropílico y repasa la tapa, la base y el apoya muñecas para eliminar el brillo aceitoso.' },
            { step: 'Pantalla Mate', text: 'Rocía el Compitt Kleen Screen únicamente sobre el paño de lentes y limpia sin presionar para no dañar el panel IPS.' },
            { step: 'Cables', text: 'Limpia el cable de carga con isopropílico y acomodalo por detrás del equipo con una curva relajada para evitar tensiones mecánicas.' }
        ]
    },
    {
        id: 'mouse',
        name: 'Mouse (Limpieza)',
        icon: 'ph-mouse',
        limits: { yellow: 7, orange: 14, red: 21 },
        type: 'clean',
        category: 'tecnologia',
        instructions: [
            { step: 'Acción', text: 'Usa la punta de precisión del kit 20 en 1 para recorrer las uniones de los plásticos y rasquetear la grasitud acumulada.' },
            { step: 'Técnica', text: 'Barre el residuo con el cepillo de cerdas duras. Luego, humedece una microfibra con alcohol isopropílico y repasa todo el cuerpo y la ruedita para desengrasarlo.' }
        ]
    },
    {
        id: 'auriculares',
        name: 'Auriculares (Limpieza)',
        icon: 'ph-headphones',
        limits: { yellow: 15, orange: 30, red: 45 },
        type: 'clean',
        category: 'tecnologia',
        instructions: [
            { step: 'Almohadillas (Cuerina)', text: 'Humedece apenas una microfibra con limpiador de pantallas neutro. Nunca uses isopropílico acá porque cuartea el material sintético.' },
            { step: 'Rejillas y Ranuras', text: 'Limpia las mallas metálicas o de tela usando los cepillos cilíndricos finos del kit y sopletea con la perita de aire para eliminar pelusas que obstruyan el sonido.' }
        ]
    },
    {
        id: 'pad_lavado',
        name: 'Pad XL',
        icon: 'ph-paint-brush',
        limits: { yellow: 60, orange: 75, red: 90 },
        type: 'wash',
        category: 'tecnologia',
        instructions: [
            { step: 'Lavado', text: 'Sumerge el pad en la bacha con agua tibia (nunca caliente). Aplica un chorrito de shampoo para el pelo para cortar el sebo corporal. Frega suavemente en círculos con un cepillo de cerdas blandas.' },
            { step: 'Enjuague y Secado', text: 'Enjuaga con agua fría hasta retirar todo el jabón. No lo retuerzas. Apoyalo plano sobre una toalla, enrollalo como un pionono para sacar el exceso de agua y déjalo secar estirado a la sombra.' }
        ]
    },
    {
        id: 'compu_limpieza_int',
        name: 'Computadora (Limpieza Int.)',
        icon: 'ph-laptop',
        limits: { yellow: 90, orange: 135, red: 180 },
        type: 'clean',
        category: 'tecnologia',
        group: 'computadora',
        groupName: 'Computadora',
        groupIcon: 'ph-laptop',
        subName: 'Limpieza Interna',
        instructions: [
            { step: 'Desarme', text: 'Abrir la tapa lateral o chasis completo del equipo con las herramientas del kit de precisión.' },
            { step: 'Limpieza', text: 'Usar aire comprimido o perita y un pincel suave para remover pelusas y tierra acumulada en los ventiladores y disipador. Sostener las aspas del fan para que no giren libres.' },
            { step: 'Armado', text: 'Verificar conexiones, cerrar el chasis y encender el equipo para corroborar flujo de aire y sonido normal.' }
        ]
    },
    {
        id: 'compu_pasta_termica',
        name: 'Computadora (Pasta Térmica)',
        icon: 'ph-wrench',
        limits: { yellow: 180, orange: 270, red: 360 },
        type: 'change',
        category: 'tecnologia',
        group: 'computadora',
        groupName: 'Computadora',
        groupIcon: 'ph-laptop',
        subName: 'Pasta Térmica',
        instructions: [
            { step: 'Desmontaje', text: 'Desatornillar el disipador del procesador (y placa de video si aplica) con cuidado.' },
            { step: 'Limpieza', text: 'Limpiar la pasta vieja del chip y disipador usando un paño o hisopo humedecido en alcohol isopropílico al 99% hasta que brille el metal.' },
            { step: 'Aplicación', text: 'Colocar un grano de arroz o gota de pasta de buena calidad (ej. Arctic MX-4) en el centro del procesador, volver a montar el disipador ajustando tornillos en cruz.' }
        ]
    },
    {
        id: 'botella_vidrio',
        name: 'Botella de Vidrio (1L)',
        icon: 'ph-drop',
        limits: { yellow: 14, orange: 21, red: 30 },
        type: 'wash',
        category: 'cuidado_personal',
        instructions: [
            { step: 'Lavado Regular', text: 'Limpiar con agua tibia, detergente común y un cepillo largo para botellas que remueva el biofilm interno.' },
            { step: 'Desinfección profunda', text: 'Remojar unos minutos con agua y unas gotas de lavandina o vinagre blanco, enjuagar abundantemente y dejar secar boca abajo.' }
        ]
    }
];

// Configuración de Zonas de Cuidado Corporal (HabitSync)
export const ZONES = [
    { id: 'barba', name: 'Barba', isHero: false },
    { id: 'pelo', name: 'Pelo', isHero: false },
    { id: 'axilas', name: 'Axilas', isHero: false },
    { id: 'pecho_panza', name: 'Pecho y Panza', isHero: false },
    { id: 'brazos', name: 'Brazos', isHero: false },
    { id: 'piernas', name: 'Piernas', isHero: false },
    { id: 'intimas', name: 'Zonas Íntimas', isHero: false },
    { id: 'unas_manos', name: 'Uñas Manos', isHero: false },
    { id: 'unas_pies', name: 'Uñas Pies', isHero: false },
    { id: 'hoja_gillette', name: 'Hoja Gillette', isHero: false, isTool: true }
];

export const GROOMING_RULES = {
    barba: { limits: { green: 1, yellow: 2, red: 3 } },
    pelo: { limits: { green: 14, yellow: 17, orange: 19, red: 20 } },
    axilas: { limits: { green: 20, yellow: 25, orange: 29, red: 30 } },
    hoja_gillette: { limits: { green: 20, yellow: 29, red: 30 } },
    pecho_panza: { limits: { green: 40, yellow: 50, orange: 59, red: 60 } },
    brazos: { limits: { green: 120, yellow: 150, orange: 179, red: 180 } },
    piernas: { limits: { green: 80, yellow: 100, orange: 119, red: 120 } },
    intimas: { limits: { green: 15, yellow: 22, orange: 29, red: 30 } },
    unas_manos: { limits: { green: 10, yellow: 14, orange: 17, red: 18 } },
    unas_pies: { limits: { green: 30, yellow: 40, orange: 49, red: 50 } }
};

// Límites de Lentes de Contacto (LensTracker) en Días
export const LENS_LIMITS = {
    lenses: 60,
    solution: 90,
    case: 90,
    systane: 90,
    clothWash: 15,
    clothChange: 270
};

// Alertas del Gestor Centralizado
export const ALERT_DEFINITIONS = [
    // Higiene
    { key: 'esponja_africana', name: 'Esponja Africana', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'toalla_mano', name: 'Toalla de Mano', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'toalla_cuerpo', name: 'Toalla de Cuerpo', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'sabanas', name: 'Sábanas (Completas)', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'funda_almohada', name: 'Funda de Almohada', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'cepillo_dientes', name: 'Cepillo de Dientes', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'dentista', name: 'Control Dentista', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'compu_limpieza_int', name: 'Computadora (Limpieza Int.)', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'compu_pasta_termica', name: 'Computadora (Pasta Térmica)', category: 'higiene', type: 'interval', defaultTime: '23:00' },
    { key: 'botella_vidrio', name: 'Lavado Botella de Vidrio', category: 'higiene', type: 'interval', defaultTime: '23:00' },

    // Cuidado Corporal
    { key: 'pelo', name: 'Corte de Pelo', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'barba', name: 'Afeitado de Barba', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'axilas', name: 'Depilación Axilas', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'hoja_gillette', name: 'Hoja Gillette', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'pecho_panza', name: 'Depilación Pecho y Panza', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'brazos', name: 'Depilación Brazos', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'piernas', name: 'Depilación Piernas', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'intimas', name: 'Depilación Zonas Íntimas', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'unas_manos', name: 'Cortar Uñas de Manos', category: 'cuidado', type: 'interval', defaultTime: '23:00' },
    { key: 'unas_pies', name: 'Cortar Uñas de Pies', category: 'cuidado', type: 'interval', defaultTime: '23:00' },

    // Lentes
    { key: 'lenses_droplets', name: 'Gotas de Ojos (Systane)', category: 'lentes', type: 'interval', defaultTime: '23:00' },
    { key: 'lenses_case', name: 'Estuche de Lentes', category: 'lentes', type: 'interval', defaultTime: '23:00' },
    { key: 'lenses_solution', name: 'Solución de Lentes', category: 'lentes', type: 'interval', defaultTime: '23:00' },
    { key: 'lenses_replace', name: 'Reemplazo de Lentes', category: 'lentes', type: 'interval', defaultTime: '23:00' },
    { key: 'glasses_cloth_wash', name: 'Lavado Paño Anteojos', category: 'lentes', type: 'interval', defaultTime: '23:00' },
    { key: 'glasses_cloth_replace', name: 'Reemplazo Paño Anteojos', category: 'lentes', type: 'interval', defaultTime: '23:00' },

    // Vehículo
    { key: 'vehicle_oil', name: 'Aceite y Filtros', category: 'vehiculo', type: 'interval', defaultTime: '23:00' },
    { key: 'vehicle_align', name: 'Alineación & Balanceo', category: 'vehiculo', type: 'interval', defaultTime: '23:00' },
    { key: 'vehicle_rot', name: 'Rotación de Neumáticos', category: 'vehiculo', type: 'interval', defaultTime: '23:00' },
    { key: 'vehicle_replace', name: 'Reemplazo de Neumáticos', category: 'vehiculo', type: 'interval', defaultTime: '23:00' },
    { key: 'vehicle_issues_check', name: 'Fallas y Pendientes', category: 'vehiculo', type: 'interval', defaultTime: '09:00' },
    { key: 'vehicle_docs_check', name: 'Vencimiento de Documentación', category: 'vehiculo', type: 'interval', defaultTime: '09:00' },
    { key: 'vehicle_fluids_check', name: 'Control de Fluidos y Matafuegos', category: 'vehiculo', type: 'interval', defaultTime: '09:00' },

    // Nutrición & Hábitos
    { key: 'vitamina_d', name: 'Vitamina D', category: 'gym', type: 'interval', defaultTime: '23:00' },
    { key: 'creatine', name: 'Creatina', category: 'gym', type: 'recurring', defaultTime: '23:00', defaultDays: [1,2,3,4,5,6,0] },
    { key: 'salmon', name: 'Salmón & Omega 3', category: 'gym', type: 'recurring', defaultTime: '17:00', defaultDays: [0] },
    { key: 'neck', name: 'Entrenamiento de Cuello', category: 'gym', type: 'recurring', defaultTime: '23:30', defaultDays: [5,6] },
    { key: 'weigh_in', name: 'Recordatorio para Pesarme', category: 'gym', type: 'recurring', defaultTime: '08:00', defaultDays: [1,2,3,4,5,6,0] },

    // Otros
    { key: 'robot', name: 'Robot Aspiradora', category: 'otros', type: 'interval', defaultTime: '23:00' },
    { key: 'workana', name: 'Vencimiento Workana', category: 'otros', type: 'interval', defaultTime: '23:00' },
    { key: 'projects_check', name: 'Estado de Proyectos Activos', category: 'otros', type: 'interval', defaultTime: '09:00' },
    { key: 'tareas_urgentes_check', name: 'Tareas Pendientes Urgentes', category: 'otros', type: 'interval', defaultTime: '09:00' }
];

export const CATEGORY_NAMES = {
    higiene: '💧 Higiene y Baño',
    cuidado: '✂️ Cuidado Corporal',
    lentes: '👁️ Lentes & Anteojos',
    vehiculo: '🚗 Vehículo',
    gym: '💪 Nutrición & Hábitos',
    otros: '⚙️ Otros Avisos'
};
