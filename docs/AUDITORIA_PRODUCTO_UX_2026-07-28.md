# Auditoría de funcionalidad y experiencia de LifeCycle

Fecha de corte: 28 de julio de 2026
Alcance: aplicación web/PWA, módulos funcionales, flujos principales, experiencia móvil y escritorio, notificaciones, sincronización y respaldo.

## 1. Contexto y criterio de evaluación

LifeCycle es una aplicación personal, privada y orientada a ahorrar tiempo al centralizar el seguimiento de tareas, proyectos, finanzas, higiene, cuidado personal, salud, lentes, vehículo y gimnasio.

La auditoría considera como decisiones confirmadas:

- El usuario actual es una sola persona.
- La aplicación debe permanecer cerrada a cuentas no autorizadas.
- Supabase es la fuente principal de datos.
- No se requiere funcionamiento offline.
- La zona horaria funcional es Argentina.
- Las notificaciones deben llegar a cada dispositivo en el que se habiliten.
- Las tareas muy urgentes deben respetar su intervalo configurado durante las 24 horas.
- El objetivo principal es reducir fricción y tiempo de registro, no agregar funciones por el solo hecho de que sean técnicamente posibles.

La evaluación se hizo recorriendo todos los módulos con datos sintéticos en un entorno aislado, inspeccionando los flujos y contrastándolos con el código y las capturas reales provistas.

### Estado de implementación de esta auditoría

La auditoría describe el producto observado al comenzar esta etapa. Durante la misma tanda ya quedaron implementados y verificados:

- Persistencia del último módulo, pestaña de perfil y categoría de Higiene.
- Protección del contador de lentes frente a fechas futuras, cruces de medianoche y valores inválidos.
- Nombres accesibles y estados expandidos en controles compactos, días semanales y documentación del vehículo.
- Backups versionados, validados semánticamente y restaurados de forma atómica.
- Neutralización de contenido HTML introducido por el usuario en los módulos auditados.
- Primera versión del núcleo de tarjetas configurables para Higiene, Cuidado, Lentes y Salud.
- Creación, edición, orden, historial, cambio de fecha, archivo, deshacer, restauración y borrado permanente.
- Unificación de las 32 tarjetas preexistentes en el mismo modelo configurable, preservando sus estados e historiales; las cuentas nuevas comienzan sin tarjetas obligatorias.
- Administrador central agrupado por sección y categoría, con un modo de ordenamiento explícito mediante arrastre o teclado, borrador cancelable y una única persistencia al guardar.
- Sistema compartido de tooltips para controles compactos, compatibilidad con los `title` históricos y nombres accesibles en los iconos auditados.
- Convenciones obligatorias de interfaz documentadas en `docs/UX_CONVENTIONS.md` y verificadas parcialmente mediante contratos automáticos.
- Captura rápida de tareas disponible desde cualquier módulo, con carpeta, urgencia, validación en contexto, confirmación visible, atajo `Alt+N` y reutilización del mismo modelo sincronizado de Tareas.
- Navegación horizontal que centra el contexto activo y muestra una ayuda móvil descartable cuando existen módulos u opciones de perfil fuera de pantalla.
- Estados automáticos de seguimiento, instrucciones colapsadas y alertas opcionales integradas con el Gestor de Alertas.
- Evaluación backend de seguimientos configurables aunque la PWA esté cerrada.
- Motor repetitivo de tareas muy urgentes comprobado sin horario silencioso y con recuperación ante marcas de tiempo corruptas.
- Registro Push canalizado por el backend autenticado, conteo de dispositivos y estado operativo del planificador.
- Validación automática en GitHub Actions y eliminación de la vulnerabilidad npm reportada.

Estas implementaciones no alteran las calificaciones históricas de la sección 5.3; esas notas representan la línea de base observada antes de aplicar la tanda.

## 2. Diagnóstico general

LifeCycle ya tiene una base de producto útil y coherente. Sus mejores decisiones son:

