# Base visual de LifeCycle

Autorizada por Fabrizio después de la revisión de referencias del 17/10.
Objetivo: más claridad y personalidad conservando rapidez y acceso inmediato.

## Implementación

- Base compartida en `visual.css`: superficies opacas, contraste, pestañas,
  botones, foco y variantes claras/oscuras; acento discreto en Trabajo.
- Higiene y tarjetas configurables: jerarquía de estado, fechas y registro;
  confirmación visual breve después de la sincronización confirmada.
- Cargas: conexión SVG finita al iniciar, tiempo/plazo y estado real del último
  aviso, ayuda secundaria desplegable. Sin más consultas ni polling.
- Proyectos: alta desplegable debajo de los activos y acceso directo arriba;
  atajo de Hoy conserva el foco. Estados reales de curso/entrega; fases continúan
  siendo texto libre, sin progreso de trabajo inventado.
- Saylor: tres cargadores de treinta segmentos; reglas desplegables.
- Preferencia local de movimiento reducido, siempre subordinada a la preferencia
  de accesibilidad del dispositivo. Se elimina el fondo animado continuo.
- Salud, bloqueo, recuperación y Finanzas conservan todos sus controles y
  confirmaciones; no se agregan efectos que retrasen tareas sensibles.

No hay cambios de esquema, datos personales, permisos, facturación, motor Push
ni dependencias de animación. El frontend se puede revertir con Git conservando
los documentos e historiales.

## Validación

La base visual se publicó en `e4fc076` después de 492 tests, pruebas visuales
locales en 1440/390 px con ambos temas, controles de desborde en siete anchos
con ambos temas y navegación autenticada en QA. Se verificaron commit exacto,
`/api/health` y logs posteriores al Manual Deploy.

## Corrección posterior: navegación e iconos

- Se elimina el fade con desplazamiento CSS y la segunda entrada por Web
  Animations al cambiar de módulo: el contenido permanece opaco e inmóvil.
- El logo conserva el glifo blanco sobre azul tanto en LifeCycle como en Trabajo.
- El icono heredado `ph-spray` del pañuelo se representa con `ph-spray-bottle`
  en las tarjetas y el selector, sin modificar el valor ni historial guardados.
- La regresión de navegación se reproduce con el código anterior. La prueba
  inspecciona doce cuadros consecutivos por cambio de módulo y comprueba contraste
  del logo e icono del pañuelo, en escritorio/móvil y claro/oscuro.
- Los efectos de confirmación de guardado y conexión de Cargas se conservan.

Validación local de la corrección: 492 tests sin fallos; navegación e iconos en
1440/390 px, claro/oscuro; y regresión visual de guardado, Cargas, Proyectos,
movimiento reducido y recuperación de errores en los mismos cuatro escenarios.
