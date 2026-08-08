# Convenciones de UX de LifeCycle

Este documento es obligatorio para cualquier cambio de interfaz. Su objetivo es
mantener LifeCycle clara en escritorio y móvil aunque distintas personas o
asistentes modifiquen el proyecto.

## 1. Jerarquía de acciones

- Una acción frecuente y principal debe tener texto visible: `Registrar`,
  `Guardar`, `Nueva tarjeta`.
- Una acción secundaria puede usar texto o icono según el espacio disponible.
- Una acción representada solo por un icono debe tener siempre:
  - un `aria-label` específico para lectores de pantalla;
  - un `data-tooltip` breve cuando su efecto no sea evidente.
- No se agrega tooltip a un botón cuyo texto ya explica de forma completa la
  acción.
- Un tooltip complementa la interfaz, pero nunca puede ser la única forma de
  comunicar información necesaria para completar un flujo.

Ejemplo:

```html
<button
    type="button"
    aria-label="Archivar tarjeta Cepillo de dientes"
    data-tooltip="Archivar tarjeta"
>
    <i class="ph ph-archive"></i>
</button>
```

El controlador compartido también reconoce los `title` existentes y los
convierte al tooltip visual de LifeCycle. El código nuevo debe preferir
`data-tooltip` y `aria-label`.

Los controles compactos reutilizan los componentes visuales comunes:

- `icon-btn` para cierres y acciones de solo icono; `is-danger` identifica una
  acción riesgosa y `icon-btn-sm` reduce su huella únicamente en escritorio;
- `lifecycle-checkbox` para selecciones simples visibles, dentro de una etiqueta
  `lifecycle-checkbox-label` cuando incluya texto;
- `switch` con `slider` para preferencias binarias persistentes.

No se usan cruces de texto (`&times;`) ni checkboxes nativos como controles de
interfaz. Los componentes deben conservar foco visible, estado deshabilitado y
un área táctil mínima de 44 px en móvil.

La cabecera de contenido identifica el módulo activo. En escritorio con la
barra lateral expandida no repite la marca `LifeCycle`; cuando la navegación se
contrae, en tablet o en celular, muestra una identificación compacta.

Las tarjetas configurables exponen `Editar configuración` como acción
contextual, pero siempre abren el administrador y el editor central existentes.
Los estados avanzan en este orden y no cambian los valores guardados:

- `Próximo`: empieza a mostrarse como cercano;
- `Atención`: pasa a una advertencia más visible;
- `Vencido`: alcanzó o superó el plazo configurado.

Vehículo y Salud usan composición compacta sin fusionar datos distintos. El
odómetro permanece como resumen independiente, los mantenimientos conservan
sus historiales y los fluidos vuelven a una columna en móvil. Los formularios
secundarios y los historiales extensos empiezan colapsados, pero nunca se
eliminan ni se recortan sus datos o adjuntos.

## 2. Tooltips y dispositivos

- El tooltip aparece con mouse al mantener el puntero y con teclado al enfocar
  el control.
- `Escape`, un clic, el desplazamiento o un cambio de tamaño lo cierran.
- Debe reposicionarse para no salir de la ventana.
- En pantallas táctiles no se depende del hover: las acciones riesgosas deben
  seguir teniendo confirmación y los modos especiales deben incluir
  instrucciones visibles.
- El texto recomendado tiene entre dos y cinco palabras:
  `Editar tarjeta`, `Archivar tarjeta`, `Borrar registro`.

## 3. Acciones destructivas

- Archivar es reversible y debe preferirse a borrar.
- El borrado definitivo requiere una confirmación explícita cerca de la acción.
- Nunca se usa únicamente un color para explicar el riesgo.
- Después de archivar se ofrece `Deshacer` cuando el flujo lo permita.

## 4. Modo de ordenamiento

- El ordenamiento se inicia desde un único botón `Ordenar tarjetas`; no se
  muestran flechas permanentes en cada fila.
- Mientras está activo:
  - el contenedor cambia visualmente de tono;
  - se muestran instrucciones visibles;
  - editar, archivar y registrar quedan temporalmente fuera del flujo;
  - se ofrecen solamente `Guardar orden` y `Cancelar`;
  - arrastrar está limitado a la misma sección y categoría;
  - cambiar una tarjeta de categoría se hace desde `Editar tarjeta`.
- Con mouse o táctil se mantiene presionada y se arrastra la tarjeta.
- Con teclado se enfoca el control de agarre y se usan `Flecha arriba` y
  `Flecha abajo`.
- Los cambios permanecen como borrador hasta `Guardar orden`; se sincronizan
  con la nube una sola vez.
- Salir del módulo o cambiar la categoría cancela el borrador.

## 5. Estados y mensajes

- Una acción exitosa debe confirmar qué ocurrió.
- Un error debe indicar qué falló y, si corresponde, cómo recuperarse.
- Los estados de carga, vacío y deshabilitado deben ser distinguibles.
- No se debe afirmar que una operación se guardó en la nube antes de que el
  mecanismo de persistencia haya sido invocado correctamente.

## 6. Acciones rápidas globales

- Una acción global permanente se justifica solamente si se usa con frecuencia
  y evita abandonar el contexto actual.
- Debe reutilizar el mismo modelo de datos y la misma persistencia del módulo
  original; nunca crea una fuente paralela.
