# Studio Hub — reglas del proyecto

Studio Hub es la herramienta de trabajo del estudio para llevar **todos** sus videojuegos,
de la idea a la publicación y el mantenimiento. No es una web corporativa ni una landing.

- **Idioma:** castellano de España en todo: interfaz, comentarios, documentación y
  mensajes de commit (frases cortas y directas).
- **El estudio, no un juego:** ninguna pantalla ni función puede conocer a un proyecto
  concreto. Indie Dev Tycoon es el primer proyecto de los datos iniciales, nada más.
  Todo lo que sea de un proyecto cuelga de su `projectId`.
- **Nada inventado:** ni ventas, ni jugadores, ni fechas, ni estados de Steam u otros
  servicios sin fuente. Cada dato lleva `sources` y `confidence`; lo que no se puede
  comprobar va como `to_confirm`. No hay integraciones activas: no se finge ninguna.
- **Capas:** `src/domain` (tipos, catálogo, fechas, selectores y validación) no importa
  React ni el navegador; las pantallas piden los cálculos a `selectors.ts`.
- **Datos iniciales:** `src/data/seed/<proyecto>/`. Si cambian, sube `SEED_VERSION` en
  `src/data/seed/index.ts` (el panel ofrece traerlos sin pisar lo editado).
  El historial de git se regenera con `npm run historial -- …` (ver `docs/DATOS-INICIALES.md`).
- **Antes de dar algo por hecho:** `npm run typecheck`, `npm test` y `npm run build`.
  Las pruebas de `src/data/seed.test.ts` cruzan cada fecha y cada fuente de los datos
  iniciales con el historial de git: si fallan, el dato está mal, no la prueba.
- **Dependencias:** versiones exactas en `package.json`; `.npmrc` lleva
  `legacy-peer-deps=true` por las dependencias opcionales de vitest 4.
- **Diseño:** colores y medidas solo con las variables de `src/styles.css`; los estados
  usan los tonos de `domain/catalog.ts` y siempre llevan icono y texto (nunca solo color).
  Confirmaciones con `useNotify().confirm`, nunca `window.confirm`. Textos nuevos de la
  interfaz, en `src/i18n/es.ts`.
- **Comprobación en el navegador:** `e2e/recorrido.mjs` (ver README).

Documentación: `README.md`, `docs/ARQUITECTURA.md`, `docs/DISENO.md`, `docs/DATOS-INICIALES.md`.
