# Personal, Trabajo y recordatorios

Autorizado el 21/10/2026: reforzar los dos espacios de la misma cuenta, unificar
el editor de avisos con programación puntual, mover Suscripciones a Trabajo y
aplicar una dirección visual carbón/piedra sin demorar la navegación.

## Organización

- Personal conserva salud, cuidado, higiene, lentes, vehículo, facultad, hábitos,
  Trading y tareas existentes. Trabajo reúne Clientes, Seguimientos, Proyectos,
  Finanzas, Suscripciones y sus propios Recordatorios. No hay cuentas nuevas.
- Cuenta, contraseña, bloqueo, dispositivos, instalación, apariencia y backup son
  comunes. El perfil explica esta condición y la configuración de módulos indica
  a qué espacio pertenece cada acceso. Recordatorios tiene acceso directo en cada
  navegación; el acceso anterior del perfil continúa como atajo contextual.
- Cambiar de espacio sólo cambia la navegación. No pausa el scheduler, cambia
  permisos, duplica datos, reclasifica movimientos ni altera renovaciones.

## Recordatorios

Un editor compartido ofrece una sola vez (fecha y horarios Argentina), días de
la semana, intervalos de días/semanas/meses, mensual y anual. Los meses cortos
usan su último día y recuperan el día original después. Un aviso puntual no se
convierte en semanal ni confirma automáticamente una tarea realizada.

Los avisos generales conservan el registro `alerts_config.__recurring_reminders`;
el ámbito adicional `workspace` se interpreta como Personal en documentos
anteriores. Un recordatorio general de Trabajo se crea en ese mismo registro.
Los recordatorios de clientes conservan su identidad, cliente, proyecto opcional,
historial y escritura CAS en Trabajo. Aparecen en la ficha y en Recordatorios de
Trabajo mediante dos vistas del mismo registro. No se copian entre almacenes.

Las rutinas anteriores mantienen su frecuencia desde la última realización o su
calendario fijo. El seguimiento hasta realizar y el cómputo desde la realización
quedan como opciones adicionales. Un aviso programado nuevo no genera un pendiente
crítico diario por defecto. Completar un aviso puntual conserva el historial y no
crea otro ciclo. Archivar un cliente sigue suspendiendo sus avisos.

El frontend y el servidor reutilizan el mismo cálculo de calendario. Se conserva
la ventana Push de 15 minutos, incluidos horarios que cruzan medianoche; no se
recuperan avisos caducados. Editar, pausar o completar invalida reintentos que ya
no correspondan. Aceptación de Push no acredita visualización en Android.

## Diseño

`visual.css` concentra superficies carbón y grises cálidos para oscuro, piedra
para claro, acciones neutras de alto contraste y acento moderado de Trabajo.
Menos sombras y redondeados; tarjetas de Higiene más compactas, recordatorios en
filas, métricas y movimientos financieros alineados. Cuenta y los controles
conservan sus rutas, textos accesibles y zonas táctiles.

La navegación continúa opaca e inmediata, sin animaciones de entrada del módulo.
Se conservan confirmaciones breves de registro y las preferencias de movimiento.
No se agregan dependencias, servicios pagos, polling ni modificaciones financieras.

## Persistencia y verificación

`20261022015610_unified_reminder_schedules.sql` amplía la validación de rutinas y
la selección de ventanas del scheduler. No reescribe documentos personales ni
cambia políticas de acceso. Las RPC existentes conservan sus grants y propietario.

Pruebas de modelo, SQL PostgreSQL aislado, UI local en 1440/390 px con ambos temas,
regresiones de turnos/cobros y navegación. Exportación/restauración y copia
cifrada admiten las nuevas frecuencias con la misma validación de calendario.
QA real únicamente con la identidad
previamente autorizada, respaldo previo, datos sintéticos y limpieza posterior.
El recibo operativo ignorado `.tmp-sb/organization-release.json` registra la
verificación final de QA, commit, migración, Manual Deploy, salud y logs.
