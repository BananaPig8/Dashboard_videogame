// Cálculos de la sección «Roadmap»: hitos, fases, objetivos, versiones previstas y la línea
// temporal de cada proyecto. Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { STAGES, STATUS_ORDER } from '../catalog'
import type { CollectionKey } from '../collections'
import type { Build, ID, ISODate, Phase, Project, ProjectStage, Release, StudioData, WorkItem } from '../types'
import { byPriority, isOpen, type Scope } from '../selectors'
import { hasTag } from './etiquetas'

const own = (scope: Scope) => (x: { projectId?: ID }) => scope === null || x.projectId === scope
const statusRank = (i: WorkItem) => STATUS_ORDER.indexOf(i.status)
/** Abiertos primero (por estado y prioridad), luego hechos y al final los descartados. */
const byStatus = (a: WorkItem, b: WorkItem) => statusRank(a) - statusRank(b) || byPriority(a, b) || a.title.localeCompare(b.title)
/** Lo cerrado, del más reciente al más antiguo (sin fecha, al final). */
const byClosedDate = (a: WorkItem, b: WorkItem) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.title.localeCompare(b.title)
/** Con fecha primero (la más cercana antes), luego por prioridad. */
const byDueDate = (a: WorkItem, b: WorkItem) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || byPriority(a, b) || a.title.localeCompare(b.title)

// ——— Hitos ————————————————————————————————————————————————————————————————

export interface RoadmapMilestones {
  /** Abiertos con fecha límite, del más cercano al más lejano. */
  dated: WorkItem[]
  /** Abiertos sin fecha: lo que está en marcha primero. */
  undated: WorkItem[]
  /** Hechos y descartados, del más reciente al más antiguo. */
  closed: WorkItem[]
}

/** Los hitos del ámbito (con ?etiqueta=, solo los que la llevan). */
export function roadmapMilestones(data: StudioData, scope: Scope = null, tag: string | null = null): RoadmapMilestones {
  const all = data.items.filter((i) => i.kind === 'milestone' && own(scope)(i) && hasTag(i, tag))
  const open = all.filter(isOpen)
  return {
    dated: open.filter((i) => i.dueDate).sort(byDueDate),
    undated: open.filter((i) => !i.dueDate).sort(byStatus),
    closed: all.filter((i) => !isOpen(i)).sort(byClosedDate),
  }
}

// ——— Progreso por pasos ——————————————————————————————————————————————————

export interface RoadmapProgress {
  /** Lo que cuelga del elemento (parentId), abierto primero. */
  steps: WorkItem[]
  done: number
  /** Los pasos que cuentan: todos menos los descartados. */
  total: number
  cancelled: number
  /** Hechos / total; null si no tiene pasos (no hay nada que calcular). */
  ratio: number | null
}

/** El progreso de un objetivo (o de cualquier elemento): solo con lo que cuelga de él. */
export function roadmapProgress(data: StudioData, parentId: ID): RoadmapProgress {
  const steps = data.items.filter((i) => i.parentId === parentId).sort(byStatus)
  const cancelled = steps.filter((i) => i.status === 'cancelled').length
  const done = steps.filter((i) => i.status === 'done').length
  const total = steps.length - cancelled
  return { steps, done, total, cancelled, ratio: total > 0 ? done / total : null }
}

// ——— Objetivos ———————————————————————————————————————————————————————————

export interface RoadmapGoal {
  goal: WorkItem
  progress: RoadmapProgress
}

/** Los objetivos del ámbito con su progreso: abiertos (con fecha antes) y cerrados. */
export function roadmapGoals(data: StudioData, scope: Scope = null, tag: string | null = null): { open: RoadmapGoal[]; closed: RoadmapGoal[] } {
  const goals = data.items.filter((i) => i.kind === 'goal' && own(scope)(i) && hasTag(i, tag))
  const withProgress = (goal: WorkItem): RoadmapGoal => ({ goal, progress: roadmapProgress(data, goal.id) })
  return {
    open: goals.filter(isOpen).sort(byDueDate).map(withProgress),
    closed: goals
      .filter((i) => !isOpen(i))
      .sort(byClosedDate)
      .map(withProgress),
  }
}

// ——— Fases ——————————————————————————————————————————————————————————————

/** Las etapas del ciclo de vida, en orden (sin «en pausa» ni «archivado», que no son fases). */
export const ROADMAP_LIFECYCLE: ProjectStage[] = (Object.keys(STAGES) as ProjectStage[])
  .filter((s) => s !== 'paused' && s !== 'archived')
  .sort((a, b) => STAGES[a].order - STAGES[b].order)

/**
 * Cómo está cada etapa de un proyecto:
 * - current: es la etapa del proyecto (su ficha).
 * - done: tiene fases y todas están hechas.
 * - planned: tiene fases previstas.
 * - past / ahead: sin fases apuntadas, antes o después de la etapa actual.
 * - unknown: sin fases y sin etapa actual con la que comparar (proyecto en pausa o archivado).
 */
