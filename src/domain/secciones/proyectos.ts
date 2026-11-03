// Cálculos de la sección «proyectos». Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { PRIORITIES, STAGE_GROUPS, STAGES } from '../catalog'
import type { ID, ISODate, ISODateTime, ItemKind, Project, ProgressMethod, ProjectStage, StudioData, WorkItem } from '../types'
import { hasTag, itemDate, roadmapMilestones } from '../selectors'

/** Los grupos de etapas que son las subsecciones de Proyectos (?estado=). */
export type ProjectStageGroup = keyof typeof STAGE_GROUPS

/** En el orden de las subsecciones: lo que se está haciendo primero. */
export const PROJECT_GROUPS: ProjectStageGroup[] = ['activos', 'planificacion', 'pausa', 'lanzados', 'archivados']

/** ¿Es un grupo de etapas? (para leer ?estado= sin fiarse de la URL). */
export function isProjectStageGroup(value: string | null | undefined): value is ProjectStageGroup {
  return !!value && value in STAGE_GROUPS
}

/** El grupo de una etapa: «release» está en activos; lanzados es solo «live». */
export function stageGroupOf(stage: ProjectStage): ProjectStageGroup {
  return PROJECT_GROUPS.find((g) => STAGE_GROUPS[g].includes(stage)) ?? 'activos'
}

/** Por etapa (de la idea al archivo) y, dentro de cada una, por nombre. */
export const projectsByStage = (a: Project, b: Project) => STAGES[a.stage].order - STAGES[b.stage].order || a.name.localeCompare(b.name, 'es')

/** Los proyectos de un grupo (null = todos) y, si se da, con esa etiqueta; por etapa y nombre. */
export function projectsInGroup(data: StudioData, group: ProjectStageGroup | null, tag: string | null = null): Project[] {
  return data.projects.filter((p) => (group === null || stageGroupOf(p.stage) === group) && hasTag(p, tag)).sort(projectsByStage)
}

/** Cuántos proyectos hay en cada grupo (con esa etiqueta, si se da). */
export function projectGroupCounts(data: StudioData, tag: string | null = null): Record<ProjectStageGroup, number> {
  const counts = Object.fromEntries(PROJECT_GROUPS.map((g) => [g, 0])) as Record<ProjectStageGroup, number>
  for (const p of data.projects) if (hasTag(p, tag)) counts[stageGroupOf(p.stage)]++
  return counts
}

/** Cuántos proyectos hay en cada etapa (para la línea de etapas). */
export function projectStageCounts(data: StudioData): Record<ProjectStage, number> {
  const counts = Object.fromEntries(Object.keys(STAGES).map((s) => [s, 0])) as Record<ProjectStage, number>
  for (const p of data.projects) counts[p.stage]++
  return counts
}

// ——— Progreso ——————————————————————————————————————————————————————————————
//
// Criterio (el mismo en la tarjeta de cada proyecto, en el Dashboard y en Estadísticas › Progreso):
// - «Por tareas» (lo de siempre, si el proyecto no dice otra cosa): cuentan las tareas, las
//   funcionalidades y las incidencias del proyecto; no los hitos, las decisiones ni los
//   objetivos. Fuera lo descartado y lo que sigue en idea (no es trabajo comprometido). Cada
//   una pesa lo que su prioridad en el catálogo (crítica 4, alta 3, media 2, baja 1), y el
//   progreso es el peso de lo hecho entre el peso de todo lo que cuenta.
// - «Por hitos»: hitos hechos entre hitos del proyecto, sin los descartados (todos pesan 1).
// - Sin datos suficientes (menos de 3 elementos que cuenten por tareas, o ningún hito por
//   hitos), no hay porcentaje: ratio null y la pantalla dice «Sin datos suficientes», nunca 0 %.

/** Lo que cuenta en el progreso por tareas. */
export const PROGRESS_TASK_KINDS: readonly ItemKind[] = ['task', 'feature', 'issue']

/** Cuántos elementos que cuenten hacen falta, como mínimo, para dar un porcentaje. */
export const PROGRESS_MIN: Record<ProgressMethod, number> = { tasks: 3, milestones: 1 }

/** El método de un proyecto: el suyo o, sin poner, por tareas. */
export const progressMethodOf = (p: Pick<Project, 'progressMethod'>): ProgressMethod => (p.progressMethod === 'milestones' ? 'milestones' : 'tasks')

