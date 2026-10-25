// Cálculos de la sección «Estadísticas»: progreso de cada proyecto, tareas e hitos por
// semanas, horas apuntadas, actividad del código y datos de plataformas con su fuente.
// Nada se rellena: lo que no tiene fecha no sale en ninguna semana (se cuenta aparte) y
// las métricas sin comprobar no entran en las gráficas.
// Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { METRIC_KINDS, STATUSES, STATUS_ORDER, TASK_KINDS, type MetricGroup } from '../catalog'
import { addDays, daysBetween, startOfWeek, type WeekStart } from '../dates'
import type { Area, ID, ISODate, ItemKind, ItemStatus, Member, Metric, MetricKind, Project, StudioData, WorkItem } from '../types'
import { isOpen, itemsOf, normalize, projectSummary, type ProjectSummary, type Scope } from '../selectors'
import { hasTag } from './etiquetas'
import { projectsByStage } from './proyectos'

/** Semanas de las gráficas semanales (se quitan las vacías del principio). */
export const STATS_WEEKS = 12
/** Periodo de «lo último»: las últimas cuatro semanas. */
export const STATS_RECENT_DAYS = 28

const own = (scope: Scope) => (x: { projectId?: ID }) => scope === null || x.projectId === scope

// ——— Semanas ——————————————————————————————————————————————————————————————

/** Los inicios de las `weeks` semanas que acaban en la de hoy. */
export function statsWeekStarts(today: ISODate, weeks: number, weekStart: WeekStart = 1): ISODate[] {
  const end = startOfWeek(today, weekStart)
  return Array.from({ length: weeks }, (_, k) => addDays(end, -7 * (weeks - 1 - k)))
}

/** En qué semana cae una fecha (-1 si fuera de las semanas). */
function weekIndexer(starts: ISODate[], weekStart: WeekStart) {
  return (d: ISODate | undefined): number => {
    if (!d || !starts.length) return -1
    const k = daysBetween(starts[0], startOfWeek(d.slice(0, 10), weekStart)) / 7
    return k >= 0 && k < starts.length ? k : -1
  }
}

/** Quita las semanas vacías del principio, dejando al menos cuatro. */
function trimLeading<T>(rows: T[], empty: (r: T) => boolean): T[] {
  const first = rows.findIndex((r) => !empty(r))
  const keep = Math.max(0, Math.min(first === -1 ? rows.length : first, rows.length - 4))
  return rows.slice(keep)
}

/** ¿Cae en las últimas cuatro semanas (hoy incluido)? */
const recent = (d: ISODate | undefined, today: ISODate) => !!d && d.slice(0, 10) <= today && d.slice(0, 10) > addDays(today, -STATS_RECENT_DAYS)

// ——— Progreso ——————————————————————————————————————————————————————————————

export interface StatsCount {
  done: number
  /** Lo que cuenta: todo menos lo descartado. */
  total: number
  cancelled: number
  /** Hechos / total; null si no hay nada que contar. */
  ratio: number | null
}

/** Hechos sobre el total, sin contar los descartados. */
export function statsCount(items: WorkItem[]): StatsCount {
  const cancelled = items.filter((i) => i.status === 'cancelled').length
  const done = items.filter((i) => i.status === 'done').length
  const total = items.length - cancelled
  return { done, total, cancelled, ratio: total > 0 ? done / total : null }
}

export interface StatsProjectProgress {
  project: Project
  /** Tareas, funcionalidades, hitos, decisiones e incidencias. */
  tasks: StatsCount
  milestones: StatsCount
  byKind: { kind: ItemKind; count: StatsCount }[]
  /** Etapa, salud y lo abierto (lo mismo que el panel). */
  summary: ProjectSummary
}

