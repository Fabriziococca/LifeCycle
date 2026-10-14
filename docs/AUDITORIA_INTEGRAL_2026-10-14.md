# Auditoría integral de LifeCycle — 14/10/2026

Auditoría estática/local y recorridos funcionales ampliados en QA real.
Las verificaciones posteriores al despliegue permanecen pendientes: Render
mantiene pausados los deploys gratuitos. No se declara probada cada combinación
posible ni publicada una versión que todavía no tiene deploy.
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
- El respaldo anterior a esas altas está preservado. La exportación posterior
  encontró el defecto B03 y deberá repetirse en QA tras publicar la corrección.
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
| B03 / alta | QA real: registrar un PR con el formulario y exportar muestra `gym_records[0].rir debería ser un número válido`. El select guarda etiquetas como Fallo/RIR 1.5. También impide mostrar correctamente ese RIR. No se perdieron registros. | Nuevos PR numéricos, lectura/exportación compatible con etiquetas anteriores sin reescribir el dato original. Regresión de respaldo completo generado desde UI y lectura de PR legacy; revalidación real pendiente del deploy. |

No se confirmaron otros defectos durante los recorridos descritos. Los avisos sobre el
global clients del Service Worker y sobre bind/getters eran falsos positivos.
Se estabilizaron los fixtures y su sincronización; el test de horarios fija la
identidad de la tarjeta para no cambiar de objetivo al alcanzar su límite.

## Cobertura

| Superficie | Validación local / aislada | Navegador QA real |
| --- | --- | --- |
| Higiene / Cuidado / tarjetas | Migración legacy, registro, umbrales, pausa, archivo/recuperación; reglas y avisos. | Altas sin Push, 70/85 automático, registro, historial, pausa/reanudación y archivo/Deshacer en Higiene; alta/registro/pausa en Cuidado. |
| Lentes | Temporizador, finalizar/cancelar, duración/historial; regresiones de stock y fechas. | Iniciar; cancelar salida conserva timer; finalizar e historial; borrar/Deshacer recupera sesión. No se cambió stock. |
| Salud | HTTPS, rechazo de URL insegura, estudio sin adjunto, cancelación/borrado aislado; rutas privadas, MIME, límites y eliminación fallida. | Tarjeta médica, portal HTTPS, dos registros y PDF sintético de 605 bytes subido a Storage privado. Apertura en visor no verificable en IAB. Sin datos clínicos reales. |
| Vehículo | Catálogo anterior/dinámico, pausa, aceite/kilometraje inválido y válido, documentos, falla/solución/deshacer, control mensual. | Control de 30 días, registro, pausa/reanudación; falla de baja urgencia, solución y Deshacer. |
| Gimnasio | PR, rutina vinculada, sesión tras recarga, finalizar/descartar/cancelar, comidas generales/fijas, copia, edición, totales y peso; suplementos en regresiones. | PR; rutina Lunes/Jueves; sesión de 40 kg × 8 conservada tras recarga y finalizada; comida general→fija, edición 200→240 kcal, peso e historial. B03 detectado al exportar. Medicación no alterada. |
| Proyectos | Arbitraje sin entrega demorada, fecha exacta, neto, cobros parciales, plantillas y tarjetas estables. | Alta con fecha exacta, plan guardado, arbitraje congela timer/plazo; resolución al 50% pasa a historial con neto USD 37,07 e ingreso. |
| Finanzas | Cuentas, transferencias, pago de tarjeta sin duplicar gasto, moneda nativa, presupuesto, edición, recurrentes, backup y editor obsoleto. | Banco 1000; gasto120 y pago120 dejan banco880/tarjeta0 sin otro gasto. Presupuesto100 excedido20; edición120→150; búsqueda; ARS12000 a cotización1200. Saylor: ingreso único300. |
| Suscripciones | Paga/prueba/gratuita, gasto mensual, conversión, reactivación y fecha vencida rechazada, horarios y deduplicación. | Prueba gratis no suma; pausa/reactivación; conversión suma12/mes; pago confirmado en historial y renovación avanza un ciclo. Final pausada, sin Push ni gasto automático. |
| Trading / Saylor | Eventos/reglas; 90 balas, posición/margen, cierre/edición/pérdida, retry idempotente y revisiones en conflicto. | Saylor alta/cierre al20% y vínculo a Finanzas. Evento pausado creado/editado con anticipos14/7/1, conservado tras recarga mediante RPC real. |
| Facultad | Materias, evaluaciones, pendientes, reprogramación, pausa, completar, archivo y expiración de avisos. | Alta y pausa tras recarga; archivo/reactivación de materia; pendiente creado/completado; agenda y evaluación marcada realizada. |
| Tareas | Vacío rechazado, texto escapado, completar/reabrir, borrar/deshacer y captura rápida; contraste de detalle. | Vacío rechazado, crear/editar/completar/reabrir/borrar/Deshacer; recarga. V05/A02 confirmados en detalle. |
| Hoy / búsqueda / perfil | 28 vistas, destinos de búsqueda, 8 pestañas del perfil, módulos, temas y preferencias. | Navegación de los 13 módulos; Hoy; búsqueda de tarea llega a la categoría correcta; cambio claro/oscuro y restauración del tema inicial. |
| Recordatorios / Push | Multihorario, agregar/quitar, categorías, edición/recarga, límites, expiración/idempotencia, API y Service Worker simulado. | Mensual día31 desactivado, horarios09:00/15:00, edición y persistencia tras recarga. Sin suscribir QA ni enviar pruebas al teléfono personal. |
| Acceso / nube / backup | Reconexión, aislamiento entre usuarios, sin escrituras en reposo, copia cifrada, backup válido/inválido, snapshots obsoletos y retry. | Sesión QA y datos de varios módulos conservados tras recarga. Exportación inicial válida; posterior bloqueada por B03 del código antiguo. |
| Base de datos | Metadatos actuales; RLS/grants reproducidos; planificación SQL con conflictos e integridad. | 29 migraciones alineadas y asesores consultados. |

