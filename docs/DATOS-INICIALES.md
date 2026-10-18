# Datos iniciales: de dónde sale cada cosa

Studio Hub arranca con el estudio, sus áreas de trabajo y el primer proyecto, **Indie Dev
Tycoon**, con todo lo hecho desde el primer commit (27 de septiembre de 2026) hasta la
fecha de los datos (`SEED_VERSION` en `src/data/seed/index.ts`).

## Qué hay

| Fichero (`src/data/seed/indie-dev-tycoon/`) | Qué es | Cómo se hizo |
|---|---|---|
| `project.ts` | La ficha del juego: motor, plataformas, versiones, enlaces | A mano, del README, `project.yaml`, `export_presets.cfg` y la release «descargas» |
| `activity.json` | Cada commit y cada PR fusionada, con su fecha y su enlace | Automático: `scripts/importar-historial-git.mjs` |
| `items.json` | Lo hecho (funcionalidades, hitos, decisiones, fallos arreglados) y lo pendiente o por confirmar | Leyendo el historial commit a commit y el README (ver abajo) |
| `builds.json` | Las versiones compiladas (juego completo, demos, demo de feria) | De la release «descargas» y del historial |
| `events.json` | Ferias y fechas | Del historial; sin fecha si el repositorio no la dice |
| `feedback.json` | Lo que se cambió por lo que se vio o se pidió (p. ej. en la feria) | Del historial, casi siempre como «deducido» |
| `resources.json` | Repositorio, release, secciones del README, flujos de CI, herramientas | Del repositorio |
| `checklists.json` | Pasos para publicar en Steam, sacar una versión y llevar el juego a una feria | Del README y del historial: hecho solo si el repositorio lo demuestra |

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
4. **Fechas locales** del commit (`AAAA-MM-DD`). Lo terminado lleva la fecha de su último
   commit; lo empezado, la del primero.
5. **Lo que solo está en una rama sin fusionar no está hecho** (está «en revisión»). Así
   están la Demo 1.4 y la base de Idiomas del 14 de octubre, en
   `claude/lucid-lamport-fl6em4` sin PR.

`src/data/seed.test.ts` comprueba las reglas 2, 4 y 5 contra el historial de git (cada
commit citado existe y tiene esa fecha; cada commit del juego acaba en algún elemento) y
que todas las líneas de trabajo del estudio tienen elementos.

## Cómo se extrajo

Con un flujo de agentes en paralelo sobre el repositorio de Indie Dev Tycoon: seis
lectores del historial por tramos de fechas y uno del estado actual (README, CI, PR y
release); un verificador adversarial por tramo que contrastó cada elemento con su commit;
un consolidador que juntó la misma funcionalidad hecha en la web y llevada a Godot, cruzó
estados entre tramos (lo aparcado que se retomó, la decisión de qué demo va a Steam) y
escribió los JSON; y una auditoría final con tres enfoques (fechas y fuentes, nada
inventado, cobertura y estado actual) cuyos hallazgos se corrigieron.

## Actualizar el historial

```bash
# en el repositorio del juego, con las ramas al día
git -C ../Indie-Dev-Tycoon fetch --depth=5000 origin main
npm run historial -- --repo ../Indie-Dev-Tycoon --proyecto indie-dev-tycoon \
  --url https://github.com/BananaPig8/Indie-Dev-Tycoon \
  --rama origin/main --rama origin/claude/lucid-lamport-fl6em4 \
  --salida src/data/seed/indie-dev-tycoon/activity.json
```

Después: añadir a `items.json` lo nuevo (con su fuente), subir `SEED_VERSION` y pasar
`npm test`. En el panel saldrá «Hay datos iniciales nuevos»; al traerlos se respeta lo que
el estudio haya editado o borrado a mano.

## Lo que el estudio tiene que confirmar

Están en el panel como «Por confirmar» (filtro «Fiabilidad: Sin confirmar» en Tareas):
la cuenta de Steamworks y Steam Direct, si el secreto `TALO_ACCESS_KEY` está puesto, la
fecha y el nombre exacto de la feria de Valladolid, y las líneas de trabajo sin trabajo
registrado (inventario y objetos de Steam, DLC reales, planificación de lanzamientos).