/** El progreso de cada proyecto del ámbito, por etapa (con ?etiqueta=, solo lo que la lleva). */
export function statsProgress(data: StudioData, today: ISODate, scope: Scope = null, tag: string | null = null): StatsProjectProgress[] {
  return data.projects
    .filter((p) => scope === null || p.id === scope)
    .sort(projectsByStage)
    .map((project) => {
      const items = itemsOf(data, project.id).filter((i) => TASK_KINDS.includes(i.kind) && hasTag(i, tag))
      return {
        project,
        tasks: statsCount(items),
        milestones: statsCount(items.filter((i) => i.kind === 'milestone')),
        byKind: TASK_KINDS.map((kind) => ({ kind, count: statsCount(items.filter((i) => i.kind === kind)) })),
        summary: projectSummary(data, project, today),
      }
    })
}

// ——— Tareas ———————————————————————————————————————————————————————————————

export interface StatsTaskWeek {
  start: ISODate
  /** Dadas de alta esa semana (createdAt). */
  created: number
  /** Terminadas esa semana (completedAt). */
  done: number
}

export interface StatsTasks {
  weeks: StatsTaskWeek[]
  open: number
  done: number
  cancelled: number
  /** Hechas en las últimas cuatro semanas y dadas de alta en ellas. */
  doneRecent: number
  createdRecent: number
  /** Hechas sin fecha de fin y elementos sin fecha de alta: no salen en ninguna semana. */
  doneUndated: number
  createdUndated: number
  /** Las abiertas por estado, en el orden del tablero (también los estados sin ninguna). */
  byStatus: { status: ItemStatus; count: number }[]
  byKind: { kind: ItemKind; open: number }[]
}

/** Creadas y hechas por semana y lo abierto por estado (tareas, funcionalidades, hitos, decisiones e incidencias). */
export function statsTasks(data: StudioData, today: ISODate, scope: Scope = null, weekStart: WeekStart = 1, tag: string | null = null, weeks = STATS_WEEKS): StatsTasks {
  const items = itemsOf(data, scope).filter((i) => TASK_KINDS.includes(i.kind) && hasTag(i, tag))
  const starts = statsWeekStarts(today, weeks, weekStart)
  const at = weekIndexer(starts, weekStart)
  const rows = starts.map((start) => ({ start, created: 0, done: 0 }))
  for (const i of items) {
    const c = at(i.createdAt)
    if (c >= 0) rows[c].created++
    if (i.status === 'done') {
      const d = at(i.completedAt)
      if (d >= 0) rows[d].done++
    }
  }
  const open = items.filter(isOpen)
  const done = items.filter((i) => i.status === 'done')
  return {
    weeks: trimLeading(rows, (r) => r.created === 0 && r.done === 0),
    open: open.length,
    done: done.length,
    cancelled: items.filter((i) => i.status === 'cancelled').length,
    doneRecent: done.filter((i) => recent(i.completedAt, today)).length,
    createdRecent: items.filter((i) => recent(i.createdAt, today)).length,
    doneUndated: done.filter((i) => !i.completedAt).length,
    createdUndated: items.filter((i) => !i.createdAt).length,
    byStatus: STATUS_ORDER.filter((s) => STATUSES[s].open).map((status) => ({ status, count: open.filter((i) => i.status === status).length })),
    byKind: TASK_KINDS.map((kind) => ({ kind, open: open.filter((i) => i.kind === kind).length })),
  }
}

// ——— Hitos ————————————————————————————————————————————————————————————————

export interface StatsDays {
  item: WorkItem
  /** Días de retraso (o que faltan, en los próximos). */
  days: number
}