export interface ProjectProgress {
  method: ProgressMethod
  /** Peso hecho / peso total; null sin datos suficientes (no es un 0 %). */
  ratio: number | null
  /** Elementos que cuentan y, de ellos, los hechos. */
  done: number
  total: number
  /** Lo mismo, ponderado (por tareas, por prioridad; por hitos, igual que done y total). */
  doneWeight: number
  totalWeight: number
  /** Lo que no cuenta: descartados y, por tareas, lo que sigue en idea. */
  excluded: number
  /** Cuántos elementos hacen falta para dar un porcentaje. */
  minimum: number
}

/**
 * El progreso de un proyecto con su método (ver el criterio arriba). Con `tag`, solo lo que
 * lleva esa etiqueta (Estadísticas con ?etiqueta=).
 */
export function projectProgress(data: StudioData, project: Project, tag: string | null = null): ProjectProgress {
  const method = progressMethodOf(project)
  const kinds: readonly ItemKind[] = method === 'tasks' ? PROGRESS_TASK_KINDS : ['milestone']
  const all = data.items.filter((i) => i.projectId === project.id && kinds.includes(i.kind) && hasTag(i, tag))
  const left = (i: WorkItem) => i.status === 'cancelled' || (method === 'tasks' && i.status === 'idea')
  const counted = all.filter((i) => !left(i))
  const weight = (i: WorkItem) => (method === 'tasks' ? PRIORITIES[i.priority].weight : 1)
  const done = counted.filter((i) => i.status === 'done')
  const totalWeight = counted.reduce((s, i) => s + weight(i), 0)
  const doneWeight = done.reduce((s, i) => s + weight(i), 0)
  const minimum = PROGRESS_MIN[method]
  return {
    method,
    ratio: counted.length >= minimum && totalWeight > 0 ? doneWeight / totalWeight : null,
    done: done.length,
    total: counted.length,
    doneWeight,
    totalWeight,
    excluded: all.length - counted.length,
    minimum,
  }
}

// ——— Próximo hito ———————————————————————————————————————————————————————————

export interface NextMilestone {
  item: WorkItem
  /** Su fecha límite, si la tiene. */
  date?: ISODate
  /** false si se sabe que no está confirmado: el hito está «Por confirmar» o su fiabilidad es «por confirmar». */
  confirmed: boolean
}

/**
 * El próximo hito de un proyecto: el primer hito abierto por fecha límite (aunque ya haya
 * pasado: entonces va con retraso) y, si ninguno tiene fecha, el primero sin fecha en el orden
 * del Roadmap (lo que está en marcha antes). null si no tiene hitos abiertos.
 */
export function projectNextMilestone(data: StudioData, projectId: ID): NextMilestone | null {
  const { dated, undated } = roadmapMilestones(data, projectId)
  const item = dated[0] ?? undated[0]
  if (!item) return null
  return { item, date: item.dueDate, confirmed: item.status !== 'to_confirm' && item.confidence !== 'to_confirm' }
}

// ——— Última actividad ————————————————————————————————————————————————————————

/** De dónde sale la última actividad: el historial de git, el registro de cambios o las fechas de un elemento. */
export type ProjectActivitySource = 'code' | 'change' | 'item'

export interface ProjectLastActivity {
  /** Día (AAAA-MM-DD) y, si se sabe, la hora. */
  date: ISODate
  at?: ISODateTime
  source: ProjectActivitySource
  /** Qué fue: el título del commit, de lo cambiado o del elemento. */
  title: string
}

/**
 * Lo más reciente de un proyecto entre su historial de git (activity), el registro de cambios
 * de la aplicación (changes) y las fechas de sus elementos (fin, inicio o alta). Lo fechado
 * después de hoy no cuenta (no ha pasado). A igual día gana lo que tiene hora.
 */
export function projectLastActivity(data: StudioData, projectId: ID, today: ISODate): ProjectLastActivity | undefined {
  let best: ProjectLastActivity | undefined
  let bestKey = ''
  const consider = (key: string | undefined, make: () => ProjectLastActivity) => {
    if (!key || key.slice(0, 10) > today || key <= bestKey) return
    bestKey = key
    best = make()
  }
  for (const a of data.activity)
    if (a.projectId === projectId) consider(a.at, () => ({ date: a.at.slice(0, 10), at: a.at, source: 'code', title: a.title }))
  for (const c of data.changes)
    if (c.projectId === projectId) consider(c.at, () => ({ date: c.at.slice(0, 10), at: c.at, source: 'change', title: c.title }))
  for (const i of data.items)
    if (i.projectId === projectId) {
      const d = itemDate(i)
      consider(d, () => ({ date: d!, source: 'item', title: i.title }))
    }
  return best
}
