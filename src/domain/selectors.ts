// Las preguntas del panel, como funciones puras sobre los datos. Ninguna conoce a un
// proyecto concreto: reciben los datos, la fecha de hoy y, si acaso, el proyecto.
import { FEEDBACK_STATUSES, PRIORITIES, STATUSES } from './catalog'
import { addDays, daysBetween, startOfWeek } from './dates'
import type {
  Activity,
  Build,
  BuildChannel,
  Checklist,
  Feedback,
  ID,
  ISODate,
  Project,
  StudioData,
  StudioEvent,
  WorkItem,
} from './types'

/** null = todo el estudio. */
export type Scope = ID | null

const inScope = (scope: Scope) => (x: { projectId?: ID }) => scope === null || x.projectId === scope

export const isOpen = (i: WorkItem) => STATUSES[i.status].open

/** Abierto y en marcha de verdad: ni idea, ni en pausa, ni por confirmar. */
export const isActionable = (i: WorkItem) =>
  isOpen(i) && i.status !== 'idea' && i.status !== 'paused' && i.status !== 'to_confirm'

export const byPriority = (a: WorkItem, b: WorkItem) => PRIORITIES[b.priority].weight - PRIORITIES[a.priority].weight

/** Fecha que mejor resume un elemento: cuándo se acabó, si no cuándo empezó o se creó. */
export const itemDate = (i: WorkItem): ISODate | undefined => i.completedAt ?? i.startedAt ?? i.createdAt

export function itemsOf(data: StudioData, scope: Scope): WorkItem[] {
  return data.items.filter(inScope(scope))
}

export function projectById(data: StudioData, id: ID | undefined): Project | undefined {
  return id ? data.projects.find((p) => p.id === id) : undefined
}

// ——— Hoy ———————————————————————————————————————————————————————————————

export type TodayReason = 'focus' | 'overdue' | 'due' | 'in_progress' | 'review'

export interface TodayEntry {
  item: WorkItem
  reason: TodayReason
}

/**
 * Lo que toca hoy: lo marcado para hoy, lo vencido, lo que vence hoy y lo que está en
 * curso o esperando revisión. Cada elemento sale una vez, con su motivo más urgente.
 */
export function todayItems(data: StudioData, today: ISODate, scope: Scope = null): TodayEntry[] {
  const order: Record<TodayReason, number> = { overdue: 0, due: 1, focus: 2, in_progress: 3, review: 4 }
  const out: TodayEntry[] = []
  for (const item of itemsOf(data, scope)) {
    if (!isOpen(item)) continue
    let reason: TodayReason | null = null
    if (item.dueDate && item.dueDate < today) reason = 'overdue'
    else if (item.dueDate === today) reason = 'due'
    else if (item.focusDate === today) reason = 'focus'
    else if (item.status === 'in_progress') reason = 'in_progress'
    else if (item.status === 'review') reason = 'review'
    if (reason) out.push({ item, reason })
  }
  return out.sort((a, b) => order[a.reason] - order[b.reason] || byPriority(a.item, b.item))
}

export function blockedItems(data: StudioData, scope: Scope = null): WorkItem[] {
  return itemsOf(data, scope).filter((i) => i.status === 'blocked').sort(byPriority)
}

export function pausedItems(data: StudioData, scope: Scope = null): WorkItem[] {
  return itemsOf(data, scope).filter((i) => i.status === 'paused').sort(byPriority)
}

/** Lo que el estudio tiene que confirmar: estado «por confirmar» o dato sin fuente. */
export function toConfirmItems(data: StudioData, scope: Scope = null): WorkItem[] {
  return itemsOf(data, scope)
    .filter((i) => isOpen(i) && (i.status === 'to_confirm' || i.confidence === 'to_confirm'))
    .sort(byPriority)
}

export function overdueItems(data: StudioData, today: ISODate, scope: Scope = null): WorkItem[] {
  return itemsOf(data, scope).filter((i) => isOpen(i) && !!i.dueDate && i.dueDate < today)
}

// ——— Agenda —————————————————————————————————————————————————————————————

export type AgendaEntry =
  | { kind: 'event'; date: ISODate; event: StudioEvent }
  | { kind: 'due'; date: ISODate; item: WorkItem }

