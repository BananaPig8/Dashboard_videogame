# Arquitectura de Studio Hub

Studio Hub es una aplicación web de una sola página (React + TypeScript + Vite) que
funciona entera en el navegador. No tiene servidor propio: los datos viven en el navegador
(versión normal) o en la base de datos de su página privada de claude.ai (versión
`build:claude`), y se pueden exportar e importar en JSON. Está pensada para crecer
(servidor, integraciones, varios usuarios) sin rehacer lo que ya hay.

## Principio: el estudio, no un juego

Ninguna pantalla conoce a un juego concreto. Los proyectos son **datos**: añadir un
videojuego es crear un `Project` (desde la interfaz o en los datos iniciales) y todo lo
demás (tareas, builds, calendario, feedback, publicación, historial…) cuelga de su
`projectId`.
Indie Dev Tycoon es solo el primer proyecto de los datos iniciales.

Todas las vistas reciben un **ámbito**: `null` (todo el estudio) o el id de un proyecto.
La misma pantalla sirve para las dos cosas: la ficha de un proyecto reutiliza las vistas
del estudio con el proyecto como ámbito. El ámbito va en la URL (`?p=<id>` o
`/proyectos/<slug>/<pestaña>`), así se puede ir del panel general al detalle y volver sin
perder el sitio, y los enlaces se pueden guardar.

## Capas

```
src/
├── domain/            # Sin React ni navegador: se prueba en Node
│   ├── types.ts       # El modelo de datos (StudioData y sus entidades; SCHEMA_VERSION)
│   ├── collections.ts # Registro de colecciones: prefijo de id, si cuelga de un proyecto,
│   │                  # etiquetas, agrupación en la base y referencias a otras colecciones
│   ├── catalog.ts     # Nombres en pantalla y tono de cada estado, etapa, tipo… y los
│   │                  # repartos de las subsecciones (STAGE_GROUPS, RESOURCE_SECTIONS…)
│   ├── dates.ts       # Fechas «AAAA-MM-DD» en hora local
│   ├── migrate.ts     # Normaliza datos de cualquier versión (idempotente)
│   ├── references.ts  # Qué pasa al borrar algo a lo que otros apuntan
│   ├── validate.ts    # Comprueba unos datos (o un elemento) antes de usarlos o guardarlos
│   ├── selectors.ts   # Las preguntas comunes como funciones puras; reexporta secciones/
│   └── secciones/     # Los cálculos de cada sección (calendario, eventos, finanzas…)
├── data/
│   ├── storage.ts     # StorageAdapter: localStorage (versión normal)
│   ├── remote.ts      # StorageAdapter de la base de datos de la página de claude.ai
│   ├── runtime.ts     # Dónde se ejecuta y las capacidades de la página (db, descargas…)
│   ├── store.ts       # Estado inmutable + useSyncExternalStore + fusión de datos iniciales
│   └── seed/          # Datos iniciales: áreas y una carpeta por proyecto
├── i18n/              # es.ts (común) + secciones-es/ (una por sección), t() y formato (Intl)
└── ui/
    ├── navigation.ts  # Registro de secciones y subsecciones: barra, paleta, migas, pestañas
    ├── AppShell.tsx   # Armazón: barra lateral, ámbito, búsqueda, avisos, «Nuevo», atajos
    ├── Sidebar.tsx    # La barra lateral (sale del registro)
    ├── CommandPalette.tsx  # Paleta de órdenes (Ctrl/Cmd + K)
    ├── Notifications.tsx   # La campana: avisos calculados de los datos
    ├── prefs.ts       # Preferencias de este navegador: tema, acento, densidad, panel,
    │                  # vistas guardadas, secciones ocultas, «yo», idioma, zona horaria
    ├── feedback.tsx   # Avisos con «Deshacer», confirmaciones, pantalla de error, esqueleto
    ├── hooks.ts       # useToday (zona horaria), useFormat (formato elegido), useMediaQuery
    ├── context.tsx    # Ámbito (useScope) y editor (useUI); valores de partida de lo nuevo
    ├── specs.ts       # Los campos de cada colección, descritos como datos
    ├── forms.tsx      # El formulario que los pinta, valida y convierte (importes, horas…)
    ├── Editor.tsx     # Panel lateral de edición: fuentes, reglas al guardar, aviso al borrar
    ├── components/    # Etiquetas, tarjetas, tablas, calendario, listas de pasos, gráficas…
    ├── sections/      # Una carpeta por sección (página, CSS) + registry.tsx (carga diferida)
    └── pages/         # La ficha de un proyecto (Projects.tsx)
```

- **`domain/`** no importa nada de React ni del navegador. Las pantallas no calculan:
  piden a `selectors.ts`, que reexporta los cálculos de cada sección
  (`domain/secciones/<sección>.ts`). Esos ficheros importan de `selectors.ts` y este los
  reexporta: lo importado solo se usa dentro de funciones, nunca al cargar el módulo.
