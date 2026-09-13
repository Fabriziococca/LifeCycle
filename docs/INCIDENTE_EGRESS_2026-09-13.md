# Incidente de transferencia Supabase — 13 septiembre 2026

## Diagnóstico confirmado

El exceso corresponde a **transferencia saliente (egress), no al tamaño de la base**.
El panel del ciclo 27 agosto–27 septiembre mostraba aproximadamente 14.25 GB / 5 GB.
El desglose diario atribuye cerca de 13.1 GB a Realtime; Storage aporta unos 5.8 MB.
La base ocupa unos 32 MB y hay dos cuentas. Los audios no explican el pico.

Desde el 6 de septiembre el tráfico Realtime pasa de cientos de KB a cientos de
MB o varios GB diarios. Cada evento reenvía el documento de usuario completo,
de unos 100 KB, aunque sólo se esté guardando una clave sin cambios.

### Cadena causal reproducida

1. Realtime recibe el documento y la app restaura sus módulos.
2. Suscripciones elimina el aviso legado de Workana; Alertas lo recreaba.
3. Los módulos llamaban explícitamente a `triggerDataSync` durante la restauración.
   El interceptor de localStorage evitaba ese eco, pero `queueKeySync` no lo hacía.
4. `merge_user_data_keys` ejecutaba UPDATE incluso cuando `data` era idéntico.
5. Cambiaba `updated_at`, no la revisión del documento; se emitía otro evento
   completo y el circuito podía repetirse sin interacción del usuario.

También se encontraron comparaciones JSON sensibles al orden de propiedades y
una reconciliación de alertas contra memoria anterior a la restauración.

## Evidencia y límites de la auditoría

- Muestra antes: 53 actualizaciones en 83 segundos, revisión 665 sin cambios.
- Logs de las últimas 24 horas: 23,240 llamadas exitosas al RPC de guardado
  desde el cliente web Windows autenticado; 2,587 lecturas de `user_data` desde
  ese mismo tipo de cliente. El tráfico de servidor identificado usa Node/Render.
- Dos cuentas, sin altas nuevas desde el 27 de agosto; sesiones correspondientes
  a los clientes existentes. Tablas de aplicación con RLS y sin acceso anónimo.
- Los avisos de SECURITY DEFINER requieren revisar propiedad y privilegios;
  no son por sí mismos pruebas de intrusión. Las funciones de trabajadores no
  están habilitadas para usuarios normales; el RPC conserva `auth.uid()` y allowlist.
- Hay 280 respuestas 504 del claim de transcripciones en la ventana de logs:
  incidencia operativa separada que requiere seguimiento, no explica los GB de
  Realtime. No se oculta como una auditoría sin errores.
- No se encontraron indicios de acceso ajeno que expliquen este incidente.
  No equivale a una garantía forense de ausencia total de intrusión: los logs
  disponibles en Free sólo cubren una ventana limitada y los bytes de respuesta
  no aparecen en todas las entradas HTTP.

## Corrección de contención

- Migración `20260913214634_prevent_noop_sync_realtime_egress` aplicada:
  el UPSERT sólo actualiza cuando el documento resultante difiere. La comparación
  ocurre sobre la fila bloqueada, conservando la mezcla atómica de claves.
- Se conserva el tipo de respuesta timestamp, los permisos y la allowlist. Las
  PWA antiguas también quedan protegidas. No se borraron ni transformaron datos.
- Cliente: no encolar escrituras al hidratar, no resucitar Workana legado, cargar
  ambos módulos antes de reconciliar, igualdad JSON por contenido y no inventar
  revisiones en el cliente cuando el servidor puede responder a un no-op.
- No se desactiva Realtime, no se reducen horarios ni funciones, no se cambian
  cuotas ni facturación.

## Verificación de esta entrega

- 389 pruebas automatizadas aprobadas.
- Pruebas nuevas fallaban antes de corregir el circuito y pasan después.
- Smoke de navegador a 1440 y 390 px, claro y oscuro, con Realtime simulado que
  deliberadamente emite incluso los guardados idénticos: sin escrituras en reposo,
  la suscripción real sobrevive al eco y no reaparece Workana legado.
- Verificación SQL transaccional: no-op, contrato timestamp, edición real,
  repetición, eliminación de clave, aislamiento, allowlist y autenticación. Todos
  los cambios de la prueba se revirtieron con ROLLBACK.
- Entre 21:47:12 y 21:49:57 UTC: contador de actualizaciones estable en 173230,
  revisión y hashes de ambas cuentas idénticos a los previos. El timestamp del
  documento dejó de cambiar a las 21:46:34 UTC, al aplicar la contención.
- Estado de publicación: pendiente de completar y verificar el despliegue web.

## Restricción de cuota: dependencia externa pendiente

El panel autenticado consultado hoy muestra **15 septiembre 2026** como fin de
gracia, distinto del 10 octubre de las capturas aportadas. No asumir la fecha más
lejana. El período actual termina el 27 septiembre.

Frenar el circuito evita consumo nuevo pero **no descuenta los GB ya contabilizados**.
No se garantiza evitar restricciones del ciclo actual. Se necesita resolución con
Supabase o una decisión explícita sobre un plan temporal si aplican la restricción.
No se ha contratado, activado ni modificado facturación ni contactado soporte.

Fuentes oficiales consultadas:
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy

## Pendientes del plan anterior

Esta entrega contiene el incidente de sincronización. No declara terminado el plan
completo: continúan pendientes la validación física Android/APK, grabación en segundo
plano, exportación de audio compatible, modal de transcripción, retención de fallidos,
repeticiones de Trading y casos de renovación/reactivación de suscripciones señalados
en la auditoría anterior. Se abordan después de estabilizar esta entrega urgente.
