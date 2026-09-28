# Revisión de estabilidad y propuesta de continuidad — 26/09/2026

**Documento histórico de diagnóstico. Actualización 27/09:** el usuario aprobó
implementar estabilidad, confirmó copia cifrada con clave local (sólo lectura),
recuperó acceso y canceló nuevas consultas a soporte. Decidió archivar TODO
Transcripciones, sin biblioteca ni herramienta de PC dentro de este trabajo; APK
diferido. Esas decisiones sustituyen las propuestas incompatibles de este texto.
Ver [estado operativo vigente](ESTABILIDAD_Y_FINANZAS_2026-09-27.md).

## Alcance y autoridad

El usuario pidió revisar Supabase, dos videos y el código, y presentar un plan antes
de decidir su implementación. Esta entrega es diagnóstico y documentación: no
implementa modo offline, no cambia producción, no activa pagos ni migra datos.

Confirmaciones del usuario de esta fecha:

- LifeCycle debe ahorrar tiempo y carga mental; su núcleo son tarjetas, historiales
  y recordatorios. Se prefiere centralizar las funciones en la aplicación propia.
- Delegar una función es una alternativa por costos o confiabilidad, no un objetivo
  de fragmentar la experiencia en muchas aplicaciones.
- Objetivo USD 0; techo deseado aproximado de USD 5 mensuales para el conjunto.
  Ese techo no autoriza contratar servicios ni habilitar facturación.
- Conservar calidad, integridad, utilidad y puntualidad de recordatorios. No borrar
  historiales ni recortar funciones silenciosamente para bajar consumo.
- Una grabación larga debe conservarse completa con la pantalla apagada. La
  transcripción puede esperar; se evaluaría pagar poco si mejora calidad demostrada.

## Evidencia actual y límites

### Supabase

Panel autenticado de la organización y proyecto consultado el 26/09:

- Free; ciclo mostrado: 27/08/2026–27/09/2026.
- Egress 14.945 / 5 GB; servicio restringido, respuestas API 402 por Egress Exceeded.
- Base aproximadamente 29–31 MB según superficie del panel; no son 15 GB de datos
  almacenados. El tamaño no constituye verificación integral de su contenido.
- El proyecto no aparece pausado ni ofrece reanudación en la vista consultada.
- El nuevo correo advierte una posible pausa por inactividad, no confirma borrado
  ni levantamiento de la restricción por cuota. Son estados distintos.
- El panel no informa la hora exacta del reinicio del ciclo. La documentación
  permite una demora breve posterior; no prometer medianoche argentina.
- No se consultó una respuesta nueva de soporte ni se envió otro mensaje.
- No se ejecutaron consultas sobre contenido personal ni nuevas migraciones.

Según la documentación, el cupo se repone al comenzar el ciclo siguiente; el exceso
del ciclo anterior no se arrastra como consumo inicial del siguiente. Si llegara
a pausarse por inactividad, reanudar sería una acción distinta de renovar la cuota.
El correo de la cuenta indica 90 días para reanudar; la documentación pública
consultada anuncia un año. No usar el plazo mayor como garantía para esta cuenta.

### Incidente de egress: evidencia histórica, no hipótesis sobre los audios

`INCIDENTE_EGRESS_2026-09-13.md` documenta aproximadamente 13.1 GB de Realtime frente
a unos 5.8 MB de Storage y reproduce un circuito de hidratación, guardado sin cambio
y nuevo evento. La contención SQL/cliente fue publicada el 13/09, seguida por otras
reducciones de lecturas. No se debe volver a presentar ese arreglo como pendiente
de implementar, ni atribuir el pico a las grabaciones sin nueva evidencia.

Las pruebas cortas posteriores no prueban un mes completo dentro de cuota. Falta
medir uso normal con la aplicación restablecida. El incidente no implica que el
uso legítimo futuro de audio no pueda consumir transferencia.

### Videos y código

Se revisaron secuencias visuales de ambos MP4 locales, sin subirlos a proveedores:

- `2026-09-09 02-17-53.mp4` (12.77 s): reaparece el panel de sincronización al volver
  a LifeCycle. `AuthSyncModule` sólo excluye `TOKEN_REFRESHED` de la inicialización;
  los restantes eventos invocan `handleAuthStateChange`, que bloquea la interfaz y
  carga nube/políticas/suscripciones. El SDK instalado documenta `SIGNED_IN` al
  reenfocar una pestaña aunque ya esté autenticada. Hay una causa concreta en código.
