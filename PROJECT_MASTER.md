# LifeCycle — mapa canónico del proyecto

Fecha de consolidación: 17/11/2026. Este Project Pack organiza fuentes existentes; no amplía alcance ni reemplaza decisiones originales.

## Producto
Aplicación privada de uso cotidiano que concentra vida personal y trabajo. PWA web con tarjetas de ciclos, cuidado, salud/turnos, tareas, Facultad, gimnasio, vehículo, avisos Push, clientes, proyectos, mantenimientos, suscripciones y Finanzas USD/ARS. Evita repartir la organización entre muchas aplicaciones y privilegia rapidez, controles similares y preservación de datos.

Arquitectura: frontend HTML/CSS/JavaScript modular; bundle esbuild publicado; Node 24/Express en Render; Supabase como fuente principal, RPC/ownership y caché local de ejecución; service worker de notificaciones y visor de recuperación cifrada. La app normal requiere red. Android/Capacitor y transcripción conservan código, pero no son trabajo activo.

## Orden de lectura
1. AGENTS.md: instrucciones y límites.
2. PROJECT_STATE.md: estado comprobado, Git, evidencia y continuidad.
3. PROJECT_PLAN.md: qué está cerrado, READY y diferido.
4. DECISIONS.md: reglas vigentes y precedencia.
5. ACCESS_REGISTER.md: entrada a accesos locales sin secretos.
6. Fuentes funcionales siguientes, sólo según la tarea.

## Fuentes funcionales
| Tema | Fuente |
| --- | --- |
| Convenciones de interfaz | docs/UX_CONVENTIONS.md |
| Personal/Trabajo y recordatorios compartidos | docs/ORGANIZACION_Y_DISENO_2026-10-21.md |
| Diseño actual y prototipo aprobado | docs/REDISENO_VISUAL_2026-10-25.md; design-preview.html; qa-preview/visual-2026-10-25/ |
| Arranque, bundle y HTTP/2 | docs/ARRANQUE_HTTP2_2026-10-25.md |
| Clientes, vínculos y mantenimiento cobrado | docs/CLIENTES_Y_MANTENIMIENTOS_2026-10-21.md |
| Rutinas/tarjetas de clientes | docs/RUTINAS_DE_CLIENTES_2026-10-27.md; modules/MaintenanceView.js; maintenance-utils.mjs |
| Suscripciones y separación de pagador | docs/SUSCRIPCIONES_DE_CLIENTES_2026-11-01.md; subscription-utils.mjs; modules/SubscriptionsModule.js |
| Finanzas multimoneda y gráfico de ingresos | docs/FINANZAS_MULTIMONEDA_2026-10-23.md; modules/FinanceWorkspaceModule.js |
| Trading y renovaciones sin abrir la app | docs/TRADING_Y_RENOVACIONES_2026-10-18.md |
| Salud, turnos y ubicación | docs/MANTENIMIENTO_Y_TURNOS_2026-10-20.md; appointments-utils.mjs |
| Cargas | docs/CARGAS_2026-10-17.md |
| Recuperación y exclusiones de producto | docs/ESTABILIDAD_Y_FINANZAS_2026-09-27.md; product-features.mjs |
| Auditoría funcional y pruebas físicas históricas | docs/AUDITORIA_INTEGRAL_2026-10-14.md |
| Operación, Push y verificación | docs/OPERACION_Y_VERIFICACION.md |
| Presupuesto | docs/PRESUPUESTO_OPERATIVO.md |
| Roadmap original A–F, histórico | docs/PLAN_DE_FASES_Y_TANDAS.md; no ejecutar su lista antigua como pendientes actuales |

## Estructura para explorar
- Raíz: app.js, index.html, server.js, utilidades de dominio .mjs/.js, estilos y configuración PWA. No editar bundles generados manualmente.
- modules/: controladores/vistas de cada dominio; no es otro repositorio.
- assets/ y vendor/: tipografía, iconos y dependencias locales con licencias.
- supabase/migrations/ y supabase/verification/: evolución de funciones, almacenamiento y verificaciones SQL.
- scripts/ y tests/: build, nube sintética, smoke UI, SQL aislado y tests.
- .github/workflows/: CI y publicación auxiliar; Render sigue su flujo manual.
- android/: proyecto Capacitor conservado; contiene app/src y Gradle. www/: salida web nativa generada, no fuente canónica.
- docs/: especificaciones, decisiones previas y evidencia descriptiva.
- qa-preview/: 61 archivos locales de propuestas/capturas al migrar, sin versionar. Conservar sin agregarlos masivamente.
- .tmp-sb/: recibos y evidencia local ignorada, puede contener respaldos privados. Consultar archivos concretos, no volcar ni subir la carpeta.
- .codex-qa/, node_modules/, cachés CLI/Gradle: recursos locales; no son entregables ni nuevas fuentes de requisitos.

## Criterio de entrega
Flujo acordado funcional, datos conservados, interfaz consistente, validación proporcional, evidencia distinguida por entorno y release identificado. Una tanda publicada no cierra automáticamente todas las fases históricas o todas las combinaciones físicas.
