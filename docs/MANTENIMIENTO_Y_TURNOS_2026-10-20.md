# Mantenimiento de clientes y Turnos de Salud

Autorizado por Fabrizio el 20/10/2026. Usa la misma cuenta, base y scheduler;
no incorpora servicios pagos ni integraciones con equipos, Webshare u OBS.

## Comportamiento

- Trabajo → Clientes → ficha → Mantenimiento. Rutinas vinculadas al cliente y,
  opcionalmente, a un proyecto existente. Instrucciones, próxima fecha, hasta
  seis horarios diarios, pausa y archivo independientes del cliente.
- Frecuencias: cada N días/semanas/meses desde la realización, calendario fijo
  anclado a su fecha original o días de la semana. El calendario conserva el
  último día válido de los meses cortos sin derivar permanentemente su ancla.
  Una revisión atrasada sigue siendo un pendiente, sin generar una cola de
  ocurrencias vencidas. Completar guarda fecha, fecha prevista y nota; calcula
  la próxima revisión e invalida los avisos de la anterior.
- Resumen y Seguimientos reutilizan la misma rutina. Archivar cliente o rutina
  detiene sus avisos y conserva el historial. Eliminar pide confirmación y
  advierte que también elimina sus realizaciones; no afecta proyectos o cobros.
- Salud → Turnos. Consultas/estudios con profesional, lugar, notas y vínculo
  opcional a un control/estudio existente. Los controles anteriores conservan
  su pantalla, datos, registros y archivos.
- Entre uno y cuatro tramos, cada uno con anticipación de 0–365 días y hasta
  seis horarios de Argentina. El tramo más cercano reemplaza al anterior.
  Ningún aviso de asistencia se programa a partir de la hora de la cita.
- El lugar conserva su campo de texto. Un enlace de ubicación HTTPS opcional
  aparece por separado con `Abrir ubicación` y `Copiar enlace`. Se mantiene
  visible y seleccionable si el navegador rechaza el portapapeles. Abrir o
  copiar no guarda, reprograma ni cambia la revisión del turno.
- El formulario explica que los avisos son diarios y los tramos no se suman.
  La tarjeta muestra los rangos sin superposición (por ejemplo, de 15 a 8 días
  antes y desde 7 días antes hasta la cita), siempre sujetos a la hora del turno.
- Cumplir la fecha no confirma asistencia: queda pendiente de confirmar. El
  usuario puede realizar, reprogramar, cancelar, pausar, archivar o eliminar.
  Confirmar una cita no fabrica resultados ni modifica controles o archivos.
- Turnos en Hoy, campana y búsqueda; mantenimiento pendiente en Hoy/campana y
  Trabajo. Enlaces Push abren el turno o la ficha del cliente correspondiente.

## Datos y compatibilidad

Las rutinas extienden `work_followups.record.maintenance`; no duplican clientes,
proyectos ni tareas. Historial por rutina y versión de programación independientes.
Los turnos viven en `lifecycle_appointments`, con revisión y guardado mediante la
RPC existente. Los dos dominios conservan control de cuenta y conflictos de
revisión. La agenda entra en sincronización, backup, restore atómico de Trabajo
y consulta cifrada. Un backup antiguo que no la incluye no la vacía.

`locationUrl` es opcional y admite hasta 4096 caracteres. Las agendas previas sin
ese campo siguen siendo válidas. Usa la misma RPC y JSON existente, sin migración
ni reescritura de turnos personales. Se conserva en sincronización y backups.

Migración `20261020164626_client_maintenance_and_health_appointments.sql`:
validación de documentos e historial, ampliación de claves admitidas y consulta
de candidatos de Trabajo para múltiples horarios. Sin semillas ni actualizaciones
de datos existentes. Publicación y QA se acreditan en el recibo local ignorado
`.tmp-sb/care-release.json`, no por la existencia de este documento.

## Verificación

- Pruebas unitarias de calendario, fin de mes, realizaciones, tramos, caducidad,
  reprogramación, supresión de reintentos y compatibilidad de backups.
- SQL PGlite con dos propietarios y roles: validación, aislamiento, CAS,
  respuesta perdida, múltiples horarios y rollback de restore inválido.
- Navegador local, 1440 y 390 px, claro/oscuro: CRUD, archivo/reactivación,
  realización, historial, validaciones, reload, backup/restore y navegación.
- Preview de migración en Supabase con registros sintéticos QA y ROLLBACK.
  Aplicación posterior: checksums de contenido personal y QA sin cambios; sin
  hallazgos nuevos en asesores de seguridad/rendimiento.
- 508 pruebas automáticas aprobadas. Regresión de Trabajo en los cuatro tamaños/
  temas y de Facultad/Saylor en móvil claro/oscuro. El diálogo largo de backup
  limita su altura y permite desplazar el contenido manteniendo visibles sus
  acciones; se verifica también con una ventana de sólo 620 px de alto.
- QA autenticada: crear, editar, pausar, archivar y reactivar rutina; registrar
  realización el 20/10 y comprobar próxima revisión el 22/10 e historial único.
  Turno: tres tramos, reprogramación, pausa/reactivación, búsqueda, vínculo al
  estudio existente, realización, reapertura, cancelación y archivo.
- Avisos automáticos con la app fuera de ejecución: programados 14:00 Argentina,
  procesados 14:02 el 20/10. Un registro por dominio, ambos `no_devices`; no se
  interpreta como entrega Push. Las muestras quedaron archivadas al terminar.
- Backup real QA validado y vista previa de importación cancelada sin restaurar.
  Comparación antes/después: 41 claves anteriores y todos los registros previos
  de Trabajo conservados, con un cliente/rutina y un turno sintéticos añadidos.

El scheduler conserva su intervalo de cinco minutos y su ventana de frescura.
Una reserva o aceptación Push no demuestra recepción en Android. La cuenta QA
no tenía dispositivos Push registrados al comenzar estas pruebas; la recepción
física se debe comprobar en un dispositivo con esa cuenta cuando se disponga.

## Recuperación

Un rollback de código conserva los nuevos datos en la base. No eliminar la clave
de agenda ni las extensiones de rutinas como parte de un rollback. Versiones
antiguas no muestran Turnos ni conocen la repetición de Mantenimiento; pausar
rutinas nuevas antes de volver a una versión anterior si se requiere rollback.