- Las acciones cotidianas suelen resolverse en un toque.
- Los seguimientos muestran último registro, estado y próximo vencimiento.
- Las instrucciones detalladas de Higiene permanecen colapsadas hasta que se solicitan.
- Proyectos, Tareas y Finanzas tienen una relación funcional útil.
- La navegación de perfil concentra correctamente cuenta, notificaciones, instalación, backup y alertas.
- La aplicación es privada y la nube es la fuente autoritativa.
- Las sesiones activas de gimnasio pueden recuperarse.
- Los estados visuales permiten detectar rápidamente qué requiere atención.

La mayor limitación actual no es la falta de módulos sino la rigidez del modelo: gran parte de Higiene, Cuidado, Lentes, Salud y Vehículo está definida en código. Esto obliga a modificar y desplegar la aplicación cuando aparece un seguimiento nuevo.

El segundo problema es la densidad visual. Varias pantallas muestran demasiadas instrucciones, tarjetas o campos al mismo tiempo. La información es valiosa, pero compite con las acciones frecuentes.

El tercer problema es la fragmentación: cada módulo desarrolló sus propios patrones de formulario, confirmación, historial, edición y notificación. Funciona, pero aumenta la carga mental y el costo de mantenimiento.

## 3. Auditoría de funcionalidad y mejoras

### 3.1 Núcleo y navegación

| Mejora | Problema que resuelve | Cómo funcionaría | Beneficio esperado | Complejidad | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Centro “Hoy” | Para conocer todo lo pendiente hay que entrar a varios módulos o abrir el centro de notificaciones. | Una vista inicial reúne vencidos, acciones de hoy, tareas urgentes, proyectos próximos a vencer, recordatorios y accesos de un toque. | Menos navegación y menor riesgo de olvidar algo. | Alta | Alta |
| Acciones rápidas configurables | Las acciones más usadas están repartidas entre módulos. | El usuario fija entre cuatro y ocho acciones en el encabezado o en “Hoy”: nueva tarea, registrar limpieza, iniciar entrenamiento, registrar gasto, etc. | Reduce clics en el uso diario. | Media | Alta |
| Buscador global | No existe una forma única de localizar una tarjeta, tarea, proyecto o registro. | Búsqueda por nombre con resultados agrupados por módulo y navegación directa. | Ahorra tiempo a medida que crece la aplicación. | Media | Media |
| Recordar contexto de navegación | Algunos filtros o pestañas vuelven a su estado inicial al recargar. | Persistir módulo, subpestaña, mes y categoría seleccionados, sin persistir modales abiertos. | Retoma más rápida del trabajo. | Baja | Media |

### 3.2 Seguimientos configurables

| Mejora | Problema que resuelve | Cómo funcionaría | Beneficio esperado | Complejidad | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Tarjetas configurables compartidas | Higiene, Cuidado, Lentes y Salud contienen tarjetas fijas que solo pueden cambiarse modificando código. | Un modelo común permite crear, editar, archivar y ordenar seguimientos con nombre, sección, acción, intervalo, niveles de aviso, instrucciones e historial. | El usuario amplía LifeCycle sin depender de un despliegue. | Alta | Crítica |
| Plantillas por sección | Un formulario completamente genérico puede resultar difícil de entender. | Al crear una tarjeta se elige una plantilla: limpieza/cambio, cuidado corporal, insumo, control médico o seguimiento simple. Cada plantilla muestra solo los campos necesarios. | Flexibilidad sin formularios abrumadores. | Media | Alta |
| Archivo en lugar de borrado inmediato | Eliminar una tarjeta podría perder contexto e historial. | “Archivar” la oculta de la vista diaria y conserva sus registros; el borrado permanente queda dentro de un panel avanzado. | Menor riesgo de pérdida accidental. | Baja | Alta |
| Orden manual | El orden actual está definido en código. | Controles subir/bajar o arrastre opcional; el orden se sincroniza con la nube. | Las tarjetas frecuentes quedan primero. | Media | Media |
| Integración automática con alertas | Crear una tarjeta y luego configurar su aviso en otra pantalla duplica trabajo. | El creador incluye un bloque opcional de notificación; el Gestor de Alertas refleja la misma configuración. | Evita configuraciones incompletas y ahorra tiempo. | Alta | Alta |

