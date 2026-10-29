# Diseño visual y experiencia de uso

Studio Hub es una herramienta para muchas horas de trabajo: oscura por defecto, sobria,
con la información importante primero y sin adornos que cansen. Todo el aspecto sale de
variables CSS (`src/styles.css`); el tema, la densidad y el color de acento solo cambian
sus valores.

## Colores

| Uso | Oscuro (por defecto) | Claro |
|---|---|---|
| Fondo | `#0f1218` (gris carbón azulado) | `#f4f5f8` |
| Superficie de tarjetas | `#161a22` | `#ffffff` |
| Superficie secundaria / campos | `#1c212b` | `#f1f3f7` |
| Texto principal | `#e9edf3` (14,8:1) | `#141821` (17,8:1) |
| Texto secundario | `#b4bccb` (9,1:1) | `#454e5f` (8,4:1) |
| Texto auxiliar | `#8d96a8` (5,9:1) | `#5f6878` (5,6:1) |

Contraste medido sobre la superficie de tarjetas; todo cumple WCAG AA (4,5:1).

### Estados: los mismos en toda la aplicación

| Tono | Color | Significa | Ejemplos |
|---|---|---|---|
| `success` | verde | positivo, terminado | Hecho, Publicada, Al día, Verificado |
| `warning` | ámbar | aviso, vence pronto, por confirmar | Por confirmar, Pide atención, Feedback nuevo |
| `danger` | rojo | error, bloqueo, retraso | Bloqueado, Vencida, Crítica, Atención inmediata |
| `info` | azul | información, trabajo en curso | En curso, Previsto, Deducido |
| `special` | violeta | en revisión, hitos | En revisión, Hito, Pulido |
| `neutral` / `muted` | gris | el resto, y lo que no tiene datos | Pendiente, En pausa, Descartado, Sin datos, Sin decidir |

Los tonos están en `src/domain/catalog.ts` (un sitio para cada estado) y **nunca van
solos**: cada etiqueta lleva icono y texto (`src/ui/components/Badges.tsx`), así se
distinguen sin ver colores, en blanco y negro o con alto contraste del sistema.

### Color de acento

Configurable en Ajustes: violeta (por defecto), azul eléctrico, verde, turquesa, rosa o
uno personalizado. Se usa solo para lo interactivo (botón principal, elemento activo del
menú, foco, enlaces), nunca para estados. Cada acento predefinido tiene su versión para
cada tema con contraste AA comprobado (`src/ui/prefs.test.ts`); con uno personalizado, el
texto que va encima se elige solo (blanco o casi negro, el que más contraste dé).

### Gráficas

Paleta categórica validada para daltonismo (azul y naranja), con leyenda, textos de
ayuda al pasar el ratón y la tabla de datos debajo («Ver como tabla»).

## Tipografía y espaciado

- Inter (variable, incluida en la aplicación: no depende de internet), cifras tabulares
  en contadores y tablas.
- Jerarquía: título de pantalla 1,55 rem / 650; título de tarjeta 0,98 rem / 620; texto
  15 px; auxiliar 0,8 rem; cabeceras de sección en versalitas de 0,72 rem.
- Escala de espaciado de 4 px (`--space-1` … `--space-6`); radios de 6, 10 y 14 px;
  transiciones de 140 ms; sombras mínimas.
- **Densidad** (Ajustes): cómoda o compacta. La compacta reduce el relleno de filas,
  celdas y tarjetas y el tamaño base del texto.

## Estructura

- **Barra lateral** con las 15 secciones del estudio en grupos, en este orden:
  - **Estudio**: Panel y Proyectos; justo debajo, **Juegos** (acceso directo a la ficha de
    cada juego no archivado, con sus tareas abiertas).
  - **Trabajo**: Tareas, Roadmap y Calendario.
  - **Producción**: Builds y versiones, Publicación, Feedback y pruebas, y Eventos.
  - **Conocimiento**: Documentación y Recursos.
  - **Gestión**: Equipo, Finanzas y Estadísticas.
  - Las **vistas guardadas**, y al pie, **Ajustes** y «Contraer».

  Cada sección se despliega para ver sus subsecciones (botón con flecha, `aria-expanded`);
  la activa se despliega sola y lo que se pliega o despliega se recuerda en el navegador.
  Contraída (solo iconos), cada icono lleva a la raíz de su sección. En tableta y móvil es
  un panel que se abre con el botón de menú, se cierra al elegir cualquier destino o con
  `Esc`, y cerrado no recibe el foco del teclado.
- **Contadores** en la barra, solo de lo que pide acción y siempre con texto para lectores
  de pantalla: Tareas (vencidas y bloqueadas, contadas una vez), Feedback (sin revisar) y
  Eventos (inscripciones que cierran en 14 días).
- **Secciones opcionales**: en Ajustes › Preferencias se pueden ocultar las que el estudio
  no use (Roadmap, Calendario, Builds, Publicación, Feedback, Eventos, Documentación,
  Recursos, Equipo, Finanzas, Estadísticas); Panel, Proyectos, Tareas y Ajustes no. Lo
  oculto desaparece de la barra, de la paleta, de «Nuevo» y de las pestañas de la ficha.