- `2026-09-10 03-55-19.mp4` (10.13 s): se revisó la secuencia de proyectos indicada
  por el usuario. `restoreDataLocally` llama a `projects.render`; éste borra y recrea
  las tarjetas. Junto con `.card:hover` y el antiguo bucle Realtime, esto puede
  reiniciar la animación repetidamente. Es una hipótesis fundada, no una reproducción
  confirmada de producción actual. Ambos videos anteceden al arreglo del 13/09.

Las tareas completadas siguen dentro de `tareas_list`, guardado localmente y
sincronizado. Ocultarlas por antigüedad afecta la vista, no elimina su almacenamiento
ni las separa del documento sincronizado. No se midieron sus bytes exactos.

## Arquitectura propuesta, pendiente de aprobación

Conservar Supabase como estado compartido, con almacenamiento local durable por
cuenta y una cola explícita de operaciones pendientes. No volver al modelo de
subir un documento local completo y asumir que siempre es el más reciente.

1. Copia confirmada en IndexedDB para web; evaluar SQLite para Android nativo.
   La interfaz también necesita recursos offline versionados, no sólo datos.
2. Guardar operaciones con ID estable antes de confirmar la acción en pantalla.
   Confirmarlas contra servidor de forma idempotente; reintentar con espera.
3. Conflictos por entidad/revisión, historial de operaciones y marcas de borrado.
   Una respuesta fallida no equivale a una base vacía. Nunca reemplazar datos por
   vacío ni descartar ediciones pendientes durante sincronización o cambio de cuenta.
4. Dispositivo previamente autorizado: acceso local protegido. Primer acceso en
   dispositivo nuevo requiere conexión. Definir bloqueo local, gestión de claves y
   cierre de sesión; offline no se puede verificar una revocación remota inmediata.
5. Copias de seguridad versionadas fuera del único dispositivo y del único proveedor,
   con restauración ensayada en entorno aislado. Almacenamiento del navegador puede
   desaparecer por limpieza/desinstalación; persistencia solicitada no es garantía.
6. Estado visible: última sincronización, pendientes, conflicto o servicio caído.
   Nunca mostrar sincronizado mientras falta confirmación.

Durante una caída deberían funcionar tarjetas/historiales ya descargados y nuevas
anotaciones en cola. Esperarían: sincronización entre equipos, datos no descargados,
primer ingreso, servicios de IA y fuentes externas. No prometer disponibilidad
absoluta ante pérdida de dispositivo, borrado de almacenamiento o fallos del sistema.

### Recordatorios independientes de la nube

El modo offline web no garantiza avisos programados con navegador cerrado. Para el
teléfono se propone aprovechar Capacitor y programar notificaciones locales nativas,
manteniendo interfaz y datos de LifeCycle. La APK reemplazaría el acceso PWA en ese
teléfono tras validar la transición; no exigir dos aplicaciones para el uso diario.

Cada aviso conserva entidad, ocasión y horario; asignar responsable local/remoto
para evitar duplicados. Reprogramar por cambios, completar, reinicio, permisos y
zona horaria. No convertir los reintentos de entrega en horarios solicitados.
Una finalización en otro equipo desconectado no puede cancelar instantáneamente el
aviso local: esa limitación debe quedar visible y reconciliarse al reconectar.

## Plan por bloques y criterios de salida

### 1. Recuperación y línea de base

- Confirmar renovación de cuota y estado de pausa; si sigue restringido tras la
  actualización del ciclo, consultar a soporte sin activar Pro automáticamente.
- Obtener respaldo recuperable, comprobar autenticación y datos representativos.
- Medir consumo real, por servicio, durante uso normal. Alertar antes del límite
  con margen (por ejemplo 50/75/90%) y distinguir métricas oficiales de estimaciones.
- Mantener protecciones contra ecos/no-ops; cortar reintentos patológicos ante 402
  sin eliminar operaciones. No degradar horarios ni apagar avisos silenciosamente.

Salida: acceso real restablecido, respaldo verificable y medición utilizable. No
esperar al desbloqueo para diseñar o ejecutar pruebas locales independientes.