### 3.3 Higiene y Cuidado

| Mejora | Problema que resuelve | Cómo funcionaría | Beneficio esperado | Complejidad | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Nombres claros para acciones secundarias | Editar fecha y ver instrucciones dependen en varias tarjetas de iconos sin nombre accesible. | Mantener los iconos compactos, pero añadir nombre accesible, ayuda y estado expandido. | Conserva la densidad actual sin perder claridad. | Baja | Alta |
| Edición unificada | Fecha, historial e instrucciones se administran con controles diferentes. | Menú accesible por tarjeta con editar, historial, archivar y configurar aviso. La acción principal permanece visible. | Interfaz más predecible. | Media | Alta |
| Registro múltiple opcional | Después de una limpieza general puede ser necesario marcar varios elementos. | Modo de selección temporal “Registrar varios” con confirmación única. | Reduce tareas repetitivas. | Media | Media |
| Resumen por categoría | Las pestañas muestran tarjetas, pero no cuántas están vencidas o próximas. | Cada categoría indica conteo pendiente y próxima acción. | Permite priorizar sin recorrer toda la lista. | Baja | Media |

### 3.4 Lentes y Salud

| Mejora | Problema que resuelve | Cómo funcionaría | Beneficio esperado | Complejidad | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Protección del temporizador de lentes | Un inicio futuro o inconsistente puede producir un contador negativo. | Validar la fecha al cargar, corregir un horario manual que cruza medianoche y mostrar un estado recuperable ante datos inválidos. | Evita información imposible y registros incorrectos. | Baja | Alta |
| Insumos configurables | Los insumos y sus límites están fijados en código. | Plantilla “insumo” con stock opcional, fecha de apertura, duración y aviso. | Permite agregar gotas, soluciones o accesorios nuevos. | Media | Alta |
| Controles médicos configurables | Dentista y oculista son fijos. | Plantilla de control médico con frecuencia en meses, historial y adjuntos opcionales. | Extiende Salud a cualquier especialidad sin código. | Media | Alta |
| Estado de adjuntos | Un backup JSON no copia los binarios privados nuevos. | Mostrar claramente si el archivo está disponible en Storage y ofrecer, en infraestructura, un backup portátil completo. | Evita una falsa sensación de respaldo total. | Alta | Media |

### 3.5 Proyectos, Tareas y Finanzas

| Mejora | Problema que resuelve | Cómo funcionaría | Beneficio esperado | Complejidad | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Captura rápida de tarea | La creación normal exige elegir carpeta o proyecto y completar un formulario. | Campo rápido global con texto y prioridad; carpeta por defecto editable luego. | Reduce el costo de registrar algo antes de olvidarlo. | Baja | Alta |
| Vista de trabajo de hoy | Las tareas y los hitos de proyectos se ven por separado. | Lista única ordenada por prioridad y vencimiento, sin duplicar datos. | Mejor foco diario. | Media | Alta |
| Plantillas de proyecto | Se repiten etapas y tareas en trabajos similares. | Guardar planes reutilizables y aplicarlos al crear un proyecto. | Menos configuración manual en proyectos nuevos. | Media | Media |
| Reglas financieras recurrentes | Ingresos y gastos repetitivos requieren carga manual. | Transacciones recurrentes con fecha, frecuencia y confirmación opcional. | Ahorro mensual y datos más completos. | Media | Media |
| Presupuesto simple por categoría | Finanzas informa ingresos, gastos y balance, pero no muestra desvíos contra un objetivo. | Límites mensuales opcionales y progreso por categoría. | Mejora la utilidad sin convertir el módulo en contabilidad compleja. | Media | Baja |
| Etiqueta clara en acciones iconográficas | Algunos botones, como inicio de temporizador, dependen solo de un icono. | Texto visible o nombre accesible y ayuda breve. | Menos duda y mejor accesibilidad. | Baja | Alta |

### 3.6 Gimnasio

