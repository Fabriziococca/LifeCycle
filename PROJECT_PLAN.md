# Plan de continuidad de LifeCycle

Corte 19/11/2026. La continuidad del 17/11 se verificó y dio paso a la tanda de Tareas, dependencias, Nutrición móvil y guía.

## Estado reconciliado
| Frente | Estado vigente | Evidencia / límites |
| --- | --- | --- |
| Base operativa, cuenta, backup, navegación | Implementado y auditado dentro de cobertura | docs/AUDITORIA_INTEGRAL_2026-10-14.md; no equivale a todas las combinaciones |
| Tareas regulares PC/teléfono y dependencias | Publicado y comprobado en QA | 4c74c7c, migración 20261119185830. Prueba de colisión entre dos navegadores aislados y ciclo de alta, edición y borrado con la cuenta QA. |
| Nutrición móvil y guía | Publicado y comprobado en QA | bc5109c. Edición con altura reducida, búsqueda de acciones y navegación desde Más. Recibo y alcance de pruebas en PROJECT_STATE.md. |
| Caché de arranque y recuperación | Caché publicada, restauración local verificada | db7042a. Medidas de reapertura, actualización QA y ensayo reproducible en docs/CACHE_Y_RECUPERACION_2026-11-19.md. |
| Acciones rápidas de Hoy | Publicadas y comprobadas en QA | Destinos de revisión y cobro desde Historial, pendiente puntual por cliente y Nutrición opcionales. Pruebas y limpieza en PROJECT_STATE.md. |
| Personal/Trabajo y recordatorios comunes | Implementado/publicado | docs/ORGANIZACION_Y_DISENO_2026-10-21.md; una sola cuenta, una sola vez |
| Diseño y arranque | Implementado/publicado | docs/REDISENO_VISUAL_2026-10-25.md y docs/ARRANQUE_HTTP2_2026-10-25.md |
| Clientes, mantenimiento, turnos y tarjetas | Implementado/publicado | Fuentes por dominio enlazadas en PROJECT_MASTER.md; no nueva tanda pendiente |
| Finanzas USD/ARS y gráfico combinado | Implementado/publicado | docs/FINANZAS_MULTIMONEDA_2026-10-23.md; datos estimados no se inventan como originales |
| Trading multihorario y renovaciones sin navegador | Pendientes históricos resueltos por ampliación 18/10 | docs/TRADING_Y_RENOVACIONES_2026-10-18.md; pruebas físicas tienen cobertura acotada |
| Suscripciones de clientes | Implementado/publicado; regla de pagador corregida el 04/11 | Última tanda ab2b87c; PROJECT_STATE.md y recibo específico |
| Transcripciones, biblioteca/IA integrada | ARCHIVADO como producto | Conservar código/datos. No READY. No volver a habilitar por el plan antiguo |
| APK/Android nativo y avisos locales offline | DIFERIDO | No hay nueva autorización ni validación física nativa por inferir de QA web |
| Escritura offline o nueva arquitectura externa | PROPUESTA, no implementación aprobada | Recuperación cifrada sí es sólo lectura |

## READY
**READY-01 — Verificada el 19/11.** Referencia para futuras continuidades.
1. Verificar carpeta, rama, acceso al Project Pack y alcance vigente.
2. Reconocer estructura completa por nombres/carpetas y profundizar sólo en los componentes necesarios.
3. Contrastar el corte con Git/código/configuración/entorno; reconocer el commit documental posterior al funcional publicado.
4. Revisar inventario del nuevo navegador y sesiones, sin asumir transferencia.
5. Si no hay regresión ni un pedido funcional abierto, informar continuidad y esperar el siguiente pedido concreto. Si el usuario lo incluye al abrir el nuevo chat, continuarlo autónomamente dentro de sus permisos.

No hay otra implementación READY abierta. No convertir el inventario de limitaciones en autorización para nuevos desarrollos.

## Pendientes humanos / límites de evidencia
- Recepción Push: el usuario confirmó el 14/10 dos casos Android (segundo plano y app cerrada/pantalla bloqueada). No repetir como pendiente absoluto. No se midió demora exacta ni se cubrió Doze prolongado, todas las restricciones del fabricante o todos los multihorarios.
- Copia cifrada: activación, visor y descarga confirmados por el usuario el 14/10 en Brave; no equivale a activación en cada dispositivo ni a adjuntos binarios incluidos.
- Si una nueva tarea exige sesión QA y ésta no está disponible, comprobar accesos existentes y solicitar sólo el login necesario. No cambiar credenciales, permisos ni usar propietario como sustituto.
- Nuevas pruebas que ocupen teléfono/escritorio requieren coordinación específica. No repetir pruebas invasivas sólo por cambiar de chat.
- La revisión periódica de Supabase en Codex está pausada. Reactivarla o cambiarla de chat requiere un pedido; no es tarea READY.

## Cierre por unidad autorizada
Implementar → validar según riesgo → revisar diff/secretos/datos → commit/push autorizado → CI → Manual Deploy funcional → commit/health/motores/logs → preservar evidencia y estado. Push o health aislados no son cierre integral.

## Plan histórico
docs/PLAN_DE_FASES_Y_TANDAS.md conserva el alcance original A–F. Sus tablas del 13/09 y listas de cierre se leen con las decisiones posteriores: no reabrir Trading/renovaciones ya resueltos ni audio/Android suspendidos. Las especificaciones históricas se consultan cuando haga falta verificar una regla, no como cola automática de trabajo.
