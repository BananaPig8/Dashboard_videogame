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

## Cómo se usa

- **Tema oscuro** por defecto (también claro o el del sistema), con color de acento,
  densidad y bloques del panel a tu gusto (Ajustes o «Personalizar» en el panel).
- `Ctrl K` (o `/`) abre la **paleta**: ir a cualquier pantalla, proyecto, vista o tarea,
  y crear cosas sin soltar el teclado. `[` contrae la barra lateral.
- **Nuevo** (arriba a la derecha) crea tareas, decisiones, incidencias, eventos, builds,
  feedback, recursos, listas de pasos o proyectos.
- La **campana** avisa de lo vencido, lo que vence hoy, las ferias que se acercan y los
  bloqueos importantes.
- **Vistas guardadas**: filtra Tareas o Historial y pulsa «Guardar vista».
- Zona horaria (`Europe/Madrid` por defecto), formato de fecha y de hora en Ajustes.

Todo el sistema visual (colores de estado, tipografía, componentes, teclado, móvil) está
en [`docs/DISENO.md`](docs/DISENO.md).

## Ponerlo en marcha

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # pruebas (lógica, almacenamiento y datos iniciales contra git)
npm run build      # versión para publicar, en dist/
```

Recorrido completo en un navegador (Playwright y Chromium, con la versión compilada servida):

```bash
npm run build && npx vite preview --port 4173 &
PW_PATH=$(npm root -g)/playwright node e2e/recorrido.mjs http://localhost:4173 /tmp
```

Hace falta Node 22 (`.node-version`).

## La web privada (Cloudflare Workers + Cloudflare Access)

Studio Hub se publica como web normal de navegador en **Cloudflare Workers** (solo
ficheros estáticos, sin servidor: `wrangler.jsonc` sirve `dist/`), detrás de
**Cloudflare Access**: para entrar hay que identificarse con un correo autorizado. Cada
cambio en la rama de producción se publica solo. Se configura una vez:

1. **El Worker.** En el panel de Cloudflare: *Workers & Pages → Create → Import a
   repository*, este repositorio. *Build command*: `npm run build`; *Deploy command*:
   `npx wrangler deploy` (lee `wrangler.jsonc`). El nombre del Worker tiene que ser el de
   `wrangler.jsonc` (`dashboardmytu`); si lo cambias en un sitio, cámbialo en el otro.
2. **Proteger la web (y las vistas previas).** En el Worker: pestaña *Access → Protect
   this Worker behind Access → All traffic* («Previews only» dejaría abierta la web
   principal) y *Apply Access*. Así quedan protegidas la dirección `*.workers.dev`, las
   vistas previas y cualquier dominio propio del Worker.
3. **Quién entra.** La política que se crea deja entrar a los miembros de tu cuenta de
   Cloudflare (o a un dominio de correo). Para dejar entrar a personas concretas: en
   *Zero Trust → Access → Applications*, la aplicación del Worker → su política →
   *Include → Emails* con tu correo y los de quien quieras invitar.
4. **Comprobar.** Abre la dirección del Worker en una ventana privada: tiene que pedir
   identificarse antes de enseñar nada.

Lo que se apunta en la web se guarda **en el navegador** de cada persona (localStorage):
no pasa solo a otros dispositivos ni lo ven los demás. Para llevarlo a otro sitio,
*Ajustes → Exportación e importación*. El código y los datos iniciales siguen en el
repositorio de GitHub, que es público.

`public/_headers` pide a los buscadores que no la indexen y cierra lo que la web no usa
(cámara, micrófono, ubicación, incrustarla en otra página). La misma compilación sirve
también en Cloudflare Pages (directorio de salida `dist`) si algún día se prefiere.

## Otra forma: la página de claude.ai (opcional)

Studio Hub también puede vivir como **página privada de claude.ai**, con los datos en la base de
datos de la propia página. Esa base la comparten el estudio y Claude: lo que cambias en la
página lo ve Claude, y lo que Claude anota (por ejemplo, el trabajo nuevo de un juego)
aparece en la página al momento.

```bash
npm run build:claude   # dist-claude/studio-hub.html y dist-claude/ficheros.json
```

Esa build no lleva datos iniciales (todo sale de la base) y guarda con el almacén remoto
(`src/data/remote.ts`). Cómo se guardan los datos en la base, en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md#la-página-privada-en-claudeai).

**Compartirla:** es privada; solo la ve quien la publica. Desde **Compartir** en
claude.ai se invita a otras personas por correo: entran con su cuenta de Claude. Quien
entra como **Editor** puede cambiar los datos; el resto la ve en **solo lectura** (la
página esconde lo que no puede hacer y lo avisa arriba).

## Los datos

- En la versión normal se guardan **en el navegador** (localStorage); en la página de
  claude.ai, en su base de datos compartida. En **Ajustes** se exporta una copia en
  JSON o se importa otra.
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

React 19 + TypeScript + Vite, sin servidor ni librerías de interfaz (solo la fuente Inter,
incluida). La lógica (qué toca hoy, qué pide atención, la agenda, la evolución…) está en funciones puras probadas en
Node. Detalles en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