- **Barra superior**: ámbito (todo el estudio o un proyecto), búsqueda / paleta de órdenes,
  notificaciones y «Nuevo» (en tres grupos: trabajo, producción y estudio).
- **Cabecera de cada sección**: migas («Tareas › Mis tareas · Tablero Kanban»), título,
  subtítulo, acciones y las subsecciones como pestañas-enlace. El título de la pestaña del
  navegador dice dónde estás.
- **Ficha de un proyecto**: las mismas secciones como pestañas con nombre corto (las siete
  primeras a la vista y el resto en «Más»); en las pestañas que no son el resumen, la
  cabecera del proyecto se queda en lo justo.
- **Área principal** con la pantalla de cada sección. Las pantallas se cargan al abrirlas
  (con un esqueleto mientras tanto) y un fallo en una no tumba la aplicación: sale una
  pantalla de error con salida (volver al panel, recargar o exportar una copia).
- **Paneles laterales** para editar (los campos de cada colección en `specs.ts`, con
  errores claros junto a cada campo, un resumen arriba y las reglas de los datos al
  guardar) y **ventanas** de confirmación. Al borrar, la confirmación dice qué se va con
  ello y qué deja de apuntarle; a una persona con trabajo asignado no se la borra: se
  marca que ya no sigue en el estudio.
- **Avisos** abajo a la derecha tras guardar, borrar o marcar algo como hecho, con
  «Deshacer» cuando se puede.
- **Notificaciones** (campana): lo vencido, lo que vence hoy, eventos de los próximos 14
  días, eventos pasados sin actualizar, bloqueos importantes, feedback sin revisar,
  recordatorios del día, inscripciones que cierran, versiones que se acercan o cuya fecha
  ya pasó y presupuestos superados. Se calculan de los datos; «leído» se recuerda en el
  navegador.

### Subsecciones que se combinan

Las subsecciones son vistas de la misma pantalla, no pantallas sueltas, y van en la URL.
Cada una elige un valor de una **faceta** (`vista`, `filtro`, `tipo`, `canal`, `estado`,
`seccion` o `ver`), y facetas distintas se combinan: «Mis tareas» (`filtro=mias`) y
«Tablero Kanban» (`vista=tablero`) pueden estar activas a la vez, y pasar de una a otra
cambia solo su faceta. Algunas son vistas aparte («Plan de hoy», «Historial de cambios»,
«Informes de pruebas»): al entrar se quitan las demás facetas. Una subsección está activa
cuando pulsarla no cambiaría lo que se ve. El registro está en `src/ui/navigation.ts`.

## Teclado

| Atajo | Hace |
|---|---|
| `Ctrl K` / `Cmd K` o `/` | Abre la paleta: ir a una pantalla, proyecto, vista o elemento; crear cosas; cambiar el tema |
| `↑` `↓` `Intro` | Moverse y abrir en la paleta |
| `Esc` | Cerrar la paleta, un menú, un panel o el menú lateral en móvil |
| `[` | Contraer o expandir la barra lateral |

## Personalización

En **Ajustes** (se guarda en este navegador, aparte de los datos del estudio):

- Tema oscuro, claro o el del sistema; color de acento; densidad.
- **Panel**: qué bloques se ven y en qué orden (también desde «Personalizar» en el propio
  panel). Cada bloque se puede plegar desde su cabecera.
- **Vistas guardadas**: en Tareas o Historial, filtra y pulsa «Guardar vista»; sale en la
  barra lateral y en la paleta. Se renombran y borran en Ajustes. Las guardadas con las
  rutas de la versión anterior (`/trabajo`, `/agenda`…) se reescriben solas a las nuevas.
- **Barra lateral**: secciones visibles y quién eres en este navegador (para «Mis tareas»).
- **Idioma y región**: idioma (español; inglés en preparación), zona horaria
  (`Europe/Madrid` por defecto: con ella se calcula qué día es «hoy»), formato de fecha
  (corta, numérica, larga o ISO), formato de hora (24 o 12 horas) y primer día de la
  semana.

## Adaptable

- Escritorio: barra lateral expandida o contraída y panel a dos columnas.
- Tableta (≤ 960 px): una columna y menú en panel lateral.
- Móvil (≤ 640 px): el buscador baja a su propia fila, los filtros se reparten, los
  formularios van a una columna y **las tablas se convierten en tarjetas** con la etiqueta
  de cada dato. Ninguna pantalla desborda en horizontal (lo comprueba `e2e/recorrido.mjs`
  a 820 y 390 px).
- Se respeta «reducir movimiento» del sistema y los colores forzados de alto contraste.

## Idioma

Los textos de la interfaz salen de `src/i18n/es.ts` (diccionario tipado) con `t('clave')`.
Los de cada sección están en `src/i18n/secciones-es/<sección>.ts` y `es.ts` los junta bajo
`secciones` (se leen con `tr('secciones.<sección>.<clave>')`). Para añadir otro idioma:
copiar `es.ts` y `secciones-es/`, traducirlos (TypeScript avisa si falta una clave) y
añadirlo a `LOCALES` en `src/i18n/index.ts`. Fechas, horas, números e importes se
escriben con `Intl` según el idioma.
