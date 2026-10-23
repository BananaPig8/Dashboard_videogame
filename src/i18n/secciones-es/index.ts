// Los textos de cada sección, juntos (los usa es.ts).
import { panel } from './panel'
import { proyectos } from './proyectos'
import { tareas } from './tareas'
import { roadmap } from './roadmap'
import { calendario } from './calendario'
import { builds } from './builds'
import { publicacion } from './publicacion'
import { feedback } from './feedback'
import { eventos } from './eventos'
import { documentacion } from './documentacion'
import { recursos } from './recursos'
import { equipo } from './equipo'
import { finanzas } from './finanzas'
import { estadisticas } from './estadisticas'
import { ajustes } from './ajustes'

export const secciones = {
  panel,
  proyectos,
  tareas,
  roadmap,
  calendario,
  builds,
  publicacion,
  feedback,
  eventos,
  documentacion,
  recursos,
  equipo,
  finanzas,
  estadisticas,
  ajustes,
} as const
