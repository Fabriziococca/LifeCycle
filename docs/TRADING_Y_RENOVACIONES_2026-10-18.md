# Trading multihorario y renovaciones sin abrir la app

Autorizado el 18/10/2026. Reutiliza Render, Supabase y el scheduler existente de
cinco minutos. No agrega servicios pagos ni realiza pagos a proveedores.

## Comportamiento

- Trading distingue fecha/hora del evento de hasta seis horarios de aviso. Cada
  intervalo de días elegido tiene esos horarios en su fecha calendario argentina.
  Cada envío conserva una clave estable con `@HH:mm`, incluso al pasar de uno a
  varios horarios. Ventana de entrega de quince minutos; no recupera avisos
  vencidos. Pausa, eliminación, cambio de fecha u horario invalidan reintentos.
- Eventos antiguos sin horarios explícitos conservan su comportamiento original.
  Al editar se propone la hora argentina del evento. El envío antiguo aceptado
  cubre esa misma franja, sin bloquear los demás horarios nuevos.
- Suscripciones activas, pagas y con ambas opciones de renovación/registro
  automático habilitadas se procesan desde el servidor, sin navegador ni Push.
  Las manuales, pausadas, canceladas, gratuitas y de prueba no generan gastos.
- Un bloqueo de fila protege el registro del gasto, historial y próxima fecha en
  una sola transacción. El botón manual usa la misma operación y observa un
  período ya registrado. Se conservan ancla de facturación, fin de mes y años
  bisiestos. Fechas, importe y elegibilidad se vuelven a comprobar bajo el bloqueo.
- ARS usa los proveedores existentes y cotización positiva actual; si falla,
  conserva la fecha para reintentar. El gasto incluye importe/moneda originales y
  tasa usada. USD no necesita consultar cotizaciones.
- Recuperación acotada: hasta veinticuatro períodos por suscripción y sesenta y
  cuatro operaciones por ciclo; lo restante continúa en el próximo ciclo.
  `/api/health.subscriptionRenewals` distingue éxito, fallos y trabajo diferido.
- El navegador deja de ejecutar renovaciones automáticas. La confirmación manual
  adopta el registro de suscripciones devuelto por la base, sin volver a avanzar
  la fecha ni duplicar historial. Los respaldos conservan los horarios nuevos y
  siguen aceptando eventos antiguos sin ese campo.

## Base de datos y verificación

Migración aditiva `20261018050000_trading_times_and_subscription_renewals.sql`:
columna de horarios y proyección, compatibilidad de reservas, operación atómica
compartida y RPC de scheduler accesible sólo a `service_role`. RPC manual continúa
limitada a `auth.uid()`. No amplía acceso anónimo ni cambia políticas RLS.

Inventario de las 32 migraciones previas contrastado; ensayo con rollback y
comprobación agregada de preservación de documentos. La aplicación registra la
versión 33 y permite verificar el hash de la fuente guardada.

Pruebas: 502 tests, SQL PostgreSQL aislado de fechas, ARS, permisos, aislamiento,
duplicados y preservación; UI de horarios en 1440/390 px con ambos temas, edición,
duplicados, límite, pausa y recarga; regresión de Finanzas/suscripciones/bloqueo/
backup y ausencia de escrituras en reposo. Recibo de QA autenticada, renovación
con navegador cerrado y publicación en `.tmp-sb/renewals/release-receipt.json`.

Rollback: publicar el commit anterior manteniendo migración y documentos. Los
clientes anteriores conservan la firma de su RPC; los documentos e historiales
no se eliminan para volver de versión. Cargas y Trabajo requieren una prueba
física propia en Android; una aceptación Push no prueba su visualización.

## Corrección de reapertura detectada en QA

La primera prueba real confirmó los dos registros del servidor, pero al reabrir
se reprodujo una pérdida sólo en esos datos sintéticos: el RPC manual ya
confirmado se había marcado nuevamente como pendiente. La cola durable subía
su instantánea anterior antes de leer las renovaciones remotas.

- Se suprime el eco local de las instantáneas confirmadas por RPC y se conserva
  su revisión mínima. Una copia confirmada no constituye otra edición del usuario.
- Los cambios pendientes de Finanzas y Suscripciones usan una base confirmada
  por cuenta y combinan sólo las diferencias locales con los registros remotos.
  Pausar una tarjeta no puede retroceder su fecha/historial ya renovados.
- La nueva RPC autenticada compara la revisión bajo bloqueo antes de escribir;
  un conflicto permite hasta tres intentos y luego conserva la cola para reintento.
  Sólo se leen los dos campos financieros, sin descargar otros documentos.
- La cola antigua sin base se trata de forma conservadora, preservando los
  gastos automáticos y el avance/historial que el navegador no había observado.
  La base local se elimina al cerrar sesión y no se sincroniza ni exporta.
- Regresión ejecutable: cerrar con claves pendientes, modificar la nube como el
  scheduler y reabrir, tanto con base como con cola antigua, en escritorio/móvil
  y claro/oscuro. También se comprueba que una eliminación local explícita con
  base conocida siga respetándose. No se presenta como solución de todos los
  conflictos offline de cualquier módulo.

La migración adicional `20261018053000_financial_sync_revision_guard.sql` es
aditiva y no modifica documentos. El recibo operativo distingue la prueba
fallida de reapertura y la comprobación final de conservación.
