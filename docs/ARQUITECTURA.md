# Arquitectura de Studio Hub

Studio Hub es una aplicación web de una sola página (React + TypeScript + Vite) que
funciona entera en el navegador. No tiene servidor: los datos viven en el navegador y se
pueden exportar e importar en JSON. Está pensada para crecer (servidor, integraciones,
varios usuarios) sin rehacer lo que ya hay.

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
│   ├── storage.ts     # StorageAdapter: hoy localStorage; mañana un servidor
│   ├── store.ts       # Estado inmutable + useSyncExternalStore + fusión de datos iniciales
│   └── seed/          # Datos iniciales: áreas y una carpeta por proyecto
└── ui/
    ├── AppShell.tsx   # Barra lateral, selector de ámbito, buscador
    ├── context.tsx    # Ámbito (useScope) y editor (useUI)
    ├── forms.tsx      # Formularios descritos como datos (SPECS)
    ├── Editor.tsx     # Ventana lateral de edición, con las fuentes de cada dato
    ├── components/    # Etiquetas, tarjetas, listas, gráficas, iconos
    └── pages/         # Panel, Hoy, Trabajo, Agenda, Builds, Publicación, Feedback,
                       # Decisiones, Recursos, Historial, Proyectos, Ajustes
```

- **`domain/`** no importa nada de React ni del navegador. Las pantallas no calculan:
  piden a `selectors.ts` (qué toca hoy, qué está bloqueado, qué pide atención…).
- **`data/store.ts`** guarda un único `StudioData` inmutable. Cada cambio crea uno nuevo,
  se guarda con el `StorageAdapter` y avisa a las pantallas. Las pestañas abiertas se
  sincronizan entre sí (evento `storage`).
- **`ui/forms.tsx`** describe los campos de cada tipo de elemento como datos; un solo
  componente (`EntityForm`) los pinta. Añadir un campo es añadir una línea.

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

## Cómo crecerá

- **Servidor o varios usuarios:** otro `StorageAdapter` (API REST, fichero en el repo,
  base de datos) sin tocar las pantallas.
- **Integraciones** (GitHub, Steamworks, calendario…): importadores que escriben
  entidades con su `SourceRef`, como ya hace `scripts/importar-historial-git.mjs` con git.
- **Nuevos tipos de elemento:** el tipo en `types.ts`, su entrada en `catalog.ts`, su
  validación en `validate.ts` y sus campos en `forms.tsx`.
- **Cambios de esquema:** `SCHEMA_VERSION` en `types.ts`; si cambia, una migración en el
  store antes de validar lo guardado.