export type RoadmapStageState = 'current' | 'done' | 'planned' | 'past' | 'ahead' | 'unknown'

export interface RoadmapStage {
  stage: ProjectStage
  state: RoadmapStageState
  /** Las fases apuntadas de esa etapa, por fecha. */
  phases: Phase[]
}

export interface RoadmapProjectPhases {
  project: Project
  stages: RoadmapStage[]
  /** Cuántas fases tiene apuntadas el proyecto. */
  count: number
}

const phaseDate = (p: Phase) => p.startDate ?? p.endDate ?? ''

/** Una fase prevista cuya fecha de fin ya pasó: ¿se terminó? */
export const roadmapPhaseLate = (p: Phase, today: ISODate) => p.status === 'planned' && !!p.endDate && p.endDate < today

/** Las etapas de un proyecto con sus fases apuntadas y en qué punto está cada una. */
export function roadmapProjectPhases(data: StudioData, project: Project): RoadmapProjectPhases {
  const phases = data.phases.filter((p) => p.projectId === project.id)
  const lifecycle = ROADMAP_LIFECYCLE.includes(project.stage)
  const currentOrder = lifecycle ? STAGES[project.stage].order : undefined
  // En pausa o archivado (o con fases de esas «etapas»): salen al final.
  const extra = (['paused', 'archived'] as ProjectStage[]).filter((s) => s === project.stage || phases.some((p) => p.stage === s))
  const stages = [...ROADMAP_LIFECYCLE, ...extra].map((stage): RoadmapStage => {
    const list = phases.filter((p) => p.stage === stage).sort((a, b) => phaseDate(a).localeCompare(phaseDate(b)))
    let state: RoadmapStageState
    if (stage === project.stage) state = 'current'
    else if (list.length && list.every((p) => p.status === 'done')) state = 'done'
    else if (list.length) state = 'planned'
    else if (currentOrder === undefined || !ROADMAP_LIFECYCLE.includes(stage)) state = 'unknown'
    else state = STAGES[stage].order < currentOrder ? 'past' : 'ahead'
    return { stage, state, phases: list }
  })
  return { project, stages, count: phases.length }
}

/** Las fases de los proyectos del ámbito (todos los proyectos, o el elegido). */
export function roadmapPhases(data: StudioData, scope: Scope = null): RoadmapProjectPhases[] {
  return data.projects.filter((p) => scope === null || p.id === scope).map((p) => roadmapProjectPhases(data, p))
}

// ——— Versiones previstas ————————————————————————————————————————————————

export interface RoadmapRelease {
  release: Release
  /** Las builds de esta versión (build.releaseId), de la más nueva a la más antigua. */
  builds: Build[]
  /** Lo que sale en ella (item.releaseId), abierto primero. */
  items: WorkItem[]
  itemsDone: number
  /** Sin contar lo descartado. */
  itemsTotal: number
  /** La fecha prevista está confirmada. */
  confirmed: boolean
  /** La fecha prevista ya pasó y sigue sin publicarse. */
  late: boolean
}

const UPCOMING_RELEASE: Release['status'][] = ['idea', 'planned', 'in_progress']
const releaseRank: Record<Release['status'], number> = { in_progress: 0, planned: 1, idea: 2, released: 3, cancelled: 4 }