- El formulario solicita solo la información imprescindible y devuelve el foco
  al control que lo abrió al cancelar o guardar.
- Debe cerrarse con `Escape`, permitir un envío claro desde teclado y mostrar
  los errores dentro del propio formulario.
- En móvil el texto puede reducirse a un icono únicamente si conserva
  `aria-label`, tooltip y tamaño táctil suficiente.

## 7. Registro múltiple

- El registro múltiple debe comenzar desde un único botón visible y entrar en
  un modo claramente diferenciado.
- La selección no modifica datos; recién el botón final aplica una misma marca
  de tiempo a todas las tarjetas elegidas.
- Solo se pueden seleccionar tarjetas activas y visibles en la sección o
  categoría actual.
- Cambiar de módulo, abrir el perfil o cambiar la categoría cancela el modo sin
  guardar.
- La confirmación final debe indicar cuántas tarjetas se registraron.

## 8. Personalización de baja frecuencia

- Una preferencia que se configura ocasionalmente no debe ocupar espacio
  permanente en el flujo diario. Se centraliza en el perfil.
- La pantalla cotidiana puede ofrecer un enlace breve como `Personalizar`, pero
  no debe duplicar el editor completo.
- Los accesos rápidos reutilizan el flujo y la persistencia del módulo de
  origen. Nunca crean versiones paralelas de proyectos, gastos, ingresos,
  sesiones o tarjetas.
- Si el módulo de origen está oculto, su acceso rápido también se oculta sin
  borrar la preferencia.

## 9. Revisión obligatoria

Antes de entregar un cambio de interfaz:

1. Ejecutar `npm test`.
2. Comprobar que los botones de solo icono conservan un nombre accesible.
3. Probar navegación por teclado y foco visible.
4. Probar el flujo principal con mouse y en un ancho móvil.
5. Verificar que los controles dinámicos también reciben tooltips.
6. Confirmar que cancelar un modo de edición no modifica datos.

Las pruebas de contratos de interfaz en `tests/ui-contracts.test.mjs` cubren
parte de estas reglas. No reemplazan la verificación funcional en navegador.

## 10. Plantillas reutilizables

- Una plantilla reutiliza estructura, no identidad: nunca copia cliente, fecha
  de aceptación, fecha límite calculada ni estados de entrega.
- Puede copiar nombre de servicio, plazo, comisión, origen, plan y tareas; las
  tareas se crean con identificadores nuevos y siempre pendientes.
- El presupuesto es optativo porque puede variar entre clientes.
- Aplicar una plantilla solo completa el formulario. El usuario puede revisar
  y modificar todo antes de crear el proyecto.
- Administrarlas es una acción ocasional; seleccionarlas permanece junto al
  formulario donde realmente ahorran tiempo.

## 11. Movimientos financieros recurrentes

- Una regla recurrente nunca crea ingresos ni gastos silenciosamente.
- Al vencer se muestra como pendiente y abre el formulario original con datos
  precargados; el registro ocurre únicamente después de la confirmación.
- Monto, moneda, fecha, categoría y descripción siguen siendo editables en
  cada ocurrencia.
- Cada ocurrencia guarda el identificador de la regla y su fecha prevista para
  impedir duplicados.
- Una regla se puede pausar sin perder su configuración. Eliminarla no borra
  movimientos financieros que ya fueron confirmados.

## 12. Navegación adaptativa

- La navegación cambia de presentación, no de modelo: todos los dispositivos
  deben abrir los mismos módulos y conservar los mismos identificadores.
- Escritorio usa una barra lateral contraíble; tablet, un riel compacto; móvil,
  cuatro favoritos y un acceso `Más`.
- Los favoritos móviles son una preferencia sincronizada y admiten entre uno y
  cuatro módulos. Ocultar un módulo no borra esa preferencia ni sus datos.
- El menú `Más` siempre permite llegar a los módulos restantes, a la cuenta y a
  las preferencias. `Escape` y tocar el fondo lo cierran.
- En móvil ningún flujo puede depender del hover ni de desplazamiento horizontal
  para descubrir un módulo principal.

## 13. Búsqueda y comandos

- `Ctrl+K` o `Cmd+K` abre una única paleta para buscar y ejecutar acciones.
- Buscar nunca debe indexar secretos, adjuntos privados, endpoints Push ni datos
  médicos internos. Solo usa los datos funcionales ya cargados en el cliente.
- Las acciones de la paleta abren el formulario original del módulo. No duplican
  validaciones, persistencia ni modelos de datos.
- Cuando la consulta está vacía se muestran pocas acciones frecuentes; al
  escribir se priorizan coincidencias de nombre y contexto.
- Flechas, `Enter` y `Escape` deben permitir completar el flujo sin mouse.

## 14. Recordatorios configurables

- Un recordatorio recurrente configura un aviso Push semanal; no representa que
  una tarea o una tarjeta haya sido completada.
- Nombre, título, mensaje, hora, días activos, categoría y estado deben poder
  modificarse sin tocar código.
- El catálogo y su programación se sincronizan juntos para que el backend use la
  misma definición visible en la interfaz.
- Eliminar un recordatorio requiere confirmación y ofrece deshacer. No puede
  eliminar tarjetas, tareas ni historiales de otros módulos.
- Los recordatorios existentes deben migrar conservando hora, días y estado.
