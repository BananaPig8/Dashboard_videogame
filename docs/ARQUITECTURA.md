# Arquitectura de Studio Hub

Studio Hub es una aplicación web de una sola página (React + TypeScript + Vite) que
funciona entera en el navegador. No tiene servidor propio: los datos viven en el navegador
(versión normal) o en la base de datos de su página privada de claude.ai (versión
`build:claude`), y se pueden exportar e importar en JSON. Está pensada para crecer
(servidor, integraciones, varios usuarios) sin rehacer lo que ya hay.

## Principio: el estudio, no un juego

Ninguna pantalla conoce a un juego concreto. Los proyectos son **datos**: añadir un
videojuego es crear un `Project` (desde la interfaz o en los datos iniciales) y todo lo
demás (tareas, builds, agenda, feedback, publicación, historial) cuelga de su `projectId`.
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
│   ├── types.ts       # El modelo de datos (StudioData y sus entidades)
│   ├── catalog.ts     # Nombres en pantalla y tono de cada estado, etapa, tipo…
│   ├── dates.ts       # Fechas «AAAA-MM-DD» en hora local
│   ├── selectors.ts   # Las preguntas del panel como funciones puras
│   └── validate.ts    # Comprueba unos datos antes de usarlos (importar, cargar, pruebas)
├── data/
│   ├── storage.ts     # StorageAdapter: localStorage (versión normal)
│   ├── remote.ts      # StorageAdapter de la base de datos de la página de claude.ai
│   ├── runtime.ts     # Dónde se ejecuta y las capacidades de la página (db, descargas…)
│   ├── store.ts       # Estado inmutable + useSyncExternalStore + fusión de datos iniciales
│   └── seed/          # Datos iniciales: áreas y una carpeta por proyecto
├── i18n/              # Idioma: diccionario tipado (es.ts), t() y formato de fechas (Intl)
└── ui/
    ├── AppShell.tsx   # Barra lateral (contraíble), ámbito, búsqueda, avisos, «Nuevo», atajos
    ├── CommandPalette.tsx  # Paleta de órdenes (Ctrl/Cmd + K)
    ├── Notifications.tsx   # La campana: avisos calculados de los datos
    ├── prefs.ts       # Preferencias de este navegador: tema, acento, densidad, panel,
    │                  # vistas guardadas, idioma, zona horaria y formatos
    ├── feedback.tsx   # Avisos con «Deshacer», confirmaciones, pantalla de error, esqueleto
    ├── hooks.ts       # useToday (zona horaria) y useFormat (formato elegido)
    ├── context.tsx    # Ámbito (useScope) y editor (useUI)
    ├── forms.tsx      # Formularios descritos como datos (SPECS), con validación
    ├── Editor.tsx     # Panel lateral de edición, con las fuentes de cada dato
    ├── components/    # Etiquetas, tarjetas, listas, gráficas, iconos, menús
    └── pages/         # Panel (widgets), Hoy, Trabajo, Agenda, Builds, Publicación,
                       # Feedback, Decisiones, Recursos, Historial, Proyectos, Ajustes
```

- **`domain/`** no importa nada de React ni del navegador. Las pantallas no calculan:
  piden a `selectors.ts` (qué toca hoy, qué está bloqueado, qué pide atención…).
- **`data/store.ts`** guarda un único `StudioData` inmutable. Cada cambio crea uno nuevo,
  se guarda con el `StorageAdapter` y avisa a las pantallas. Las pestañas abiertas se
  sincronizan entre sí (evento `storage`).
- **`ui/forms.tsx`** describe los campos de cada tipo de elemento como datos; un solo
  componente (`EntityForm`) los pinta y los valida. Añadir un campo es añadir una línea.
- **Preferencias aparte de los datos** (`ui/prefs.ts`): lo que es de cada persona (tema,
  panel, vistas, zona horaria…) no viaja con los datos del estudio.
- **«Hoy» en la zona horaria del estudio** (`domain/dates.ts`, `Europe/Madrid` por
  defecto), no en la del navegador; las fechas del modelo son de calendario y se escriben
  con `i18n/format.ts`.
- El diseño (colores de estado, tipografía, componentes, teclado, móvil) está en
  [`DISENO.md`](DISENO.md).

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

Se publica con las capacidades `db` (reglas: `{ path: "", read: "view", write: "admin" }`,
es decir, la ve quien tenga acceso y solo la cambian la dueña o los Editores), `user`
(para saber si quien mira puede escribir) y `downloads` (exportar copias).

### Cómo se guardan los datos en la base

`remote.ts` (`RemoteAdapter`) escucha la base en vivo y escribe solo lo que cambia:

| Documento | Qué lleva |
|---|---|
| `estudio/datos` | `{ studio, schemaVersion }` |
| `<colección>/<id>` | Un elemento de `areas`, `projects`, `items`, `builds`, `events`, `feedback`, `resources` o `checklists`, tal cual, más `_orden` (su posición en la lista) |
| `activity/<proyecto>~<AAAA-MM>` | `{ entries: [...] }`: el historial de un proyecto en un mes (para no gastar un documento por commit) |

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
- **Nuevos tipos de elemento:** el tipo en `types.ts`, su entrada en `catalog.ts`, su
  validación en `validate.ts` y sus campos en `forms.tsx`.
- **Cambios de esquema:** `SCHEMA_VERSION` en `types.ts`; si cambia, una migración en el
  store antes de validar lo guardado.