- **`data/store.ts`** guarda un único `StudioData` inmutable. Cada cambio crea uno nuevo,
  se guarda con el `StorageAdapter` y avisa a las pantallas. Las pestañas abiertas se
  sincronizan entre sí (evento `storage`).
- **`ui/specs.ts`** describe los campos de cada colección como datos; un solo componente
  (`EntityForm`, en `forms.tsx`) los pinta y los valida, y el editor comprueba el elemento
  con las mismas reglas que al cargar (`validateEntity`) antes de guardarlo.
- **Preferencias aparte de los datos** (`ui/prefs.ts`): lo que es de cada persona (tema,
  panel, vistas, secciones ocultas, quién es…) no viaja con los datos del estudio.
- **«Hoy» en la zona horaria del estudio** (`domain/dates.ts`, `Europe/Madrid` por
  defecto), no en la del navegador; las fechas del modelo son de calendario y se escriben
  con `i18n/format.ts`.
- El diseño (colores de estado, tipografía, componentes, teclado, móvil) está en
  [`DISENO.md`](DISENO.md).

## Navegación: quince secciones sobre los mismos datos

Las secciones no son pantallas sueltas: todas leen el mismo `StudioData` y comparten
proyectos, tareas, fechas, etiquetas y referencias. `ui/navigation.ts` es la única fuente
del árbol (grupos → secciones → subsecciones); de él salen la barra lateral, la paleta,
las migas, las pestañas de cada sección y las de la ficha de un proyecto.

- Cada subsección es un valor de una **faceta** de la URL (`?vista=`, `?filtro=`,
  `?tipo=`, `?canal=`, `?estado=`, `?seccion=`, `?ver=`); `null` es lo de por defecto.
  `childParams()` cambia solo esa faceta y conserva las demás y los filtros finos;
  `activeChildren()` da las activas (las que, pulsadas, no cambiarían nada). Las pruebas
  están en `ui/navigation.test.ts`.
- **Ámbito**: `scopedHref()` lleva una ruta del estudio al ámbito actual (`?p=<id>` o, en
  la ficha, `/proyectos/<slug>/<pestaña>`). La usan `useScope().href`, la barra, la paleta
  y las cabeceras.
- **Rutas antiguas**: `migratePath()` traduce las de la versión anterior (`/hoy`,
  `/trabajo`, `/agenda`, `/decisiones`, `/historial`, sus pestañas en la ficha y
  `?estado=blocked`); la usan las redirecciones, la ficha y las vistas guardadas.
- **Fechas**: `domain/secciones/calendario.ts` junta en una lista todas las fechas de
  todas las colecciones (fechas límite, eventos, cierres de inscripción, versiones,
  builds, recordatorios). Panel, Calendario, la ficha y los avisos leen esa misma lista.
- **Etiquetas**: comunes a todas las colecciones que las tienen (`TAGGED`); `?etiqueta=`
  filtra cualquier sección, `/etiquetas/<etiqueta>` enseña todo lo que la lleva y
  renombrarla (Ajustes) la cambia en todas partes.
- **Añadir una sección**: su entrada en `navigation.ts`, su página en
  `ui/sections/<sección>/` registrada en `sections/registry.tsx`, sus textos en
  `i18n/secciones-es/<sección>.ts` y sus cálculos en `domain/secciones/<sección>.ts`.
  Añadir una subsección es añadir una línea en el registro y la vista en la página.

## El modelo de datos (versión 2)

Además de proyectos, elementos de trabajo, builds, eventos, feedback, recursos, listas
de pasos e historial, la versión 2 tiene: personas del equipo (`members`), horas
(`timeEntries`), fases (`phases`), versiones para jugadores (`releases`), fichas de tienda
y sus textos (`storeListings`, `storeTexts`), logros (`achievements`), pruebas con
jugadores (`playtests`), recordatorios (`reminders`), movimientos y presupuestos
(`transactions`, `budgets`, en céntimos y en la moneda del estudio) y datos de
plataformas (`metrics`, con su fuente). Lo de fuera (Steam, ventas) se lleva a mano y lo
que afirma un estado externo solo puede ir como verificado con una fuente comprobable.

- **`collections.ts`** es el registro de colecciones: de él salen la validación, la
  normalización, las referencias, el store, la base de claude.ai, los prefijos de id y
  los formularios. Una colección nueva es una entrada ahí (más su tipo, su catálogo, su
  validación y sus campos en `specs.ts`).
- **Normalizar** (`migrate.ts`): los datos de cualquier versión se completan al cargarlos
  (colecciones que faltan, listas vacías), sin renombrar nada; lo de un proyecto que no
  existe se oculta y las referencias perdidas se quitan, con aviso. Es idempotente. Si
  los datos son de una versión más nueva de la aplicación, la página se queda en solo
  lectura en vez de reescribirlos.
- **Referencias** (`references.ts`): cada campo que apunta a otra colección dice qué pasa
  al borrar el destino: se vacía, se quita de la lista, se borra con él o lo impide (una
  persona con trabajo asignado no se borra: se desactiva). Borrar un proyecto borra lo
  suyo, salvo el dinero, que se queda sin proyecto.