| Mejora | Problema que resuelve | Cómo funcionaría | Beneficio esperado | Complejidad | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Modo entrenamiento centrado | El módulo contiene muchas funciones y formularios en una sola sección. | Al iniciar una sesión, mostrar solo ejercicio actual, series, descanso, progreso y finalizar; el resto queda fuera del flujo activo. | Menos distracción durante el entrenamiento. | Media | Alta |
| Duplicar comida o sesión | Registrar combinaciones repetidas sigue requiriendo varios campos. | Acción “Usar de nuevo” con fecha y cantidades editables. | Carga de nutrición más rápida. | Baja | Media |
| Objetivos y tendencias compactas | Hay históricos, pero cuesta ver progreso reciente de un vistazo. | Resúmenes de peso, récords y adherencia con períodos cortos seleccionables. | Información más accionable. | Media | Media |

### 3.7 Notificaciones, backup y operación

| Mejora | Problema que resuelve | Cómo funcionaría | Beneficio esperado | Complejidad | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Diagnóstico de notificaciones por dispositivo | Hoy se puede activar y probar, pero no se ve una lista clara de dispositivos ni su última prueba. | Mostrar nombre asignable, navegador, alta, última confirmación y estado del endpoint. | Facilita detectar por qué una PC o celular no recibe avisos. | Media | Crítica |
| Prueba guiada | Un error de permisos, PWA o navegador puede ser difícil de interpretar. | Secuencia de diagnóstico: compatibilidad, permiso, service worker, suscripción, backend y recepción. | Reduce incertidumbre y soporte manual. | Media | Alta |
| Registro de entregas legible | Los logs técnicos están en Render y no son cómodos para una revisión diaria. | Panel privado con últimos envíos, omitidos y errores, sin exponer secretos. | Verificación operativa rápida. | Media | Media |
| Backup portátil completo | El JSON actual conserva datos y referencias, pero no descarga los adjuntos privados nuevos. | Generar un paquete comprimido con JSON, manifiesto y archivos descargados de Storage. | Restauración independiente del proyecto actual de Supabase. | Alta | Media |
| Estado del despliegue | Render no está desplegando automáticamente cada push. | Revisar integración GitHub, permisos y ajuste Auto-Deploy; opcionalmente mostrar versión/commit en el perfil. | Menos trabajo manual y certeza sobre la versión activa. | Baja si es configuración / Media si requiere reintegrar | Media |

## 4. Cinco mejoras con mejor relación impacto/esfuerzo

1. **Nombrar y normalizar los controles secundarios de las tarjetas.** Es un cambio pequeño que elimina ambigüedad sin aumentar la densidad visual.
2. **Captura rápida de tareas.** Tareas es uno de los módulos más usados y el beneficio aparece varias veces por día.
3. **Protección del temporizador de lentes y nombres accesibles en controles de icono.** Corrige información imposible y reduce dudas con bajo riesgo.
4. **Recordar módulo, pestaña y filtros recientes.** Evita navegación repetitiva sin cambiar modelos de datos.
5. **Diagnóstico guiado de notificaciones.** Ataca un problema real y vuelve comprobable una función crítica.

El sistema de tarjetas configurables tiene un impacto superior, pero no aparece en esta lista porque requiere una inversión inicial alta y una migración cuidadosa.

## 5. Auditoría de experiencia de usuario

### 5.1 Aspectos especialmente bien resueltos

- **Registro directo:** botones como “Registrar Limpieza”, “Registrar Visita Hoy” o “Cambiar Estuche” expresan bien la acción principal.
- **Estado temporal:** “último”, “próximo” y los colores permiten interpretar rápidamente la mayoría de las tarjetas.
- **Información progresiva:** las instrucciones detalladas de Higiene ya se abren solo bajo demanda.
- **Perfil concentrado:** cuenta, notificaciones, instalación, backup y alertas se encuentran en un lugar lógico y requieren pocos pasos.
- **Continuidad entre módulos:** los proyectos pueden alimentar tareas y finanzas, evitando duplicación manual.
- **Privacidad explícita:** una persona no autenticada no puede navegar el contenido ni crear una cuenta.
- **Recuperación de trabajo:** la persistencia de sesiones activas de gimnasio evita perder un entrenamiento.