export interface StatsMilestones {
  done: WorkItem[]
  /** Abiertos: los que siguen previstos. */
  planned: WorkItem[]
  cancelled: number
  /** Hechos el día de su fecha límite o antes. */
  onTime: WorkItem[]
  /** Hechos después de su fecha límite, con los días de retraso (del más tardío al menos). */
  late: StatsDays[]
  /** Hechos sin fecha límite: no se puede saber si llegaron a tiempo. */
  noDue: WorkItem[]
  /** Hechos con fecha límite pero sin fecha de fin: tampoco se puede saber. */
  noCompleted: WorkItem[]
  /** Previstos con la fecha ya pasada, del más retrasado al menos. */
  overdue: StatsDays[]
  /** Previstos con fecha por llegar, del más cercano al más lejano. */
  upcoming: StatsDays[]
  /** Previstos sin fecha límite. */
  undated: WorkItem[]
  /** Hechos por mes (AAAA-MM), del primero con alguno a este (sin contar los que no tienen fecha). */
  byMonth: { month: string; done: number }[]
  byProject: { project: Project; done: number; planned: number; onTime: number; late: number }[]
}

const monthsBetween = (from: string, to: string): string[] => {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** Hitos hechos frente a previstos y, de los hechos, a tiempo o tarde (completedAt frente a dueDate). */
export function statsMilestones(data: StudioData, today: ISODate, scope: Scope = null, tag: string | null = null): StatsMilestones {
  const all = itemsOf(data, scope).filter((i) => i.kind === 'milestone' && hasTag(i, tag))
  const done = all.filter((i) => i.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const planned = all.filter(isOpen)
  const onTime = done.filter((i) => i.dueDate && i.completedAt && i.completedAt <= i.dueDate)
  const late = done
    .filter((i) => i.dueDate && i.completedAt && i.completedAt > i.dueDate)
    .map((item) => ({ item, days: daysBetween(item.dueDate!, item.completedAt!) }))
    .sort((a, b) => b.days - a.days)
  const dated = planned.filter((i) => i.dueDate)
  const months = done.map((i) => i.completedAt?.slice(0, 7)).filter((m): m is string => !!m)
  const first = months.length ? months.reduce((a, b) => (a < b ? a : b)) : null
  const projects = data.projects.filter((p) => all.some((i) => i.projectId === p.id)).sort(projectsByStage)
  return {
    done,
    planned,
    cancelled: all.filter((i) => i.status === 'cancelled').length,
    onTime,
    late,
    noDue: done.filter((i) => !i.dueDate),
    noCompleted: done.filter((i) => i.dueDate && !i.completedAt),
    overdue: dated
      .filter((i) => i.dueDate! < today)
      .map((item) => ({ item, days: daysBetween(item.dueDate!, today) }))
      .sort((a, b) => b.days - a.days),
    upcoming: dated
      .filter((i) => i.dueDate! >= today)
      .map((item) => ({ item, days: daysBetween(today, item.dueDate!) }))
      .sort((a, b) => a.days - b.days),
    undated: planned.filter((i) => !i.dueDate),
    byMonth: first ? monthsBetween(first, today.slice(0, 7)).map((month) => ({ month, done: months.filter((m) => m === month).length })) : [],
    byProject: projects.map((project) => {
      const n = (list: WorkItem[]) => list.filter((i) => i.projectId === project.id).length
      return { project, done: n(done), planned: n(planned), onTime: n(onTime), late: n(late.map((l) => l.item)) }
    }),
  }
}

// ——— Tiempo ———————————————————————————————————————————————————————————————

export interface StatsTimeRow<T> {
  /** Sin él: sin indicar (o ya no existe). */
  who?: T
  minutes: number
  /** Minutos en las últimas cuatro semanas. */
  recent: number
}

export interface StatsTime {
  entries: number
  total: number
  recent: number
  weeks: { start: ISODate; minutes: number }[]
  byProject: StatsTimeRow<Project>[]
  byPerson: StatsTimeRow<Member>[]
  /** En qué se fueron las horas (los elementos con más tiempo apuntado; sin elemento, «en general»). */
  byItem: StatsTimeRow<WorkItem>[]
}

function groupMinutes<T extends { id: ID }>(entries: { key?: ID; date: ISODate; minutes: number }[], lookup: Map<ID, T>, today: ISODate): StatsTimeRow<T>[] {
  const rows = new Map<string, StatsTimeRow<T>>()
  for (const e of entries) {
    const who = e.key ? lookup.get(e.key) : undefined
    const k = who?.id ?? ''
    const row = rows.get(k) ?? { who, minutes: 0, recent: 0 }
    row.minutes += e.minutes
    if (recent(e.date, today)) row.recent += e.minutes
    rows.set(k, row)
  }
  // De más a menos; lo «sin indicar», al final.
  return [...rows.values()].sort((a, b) => Number(!a.who) - Number(!b.who) || b.minutes - a.minutes)
}

/** Las horas apuntadas a mano: por semana, proyecto, persona y elemento. */
export function statsTime(data: StudioData, today: ISODate, scope: Scope = null, weekStart: WeekStart = 1, weeks = STATS_WEEKS): StatsTime {
  const entries = data.timeEntries.filter(own(scope))
  const starts = statsWeekStarts(today, weeks, weekStart)
  const at = weekIndexer(starts, weekStart)
  const rows = starts.map((start) => ({ start, minutes: 0 }))
  for (const e of entries) {
    const k = at(e.date)
    if (k >= 0) rows[k].minutes += e.minutes
  }
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  const members = new Map(data.members.map((m) => [m.id, m]))
  const items = new Map(data.items.map((i) => [i.id, i]))
  return {
    entries: entries.length,
    total: entries.reduce((s, e) => s + e.minutes, 0),
    recent: entries.filter((e) => recent(e.date, today)).reduce((s, e) => s + e.minutes, 0),
    weeks: trimLeading(rows, (r) => r.minutes === 0),
    byProject: groupMinutes(entries.map((e) => ({ ...e, key: e.projectId })), projects, today),
    byPerson: groupMinutes(entries.map((e) => ({ ...e, key: e.memberId })), members, today),
    byItem: groupMinutes(entries.map((e) => ({ ...e, key: e.itemId })), items, today),
  }
}

// ——— Actividad ————————————————————————————————————————————————————————————

export interface StatsActivityPerson {
  /** La persona del equipo, si se reconoce (memberId o uno de sus nombres en git). */
  member?: Member
  /** El autor tal cual viene de git, si no se reconoce a nadie. */
  author?: string
  count: number
}

export interface StatsActivity {
  commits: number
  merges: number
  /** Commits y fusiones en las últimas cuatro semanas. */
  recent: number
  weeks: { start: ISODate; commits: number; merges: number }[]
  /** Commits y fusiones por área (sin área, al final). */
  byArea: { area?: Area; count: number }[]
  /** Por persona: solo lo que trae autor. */
  byPerson: StatsActivityPerson[]
  /** Commits y fusiones sin autor ni persona. */
  withoutAuthor: number
}

/** La persona de un registro: su memberId o, si no, quien tenga ese autor entre sus nombres en git (o como nombre). */
export function statsActivityMember(data: StudioData, a: { memberId?: ID; author?: string }): Member | undefined {
  if (a.memberId) return data.members.find((m) => m.id === a.memberId)
  if (!a.author) return undefined
  const who = normalize(a.author.trim())
  return data.members.find((m) => [m.name, ...(m.aliases ?? [])].some((n) => normalize(n.trim()) === who))
}

/** Commits y fusiones del historial: por semana, por área y, si traen autor, por persona. */
export function statsActivity(data: StudioData, today: ISODate, scope: Scope = null, weekStart: WeekStart = 1, weeks = STATS_WEEKS): StatsActivity {
  const code = data.activity.filter((a) => own(scope)(a) && (a.type === 'commit' || a.type === 'merge'))
  const starts = statsWeekStarts(today, weeks, weekStart)
  const at = weekIndexer(starts, weekStart)
  const rows = starts.map((start) => ({ start, commits: 0, merges: 0 }))
  const areas = new Map<string, number>()
  const people = new Map<string, StatsActivityPerson>()
  let withoutAuthor = 0
  for (const a of code) {
    const k = at(a.at)
    if (k >= 0) rows[k][a.type === 'commit' ? 'commits' : 'merges']++
    areas.set(a.areaId ?? '', (areas.get(a.areaId ?? '') ?? 0) + 1)
    const member = statsActivityMember(data, a)
    const author = a.author?.trim()
    if (!member && !author) {
      withoutAuthor++
      continue
    }
    const key = member ? `m:${member.id}` : `a:${normalize(author!)}`
    const row = people.get(key) ?? (member ? { member, count: 0 } : { author, count: 0 })
    row.count++
    people.set(key, row)
  }
  const areaById = new Map(data.areas.map((x) => [x.id, x]))
  return {
    commits: code.filter((a) => a.type === 'commit').length,
    merges: code.filter((a) => a.type === 'merge').length,
    recent: code.filter((a) => recent(a.at, today)).length,
    weeks: trimLeading(rows, (r) => r.commits === 0 && r.merges === 0),
    byArea: [...areas.entries()]
      .map(([id, count]) => ({ area: areaById.get(id), count }))
      .sort((a, b) => Number(!a.area) - Number(!b.area) || b.count - a.count),
    byPerson: [...people.values()].sort((a, b) => b.count - a.count),
    withoutAuthor,
  }
}

// ——— Métricas de plataformas ————————————————————————————————————————————————

/** ¿Entra en las gráficas? Lanzamiento: lo que no está por comprobar. Comerciales: solo lo verificado. */
export function statsMetricCounts(m: Metric): boolean {
  return METRIC_KINDS[m.kind].group === 'commercial' ? m.confidence === 'verified' : m.confidence !== 'to_confirm'
}

export interface StatsMetricSeries {
  /** Proyecto, tipo, plataforma y (en «otra métrica») su nombre. */
  key: string
  projectId: ID
  kind: MetricKind
  platform?: Metric['platform']
  label?: string
  /** Los datos que cuentan, del más antiguo al más reciente. */
  points: Metric[]
  latest: Metric
  /** El dato anterior al último (para la diferencia). */
  previous?: Metric
}

export interface StatsMetrics {
  series: StatsMetricSeries[]
  /** Los que no cuentan (por comprobar o, en los comerciales, sin verificar), del más reciente al más antiguo. */
  excluded: Metric[]
}

const KIND_ORDER = Object.keys(METRIC_KINDS) as MetricKind[]

/** Los datos de un grupo (lanzamiento o comerciales) agrupados en series, y aparte los que no cuentan. */
export function statsMetrics(data: StudioData, group: MetricGroup, scope: Scope = null): StatsMetrics {
  const list = data.metrics.filter((m) => own(scope)(m) && METRIC_KINDS[m.kind].group === group)
  const series = new Map<string, Metric[]>()
  for (const m of list.filter(statsMetricCounts)) {
    const label = m.kind === 'other' ? (m.label?.trim() ?? '') : ''
    const key = [m.projectId, m.kind, m.platform ?? '', normalize(label)].join('|')
    series.set(key, [...(series.get(key) ?? []), m])
  }
  const names = new Map(data.projects.map((p) => [p.id, p.name]))
  return {
    series: [...series.entries()]
      .map(([key, points]): StatsMetricSeries => {
        const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
        const latest = sorted[sorted.length - 1]
        return {
          key,
          projectId: latest.projectId,
          kind: latest.kind,
          platform: latest.platform,
          label: latest.kind === 'other' ? latest.label : undefined,
          points: sorted,
          latest,
          previous: sorted[sorted.length - 2],
        }
      })
      .sort(
        (a, b) =>
          (names.get(a.projectId) ?? '').localeCompare(names.get(b.projectId) ?? '', 'es') ||
          KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
          (a.platform ?? '').localeCompare(b.platform ?? '') ||
          (a.label ?? '').localeCompare(b.label ?? '', 'es'),
      ),
    excluded: list.filter((m) => !statsMetricCounts(m)).sort((a, b) => b.date.localeCompare(a.date)),
  }
}
