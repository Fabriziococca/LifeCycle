# Rediseño visual aprobado · 25/10/2026

El usuario aprobó la propuesta de `qa-preview/visual-2026-10-25` y autorizó
adaptar todo LifeCycle, en claro/oscuro y escritorio/celular, conservar los datos,
probar en QA y realizar Manual Deploy. El proyecto de Antonio queda excluido:
no leer, editar ni ejecutar recursos allí durante esta implementación.

## Criterios de aceptación

- Paleta blanca/negra con acento cereza y rosa del prototipo aprobado.
- Jerarquía común de títulos, acciones, campos, diálogos y estados. Mantener
  verdes/ámbar/rojos semánticos y las personalizaciones de las tarjetas.
- Navegación inmediata, sin fundido de módulos ni fondos animados; barra lateral
  en PC, riel en tablet, favoritos y Más en celular. Una cuenta compartida.
- Adaptar composición: tarjetas operativas en cuidados, ficha de Cliente,
  listados financieros con originales y estimaciones, formularios legibles.
- Conservar identidades, vínculos, historiales, reglas monetarias, recordatorios,
  sincronización y recuperación. Sin migraciones de datos por el rediseño.
- Incluir entrada/acceso, Cuenta, herramientas secundarias y recuperación.
- QA aislado con copia de lectura del documento personal y Trabajo, sin cargar
  esa copia en una cuenta productiva ni activar Push, renovaciones o cobros reales.
  Complementar con fixtures ficticios y verificar los archivos publicados con
  la misma nube aislada. No usar una sesión cuya identidad no pueda verificarse.
- Commit/push y Manual Deploy sólo tras validaciones relevantes satisfactorias;
  comprobar commit publicado, /api/health, scheduler y logs de Render.

## Estado

Implementación y QA local completadas: 545 tests; flujos de Clientes,
Mantenimiento, Trabajo, organización, Finanzas, preferencias y Suscripciones;
68 vistas de la copia aislada en 1440/390 px; revisión de composición en siete
anchos entre 360 y 1920 px, ambos temas. Navegación opaca inmediata, contraste
de títulos y acciones renderizadas y recuperación cifrada sin conexión
verificados. Paquete web nativo incluye estilos, tipografía e íconos locales;
esto no equivale a una prueba física de Android.

Copia del propietario obtenida en modo lectura: 41 secciones y cinco clientes.
Guardada sólo en `.tmp-sb/` (ignorado), sin envíos a Supabase ni Push desde QA.
Sin migraciones ni escrituras productivas del rediseño. Antonio no se accedió.

La tipografía Inter y los íconos Phosphor 2.1.2 se sirven localmente con sus
licencias. Se conservan las clases e iconos existentes y se evita descargar
esa presentación desde proveedores externos durante cada arranque.

El navegador de verificación presentó rechazos HTTP/2 de módulos en la versión
anterior publicada (`8c65f1f`). Una comprobación anónima con HTTP/1 cargó el
acceso sin fallos. No se presume una sesión QA autenticada a partir de ese
resultado: el chequeo publicado usa un contexto aislado sin datos productivos.

El cierre operativo requiere Manual Deploy y comprobación del SHA, salud,
scheduler y logs. El recibo de esa publicación y la comparación de huellas
de datos se conservan en `.tmp-sb/redesign-release-receipt.json`.

La propuesta anterior usó un servidor temporal que ya estaba cerrado: por eso
su enlace HTTP no podía recargarse. `design-preview.html` conserva la propuesta
ficticia en el origen de la aplicación, sin depender de un servidor local.
