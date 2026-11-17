# Estado actual de LifeCycle

Corte: 17/11/2026, migración del chat 01a0efed-8ad3-7de3-9eca-27ac6672b9d2. Leer junto a PROJECT_PLAN.md y DECISIONS.md.

## Punto seguro
- No hay desarrollo parcial, deploy en curso ni operación de escritura pendiente en esta sesión.
- Última implementación funcional: ab2b87c1e46b564173ae2268e58721a3b7621afa, corrección de suscripciones pagadas por clientes (04/11).
- La migración sólo incorpora/actualiza Markdown; no cambia código, datos, configuración, permisos, facturación ni despliegues. El commit documental posterior se identifica con git log; su código ejecutable es el mismo que ab2b87c.
- Antes de la actualización documental el único pendiente Git era qa-preview/ (61 archivos). Se preserva sin limpiar, mover ni commitear capturas en bloque.
- No se detectó servidor local/preview propio que requiriese detenerse. Los dos procesos Node asociados a esta carpeta son kernel.js/trusted-worker.js del runtime de herramientas de esta sesión, sin puertos Listen; no matarlos manualmente.

## Git y destino
- Carpeta: C:\Users\fabro\Documents\Desarrollo freelance\4_Proyectos_personales\LifeCycle.
- Rama de trabajo: codex/full-plan-audit, upstream origin/main.
- Remoto: git@github.com:Fabriziococca/LifeCycle.git.
- Rama publicada: origin/main. Al iniciar la migración, Git local, remoto (ls-remote) y producción coincidían en ab2b87c.
- Hay un único worktree. El main LOCAL está antiguo y divergente (479fc6a; ahead 9/behind 72 al corte); no cambiarse a él ni fusionarlo por rutina. La rama snapshot de Antigravity también es histórica.
- Commit de migración documental: mensaje docs: preserve LifeCycle continuity for new chat [skip render] [skip ci]. No hacer Manual Deploy de documentación para igualar health.

## Producción comprobada hoy
URL: https://lifecycle-ykn5.onrender.com.
- Render Lifecycle, servicio srv-d90sh067r5hc73bfo76g, workspace confirmado tea-d4ouodi4d50c73ak3dtg, main, plan Free. Config muestra autoDeploy yes; las publicaciones funcionales se hicieron manualmente con commits [skip render].
- Último deploy: dep-dblbocijnfac73fhdpr0, live, commit exacto ab2b87c1e46b564173ae2268e58721a3b7621afa.
- /api/health leído el 17/11 a las 17:58 Argentina: status ok, commit ab2b87c; motor de avisos último éxito 17:55:34.951, renovaciones 17:55:32.708; cero fallos consecutivos y timeouts.
- Supabase: consulta sólo de metadatos confirmó vigente el guard que impide gastos de clientes; avance de seguimiento permitido a service_role y no a authenticated. Sin leer/modificar documentos personales.
- No se hizo auditoría nueva de cuotas, logs históricos ni recepción física hoy. Un health sano no acredita disponibilidad continua ni todas las notificaciones.
- Transcripciones: enabled/configured/running false, coincidente con product-features.mjs.
- Hoy: Node v24.15.0; npm run check:browser y node --check server.js correctos. No se repitió innecesariamente la suite completa para una migración sólo documental.

