// Cálculos de la sección «Builds y versiones»: qué build sale en cada subsección (Desarrollo,
// Pruebas, Demos…), el historial de cambios entre una build y la siguiente y las incidencias
// de cada versión. Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import type { Activity, Build, BuildChannel, BuildStatus, Feedback, ID, ISODate, StudioData, WorkItem } from '../types'
import { byPriority, isOpen, type Scope } from '../selectors'

/** Subsecciones de la faceta «canal» (null = todas las builds). */
export type BuildGroup = 'desarrollo' | 'pruebas' | 'demos' | 'publicas' | 'candidatas'

/**
 * Qué entra en cada subsección: una build entra si su canal o su estado están en la lista.
 * Desarrollo junta las internas y las que están a medias, sean del canal que sean.
 */
export const BUILD_GROUPS: Record<BuildGroup, { channels: BuildChannel[]; statuses: BuildStatus[] }> = {
  desarrollo: { channels: ['internal'], statuses: ['in_progress'] },
  pruebas: { channels: ['playtest', 'beta'], statuses: [] },
  demos: { channels: ['demo', 'event'], statuses: [] },
  publicas: { channels: [], statuses: ['published'] },
  candidatas: { channels: [], statuses: ['candidate'] },
}

/** El valor de ?canal= si es una subsección; si no, null (todas). */
export function buildGroupOf(value: string | null): BuildGroup | null {
  return value && value in BUILD_GROUPS ? (value as BuildGroup) : null
}

export function inBuildGroup(b: Build, group: BuildGroup | null): boolean {
  if (group === null) return true
  const g = BUILD_GROUPS[group]
  return g.channels.includes(b.channel) || g.statuses.includes(b.status)
}

/** Lo que lleva una build nueva creada desde cada subsección. */
export function buildGroupDefaults(group: BuildGroup | null): Partial<Build> {
  switch (group) {
    case 'desarrollo':
      return { channel: 'internal' }
    case 'pruebas':
      return { channel: 'playtest' }
    case 'demos':
      return { channel: 'demo' }
    case 'publicas':
      return { status: 'published' }
    case 'candidatas':
      return { status: 'candidate' }
    default:
      return {}
  }
}

/** De la más reciente a la más antigua; las que no tienen fecha, al final. */
export function compareBuilds(a: Build, b: Build): number {
  if (!!a.date !== !!b.date) return a.date ? -1 : 1
  return (b.date ?? '').localeCompare(a.date ?? '') || a.name.localeCompare(b.name, 'es') || a.version.localeCompare(b.version, 'es')
}

/** Las builds de una subsección (null = todas), en el ámbito. */
export function buildsInChannelGroup(data: StudioData, group: BuildGroup | null, scope: Scope = null): Build[] {
  return data.builds.filter((b) => (scope === null || b.projectId === scope) && inBuildGroup(b, group)).sort(compareBuilds)
}

/** «Qué cambia» de una build, una línea por cambio (sin viñetas ni líneas vacías). */
export function changelogLines(b: Pick<Build, 'changelog'>): string[] {
  return (b.changelog ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
}

// ——— Historial de cambios ——————————————————————————————————————————————————

/**
 * Un tramo del historial: lo que se hizo desde la build anterior hasta estas builds (las
 * del mismo día). Las builds solo tienen fecha, sin hora: lo del mismo día cuenta para ellas.
 */
export interface BuildStretch {
  /** Las builds que cierran el tramo; vacío = lo hecho después de la última build. */
  builds: Build[]
  /** Fecha de esas builds (último día del tramo). Sin ella, el tramo sigue abierto. */
  date?: ISODate
  /** Fecha de las builds anteriores (el tramo empieza al día siguiente). Sin ella, desde el principio. */
  since?: ISODate
  activity: Activity[]
  done: WorkItem[]
}

/**
 * Reparte commits y elementos terminados entre las builds de un proyecto, de lo más nuevo a
 * lo más antiguo. Las builds sin fecha no se pueden colocar: se quedan fuera (ver
 * `undatedBuilds`). Solo sale el tramo abierto si tiene algo.
 */
export function buildStretches(builds: Build[], activity: Activity[], done: WorkItem[]): BuildStretch[] {
  const dates = [...new Set(builds.filter((b) => b.date).map((b) => b.date!))].sort()
  const stretches: BuildStretch[] = dates.map((date, k) => ({
    builds: builds.filter((b) => b.date === date).sort(compareBuilds),
    date,
    since: k > 0 ? dates[k - 1] : undefined,
    activity: [],
    done: [],
  }))
  const open: BuildStretch = { builds: [], since: dates[dates.length - 1], activity: [], done: [] }
  // El primer tramo cuya fecha es igual o posterior al día; si no hay, el abierto.
  const find = (day: ISODate) => stretches.find((s) => day <= s.date!) ?? open
  for (const a of activity) find(a.at.slice(0, 10)).activity.push(a)
  for (const i of done) if (i.completedAt) find(i.completedAt).done.push(i)
  for (const s of [...stretches, open]) {
    s.activity.sort((a, b) => b.at.localeCompare(a.at))
    s.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  }
  const out = stretches.reverse()
  return open.activity.length || open.done.length ? [open, ...out] : out
}

/** Las builds que no tienen fecha (no se pueden colocar en el historial). */
export function undatedBuilds(builds: Build[]): Build[] {
  return builds.filter((b) => !b.date).sort(compareBuilds)
}

// ——— Incidencias por versión ——————————————————————————————————————————————

export interface BuildIssues {
  /** Sin build: las incidencias que no dicen en qué build aparecen. */
  build?: Build
  open: WorkItem[]
  closed: WorkItem[]
  /** El feedback que se vio con esa build. */
  feedback: Feedback[]
}

/**
 * Las incidencias agrupadas por la build en la que aparecen (de la build más reciente a la
 * más antigua) y, al final, las que no dicen build. Solo salen las builds con algo. Las que
 * apuntan a una build que ya no existe van con las que no dicen build.
 */
export function issuesByBuild(data: StudioData, scope: Scope = null, keep: (x: { tags?: string[] }) => boolean = () => true): BuildIssues[] {
  const own = (x: { projectId: ID }) => scope === null || x.projectId === scope
  const builds = new Map(data.builds.filter(own).map((b) => [b.id, b]))
  const groups = new Map<string, BuildIssues>()
  const group = (buildId: ID | undefined) => {
    const key = buildId && builds.has(buildId) ? buildId : ''
    if (!groups.has(key)) groups.set(key, { build: builds.get(key), open: [], closed: [], feedback: [] })
    return groups.get(key)!
  }
  for (const i of data.items) {
    if (i.kind !== 'issue' || !own(i) || !keep(i)) continue
    const g = group(i.buildId)
    if (isOpen(i)) g.open.push(i)
    else g.closed.push(i)
  }
  for (const f of data.feedback) if (f.buildId && builds.has(f.buildId) && own(f) && keep(f)) group(f.buildId).feedback.push(f)
  const out = [...groups.values()]
  for (const g of out) {
    g.open.sort(byPriority)
    g.closed.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    g.feedback.sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? ''))
  }
  return out.sort((a, b) => (!a.build ? 1 : !b.build ? -1 : compareBuilds(a.build, b.build)))
}