### 5.2 Problemas de experiencia detectados

| Problema detectado | Cómo afecta | Impacto | Propuesta | Beneficio | Complejidad |
| --- | --- | --- | --- | --- | --- |
| Navegación principal horizontal con nueve módulos | En móvil solo se ven algunos módulos y no hay una señal fuerte de cuántos quedan fuera de pantalla. | Medio | Indicador de desplazamiento, botón “Módulos” o acceso rápido configurable. | Mejor descubrimiento. | Baja/Media |
| Perfil móvil también depende de desplazamiento horizontal | Al seleccionar una pestaña, las anteriores quedan fuera de pantalla y se pierde contexto. | Medio | Selector compacto, pestañas con indicador o menú desplegable en móvil. | Navegación más clara. | Baja |
| Tarjetas fijas | El usuario no puede adaptar la aplicación a nuevos hábitos o elementos. | Alto | Creador con plantillas, edición, orden y archivo. | Autonomía real del producto. | Alta |
| Controles de icono sin nombre accesible | El significado depende de reconocer el icono o mantener pulsado. | Medio | `aria-label`, `title` coherente y texto cuando la acción no sea obvia. | Menos errores y mejor accesibilidad. | Baja |
| Días semanales identificados solo por una letra | Los dos botones “M” son ambiguos para lectores de pantalla y el grupo es muy ajustado en móvil. | Medio | Nombres completos accesibles, distribución fluida y resumen de selección. | Configuración más confiable. | Baja |
| Formularios de módulos grandes mezclados con contenido | Gimnasio y Vehículo presentan muchos campos aunque solo una parte esté activa. | Medio | Mostrar exclusivamente la subpestaña o flujo elegido y diferir opciones avanzadas. | Menor carga mental. | Media |
| Confirmaciones y errores nativos del navegador | Los mensajes interrumpen el flujo y varían entre plataformas. | Medio | Sistema único de diálogos, avisos y deshacer. | Experiencia coherente y menos pérdidas accidentales. | Media |
| Acciones destructivas sin patrón único | Algunas eliminaciones usan icono, otras texto y las consecuencias no siempre se presentan igual. | Alto | Archivo o deshacer para acciones recuperables; confirmación consistente para borrado permanente. | Mayor seguridad de uso. | Media |
| Falta de una vista diaria consolidada | Para decidir qué hacer ahora hay que combinar mentalmente módulos y alertas. | Alto | Centro “Hoy” con prioridad y acciones directas. | Ahorro diario importante. | Alta |
| Falta de estado de salud de las notificaciones | “Activado” no demuestra que el navegador, endpoint y backend sigan funcionando. | Alto | Diagnóstico por dispositivo y última prueba exitosa. | Confianza y detección rápida de fallos. | Media |
| Temporizador de lentes puede mostrar valores negativos | Presenta información imposible ante una fecha futura o inconsistente. | Alto | Validación y estado de recuperación. | Evita decisiones basadas en datos erróneos. | Baja |
| Backup descrito como completo sin incluir binarios nuevos | Puede interpretarse que un único JSON permite reconstruir también todos los adjuntos. | Alto | Redacción precisa y opción posterior de paquete portátil. | Expectativas correctas y menor riesgo. | Baja para aclaración / Alta para paquete |

### 5.3 Evaluación general

| Dimensión | Puntaje | Lectura |
| --- | --- | --- |
| Facilidad de aprendizaje | 7/10 | Las acciones principales se comprenden, pero la cantidad de módulos y opciones exige exploración. |
| Facilidad de uso diario | 8/10 | Los registros de un toque funcionan bien; pierde puntos por navegación repetida y densidad. |
| Claridad de la interfaz | 7/10 | Los estados son claros, aunque instrucciones, iconos y formularios compiten por atención. |
| Fluidez de los procesos | 7/10 | Los flujos principales funcionan, pero los patrones varían entre módulos. |
| Experiencia general | 7,5/10 | Es una herramienta personal útil y avanzada, con una base sólida para convertirse en un sistema mucho más adaptable. |

