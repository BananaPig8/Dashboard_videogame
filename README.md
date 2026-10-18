# Studio Hub

El panel de trabajo del estudio: todos los videojuegos en un sitio, desde la primera idea
hasta la publicación, el mantenimiento y las expansiones. No es una web corporativa: es la
pantalla que se abre cada día para saber qué hacer.

El primer proyecto es **Indie Dev Tycoon** (Godot), con todo lo hecho desde el 27 de
septiembre de 2026 sacado de su repositorio, con fecha y fuente. Cualquier juego nuevo se
añade desde la propia aplicación, sin tocar el código.

## Qué responde

| Pregunta | Dónde |
|---|---|
| ¿Qué proyectos tiene el estudio y cuál es su estado real? | Panel → «Proyectos del estudio»; **Proyectos** |
| ¿Qué tengo pendiente hoy? | Panel → «Hoy»; **Hoy** (planificar el día) |
| ¿Qué está bloqueado? | Panel → «Bloqueado y en pausa»; **Trabajo** filtrado por estado |
| ¿Próximos eventos, entregas y fechas límite? | Panel → «Próximas fechas»; **Agenda** |
| ¿Qué versiones, demos y builds hay? | Panel → «Builds y versiones»; **Builds** |
| ¿Qué hace falta para publicar o actualizar un juego? | Panel → «Publicar y actualizar»; **Publicación** (listas de pasos) |
| ¿Qué feedback hay y qué priorizar? | Panel → «Feedback»; **Feedback** |
| ¿Cómo evoluciona cada proyecto? | Panel → «Evolución»; **Historial** (día a día, commit a commit) |
| ¿Qué documentación, recursos y decisiones consultar? | **Recursos**, **Decisiones** |
| ¿Qué falta para Steam, ferias, festivales o presentaciones? | Panel → «Steam, ferias y presentaciones» |
| ¿Qué proyecto necesita atención inmediata, y por qué? | Panel → «Necesita atención» |

Arriba, el selector de ámbito cambia entre **todo el estudio** y **un proyecto**: todas las
pantallas se filtran y el ámbito va en la URL, así se pasa de lo general al detalle sin
perder el sitio. La ficha de cada proyecto tiene las mismas secciones en pestañas.

## Ponerlo en marcha

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # pruebas (lógica, almacenamiento y datos iniciales contra git)
npm run build      # versión para publicar, en dist/
```

Hace falta Node 22. Con cada cambio en `main`, el flujo **Pages** la publica en GitHub
Pages (hay que activarlo una vez: *Settings → Pages → Source: GitHub Actions*).

## Los datos

- Se guardan **en el navegador** (localStorage). En **Ajustes y datos** se exporta una
  copia en JSON, se importa en otro equipo o se vuelve a los datos iniciales.
- Cada dato dice **de dónde sale** (commit, PR, release, README o anotado a mano) y
  **cuánto fiarse**: *Verificado*, *Deducido* o *Sin confirmar*. Nada de ventas,
  jugadores, fechas de ferias ni estados de Steam se da por bueno sin fuente.
- No hay integraciones activas con Steam ni con otros servicios.
- Cómo se sacaron los datos de Indie Dev Tycoon y cómo actualizarlos:
  [`docs/DATOS-INICIALES.md`](docs/DATOS-INICIALES.md).

## Añadir un videojuego

Desde la aplicación: **Proyectos → Nuevo proyecto** (o el «+» de la barra lateral). Tiene
las mismas secciones que los demás desde el primer momento.

Para que forme parte de los datos iniciales: una carpeta `src/data/seed/<proyecto>/` con
su `project.ts` y sus listas en JSON, una línea en `PROJECTS` de `src/data/seed/index.ts`
y su historial con `npm run historial` (ver `docs/DATOS-INICIALES.md`).

## Cómo está hecho

React 19 + TypeScript + Vite, sin servidor ni librerías de interfaz. La lógica (qué toca
hoy, qué pide atención, la agenda, la evolución…) está en funciones puras probadas en
Node. Detalles en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