/** Eventos y fechas límite desde hoy hasta dentro de `days` días, por fecha. */
export function upcoming(data: StudioData, today: ISODate, days: number, scope: Scope = null): AgendaEntry[] {
  const until = addDays(today, days)
  const events: AgendaEntry[] = data.events
    .filter(inScope(scope))
    .filter((e) => e.date && e.status !== 'cancelled' && e.status !== 'done' && (e.endDate ?? e.date) >= today && e.date <= until)
    .map((event) => ({ kind: 'event', date: event.date!, event }))
  const dues: AgendaEntry[] = itemsOf(data, scope)
    .filter((i) => isOpen(i) && i.dueDate && i.dueDate >= today && i.dueDate <= until)
    .map((item) => ({ kind: 'due', date: item.dueDate!, item }))
  return [...events, ...dues].sort((a, b) => a.date.localeCompare(b.date))
}

/** Eventos previstos que aún no tienen fecha confirmada. */
export function undatedEvents(data: StudioData, scope: Scope = null): StudioEvent[] {
  return data.events
    .filter(inScope(scope))
    .filter((e) => (e.status === 'idea' || e.status === 'planned' || e.status === 'confirmed') && (!e.date || !e.dateConfirmed))
}

/** Eventos con fecha ya pasada que siguen como previstos: ¿se celebraron? */
export function staleEvents(data: StudioData, today: ISODate, scope: Scope = null): StudioEvent[] {
  return data.events
    .filter(inScope(scope))
    .filter((e) => e.date && (e.endDate ?? e.date) < today && (e.status === 'planned' || e.status === 'confirmed'))
}

// ——— Builds ————————————————————————————————————————————————————————————

/** La build más reciente de cada canal y proyecto que no esté sustituida ni retirada. */
export function currentBuilds(data: StudioData, scope: Scope = null): Build[] {
  const latest = new Map<string, Build>()
  for (const b of data.builds.filter(inScope(scope))) {
    if (b.status === 'superseded' || b.status === 'withdrawn') continue
    const key = `${b.projectId}:${b.channel}:${b.name}`
    const prev = latest.get(key)
    if (!prev || (b.date ?? '') > (prev.date ?? '')) latest.set(key, b)
  }
  const channelOrder: Record<BuildChannel, number> = { full: 0, demo: 1, event: 2, beta: 3, playtest: 4, internal: 5 }
  return [...latest.values()].sort(
    (a, b) => channelOrder[a.channel] - channelOrder[b.channel] || (b.date ?? '').localeCompare(a.date ?? ''),
  )
}

// ——— Publicación ———————————————————————————————————————————————————————

export interface ChecklistProgress {
  checklist: Checklist
  done: number
  total: number
  ratio: number
}

export function checklistProgress(c: Checklist): ChecklistProgress {
  const done = c.items.filter((i) => i.done).length
  const total = c.items.length
  return { checklist: c, done, total, ratio: total ? done / total : 0 }
}

export function checklistsOf(data: StudioData, scope: Scope = null): ChecklistProgress[] {
  return data.checklists.filter(inScope(scope)).map(checklistProgress)
}

// ——— Feedback ——————————————————————————————————————————————————————————

/** Feedback abierto, de más a menos impacto y de más nuevo a más viejo. */
export function feedbackToPrioritize(data: StudioData, scope: Scope = null): Feedback[] {
  return data.feedback
    .filter(inScope(scope))
    .filter((f) => FEEDBACK_STATUSES[f.status].open)
    .sort(
      (a, b) =>
        PRIORITIES[b.impact].weight - PRIORITIES[a.impact].weight || (b.receivedAt ?? '').localeCompare(a.receivedAt ?? ''),
    )
}

// ——— Historial y evolución ————————————————————————————————————————————

export function activityOf(data: StudioData, scope: Scope = null): Activity[] {
  return data.activity.filter(inScope(scope)).sort((a, b) => b.at.localeCompare(a.at))
}

