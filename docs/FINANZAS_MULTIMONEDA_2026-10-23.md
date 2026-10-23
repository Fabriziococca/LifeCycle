# Finanzas: conversión automática, moneda original e histórico

Alcance autorizado el 23/10/2026: totales USD/ARS compartiendo preferencia con
Proyectos, desglose de moneda original, equivalentes históricos de cada cobro,
valoración actual de cuentas y conversión opcional entre cuentas. No añade bancos,
servicios pagos ni obliga a registrar compras de dólares.

## Reglas y conservación

- `amount` sigue siendo el equivalente USD guardado. No se reescribe el historial.
- La vista predeterminada convierte automáticamente al cambio actual de referencia
  compartido con Proyectos (Lemon vía CriptoYa; respaldo identificado si falla).
  No requiere completar cotizaciones antiguas. Usa los importes originales cuando
  existen y el equivalente USD guardado cuando la moneda original es desconocida.
  El selector Cotización permite alternar con el histórico de cada cobro/gasto.
  Sólo se guarda la preferencia local de vista; nunca se guarda el cambio actual
  como cotización de una fecha pasada ni se presume la moneda de cobros antiguos.
- `nativeCurrency` y `nativeAmountMinor` conservan moneda e importe recibidos.
  En ARS, `exchangeRate` fija ARS por USD al registrar el cobro/gasto. En USD,
  `exchangeRate=1` y `valuationRate`, opcional, guarda la referencia histórica ARS.
- Una cotización actual sólo se sugiere para la fecha de hoy y con caché fresca.
  Para el histórico estricto, fechas anteriores necesitan una cotización ingresada
  expresamente. Sin ella, el informe ARS identifica subtotal e importes sin convertir;
  no usa el dólar de hoy. La vista Actual · automática sigue disponible sin esa carga.
  Si todos carecen de cotización, muestra el equivalente USD guardado y el
  resultado pendiente; no presenta ingresos ni resultado en ARS como cero.
- Los registros antiguos sin moneda original conservan su equivalente USD y se
  muestran por separado. No se los presenta como dólares efectivamente cobrados.
- `workspace.receipts` permite completar datos del registro desde Finanzas sin
  duplicar el movimiento ni modificar documentos de Proyectos/Mantenimientos.
  Incluye identidad, fecha, equivalente USD y huella del origen: una modificación
  del origen invalida su aplicación. Parciales conservan la identidad al archivar.
  También permite completar sólo la cotización, manteniendo original desconocida.
- Los nuevos cobros parciales/finales de Proyectos confirman moneda y cotización;
  sus metadatos acompañan al movimiento derivado. Una edición concurrente o un
  cambio de cuenta impide confirmar un proyecto distinto del revisado.
- El saldo neto agrega cuentas registradas, archivadas y deudas de tarjetas hasta
  hoy; excluye movimientos futuros y no depende del mes ni del filtro del informe.
  Se informa origen/fecha/frescura de la referencia actual. Si falta, no se inventa
  una valoración conjunta. El saldo es manual, no una consulta bancaria.
- Traspasos de igual moneda conservan el formato anterior. En una conversión,
  `amountMinor/currency` es lo enviado y `receivedAmountMinor/receivedCurrency`
  lo neto recibido. La cotización surge de esos importes reales; no hay otro ingreso
  ni gasto. Anular conserva el registro y deja de afectar ambos saldos. Las
  conversiones no se aplican a tarjetas de crédito.
- Resumen, Movimientos y cobros de Proyectos comparten moneda de visualización y
  criterio de cotización. El desglose original se conserva en ambas vistas. El
  informe mensual a valor actual no representa dinero que aún conservás; el saldo
  de cuentas se calcula separadamente a partir de los movimientos registrados.
- Backups y recuperación cifrada usan el mismo validador para los campos nuevos.
  No hay migración SQL ni modificación masiva de datos/propietarios/permisos.

## Verificación

- Pruebas de cálculo: mezcla USD 1.000 + ARS 500.000, tipo histórico 1.000,
  valoración posterior 1.800, datos antiguos, cotización incompleta, conversiones
  en ambos sentidos, anulación, fechas futuras, referencias alteradas y backups.
- Navegación real en navegador local con nube sintética, escritorio 1440 y móvil
  390, carbón y piedra: desglose, filtros, persistencia al recargar, cobros
  parciales/finales y ausencia de duplicación.
- QA autenticada: identidad confirmada antes de escribir, respaldo previo,
  registros sintéticos y comparación de datos tras retirar las pruebas. La cuenta
  personal queda fuera del procedimiento.
- Publicación: commit/CI y Manual Deploy se acreditan por separado con health y
  logs en el recibo local `.tmp-sb/currency-release.json`. Ese recibo distingue
  pruebas locales, QA y despliegue; este documento no acredita un despliegue solo.
- La simplificación de vista automática se verifica sin escribir datos en QA;
  su evidencia de publicación se guarda en `.tmp-sb/currency-auto-release.json`.
