# Caché móvil y ensayo de recuperación

## Resultado de la publicación

Render publicó `aa03976` y después `db7042a`. En la misma sesión autenticada de QA se abrió cada versión. El HTML de la segunda apuntó al JavaScript nuevo y al mismo CSS. En un navegador instrumentado, la segunda publicación transfirió 360.835 bytes de JavaScript y cero de CSS. Otra apertura reutilizó los dos. Se probaron también las respuestas fallidas de JS y CSS y la recuperación mediante «Volver a intentar».

Cada archivo de arranque lleva los primeros 16 dígitos hexadecimales de su SHA-256 en el nombre. Los dos archivos referenciados por el HTML se sirven con caché pública inmutable durante un año. El HTML y el service worker siguen vigentes en cada apertura. Una solicitud de una huella retirada devuelve 404 con `no-store`. Las direcciones históricas sin huella redirigen al archivo actual.

### Medición antes y después

Chrome contra producción, viewport 390 × 844, red simulada de 4 Mbps de bajada y 1 Mbps de subida, 80 ms de latencia y CPU ×4 más lenta. Se hicieron tres pares por versión con perfiles independientes. En cada par se cerró la primera pestaña y se abrió otra en el mismo contexto. La medición anónima excluyó el service worker para aislar la caché HTTP. La verificación de identidad y actualización se hizo por separado en el navegador integrado.

| Mediana en la segunda apertura | Antes | Después |
| --- | ---: | ---: |
| Bytes transferidos por JS + CSS, según Resource Timing | 505.914 | 0 |
| Tiempo desde navegar hasta disponer de ambos archivos | 1,56 s | 0,29 s |
| Tiempo hasta ver el formulario de ingreso | 3,48 s | 2,34 s |

En la primera apertura se transfirieron aproximadamente 506 KB en ambas versiones. La cifra de ingreso depende también de la red y de servicios externos. Las series crudas, la transición entre versiones y los recibos de Render están en `.tmp-sb/cache-recovery-2026-11-19/`. Las dos publicaciones pasaron Validate LifeCycle.

## Reconstrucción y restauración

Se inicializó un clúster PostgreSQL 17.12 local y se construyeron dos bases vacías. Cada una recibió las interfaces mínimas de Auth y Storage del ensayo, el esquema inicial de LifeCycle y las 41 migraciones de Git en orden. Al comparar con el proyecto alojado coincidieron las 453 entradas del catálogo consultado, entre ellas columnas, restricciones, políticas, firmas de funciones, disparadores, publicación Realtime y configuración de los dos buckets.

El historial de Supabase y los archivos locales concuerdan en las 41 versiones y nombres. Se corrigieron en Git tres marcas de tiempo. Cinco scripts históricos contienen comentarios adicionales en Git. El SQL ejecutable comparado coincidió. El servicio alojado sólo se consultó para leer metadatos.

Se exportó un respaldo unificado desde la primera base y se importó en la segunda con el validador y la operación de restauración de LifeCycle. Se comprobaron una tarea, una ficha de cliente, movimientos originales en USD y ARS y la referencia de un estudio. Los bytes del adjunto sintético se copiaron y restauraron por separado. Se verificó su SHA-256, la visibilidad para su titular, el aislamiento respecto de la segunda cuenta y la reversión completa de una restauración con una revisión de tareas obsoleta.

### Repetir el ensayo local en Windows

Desde la raíz del proyecto, con Node 24, los comandos siguientes instalan las herramientas de prueba en una carpeta ignorada. El script crea el clúster bajo el directorio temporal del sistema, escucha en loopback con contraseña efímera y lo retira al finalizar.

```powershell
$toolDir = Join-Path (Get-Location) '.tmp-sb/recovery-tools'
npm.cmd install --prefix $toolDir --no-save --ignore-scripts --no-audit --no-fund '@embedded-postgres/windows-x64@17.12.0-beta.19' 'pg@8.23.1'
$env:LIFECYCLE_POSTGRES_BIN = Join-Path $toolDir 'node_modules/@embedded-postgres/windows-x64/native/bin'
$env:LIFECYCLE_RECOVERY_PG_MODULE = Join-Path $toolDir 'node_modules/pg'
node scripts/rehearse-recovery.mjs
```

El script admite como argumento opcional un archivo JSON de salida para el catálogo reconstruido. La consulta de comparación es `supabase/verification/recovery_catalog.sql`.

### Para una recuperación en otro destino

1. Preparar un destino vacío con Auth, Storage, sus roles y la publicación de Supabase disponibles. En el ensayo local se usó `scripts/recovery-provider-fixture.sql` para representar esas interfaces.
2. Aplicar `supabase/recovery/before_migrations.sql` una vez y luego las migraciones de `supabase/migrations/` en orden de versión. El archivo inicial recupera las dos tablas originales, el bucket médico privado, Realtime y las políticas necesarias para la primera migración.
3. Recuperar aparte las identidades y sus UUID, y los niveles de acceso que correspondan. En el destino de prueba ambas identidades eran sintéticas.
4. Importar la copia unificada en la cuenta correspondiente. Recuperar los archivos privados desde su copia de Storage conservando bucket, ruta, titular y contenido. Verificar un archivo de muestra con su titular y comprobar el aislamiento con otra cuenta.

La prueba cubre PostgreSQL y el recorrido de exportación/importación de la aplicación. La entrega HTTP de adjuntos por el servicio Storage, la recuperación de credenciales de Auth y un simulacro alojado quedan fuera de la medición.