- La clave de `localStorage` es `studio-hub:v2`; si no existe se leen los datos de la
  `v1`, que quedan como copia.

## Datos iniciales y cambios del estudio

Los datos iniciales (`src/data/seed/`) llevan versión (`SEED_VERSION`). Cuando una versión
nueva de la aplicación trae datos iniciales nuevos, el panel lo avisa y los trae **sin
pisar** lo que el estudio ha cambiado:

- lo nuevo se añade;
- lo que nadie ha tocado se actualiza;
- lo editado a mano se respeta (el store apunta qué se editó);
- lo borrado a mano no vuelve.

Es `mergeSeed()` en `store.ts`, con su prueba en `store.test.ts`.

## Fiabilidad de cada dato

Cada elemento lleva `sources` (commit, PR, release, README, documento o «anotado a mano»)
y `confidence`:

| Valor | Significa |
|---|---|
| `verified` | Sale tal cual de una fuente. |
| `inferred` | Se deduce de una fuente, pero no lo dice con esas palabras. |
| `to_confirm` | Ninguna fuente lo confirma: lo tiene que confirmar el estudio. |

No hay integraciones activas con Steam, Talo, Discord ni ningún otro servicio: lo que
dependa de ellos sale «Por confirmar» hasta que el estudio lo confirme.

## La página privada en claude.ai

`npm run build:claude` compila con `--mode artifact`: `runtime.ts` sabe que está en
claude.ai (`EN_CLAUDE`), `vite.config.ts` cambia `seed/index.ts` por `seed/vacio.ts` (la
build no lleva datos: todo sale de la base) y `scripts/empaquetar-claude.mjs` deja la
página en `dist-claude/studio-hub.html` (sin `<html>`, `<head>` ni `<body>`, que los pone
claude.ai) y la lista de ficheros que la acompañan en `dist-claude/ficheros.json`.

Se publica con las capacidades `db`, `user` (para saber si quien mira puede escribir) y
`downloads` (exportar copias). Las reglas de la base:

```json
[
  { "path": "", "read": "view", "write": "admin" },
  { "path": "transactions", "read": "admin", "write": "admin" },
  { "path": "budgets", "read": "admin", "write": "admin" }
]
```

Es decir: la ve quien tenga acceso y solo la cambian la dueña o los Editores; las
finanzas (movimientos y presupuestos, `private` en el registro) solo las leen quienes
editan. Para los demás esos documentos no existen (la base no da error: simplemente no
llegan) y la sección Finanzas lo explica.

### Cómo se guardan los datos en la base

`remote.ts` (`RemoteAdapter`) escucha la base en vivo y escribe solo lo que cambia:

| Documento | Qué lleva |
|---|---|
| `estudio/datos` | `{ studio, schemaVersion }` |
| `<colección>/<id>` | Un elemento de cualquier colección del registro (`collections.ts`) salvo las agrupadas, tal cual, más `_orden` (su posición en la lista) |
| `activity/<proyecto>~<AAAA-MM>` | `{ entries: [...] }`: el historial de un proyecto en un mes (para no gastar un documento por commit) |
| `timeEntries/<persona>~<AAAA-MM>` | `{ entries: [...] }`: las horas de una persona en un mes (`sin-persona` si no tiene) |

Los ids que la base no admite (solo letras, números y `_ - . ~ : @ +`) se codifican con
`docIdFor()`. Quien escriba en la base desde fuera (Claude, con su herramienta de datos)
sigue esta misma forma y las reglas de `validate.ts`: si lo que llega no es válido, la
página se queda con lo último bueno y lo enseña en un aviso.

- **Solo lectura:** si la plataforma dice que quien mira no puede escribir
  (`can("data.write")`), o la base rechaza una escritura, la página esconde los controles
  de crear y editar y lo avisa arriba; el editor se abre para consultar.
- **Mientras conecta** no se enseña un panel vacío que engañe: un esqueleto. Sin base
  (abierta fuera de claude.ai o sin sesión), lo explica.
- **Eco:** lo que la página acaba de guardar vuelve de la base; `reconcile()` conserva los
  objetos que no cambian, así no repinta ni rompe «Deshacer».
- Pruebas: `src/data/remote.test.ts`, con una base simulada.

## Cómo crecerá

- **Servidor o varios usuarios:** otro `StorageAdapter` (API REST, fichero en el repo,
  base de datos) sin tocar las pantallas.
- **Integraciones** (GitHub, Steamworks, calendario…): importadores que escriben
  entidades con su `SourceRef`, como ya hace `scripts/importar-historial-git.mjs` con git.
  Ajustes › Integraciones dice cuáles hay y cuáles no; ninguna aparenta estar conectada.
- **Nuevas colecciones o campos:** su entrada en `collections.ts`, el tipo en `types.ts`,
  su catálogo, su validación en `validate.ts` y sus campos en `specs.ts`.
- **Cambios de esquema:** `SCHEMA_VERSION` en `types.ts` y, si hace falta, el paso en
  `migrate.ts` (que no renombra valores: añade y completa).
