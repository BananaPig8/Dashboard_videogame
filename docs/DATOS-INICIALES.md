# Datos iniciales: de dónde sale cada cosa

Studio Hub arranca con el estudio, sus áreas de trabajo y el primer proyecto, **Indie Dev
Tycoon**, con todo lo hecho desde el primer commit (27 de septiembre de 2026) hasta la
fecha de los datos (`SEED_VERSION` en `src/data/seed/index.ts`).

## Qué hay

| Fichero (`src/data/seed/indie-dev-tycoon/`) | Qué es | Cómo se hizo |
|---|---|---|
| `project.ts` | La ficha del juego: motor, plataformas, versiones, enlaces | A mano, del README, `project.yaml`, `export_presets.cfg` y la release «descargas» |
| `activity.json` | Cada commit y cada PR fusionada, con su fecha, su autor (el nombre que guarda git) y su enlace | Automático: `scripts/importar-historial-git.mjs` |
| `items.json` | Lo hecho (funcionalidades, hitos, decisiones, fallos arreglados) y lo pendiente o por confirmar | Leyendo el historial commit a commit y el README (ver abajo) |
| `builds.json` | Las versiones compiladas (juego completo, demos, demo de feria), cada demo publicada con su versión (`releaseId`) y la de feria con su evento | De la release «descargas» y del historial |
| `releases.json` | Lo que sale a los jugadores: las demos publicadas (1.3, 1.3 V2 y Valladolid 1.0) con su fecha, la Demo 1.4 en preparación y el lanzamiento en Steam previsto, sin fecha | De las builds publicadas; lo previsto, del README y de la rama, como «sin confirmar» o «deducido» |
| `storeListings.json` | Las fichas de Steam del juego y de la demo, sin empezar y sin App ID | Del README, `desktop/steam/` y `Game.STEAM_URL`: se llevan a mano y están «sin confirmar» |
| `achievements.json` | Los 56 logros del juego con su nombre de API (los 23 de la demo, con la etiqueta `demo`) | De `js/engine.js` y `godot/scripts/sim.gd`, con el commit que añadió cada uno; ninguno «en la tienda» |
| `events.json` | Ferias y fechas (las publicaciones van en `releases.json` y Steam, en `storeListings.json`) | Del historial; sin fecha si el repositorio no la dice |
| `feedback.json` | Lo que se cambió por lo que se vio o se pidió, con su tipo (comentario, fallo o petición) cuando el commit lo dice | Del historial, casi siempre como «deducido» |
| `playtests.json` | Las pruebas con jugadores: beta testers, Minlok (Hexistence) y las partidas del stand de la feria | Del historial; la de la feria, «sin confirmar» (no consta que se haya celebrado) |
| `resources.json` | Repositorio, release, secciones del README, flujos de CI, herramientas | Del repositorio |
| `checklists.json` | Pasos para publicar en Steam (de la ficha del juego), sacar una versión y llevar el juego a una feria (de la de Valladolid) | Del README y del historial: hecho solo si el repositorio lo demuestra |

## Reglas que siguen los datos

1. **Nada inventado.** Ni ventas, ni jugadores, ni descargas, ni fechas de ferias o de
   lanzamiento, ni estados de Steam, Talo o certificados que el repositorio no confirme.
2. **Cada dato con su fuente** (`sources`): el commit (hash corto y fecha), la PR, la
   release o la sección del README de donde sale.
3. **Cada dato con su fiabilidad** (`confidence`):
   - *Verificado*: la fuente lo dice tal cual.
   - *Deducido*: se deduce de la fuente (p. ej. que un cambio vino de lo visto en la feria).
   - *Sin confirmar*: no hay fuente; lo tiene que confirmar el estudio. Las líneas de
     trabajo del brief sin trabajo en el repositorio (inventario y objetos de Steam, DLC
     reales del juego…) están así, como «idea» o «por confirmar».
4. **Fechas en la hora del estudio** (Madrid, `AAAA-MM-DD`), no en la zona que guarda cada
   commit: los commits del juego van en UTC y las fusiones de GitHub en +02:00, así que un
   commit hecho después de medianoche cuenta para el día siguiente. Lo terminado lleva la
   fecha de su último commit; lo empezado, la del primero.
5. **Lo que solo está en una rama sin fusionar no está hecho** (está «en revisión» o «en
   marcha», también las decisiones). Así estuvieron la Demo 1.4, los idiomas, el cartel A3 y
   las pegatinas del 14 al 20 de octubre, en `claude/lucid-lamport-fl6em4` sin PR, hasta que
   llegaron a main con la PR #40 (28 de octubre): entonces pasan a hechos, con la fecha de su
   último commit y la PR como fuente.
6. **Lo de fuera se lleva a mano.** No hay ninguna integración: el estado de Steam (fichas,
   App ID, logros dados de alta) no se puede comprobar desde el repositorio, así que las
   fichas están «sin empezar» y «sin confirmar», y los logros, «en el juego», nunca «en la
   tienda».
7. **No se inventan personas.** La actividad guarda el autor tal cual lo dice git
   (`Claude` en los commits, `BananaPig8` en las fusiones); el equipo (`members`) lo da de
   alta el estudio.