/** Las versiones que aún no han salido (idea, prevista, en preparación) con sus builds y elementos. */
export function roadmapReleases(
  data: StudioData,
  today: ISODate,
  scope: Scope = null,
  tag: string | null = null,
): { upcoming: RoadmapRelease[]; released: number; cancelled: number } {
  const all = data.releases.filter((r) => own(scope)(r) && hasTag(r, tag))
  const upcoming = all
    .filter((r) => UPCOMING_RELEASE.includes(r.status) && !r.releasedAt)
    .sort(
      (a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') || releaseRank[a.status] - releaseRank[b.status] || a.name.localeCompare(b.name),
    )
    .map((release): RoadmapRelease => {
      const items = data.items.filter((i) => i.releaseId === release.id).sort(byStatus)
      return {
        release,
        builds: data.builds.filter((b) => b.releaseId === release.id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
        items,
        itemsDone: items.filter((i) => i.status === 'done').length,
        itemsTotal: items.filter((i) => i.status !== 'cancelled').length,
        confirmed: !!release.targetDate && !!release.targetConfirmed,
        late: !!release.targetDate && release.targetDate < today,
      }
    })
  return {
    upcoming,
    released: all.filter((r) => r.status === 'released' || !!r.releasedAt).length,
    cancelled: all.filter((r) => r.status === 'cancelled').length,
  }
}

// ——— Línea temporal —————————————————————————————————————————————————————

export type RoadmapLineKind = 'phase' | 'milestone' | 'release' | 'event'

export interface RoadmapLineEntry {
  /** Estable: «colección:id». */
  id: string
  kind: RoadmapLineKind
  date?: ISODate
  endDate?: ISODate
  /** El nombre; en una fase sin nombre propio, vacío (la pantalla pone el de la etapa). */
  title: string
  /** En las fases, su etapa. */
  stage?: ProjectStage
  /** La fecha está confirmada (las previstas sin confirmar, no). */
  confirmed: boolean
  /** Hecho, publicado o celebrado. */
  done: boolean
  projectId?: ID
  target: { collection: CollectionKey; id: ID }
}

export interface RoadmapLine {
  /** null = lo que es de todo el estudio (eventos sin proyecto). */
  projectId: ID | null
  /** Lo que ya pasó, en orden. */
  past: RoadmapLineEntry[]
  /** De hoy en adelante, en orden. */
  future: RoadmapLineEntry[]
  /** Lo que aún no tiene fecha. */
  undated: RoadmapLineEntry[]
}

const LINE_KIND_ORDER: Record<RoadmapLineKind, number> = { phase: 0, milestone: 1, release: 2, event: 3 }

/** Todo lo que va en la línea temporal (sin repartir por proyecto). */
function lineEntries(data: StudioData, scope: Scope, tag: string | null): RoadmapLineEntry[] {
  const out: RoadmapLineEntry[] = []
  // Las fases no llevan etiquetas: con ?etiqueta= no salen.
  if (!tag)
    for (const p of data.phases.filter(own(scope)))
      out.push({
        id: `phases:${p.id}`,
        kind: 'phase',
        date: p.startDate ?? p.endDate,
        endDate: p.startDate && p.endDate && p.endDate > p.startDate ? p.endDate : undefined,
        title: p.title ?? '',
        stage: p.stage,
        confirmed: true,
        done: p.status === 'done',
        projectId: p.projectId,
        target: { collection: 'phases', id: p.id },
      })
  for (const i of data.items.filter((i) => i.kind === 'milestone' && i.status !== 'cancelled' && own(scope)(i) && hasTag(i, tag))) {
    const done = !isOpen(i)
    out.push({
      id: `items:${i.id}`,
      kind: 'milestone',
      date: done ? (i.completedAt ?? i.dueDate) : i.dueDate,
      title: i.title,
      confirmed: true,
      done,
      projectId: i.projectId,
      target: { collection: 'items', id: i.id },
    })
  }
  for (const r of data.releases.filter((r) => r.status !== 'cancelled' && own(scope)(r) && hasTag(r, tag))) {
    const done = r.status === 'released' || !!r.releasedAt
    out.push({
      id: `releases:${r.id}`,
      kind: 'release',
      date: r.releasedAt ?? r.targetDate,
      title: r.version ? `${r.name} (${r.version})` : r.name,
      confirmed: !!r.releasedAt || !!r.targetConfirmed,
      done,
      projectId: r.projectId,
      target: { collection: 'releases', id: r.id },
    })
  }
  // Los eventos del proyecto (y, en todo el estudio, los del estudio). Las reuniones son agenda, no roadmap.
  for (const e of data.events.filter((e) => e.status !== 'cancelled' && e.type !== 'meeting' && (scope === null || e.projectId === scope) && hasTag(e, tag)))
    out.push({
      id: `events:${e.id}`,
      kind: 'event',
      date: e.date,
      endDate: e.endDate && e.date && e.endDate > e.date ? e.endDate : undefined,
      title: e.title,
      confirmed: !!e.date && e.dateConfirmed,
      done: e.status === 'done',
      projectId: e.projectId,
      target: { collection: 'events', id: e.id },
    })
  return out
}

/**
 * La línea temporal de cada proyecto del ámbito: fases, hitos, versiones y eventos en orden,
 * partida en lo pasado, lo que viene y lo que no tiene fecha. En todo el estudio sale un
 * grupo por proyecto (aunque esté vacío) y uno más con los eventos sin proyecto, si los hay.
 */
export function roadmapLine(data: StudioData, today: ISODate, scope: Scope = null, tag: string | null = null): RoadmapLine[] {
  const entries = lineEntries(data, scope, tag).sort(
    (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || LINE_KIND_ORDER[a.kind] - LINE_KIND_ORDER[b.kind] || a.title.localeCompare(b.title),
  )
  const isPast = (e: RoadmapLineEntry) => !!e.date && ((e.endDate ?? e.date) < today || (e.done && e.date <= today))
  const group = (projectId: ID | null): RoadmapLine => {
    const mine = entries.filter((e) => (e.projectId ?? null) === projectId)
    return {
      projectId,
      past: mine.filter((e) => e.date && isPast(e)),
      future: mine.filter((e) => e.date && !isPast(e)),
      undated: mine.filter((e) => !e.date),
    }
  }
  const groups = data.projects.filter((p) => scope === null || p.id === scope).map((p) => group(p.id))
  if (scope === null) {
    const studio = group(null)
    if (studio.past.length + studio.future.length + studio.undated.length > 0) groups.push(studio)
  }
  return groups
}