### 5.4 Cinco mejoras de experiencia a implementar primero

1. Mantener la información secundaria bajo demanda y dar nombres claros a todos sus controles compactos.
2. Unificar creación, edición, historial, archivo y notificación de los seguimientos configurables.
3. Incorporar captura rápida y una vista “Hoy” para las acciones más frecuentes.
4. Mejorar navegación móvil y mantener visible el contexto seleccionado.
5. Unificar mensajes, confirmaciones, deshacer y diagnóstico de notificaciones.

## 6. Decisiones de producto resultantes

- No conviene convertir todos los módulos especializados en un único constructor sin tipos. Lentes, controles médicos y mantenimientos del vehículo poseen datos diferentes.
- Sí conviene compartir un núcleo de seguimiento recurrente: identidad, orden, archivo, historial, intervalo, estado, instrucciones y alerta.
- Sobre ese núcleo deben existir plantillas por dominio que agreguen campos propios, por ejemplo stock para insumos o frecuencia mensual para controles médicos.
- Los elementos actuales deben conservarse como definiciones del sistema y admitir personalización no destructiva. Los datos históricos no se reemplazan.
- Archivar debe ser la operación normal; borrar permanentemente debe quedar como acción avanzada.
- La configuración de alertas debe pertenecer a la misma tarjeta y reflejarse en el Gestor de Alertas, no duplicarse.

## 7. Criterios de aceptación para tarjetas configurables

Una primera versión se considera completa cuando:

1. Se puede crear una tarjeta en Higiene, Cuidado, Lentes y Salud.
2. Se puede definir nombre, acción principal, intervalo e instrucciones opcionales; los niveles visuales se calculan automáticamente para no sobrecargar el formulario.
3. Se puede registrar una acción y ver, editar o borrar entradas de su historial.
4. Se puede editar, archivar, restaurar y ordenar la tarjeta.
5. Las tarjetas del sistema existentes mantienen sus datos y comportamiento.
6. La configuración y los historiales se sincronizan con Supabase.
7. El backup exporta e importa las nuevas definiciones.
8. Una alerta opcional se configura desde la tarjeta y aparece en el Gestor de Alertas.
9. El backend evalúa las alertas personalizadas sin depender de que la PWA esté abierta.
10. La interfaz móvil no presenta desbordes y todos los controles tienen nombre accesible.

## 8. Orden recomendado de implementación

1. Cerrar estabilización y seguridad de backup/contenido dinámico.
2. Aplicar mejoras objetivas y pequeñas: contador de lentes, etiquetas accesibles y navegación contextual.
3. Introducir el núcleo de seguimientos configurables con migración compatible.
4. Integrarlo primero en Higiene y Cuidado.
5. Agregar plantillas de insumo para Lentes y control para Salud.
6. Integrar alertas dinámicas y probar los intervalos de punta a punta.
7. Abordar centro “Hoy”, captura rápida y navegación móvil. La captura rápida y la orientación móvil ya están implementadas; el centro “Hoy” queda como la siguiente decisión de producto de alcance alto.
8. Cerrar operación: diagnóstico de dispositivos, auto-deploy de Render, seguridad diferida de Supabase y backup portátil.

## 9. Información que todavía requiere comprobación operativa

Estas cuestiones no impiden avanzar con el código, pero no pueden declararse verificadas solo con una simulación:

- Recepción real de push en el celular.
- Alta y recepción real de push en un navegador de escritorio.
- Cumplimiento real de varios ciclos consecutivos de una tarea muy urgente.
- Estado del permiso de notificaciones y políticas del navegador concreto del usuario.
- Configuración de Auto-Deploy e integración GitHub dentro de la cuenta de Render.
- Protección de contraseñas filtradas y RLS adicional del snapshot privado en Supabase.
- Restauración portátil de adjuntos después de implementar el paquete completo.
