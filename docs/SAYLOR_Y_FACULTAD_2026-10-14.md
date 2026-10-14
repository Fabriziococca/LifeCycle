# Saylor, Facultad básica y neumáticos

Alcance aprobado por Fabrizio el 14/10/2026. Implementado y validado sin IA,
servicios nuevos, cambios de planes ni integraciones con exchanges.

## Comportamiento

- Trading → Saylor: tres cargadores de treinta balas; capital/bala configurables
  antes de cargar. Las recargas conservan su valor nominal histórico y distinguen
  posición de margen adicional. Botones de una a cinco balas, historial y anulación
  conservada. Se puede incorporar una posición existente mediante saldo declarado.
  No se deducen aportes a partir del precio actual de BTC.
- Cierre: porcentaje sobre todos los aportes o solamente posición, con opción de
  resultado neto real. Treinta balas de USD 50 al 20% generan USD 300 de ingreso
  en el mes del cierre. El capital devuelto no es ingreso. Una pérdida es gasto;
  el cierre en cero no crea movimiento. Editar un cierre actualiza su movimiento
  derivado con identidad estable, sin duplicación. Se edita desde Saylor.
- Se reutiliza el recordatorio existente de Trading; no se añadió otro.
- Facultad: materias, parciales/finales/recuperatorios/TP, agenda y pendientes.
  Fecha/hora en Argentina, aviso diario configurable desde N días antes (valores
  iniciales: catorce días, 15:00). Pausar/completar/cancelar/archivar/reprogramar
  invalida los avisos anteriores. La hora de la evaluación no se desplaza.
- Neumáticos: tarjeta del propietario, cada treinta días, sin kilometraje, presión
  en frío. Se agregó sin registros; el primer control debe ser real. Se conservan
  las doce tarjetas anteriores y sus once registros. No se sembró en otras cuentas.

## Persistencia y compatibilidad

Dos documentos pequeños en user_data: lifecycle_saylor y lifecycle_faculty.
RPC autenticada save_lifecycle_planning con bloqueo de fila, comparación de revisión
por documento y reintentos idempotentes. Un trigger protege también la restauración
mediante merge_user_data_keys; contempla tanto INSERT ON CONFLICT como UPDATE y
las representaciones objeto/string de localStorage. Se conserva el filtro de
escrituras idénticas que evita el eco de Realtime.

El cliente descarta respuestas HTTP/Realtime anteriores a una confirmación de
RPC. No añade polling. Guardar estos dos módulos requiere conexión; un fallo
conserva el formulario. Al cambiar de cuenta se eliminan los formularios privados.
Copias completas, recuperación cifrada, búsqueda y navegación incluyen ambos
módulos; una copia antigua sin esas claves no los borra.

Los avisos académicos reutilizan scheduler, claim/deduplicación y entregas Push
existentes. Ventana máxima de quince minutos y vencimiento a la hora del evento.
Aceptación por el proveedor no demuestra recepción/visualización en el teléfono.
La lámina aportada por el usuario se sirve como recurso estático de Render.

## Base de datos

Migraciones 20261014191358_personal_planning y
20261014212000_owner_monthly_tire_pressure. Historial remoto/local: 29 versiones
alineadas; fuentes remotas verificadas por hash. Vista previa con rollback antes
de aplicar ambas en una transacción. RLS/políticas existentes conservadas; RPC
habilitada solamente para authenticated, sin acceso anon. No se borraron tablas,
columnas, registros ni contenido del usuario. El asesor de seguridad actualizado
no muestra errores; marca la RPC SECURITY DEFINER como advertencia genérica.
Se revisaron auth.uid(), privilegios, aislamiento y search_path fijo; se necesita
ese patrón porque el cliente no tiene UPDATE directo en user_data. El asesor de
rendimiento muestra cero errores, cero advertencias y diecinueve sugerencias
informativas; no se eliminaron índices por sugerencias de falta de uso. La prueba temporal del RPC se
revirtió; no se cargaron campañas o materias sintéticas en producción.

## Verificación y publicación

- npm test: 449/449.
- scripts/planning-sql-check.mjs: PostgreSQL aislado con PGlite (dependencia local
  opcional en .tmp-sb/pglite). Verifica aislamiento, permisos, cálculo de cierre,
  revisiones, reintentos, formatos de backup, escrituras parciales y tarjeta mensual.
- scripts/ui-smoke.cjs, modo planning: flujos completos, recargas, cierre/edición,
  ingresos/pérdidas, Facultad, búsqueda, navegación móvil, recarga, guardado con
  respuesta perdida y privacidad al cerrar sesión. 1440/390, claro/oscuro.
- Regresión general de interfaz: finanzas, suscripciones, recordatorios, perfil,
  recuperación y ausencia de escrituras en reposo. Cuatro combinaciones sin fallos.
- Sintaxis backend/frontend revisada. Push físico pendiente de observar en el
  teléfono; no se afirma entrega real a partir de pruebas sintéticas.

Destino: main de Fabriziococca/LifeCycle. Render: My Workspace,
srv-d90sh067r5hc73bfo76g. Siempre Manual Deploy; verificar commit exacto, build,
/api/health y scheduler/logs posteriores. Recibos locales sin datos personales en
.tmp-sb/planning-supabase-verification.json y .tmp-sb/planning-release.json; el estado
actual de producción se consulta en Render, no se deduce de este documento.

Rollback de aplicación: Manual Deploy del commit anterior 26b23d5. Conservar las
migraciones aditivas y los documentos nuevos para no perder registros posteriores.
La tarjeta de neumáticos usa el catálogo ya existente y sigue siendo compatible.
No realizar resets de producción ni eliminar automáticamente estos documentos.