## Última tanda: cerrada y publicada
Regla: las suscripciones vinculadas a clientes las pagan ellos. cost/currency son informativos; clientId impide registro manual/automático de gastos propios incluso ante una petición de versión vieja.
- Fuentes: helpers isClientSubscription/isExpenseSubscription, normalización autoRecordExpense=false para clientes, formularios y tarjetas compartidos, guard en Finanzas, worker y PostgreSQL.
- Migración aplicada: supabase/migrations/20261104045523_client_subscription_payer_boundary.sql. No es una migración de datos.
- Propias: conservan gasto manual/automático. Clientes: costo informativo. Todas: gasto propio y costo del cliente separado.
- 564 tests aprobados, SQL aislado, UI local 1440/390 y ambos temas. QA productiva autenticada con soyfabr, alta/edición/recarga, sin acciones de gasto y sin overflow; request RPC de cliente bloqueado sin escrituras.
- Fixture QA Pagador 04/11 / QA Servicio del cliente 04/11: importe ficticio USD 20; suscripción pausada y ficha archivada al cerrar. Finanzas de QA sin cambios. No reactivar ni usar este caso como dato personal.
- CI Validate LifeCycle: https://github.com/Fabriziococca/LifeCycle/actions/runs/41776627613, success. Pages también success en esa publicación.
- Recibo local canónico: .tmp-sb/release-client-payer-2026-11-04.json.
- Capturas locales: .tmp-sb/qa-client-payer-2026-11-04/pc-oscuro.png y movil-editor.png.
- Logs del release 04/11: ventana 05:01:38–05:03:32 UTC, sin warning/error; no presentarlos como una revisión de logs del 17/11.

## Entregas previas que no hay que rehacer
- Diseño claro/oscuro cereza/rosa adaptado a PC y móvil; arranque HTTP/2 resuelto con bundle y reintento de acceso.
- Personal/Trabajo; recordatorios compartidos, una sola vez y horarios con controles comunes; Suscripciones en Trabajo.
- Clientes: vínculos explícitos por cliente, mantenimientos con cobros confirmables, tarjetas de ciclos con registro directo, otra fecha desde menú, Seguimientos compacto.
- Suscripciones de Diego creadas por pedido explícito anterior: Webshare anclada 04/11/2026 17:47; ngrok 29/11/2026 21:00; ambas cada 30 días, avisos 7/5/3/2/1/0 a las 22:00, adelantados a la hora de renovación el último día. Son anclas históricas: NO volver a crearlas, resetear fechas ni presumir que esa sigue siendo su próxima renovación.
- Finanzas USD/ARS: originales/histórico/valor actual, estimados identificados, confirmación en lote de ingresos antiguos, gráfico de ingresos y conversiones opcionales sin duplicar ingresos.
- Modales de Proyectos/Finanzas y promedios de ingresos corregidos en octubre.
- Evidencia por tanda en docs/ y recibos concretos de .tmp-sb/. No inferir ausencia de una función por una fila vieja del plan A–F.

## Navegador y recursos al migrar
- Inventario 17/11: navegador integrado de este chat id 2, sin pestañas; MCP Apps id 1, sin pestañas; sin Page/documento compañero ni artefactos/worktrees adjuntos.
- No hay pestaña LifeCycle/QA/Supabase/Render que marcar o recuperar por ID. No se cerró ningún navegador/ventana ajeno.
- QA autenticada se comprobó por última vez el 04/11. Sus cookies/sesión NO se presumen transferibles. En el nuevo chat, inventariar navegadores; abrir LifeCycle en su IAB si hace falta y comprobar identidad antes de escribir.
- docs/ACCESS_REGISTER.md contiene rutas/roles y recuperación sin secretos. No usar almacenamiento de navegador/tokens como atajo ni suponer que una sesión es QA por estar abierta.
- La propuesta aprobada persiste en design-preview.html y qa-preview/visual-2026-10-25/. Un viejo localhost puede estar cerrado; no es una caída de producción.
- Automatización Codex Revisión de Supabase LifeCycle cada 5 días: PAUSED, id revisi-n-diaria-de-supabase-lifecycle, heartbeat ligado al chat anterior. No reanudar, duplicar ni trasladar por esta migración. Es diferente del scheduler operativo de avisos de LifeCycle, que sigue activo en Render.

## Próxima acción
READY-01 de PROJECT_PLAN.md: lectura dirigida, reconocimiento estructural y contraste de continuidad. No hay nueva tanda funcional abierta ni permiso nuevo para reactivar módulos diferidos. Si se confirma el cierre, continuar con el siguiente pedido concreto del usuario; no inventar desarrollo.