### 2. Molestias de interfaz

- Diferenciar inicio/cambio real de cuenta de reconfirmación de la misma sesión.
  Sincronizar en segundo plano sin tapar la app, conservando controles de seguridad.
- Reproducir hover con eventos controlados; evitar reconstruir tarjetas sin cambios,
  preservando foco, scroll, menús y animación normal.
- Verificar cambio de pestaña repetido, vencimiento real de sesión, cierre de sesión,
  cuenta distinta, error de red y actualizaciones simultáneas.

Salida: volver a la pestaña no bloquea una sesión válida; tarjeta quieta no repite
animación por renders redundantes. Pruebas locales posibles ahora; producción luego.

### 3. Continuidad y protección de datos

- Implementar incrementalmente copia local, cola, conflictos y respaldos.
- Primera entrega: lectura recuperable; después escritura offline, sin habilitarla
  antes de probar reconciliación y recuperación.
- Probar caída 402, timeout, recarga/reinicio, dos equipos, completar simultáneamente,
  eliminación/edición concurrentes, cambio de cuenta y dispositivo sin copia local.

Salida: ninguna operación confirmada localmente se pierde en los casos ensayados;
pendientes/conflictos visibles; restauración independiente demostrada. No tratarlo
como un cambio cosmético ni dar por segura una migración por pasar tests unitarios.

### 4. Continuidad de recordatorios Android

- Completar planificación local y coordinación con Push remoto en la app nativa.
- Validar en Galaxy S24 FE / Android 16: pantalla apagada, sin red, reinicio,
  permisos, varias horas, cancelación al completar y regreso de conectividad.
- La prueba física exige acceso al teléfono del usuario; no usar el emulador ajeno
  como sustituto de esa evidencia.

### 5. Transcripción con costos controlados

- Probar Samsung Voice Recorder como capturador de 1–3 horas, sin adoptar todavía
  su transcriptor ni dar por validada una grabación prolongada en este teléfono.
- Conservar originales localmente con respaldo; herramienta en PC prepara fragmentos,
  valida duración, persiste progreso, reintenta sólo fallos y une el texto completo.
- Comparar la misma muestra representativa con el proveedor actual y una alternativa
  de alta calidad. Prueba paga o envío de material privado requiere autorización.
- Mantener biblioteca, texto, resúmenes y búsqueda en LifeCycle; no es necesario
  retransmitir cada audio grande a Supabase para centralizar el resultado.
- La PC debe estar disponible para este flujo. El procesamiento autónomo desde móvil
  seguiría siendo una ampliación distinta, no se prometerá implícitamente.
- Referencia oficial consultada: `gpt-transcribe`, USD 0.0045/min, aproximadamente
  USD 0.27/h; 2/5/10 horas cuestan USD 0.54/1.35/2.70 antes de impuestos, reintentos,
  solapamientos o resúmenes. No es gratuito ni prueba calidad en los audios del usuario.
- Mostrar presupuesto antes de procesar y frenar al límite sin borrar grabaciones.

### 6. Retomar alcance existente

Mantener finanzas/suscripciones y funciones existentes; no clonar Sandía ni borrar
módulos para justificar el costo del incidente. Retomar pendientes del plan A–F
después del núcleo estable, contrastando lo ya implementado para no rehacerlo.
Archivar/paginar historiales puede bajar transferencia sin perder información;
no confundir ocultar una tarea con archivarla ni eliminarla.

## Fuentes públicas consultadas

- https://supabase.com/docs/guides/platform/billing-faq
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://www.samsung.com/us/support/answer/ANS10000942/
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.openai.com/api/docs/models/gpt-transcribe
- https://developers.openai.com/api/docs/pricing
- https://developer.android.com/develop/background-work/services/alarms

## Estado de esta entrega

Diagnóstico y propuesta documentados. Sin cambios de aplicación, SQL, facturación,
despliegue ni pruebas pagas. No se declara cerrado el plan previo ni una prueba
actual de login, hover productivo, integridad completa o grabación física prolongada.
Siguiente paso: aprobación del bloque de trabajo; las nuevas decisiones de continuidad
no se consideran autorizadas por las aprobaciones históricas de otros bloques.
