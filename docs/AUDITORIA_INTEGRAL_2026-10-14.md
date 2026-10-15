# Auditoría integral de LifeCycle — 14/10/2026

Auditoría estática/local y recorridos funcionales ampliados en QA real.
Render volvió a aceptar despliegues: 0144573 quedó publicado mediante Manual
Deploy y se verificaron hash completo, build, health y logs. La revisión de
cierre incorpora el bloqueo manual autorizado y B04; su recibo de publicación
exacta se conserva en .tmp-sb/audit-completion-release.json.
No se declara probada cada combinación posible.
Transcripciones/IA y Android nativo quedan excluidos y conservados.

## Alcance y datos

- 82 archivos JavaScript activos analizados estáticamente, con revisión dirigida
  de renderizado, acciones, validaciones, persistencia, API y permisos SQL. Esto
  no demuestra semánticamente cada línea o combinación posible.
- Cuenta QA confirmada por el usuario, acceso verificado y backup exportado antes
  de escribir. Identidades en ACCESS_REGISTER.md, privado e ignorado por Git;
  contraseña no persistida. No se modificó la cuenta personal.
- Casos destructivos, reloj artificial, pérdida de red, respuestas tardías y datos
  inválidos se prueban con nube sintética o PostgreSQL aislado.
- QA real: navegación de los 13 módulos y recorridos funcionales de tarjetas,
  Tareas, Lentes, Salud/Storage, Vehículo, Gimnasio, Proyectos, Finanzas,
  Suscripciones, Trading, Facultad, Recordatorios, búsqueda y preferencias.
  Se conservan casos sintéticos con prefijo AUDIT QA. Avisos nuevos desactivados;
  la evaluación y la Saylor están finalizadas, la suscripción está pausada.
- Los respaldos anteriores y posteriores a las altas están preservados. B03 se
  volvió a comprobar corregido en QA publicado; exportación y restauración
  completa también se verificaron tras recarga.
- CI verde no equivale a cobertura infinita; aceptación Push por el proveedor no
  demuestra recepción/visualización física en el teléfono.

## Defectos corregidos

