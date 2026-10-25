# Arranque y carga HTTP/2

El bloqueo reportado fue una carga interminable en «Comprobando tu sesión
segura». Se reprodujeron descargas rechazadas con
`ERR_HTTP2_SERVER_REFUSED_STREAM` antes de solicitar `/api/config`.
El mismo acceso anónimo funcionó al usar HTTP/1 en el diagnóstico. No se
atribuyó a contraseña inválida, pérdida de datos ni indisponibilidad de la base.

La entrada del navegador solicitaba un grafo de 117 módulos. Ahora se publica
`app.bundle.js`, compilado mediante esbuild con versión fijada y sin imports
externos de módulos. Se mantienen fuentes, reglas de negocio, almacenamiento,
sesiones y configuración de Supabase. No se desactiva HTTP/2 ni se cambia TLS.

El bundle se incluye en Git para el despliegue actual sin cambiar infraestructura.
Después de editar fuentes, ejecutar `npm run build:browser`. CI ejecuta
`npm run check:browser` para impedir publicar un artefacto desactualizado.
Las pruebas de interfaz y el empaquetado nativo regeneran el artefacto.

Un guard independiente dentro del HTML ofrece «Volver a intentar» si falla la
descarga o si la pantalla inicial no termina en treinta segundos. Recarga la
página sin eliminar sesión, almacenamiento ni respaldos. Si el acceso termina
mientras tanto, el guard no altera la aplicación.

Verificación local: tests automatizados, flujos completos de interfaz de
1440/390 px y ambos temas, fallo forzado de descarga y recuperación por botón
sin perder almacenamiento. `scripts/public-startup-smoke.cjs` comprueba el
arranque anónimo publicado sobre HTTP/2 real, sin banderas de degradación de
protocolo ni interceptar tráfico. La QA autenticada debe verificar la identidad
de la cuenta de pruebas antes de cualquier escritura; nunca sustituirla por la
cuenta propietaria. Evidencia operativa final en `.tmp-sb/http2-release-receipt.json`.

El proyecto de Antonio queda completamente excluido.