Resultados locales:

- npm test tras la ampliación: **453 aprobados, 0 fallidos**.
- node --check server.js; 82 archivos activos sin hallazgos del analizador de
  errores de lógica/sintaxis configurado. No es un auditor formal de seguridad.
- npm audit --omit=dev: **0 vulnerabilidades conocidas reportadas**.
- UI audit: 28 vistas × 7 anchos (1920, 1440, 1024, 768, 714, 390, 360) × 2 temas
  = **392 inspecciones geométricas**, sin desbordes/superposición de controles
  detectados por esas reglas. Capturas representativas inspeccionadas.
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
- Recepción/visualización física de Push, apertura del PDF en el visor integrado,
  nueva autenticación/cambio de contraseña y publicación del commit corregido
  no están verificadas en esta ampliación.
- Restauración destructiva en producción y sesiones de
  propietarios distintos no se forzaron sobre datos personales. Se contrastó
  RLS real y se ensayó en PostgreSQL aislado.
- La cola existente no es edición offline sin conflictos por entidad. Siguen
  las limitaciones ya documentadas del plan anterior: Trading multihorario y
  renovación automática de gastos sin abrir la app; no se presentan como nuevas
  capacidades completadas por esta auditoría.
- No se propone pagar servicios ni cambiar infraestructura para estos defectos.
  Rollback de código: Manual Deploy del commit previo validado 08eceb0; sin SQL.

## Publicación y trabajo pendiente

- El commit 590e040 fue enviado a origin/main y su CI aprobó. Live continúa
  en 08eceb0: estas pruebas reales examinaron ese código; las correcciones se
  verificaron además localmente, sin simular que ya estén publicadas.
- Manual Deploy rechazado: 3 intentos por panel y 1 por conector, HTTP503;
  sin nuevo deploy/build. Render confirmó pausa de deploys gratuitos y a las
  21:04 UTC del 14/10 seguía trabajando en el incidente:
  https://status.render.com/incidents/8tsd93r1wbmz.
- La ampliación agrega V05/A02/B03 y su regresión. Registro privado de casos:
  .tmp-sb/qa-real-audit-results.json; respaldo previo .tmp-sb/qa-real-audit-before.json.
  No hay respaldo posterior exportado porque B03 lo impide en la versión live.
- Cuando Render acepte deploys: Manual Deploy del último commit aprobado,
  comprobar hash exacto, build, /api/health, scheduler y logs posteriores.
  Repetir exportación QA y validar RIR legacy, detalle claro y cambios visuales
  sobre la versión publicada. Sin migraciones ni costo adicional.