| ID / severidad | Evidencia y causa | Corrección y verificación |
| --- | --- | --- |
| V01 / media | Capturas del usuario: Pausar desplaza títulos/acciones de Vehículo. Reproducción con catálogo anterior y control mensual. Reglas generales de botones y mínimos de columnas incompatibles. | Grupo compacto editar/pausar, anchos y cabeceras adaptables; fecha del matafuego a 360 px. Matriz de 7 anchos y 2 temas. |
| V02 / baja | Facultad vacía presenta métricas sin espacio interior y dos mensajes de vacío. | Una indicación inicial; métricas con margen/padding cuando hay materias. Pruebas vacío/con datos. |
| V03 / media | Recordatorios: acciones recortadas en perfil angosto, incluso en tableta. | Barra que permite saltos de línea y botones flexibles según el espacio real. |
| V04 / media | Nutrición móvil: seis macros rígidos y tablas sin contenedor desplazable cortan columnas. | Grilla adaptable y scroll horizontal acotado a las tablas. No se ocultan datos ni acciones. |
| B01 / media | Rama legacy del robot usa nowArg inexistente; falla si se activa esa rama. Frecuencia real no establecida. | Reloj del scheduler mediante helper probado; fechas ausentes, inválidas o futuras no producen horas negativas. No atribuirle todos los retrasos Push. |
| B02 / alta | URL HTTP inválida en Salud reproduce TypeError: this.feedback.message is not a function. El campo DOM message oculta el método compartido desde el constructor. | Renombrado a messageElement. Regresión y flujos UI de advertencia, confirmación, cancelación y reintento. |
| A01 / baja | Cierre de planificación usa × de texto, contra UX_CONVENTIONS. | Icono con nombre accesible y tooltip. |
| V05 / media | QA real: texto de detalle de tarea blanco sobre fondo casi blanco en tema claro. | Color del tema; capturas y contraste mínimo 4,5:1 verificados en escritorio/móvil y ambos temas. |
| A02 / baja | Detalle de tarea sin rol ni nombre de diálogo en el DOM. | role=dialog, aria-modal y título asociado; comprobación del diálogo por nombre accesible. |
| B03 / alta | QA real: registrar un PR con el formulario y exportar muestra `gym_records[0].rir debería ser un número válido`. El select guarda etiquetas como Fallo/RIR 1.5. También impide mostrar correctamente ese RIR. No se perdieron registros. | Nuevos PR numéricos, lectura/exportación compatible con etiquetas anteriores. Revalidación real publicada: PR 0/1,5 y backup completo válidos. |
| B04 / baja | QA real: dos cobros del 50% del saldo de un proyecto neto100 registran50+25 correctamente, pero la etiqueta suma50%+50%=100%. | Porcentaje calculado desde el neto efectivamente liberado:75%. Regresión mediante dos cobros UI y total de movimientos75, en escritorio/móvil y ambos temas. No cambia pagos ni datos existentes. |
| B05 / alta para respaldos | Captura del usuario: la copia de su cuenta en Brave falla con hygiene_tracker_data.listerine debería ser una lista. a07d1f2 introdujo un objeto de ciclo (status/startDate); d4d925b quitó la tarjeta, pero el dato podía permanecer. QA no tenía ese objeto. Reproducción exacta con datos sintéticos en el código actual: no es evidencia de un deploy viejo ni de una falla propia de Brave. | Compatibilidad acotada con ese objeto histórico, conservando el dato completo y los controles de JSON seguro. Exportación/importación, cifrado/descifrado y UI en1440/390, ambos temas, aprobados. No se borra el resto ni se reactiva la tarjeta. El usuario confirmó en su Brave personal la creación, consulta y descarga cifrada correctas después del despliegue. |
| B06 / media | Reingreso real QA: el input de contraseña del acceso conserva su valor después de autenticarse y ocultarse el formulario. Se comprobó sólo presencia/ausencia, sin exponer el valor ni guardarlo en el informe. | Limpiar los campos de contraseña al completar un acceso exitoso, antes de continuar con el bloqueo local. Regresión de autenticación y comprobación UI. No se cambia la contraseña de la cuenta. |

Los avisos sobre el
global clients del Service Worker y sobre bind/getters eran falsos positivos.
Se estabilizaron los fixtures y su sincronización; el test de horarios fija la
identidad de la tarjeta para no cambiar de objetivo al alcanzar su límite.

## Cobertura

