# Auditoría integral de LifeCycle — 14/10/2026

Validación local y QA autenticada completadas. Publicación: pendiente del commit
validado y Manual Deploy; el comprobante posterior registra el hash exacto.
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
- QA real: navegación de los 13 módulos, backup, Facultad y Saylor/Finanzas.
  Se conservan casos con prefijo AUDIT QA: materia archivada, evaluación pausada
  y Saylor cerrada. No generan avisos nuevos.
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

No se detectaron más errores con los análisis ejecutados. Los avisos sobre el
global clients del Service Worker y sobre bind/getters eran falsos positivos.
Se estabilizaron los fixtures y su sincronización; el test de horarios fija la
identidad de la tarjeta para no cambiar de objetivo al alcanzar su límite.

## Cobertura

| Superficie | Validación local / aislada | Navegador QA real |
| --- | --- | --- |
| Higiene / Cuidado / tarjetas | Migración legacy, registro, umbrales, pausa, archivo/recuperación; reglas y avisos. | Apertura y renderizado. |
| Lentes | Temporizador, finalizar/cancelar, duración/historial; regresiones de stock y fechas. | Apertura y renderizado. |
| Salud | HTTPS, rechazo de URL insegura, estudio sin adjunto, cancelación/borrado aislado; rutas privadas, MIME, límites y eliminación fallida. | Apertura y renderizado. Sin archivos clínicos reales. |
| Vehículo | Catálogo anterior/dinámico, pausa, aceite/kilometraje inválido y válido, documentos, falla/solución/deshacer, control mensual. | Apertura y renderizado. |
| Gimnasio | PR, rutina vinculada, sesión tras recarga, finalizar/descartar/cancelar, comidas generales/fijas, copia, edición, totales y peso; suplementos en regresiones. | Apertura y renderizado. |
| Proyectos | Arbitraje sin entrega demorada, fecha exacta, neto, cobros parciales, plantillas y tarjetas estables. | Apertura y renderizado. |
| Finanzas | Cuentas, transferencias, pago de tarjeta sin duplicar gasto, moneda nativa, presupuesto, edición, recurrentes, backup y editor obsoleto. | Saylor: 30 balas de USD 50 cerradas al 20% producen un único ingreso de USD 300. |
| Suscripciones | Paga/prueba/gratuita, gasto mensual, conversión, reactivación y fecha vencida rechazada, horarios y deduplicación. | Apertura y renderizado. |
| Trading / Saylor | Eventos/reglas; 90 balas, posición/margen, cierre/edición/pérdida, retry idempotente y revisiones en conflicto. | Alta y cierre sintéticos, vínculo a Finanzas. |
| Facultad | Materias, evaluaciones, pendientes, reprogramación, pausa, completar, archivo y expiración de avisos. | Alta, pausa conservada tras recargar y archivo reversible de materia. |
| Tareas | Vacío rechazado, texto escapado, completar/reabrir, borrar/deshacer y captura rápida. | Apertura y renderizado. |
| Hoy / búsqueda / perfil | 28 vistas, destinos de búsqueda, 8 pestañas del perfil, módulos, temas y preferencias. | Navegación de los 13 módulos por controles visibles. |
| Recordatorios / Push | Multihorario, agregar/quitar, categorías, edición/recarga, límites, expiración/idempotencia, API y Service Worker simulado. | Sin suscribir QA ni enviar pruebas al teléfono personal. |
| Acceso / nube / backup | Reconexión, aislamiento entre usuarios, sin escrituras en reposo, copia cifrada, backup válido/inválido, snapshots obsoletos y retry. | Sesión QA, backup y planificación persistida tras recarga. |
| Base de datos | Metadatos actuales; RLS/grants reproducidos; planificación SQL con conflictos e integridad. | 29 migraciones alineadas y asesores consultados. |

Resultados locales:

- npm test: **451 aprobados, 0 fallidos**.
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
- Adjuntos reales, restauración destructiva en producción y sesiones de
  propietarios distintos no se forzaron sobre datos personales. Se contrastó
  RLS real y se ensayó en PostgreSQL aislado.
- La cola existente no es edición offline sin conflictos por entidad. Siguen
  las limitaciones ya documentadas del plan anterior: Trading multihorario y
  renovación automática de gastos sin abrir la app; no se presentan como nuevas
  capacidades completadas por esta auditoría.
- No se propone pagar servicios ni cambiar infraestructura para estos defectos.
  Rollback de código: Manual Deploy del commit previo validado 08eceb0; sin SQL.

Próximo paso: publicar el commit validado, Manual Deploy y comprobar hash exacto,
build, /api/health, scheduler y logs posteriores. Guardar comprobante operativo.