export function lastActivityDate(data: StudioData, projectId: ID): ISODate | undefined {
  let last: string | undefined
  for (const a of data.activity) if (a.projectId === projectId && (!last || a.at > last)) last = a.at
  for (const i of data.items) {
    if (i.projectId !== projectId) continue
    const d = itemDate(i)
    if (d && (!last || d > last.slice(0, 10))) last = d
  }
  return last?.slice(0, 10)
}

export interface Bucket {
  start: ISODate
  commits: number
  completed: number
}

/**
 * Evolución por semanas (lunes a domingo) hasta la semana de hoy: commits y elementos
 * terminados. Empieza en la primera semana con actividad o `weeks` semanas atrás.
 */
export function weeklyEvolution(data: StudioData, today: ISODate, weeks: number, scope: Scope = null): Bucket[] {
  const end = startOfWeek(today)
  const buckets: Bucket[] = []
  for (let k = weeks - 1; k >= 0; k--) buckets.push({ start: addDays(end, -7 * k), commits: 0, completed: 0 })
  const index = (d: ISODate) => {
    const n = daysBetween(buckets[0].start, startOfWeek(d)) / 7
    return n >= 0 && n < buckets.length ? n : -1
  }
  for (const a of activityOf(data, scope)) {
    if (a.type !== 'commit') continue
    const k = index(a.at.slice(0, 10))
    if (k >= 0) buckets[k].commits++
  }
  for (const i of itemsOf(data, scope)) {
    if (i.status !== 'done' || !i.completedAt) continue
    const k = index(i.completedAt)
    if (k >= 0) buckets[k].completed++
  }
  // Las semanas vacías del principio no cuentan nada: se quitan, dejando al menos cuatro.
  const first = buckets.findIndex((b) => b.commits > 0 || b.completed > 0)
  const keep = Math.max(0, Math.min(first === -1 ? buckets.length : first, buckets.length - 4))
  return buckets.slice(keep)
}

/** Commits por día en los últimos `days` días (para la minigráfica de cada proyecto). */
export function dailyCommits(data: StudioData, today: ISODate, days: number, projectId: ID): number[] {
  const start = addDays(today, -(days - 1))
  const counts = new Array<number>(days).fill(0)
  for (const a of data.activity) {
    if (a.projectId !== projectId || a.type !== 'commit') continue
    const k = daysBetween(start, a.at.slice(0, 10))
    if (k >= 0 && k < days) counts[k]++
  }
  return counts
}

// ——— Estado de cada proyecto ——————————————————————————————————————————

export type HealthLevel = 'on_track' | 'attention' | 'urgent' | 'idle'

export interface ProjectHealth {
  level: HealthLevel
  score: number
  reasons: string[]
}