| Superficie | Validación local / aislada | Navegador QA real |
| --- | --- | --- |
| Higiene / Cuidado / tarjetas | Migración legacy, registro, umbrales, pausa, archivo/recuperación; reglas y avisos. | Altas sin Push, 70/85 automático, registro, historial, pausa/reanudación y archivo/Deshacer en Higiene; alta/registro/pausa en Cuidado. |
| Lentes | Temporizador, finalizar/cancelar, duración/historial; regresiones de stock y fechas. | Timer, historial, Deshacer; stock2→nuevo par→1 conservado tras recarga; stock0 rechaza descuento. Stock final0 como al inicio. |
| Salud | HTTPS, rechazo de URL insegura, estudio sin adjunto, cancelación/borrado aislado; rutas privadas, MIME, límites y eliminación fallida. | Dos registros y PDF sintético privado de605bytes: carga y apertura en visor PDF confirmadas. Sin datos clínicos reales. |
| Vehículo | Catálogo anterior/dinámico, pausa, aceite/kilometraje inválido y válido, documentos, falla/solución/deshacer, control mensual. | Control30días, pausa/reanudación, falla/solución/Deshacer; documento sintético con vencimiento2027-10-14, pausa impide guardar y recarga conserva fecha. |
| Gimnasio | PR, rutina vinculada, sesión tras recarga, finalizar/descartar/cancelar, comidas generales/fijas, copia, edición, totales y peso; suplementos en regresiones. | PR; rutina Lunes/Jueves; sesión de 40 kg × 8 conservada tras recarga y finalizada; comida general→fija, edición 200→240 kcal, peso e historial. B03 detectado al exportar. Medicación no alterada. |
| Proyectos | Arbitraje sin entrega demorada, fecha exacta, neto, cobros parciales, plantillas y tarjetas estables. | Arbitraje resuelto50%=37,07; proyecto neto100: parciales50+25, timer/navegación, entrega, cancelar pago conserva estado y pago final25 cierra sin duplicar ingresos. B04 detectado en etiqueta. |
| Finanzas | Cuentas, transferencias, pago de tarjeta sin duplicar gasto, moneda nativa, presupuesto, edición, recurrentes, backup y editor obsoleto. | Banco 1000; gasto120 y pago120 dejan banco880/tarjeta0 sin otro gasto. Presupuesto100 excedido20; edición120→150; búsqueda; ARS12000 a cotización1200. Saylor: ingreso único300. |
| Suscripciones | Paga/prueba/gratuita, gasto mensual, conversión, reactivación y fecha vencida rechazada, horarios y deduplicación. | Prueba gratis no suma; pausa/reactivación; conversión suma12/mes; pago confirmado en historial y renovación avanza un ciclo. Final pausada, sin Push ni gasto automático. |
| Trading / Saylor | Eventos/reglas; 90 balas, posición/margen, cierre/edición/pérdida, retry idempotente y revisiones en conflicto. | Saylor alta/cierre al20% y vínculo a Finanzas. Evento pausado creado/editado con anticipos14/7/1, conservado tras recarga mediante RPC real. |
| Facultad | Materias, evaluaciones, pendientes, reprogramación, pausa, completar, archivo y expiración de avisos. | Alta y pausa tras recarga; archivo/reactivación de materia; pendiente creado/completado; agenda y evaluación marcada realizada. |
| Tareas | Vacío rechazado, texto escapado, completar/reabrir, borrar/deshacer y captura rápida; contraste de detalle. | Vacío rechazado, crear/editar/completar/reabrir/borrar/Deshacer; recarga. V05/A02 confirmados en detalle. |
| Hoy / búsqueda / perfil | 28 vistas, destinos de búsqueda, 8 pestañas del perfil, módulos, temas y preferencias. | Navegación de los 13 módulos; Hoy; búsqueda de tarea llega a la categoría correcta; cambio claro/oscuro y restauración del tema inicial. |
| Recordatorios / Push | Multihorario, agregar/quitar, categorías, edición/recarga, límites, expiración/idempotencia, API y Service Worker simulado. | Mensual día31 desactivado, horarios09:00/15:00, edición y persistencia tras recarga. Sin suscribir QA ni enviar pruebas al teléfono personal. |
| Acceso / nube / backup | Reconexión, aislamiento entre usuarios, sin escrituras en reposo, copia cifrada, backup válido/inválido, snapshots obsoletos y retry; estado retirado Listerine. | Restauración completa sincronizada. Visor real: clave incorrecta rechazada, búsqueda, versión anterior, carga/desbloqueo sin red mediante Service Worker, descarga cifrada y JSON, reapertura del archivo. JSON recuperado válido e idéntico al backup normal en40secciones. |
| Bloqueo manual (pedido adicional) | Clave equivocada, recarga bloqueada, desbloqueo sin red, otra cuenta, pestañas, cambio de clave, diálogos nativos, atajos, logout/login y ausencia del verificador en backup/nube. | Usuario configuró clave sólo en QA. Verificados: app oculta, Escape/atajos no la exponen, clave incorrecta rechazada, recarga bloqueada, desbloqueo sin red y coordinación entre pestañas. Logout/reingreso real conservó la configuración. |
| Base de datos | Metadatos actuales; RLS/grants reproducidos; planificación SQL con conflictos e integridad. | 29 migraciones alineadas y asesores consultados. |

Resultados locales:

