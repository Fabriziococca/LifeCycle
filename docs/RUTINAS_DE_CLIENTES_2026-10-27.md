# Recordatorios de clientes con refuerzo de prioridad

## Ajuste de experiencia del 27/10 por la noche

Clientes → ficha → **Tarjetas y avisos** permite crear una **Nueva tarjeta**.
Reutiliza los componentes de Higiene: contador de días, progreso, Último/Vence,
estado, pausa y registro de realización. Configuración principal: nombre,
Atención desde un día, Vencida desde otro y horarios con **+ Horario**.
Proyecto e instrucciones quedan desplegables; configuración, instrucciones,
historial y archivo están en el menú de la tarjeta.

Para Diego se conservan las tres rutinas existentes, fechas, horarios e historial.
El reinicio y la revisión de proveedores pasan a Atención al día 3 y Vencido al
día 7; OBS al día 1 y 2 respectivamente. Vencido es un plazo de organización,
no una afirmación sobre daño del equipo. El aviso reforzado dice «Vencido».
Un ciclo inicial cuenta desde su inicio, sin inventar una realización. Registrar
una realización reinicia ambos plazos desde la fecha elegida; consultar, editar
instrucciones o cerrar el formulario no registra tareas ni reinicia el ciclo.

Los avisos de una sola vez y otras frecuencias se conservan en «Recordatorios con
otra frecuencia» y en Recordatorios de Trabajo. Una tarjeta admite volver a ese
editor desde su menú. No se convierten automáticamente los recordatorios
puntuales ni los calendarios fijos. Se mantiene el modelo y guardado existentes;
no requiere migración de datos.

La sección siguiente describe la implementación inicial de los plazos. Sus
referencias a «Prioridad alta» corresponden al nombre anterior del segundo plazo.

Desde Trabajo → Clientes → Abrir ficha → Agregar recordatorio se conserva el
editor unificado: una sola vez, intervalos, semanal, mensual y anual. También
se puede crear desde Recordatorios de Trabajo eligiendo el cliente.

Para una rutina: elegir intervalo y activar «contar desde la última realización».
El intervalo determina el primer aviso. El campo «Prioridad alta desde el día»
permite, por ejemplo, aviso normal al día 3 y prioridad alta al día 7. Los avisos
siguen en los horarios elegidos hasta registrar que la tarea fue realizada.

Las tarjetas muestran última realización, fecha del aviso normal y fecha de
prioridad alta. Un ciclo inicial no inventa una realización. Registrar una tarea
efectivamente hecha conserva su historial y recalcula ambos plazos desde esa
fecha, aunque se haya hecho tarde. Pausar o archivar conserva el historial.

Los intervalos usan fechas de Argentina y horarios diarios configurados. No son
cronómetros de horas transcurridas. Los avisos recuerdan la tarea; no ejecutan
reinicios, controlan OBS ni consultan cuotas o facturación de proveedores.

El modelo almacena `maintenance.escalationDays`, opcional, como días posteriores
a `reviewOn`; permite calendarios semanales/mensuales sin inferir una duración
fija del mes. La interfaz convierte el umbral absoluto para intervalos en días
desde cada realización. Los registros anteriores conservan su comportamiento.

La prioridad se refleja en la tarjeta, el orden de seguimientos, la campana y
el título Push. Se conserva la deduplicación por rutina, versión, horario y día,
la ventana de 15 minutos y la supresión de reintentos después de completar.
No cambia los permisos de notificación ni garantiza recepción en el dispositivo.

Validación: pruebas de límites, normal/alta, ciclo nuevo tras realización tardía,
pausas/archivo, reintentos y backup; guard de PostgreSQL en PGlite; interfaz en
1440/390 px y ambos temas. Recibo operativo: `.tmp-sb/escalation-release.json`.