export interface ProjectSummary {
  project: Project
  done: number
  open: number
  actionable: number
  blocked: number
  paused: number
  toConfirm: number
  inReview: number
  overdue: number
  lastActivity?: ISODate
  health: ProjectHealth
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Cuánta atención pide un proyecto, con los motivos en claro. Los puntos son
 * orientativos: sirven para ordenar los proyectos, no para juzgarlos.
 */
export function projectSummary(data: StudioData, project: Project, today: ISODate): ProjectSummary {
  const items = itemsOf(data, project.id)
  const open = items.filter(isOpen)
  const blocked = open.filter((i) => i.status === 'blocked')
  const paused = open.filter((i) => i.status === 'paused')
  const toConfirm = open.filter((i) => i.status === 'to_confirm')
  const inReview = open.filter((i) => i.status === 'review')
  const overdue = open.filter((i) => i.dueDate && i.dueDate < today)
  const urgentOpen = open.filter((i) => i.priority === 'critical' && i.status !== 'paused')
  const lastActivity = lastActivityDate(data, project.id)
  const newFeedback = data.feedback.filter((f) => f.projectId === project.id && f.status === 'new')
  const soonEvents = data.events.filter(
    (e) =>
      e.projectId === project.id &&
      e.date &&
      (e.status === 'planned' || e.status === 'confirmed') &&
      e.date >= today &&
      daysBetween(today, e.date) <= 14,
  )

  const reasons: string[] = []
  let score = 0
  if (blocked.length) {
    score += blocked.reduce((s, i) => s + (PRIORITIES[i.priority].weight >= 3 ? 3 : 2), 0)
    reasons.push(plural(blocked.length, 'elemento bloqueado', 'elementos bloqueados'))
  }
  if (overdue.length) {
    score += 2 * overdue.length
    reasons.push(plural(overdue.length, 'fecha límite vencida', 'fechas límite vencidas'))
  }
  if (urgentOpen.length) {
    score += 2 * urgentOpen.length
    reasons.push(plural(urgentOpen.length, 'elemento crítico abierto', 'elementos críticos abiertos'))
  }
  const highReview = inReview.filter((i) => PRIORITIES[i.priority].weight >= 3)
  if (highReview.length) {
    score += highReview.length
    reasons.push(plural(highReview.length, 'cambio importante esperando revisión', 'cambios importantes esperando revisión'))
  }
  const highConfirm = toConfirm.filter((i) => PRIORITIES[i.priority].weight >= 3)
  if (highConfirm.length) {
    score += Math.min(3, highConfirm.length)
    reasons.push(plural(highConfirm.length, 'dato importante por confirmar', 'datos importantes por confirmar'))
  }
  if (newFeedback.length) {
    score += 1
    reasons.push(plural(newFeedback.length, 'feedback sin revisar', 'feedback sin revisar'))
  }
  if (soonEvents.length) {
    score += 2
    reasons.push(plural(soonEvents.length, 'evento en las próximas dos semanas', 'eventos en las próximas dos semanas'))
  }
  const quiet = project.stage !== 'paused' && project.stage !== 'archived' && project.stage !== 'live'
  if (quiet && lastActivity) {
    const idle = daysBetween(lastActivity, today)
    if (idle > 30) {
      score += 3
      reasons.push(`sin actividad desde hace ${idle} días`)
    } else if (idle > 14) {
      score += 2
      reasons.push(`sin actividad desde hace ${idle} días`)
    }
  }

  let level: HealthLevel = score >= 7 ? 'urgent' : score >= 3 ? 'attention' : 'on_track'
  if (project.stage === 'paused' || project.stage === 'archived') level = 'idle'

  return {
    project,
    done: items.filter((i) => i.status === 'done').length,
    open: open.length,
    actionable: open.filter(isActionable).length,
    blocked: blocked.length,
    paused: paused.length,
    toConfirm: toConfirm.length,
    inReview: inReview.length,
    overdue: overdue.length,
    lastActivity,
    health: { level, score, reasons },
  }
}

export function projectSummaries(data: StudioData, today: ISODate): ProjectSummary[] {
  return data.projects
    .map((p) => projectSummary(data, p, today))
    .sort((a, b) => b.health.score - a.health.score || a.project.name.localeCompare(b.project.name))
}

/** Proyectos que piden atención ya (nivel «atención» o «urgente»). */
export function needsAttention(data: StudioData, today: ISODate): ProjectSummary[] {
  return projectSummaries(data, today).filter((s) => s.health.level === 'urgent' || s.health.level === 'attention')
}

// ——— Decisiones ————————————————————————————————————————————————————————

export function decisions(data: StudioData, scope: Scope = null): { open: WorkItem[]; taken: WorkItem[] } {
  const all = itemsOf(data, scope).filter((i) => i.kind === 'decision')
  return {
    open: all.filter(isOpen).sort(byPriority),
    taken: all.filter((i) => !isOpen(i)).sort((a, b) => (itemDate(b) ?? '').localeCompare(itemDate(a) ?? '')),
  }
}

// ——— Steam, ferias y presentaciones ———————————————————————————————————

/** Lo pendiente de las áreas que se pasan (Steam, ferias…), para el bloque de publicación. */
export function pendingInAreas(data: StudioData, areaIds: ID[], scope: Scope = null): WorkItem[] {
  return itemsOf(data, scope)
    .filter((i) => isOpen(i) && i.areaId !== undefined && areaIds.includes(i.areaId))
    .sort(byPriority)
}

// ——— Búsqueda ————————————————————————————————————————————————————————————

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function matchesQuery(item: WorkItem, query: string): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  const hay = normalize([item.title, item.description, item.decisionOutcome, item.blockedReason, ...item.tags, ...item.sources.map((s) => s.ref)].join(' '))
  return q.split(/\s+/).every((w) => hay.includes(w))
}