- npm test tras B06: **459 aprobados, 0 fallidos**.
- node --check server.js; 82 archivos activos sin hallazgos del analizador de
  errores de lógica/sintaxis configurado. No es un auditor formal de seguridad.
- npm audit --omit=dev: **0 vulnerabilidades conocidas reportadas**.
- UI audit: 28 vistas × 7 anchos (1920, 1440, 1024, 768, 714, 390, 360) × 2 temas
  = **392 inspecciones geométricas**, sin desbordes/superposición de controles
  detectados por esas reglas. Capturas representativas inspeccionadas.
- La matriz incluye ahora cruces entre acciones rápidas, título y Cuenta.
  El botón nuevo motivó separar las filas en anchos menores de1100px.
- UI modules, planning, improvements y suite general: cada una en escritorio
  1440 y móvil 390, claro/oscuro; sin excepciones no controladas. La suite general
  incluye horarios, Finanzas, recuperación y sesiones.
- SQL planning y reproducción de políticas reales en PGlite: aprobados.

Artefactos locales privados: .tmp-sb/audit-*. Scripts: scripts/ui-smoke.cjs con
LIFECYCLE_UI_SMOKE_ONLY=audit|modules|planning|improvements; sin selector para
suite general. Requiere Playwright/Chrome disponibles y admite
LIFECYCLE_PLAYWRIGHT_MODULE. El sembrado sintético rechaza orígenes no localhost.

## Base de datos y observaciones

- 29 versiones locales y 29 remotas, sin faltantes. Estas correcciones no
  necesitan migraciones ni cambios de esquema.
- Tablas activas con RLS. user_data y trading_events permiten lectura propia;
  documento escrito mediante RPC. Tablas internas de entregas, snapshots,
  perfiles y límites no permiten acceso directo del cliente.
- Funciones activas con search_path fijado y sin EXECUTE para anon. RPC relevantes
  derivan propietario de auth.uid(), acotan entradas y conservan revisiones.
  PostgreSQL aislado confirma lectura propia y rechazo de operaciones cruzadas,
  escritura directa de documento, lectura de logs internos y acceso anónimo.
- Revisadas columnas, constraints validadas, índices, triggers y políticas del
  catálogo actual. Storage médico privado, MIME acotado y máximo 15 MiB;
  lectura/borrado por propietario y carga validada. Sin cambios a Storage.
- Seguridad: **0 errores, 8 advertencias** de RPC SECURITY DEFINER autenticadas.
  Son avisos genéricos que requieren revisar autorización; no se revocan permisos
  necesarios solamente para silenciarlos. Rendimiento: **0 errores,
  0 advertencias y 18 sugerencias informativas**.
- Panel oficial, organización completa (1 proyecto), ciclo **27/09–27/10/2026**,
  Free: egress **0,093/5 GB**, caché **0/5 GB**, BD **0,032/0,5 GB**,
  Storage **0/1 GB**, Realtime **129/2.000.000**, pico **2/200**, MAU **1/50.000**.
  El panel tiene retraso de actualización; el login QA reciente puede no reflejarse.
- Log Query **110,795/100 GB**, marcado Upcoming; el panel indica aplicación
  desde principios de 2027. No es una cuota activa que hoy bloquee la app.
  No se consultaron logs Supabase masivos. Mantener monitoreo de cuotas primero
  y consultar logs solamente ante un incidente concreto.
- Banner de gracia vencida: histórico del 15/09, no prueba restricción actual.
  No se cambió plan, facturación ni infraestructura.
- Supabase informa latencia Realtime externa en monitoreo:
  https://status.supabase.com/. No se atribuye automáticamente a LifeCycle;
  la persistencia QA probada funcionó durante la revisión.

## Límites explícitos

- No se probaron todas las combinaciones, navegadores/dispositivos ni carga
  concurrente alta en producción. Los ensayos adversos fueron aislados.
- Push con teléfono dormido, sin conexión o restringido por Android requiere
  ese dispositivo. Estas correcciones no prueban eliminar cualquier retraso
  del teléfono/proveedor.
