# Finanzas: moneda original, histórico y saldo actual

Alcance autorizado el 23/10/2026: totales USD/ARS compartiendo preferencia con
Proyectos, desglose de moneda original, equivalentes históricos de cada cobro,
valoración actual de cuentas y conversión opcional entre cuentas. No añade bancos,
servicios pagos ni obliga a registrar compras de dólares.

## Reglas y conservación

- `amount` sigue siendo el equivalente USD guardado. No se reescribe el historial.
- `nativeCurrency` y `nativeAmountMinor` conservan moneda e importe recibidos.
  En ARS, `exchangeRate` fija ARS por USD al registrar el cobro/gasto. En USD,
  `exchangeRate=1` y `valuationRate`, opcional, guarda la referencia histórica ARS.
- Una cotización actual sólo se sugiere para la fecha de hoy y con caché fresca.
  Fechas anteriores necesitan una cotización ingresada expresamente. Sin ella,
  el informe ARS identifica subtotal e importes sin convertir; no usa el dólar de hoy.
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
- La vista anterior queda identificada como conversión al cambio de referencia
  actual; el Resumen y Movimientos nuevos son los informes históricos.
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