8. **Feedback, eventos y pruebas, sin mezclar.** Lo que salió por la feria va con
   `origin: event` y el `eventId` de la feria; lo de los beta testers y Minlok, con
   `origin: playtest` y su `playtestId`.

`src/data/seed.test.ts` comprueba las reglas 2, 4 y 5 contra el historial de git (cada
commit citado existe y tiene esa fecha; cada commit del juego acaba en algún elemento),
que todas las líneas de trabajo del estudio tienen elementos, y las reglas 6 a 8: cada
versión publicada tiene su build con esa fecha, nada de la tienda pasa de borrador sin estar
verificado, los nombres de API de los logros valen para Steam, la actividad dice su autor y
no hay personas, no quedan eventos de Steam ni de lanzamientos de la versión 1, y el
feedback de un evento o de una prueba dice de cuál.

## Cómo se extrajo

Con un flujo de agentes en paralelo sobre el repositorio de Indie Dev Tycoon: seis
lectores del historial por tramos de fechas y uno del estado actual (README, CI, PR y
release); un verificador adversarial por tramo que contrastó cada elemento con su commit;
un consolidador que juntó la misma funcionalidad hecha en la web y llevada a Godot, cruzó
estados entre tramos (lo aparcado que se retomó, la decisión de qué demo va a Steam) y
escribió los JSON; y una auditoría final con tres enfoques (fechas y fuentes, nada
inventado, cobertura y estado actual) cuyos hallazgos se corrigieron.

Al pasar al modelo v2 (`SEED_VERSION` 2026-10-25.1) no se volvió a leer todo: el evento de
Steam pasó a la ficha de Steam, las builds publicadas de las demos dieron sus versiones, los
logros salieron de la lista del código (con `git log -S` para el commit de cada uno), las
pruebas con jugadores de los commits que las citan, y el historial se regeneró con el autor
y con lo nuevo de la rama hasta el 20 de octubre (traducciones, cartel A3 y pegatinas), que
tiene sus elementos.

Desde el 29 de octubre (`SEED_VERSION` 2026-10-29.1) el Studio Hub se pone al día con cada
cambio del juego, como pide su `CLAUDE.md`: historial regenerado, lo hecho y lo pendiente en
`items.json` y las versiones, builds, fichas y el objetivo del proyecto al día. Esa primera
puesta al día recoge las PR #40 a #42 (Demo 1.4, idiomas, cartel y pegatinas en main; nombres de
juegos y juegos de palabras en cada idioma) y la validación de las traducciones, pendiente.

En la 2026-10-29.2 se corrigió lo que la revisión de «nada inventado» encontró desfasado: el
paso «Fusionar la Demo 1.4 en main» ya está hecho (PR #40), y la versión web en un solo HTML
pasa a «Retirada» y «Deducido». Su artefacto caducaba el 20-10 y Actions no arranca, así que
ya no existe; se deduce de la fecha de caducidad, no se ha vuelto a comprobar. Además, el
área de cada commit (`withAreas()` en `seed/index.ts`) ya no es la del primer elemento de
`items.json` que lo cita, sino la de la mayoría de los que lo citan. Si empatan, gana la del
más concreto. Así, las traducciones cuentan como Idiomas y no como Lanzamientos.

## Actualizar el historial

```bash
# en el repositorio del juego, con las ramas al día (con la ruta de cada rama: si no, un
# clon que solo sigue main no actualiza origin/claude/…)
git -C ../Indie-Dev-Tycoon fetch --depth=5000 origin \
  +refs/heads/main:refs/remotes/origin/main \
  +refs/heads/claude/lucid-lamport-fl6em4:refs/remotes/origin/claude/lucid-lamport-fl6em4
npm run historial -- --repo ../Indie-Dev-Tycoon --proyecto indie-dev-tycoon \
  --url https://github.com/BananaPig8/Indie-Dev-Tycoon \
  --rama origin/main --rama origin/claude/lucid-lamport-fl6em4 \
  --salida src/data/seed/indie-dev-tycoon/activity.json
```

Las horas salen en la hora de Madrid (`--zona Europe/Madrid`, la de por defecto).

Después: añadir a `items.json` lo nuevo (con su fuente), subir `SEED_VERSION` y pasar
`npm test`. En el panel saldrá «Hay datos iniciales nuevos»; al traerlos se respeta lo que
el estudio haya editado o borrado a mano. Lo que se quita de los datos iniciales (como el
evento «Página de Steam en Próximamente» de la versión 1, que ahora es la ficha de Steam)
no se borra de unos datos ya guardados: se borra a mano o se empieza de cero.

## Lo que el estudio tiene que confirmar

Están en el panel como «Por confirmar» (filtro «Fiabilidad: Sin confirmar» en Tareas):
la cuenta de Steamworks y Steam Direct, si el secreto `TALO_ACCESS_KEY` está puesto, la
fecha y el nombre exacto de la feria de Valladolid, y las líneas de trabajo sin trabajo
registrado (inventario y objetos de Steam, DLC reales, planificación de lanzamientos).
Y, en la publicación: si las fichas de Steam del juego y de la demo siguen sin empezar, la
fecha y la versión del lanzamiento en Steam, si la feria ya se celebró y cuánta gente jugó
en el stand, y si el juego completo 0.0.8 de la release «descargas» cuenta como versión
publicada (de momento no tiene `releases.json`: no es un lanzamiento ni una actualización).