- La recepción/visualización física de Push en Android sigue pendiente del
  dispositivo. El bloqueo QA, cierre/reingreso con contraseña existente y
  recuperación de los datos desde Supabase ya se verificaron realmente.
- El usuario confirmó el14/10 que habilitó la copia cifrada en su cuenta real
  de Brave, abrió el visor, vio sus datos y descargó el archivo cifrado. Es
  validación manual del usuario, separada de las pruebas directas en QA.
- Comparación QA antes/después del reingreso:40secciones válidas; sólo cambió
  updatedAt de una tarjeta. No cambiaron sus datos funcionales.
- No se forzaron restauraciones ni sesiones de
  propietarios distintos sobre datos personales. Se contrastó
  RLS real y se ensayó en PostgreSQL aislado.
- La cola existente no es edición offline sin conflictos por entidad. Siguen
  las limitaciones ya documentadas del plan anterior: Trading multihorario y
  renovación automática de gastos sin abrir la app; no se presentan como nuevas
  capacidades completadas por esta auditoría.
- No se propone pagar servicios ni cambiar infraestructura para estos defectos.
  Rollback de esta ampliación: Manual Deploy de0144573; sin SQL. El bloqueo
  oculta la interfaz, no cifra todos los datos locales ni las notificaciones del
  sistema operativo. Su clave es por cuenta/navegador, independiente del respaldo.

## Publicación y trazabilidad

- Incidente de Render recuperado: dep-db81c8psrm7s738bfde0 publicó exactamente
  01445733e95fed1b13fb35bce521f54460e46328 el14/10 a20:54:57 Argentina.
  Build correcto, health200, scheduler sin fallos;34logs posteriores sin errores
  ni advertencias. Evidencia: .tmp-sb/deploy-0144573-receipt.json.
- En0144573 se revalidaron detalle claro (contraste17:1), PRlegacy y nuevos,
  backup; el cierre sumó stock, documentos, parciales, pago completo,
  restauración y apertura PDF. Casos: .tmp-sb/qa-pending-tests-results.json.
- Comparación del restore: .tmp-sb/qa-full-restore-validation.json. Respaldos
  completos antes/después y capturas guardados localmente, ignorados por Git.
- La publicación de la revisión de cierre exige Manual Deploy del commit
  esperado, build, health, scheduler y logs; el recibo
  .tmp-sb/audit-completion-release.json identifica la revisión verificada.
- Las pruebas físicas de Android y los pasos de clave manual se mantienen
  separados de las pruebas locales aprobadas. Sin SQL ni costo adicional.
- B05: evidencia del visor en .tmp-sb/qa-emergency-validation.json y capturas
  qa-emergency-*.png. No se modifica la cuenta personal para corregirlo. El
  recibo del Manual Deploy correctivo se guarda en
  .tmp-sb/legacy-backup-release.json, separado de la publicación92af182.
- Pruebas finales del bloqueo y sesión: .tmp-sb/qa-privacy-real-results.json y
  .tmp-sb/qa-relogin-validation.json. El recibo de la publicación de B06 y su
  comprobación posterior se guarda en .tmp-sb/auth-password-clear-release.json.

## Diferencia entre los respaldos

- Backup Unificado: JSON sin cifrar de los datos/configuración del momento;
  listo para importar con vista previa y confirmación. No se actualiza solo.
- Copia cifrada dentro del navegador: se actualiza automáticamente al usar la
  app en esa cuenta y navegador, conservando hasta3versiones. Permite consultar
  sin Supabase. Los cambios hechos sólo en otro dispositivo llegan a esta copia
  cuando ese navegador vuelve a abrir la app y sincroniza.
- Archivo cifrado descargado: conserva las versiones disponibles al descargar;
  se puede abrir en el visor con su clave. Desde allí se puede exportar un JSON
  para restaurar después. La descarga existente no recibe cambios futuros.
- Abrir el visor no restaura ni sobrescribe datos. Los adjuntos privados de
  Storage se referencian; estos respaldos no incluyen sus archivos binarios.
