# Recordatorios de clientes con refuerzo de prioridad

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
