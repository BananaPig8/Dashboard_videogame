// Las preguntas del panel, como funciones puras sobre los datos. Ninguna conoce a un
// proyecto concreto: reciben los datos, la fecha de hoy y, si acaso, el proyecto.
import { FEEDBACK_STATUSES, PRIORITIES, STATUSES, TASK_KINDS } from './catalog'
import type { CollectionKey } from './collections'
import { addDays, daysBetween, startOfWeek, type WeekStart } from './dates'
import { registrationsClosingSoon } from './secciones/eventos'
import { budgetUsage } from './secciones/finanzas'
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

/** Los eventos de todo el estudio (sin proyecto) cuentan también en cada proyecto, como en el Calendario. */
const eventInScope = (scope: Scope) => (e: { projectId?: ID }) => scope === null || !e.projectId || e.projectId === scope

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

/** Trabajo (no objetivos): lo que cuentan Tareas, Hoy, los avisos y los contadores. */
const isWork = (i: WorkItem) => TASK_KINDS.includes(i.kind)
const workOf = (data: StudioData, scope: Scope) => itemsOf(data, scope).filter(isWork)

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
  for (const item of workOf(data, scope)) {
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
  return workOf(data, scope).filter((i) => i.status === 'blocked').sort(byPriority)
}

export function pausedItems(data: StudioData, scope: Scope = null): WorkItem[] {
  return workOf(data, scope).filter((i) => i.status === 'paused').sort(byPriority)
}

export function overdueItems(data: StudioData, today: ISODate, scope: Scope = null): WorkItem[] {
  return workOf(data, scope).filter((i) => isOpen(i) && !!i.dueDate && i.dueDate < today)
}

// ——— Agenda —————————————————————————————————————————————————————————————

/** Eventos previstos que aún no tienen fecha confirmada. */
export function undatedEvents(data: StudioData, scope: Scope = null): StudioEvent[] {
  return data.events
    .filter(eventInScope(scope))
    .filter((e) => (e.status === 'idea' || e.status === 'planned' || e.status === 'confirmed') && (!e.date || !e.dateConfirmed))
}

/** Eventos con fecha ya pasada que siguen como previstos: ¿se celebraron? */
export function staleEvents(data: StudioData, today: ISODate, scope: Scope = null): StudioEvent[] {
  return data.events
    .filter(eventInScope(scope))
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
 * Evolución por semanas (de lunes, o de domingo) hasta la semana de hoy: commits y elementos
 * terminados. Empieza en la primera semana con actividad o `weeks` semanas atrás.
 */
export function weeklyEvolution(data: StudioData, today: ISODate, weeks: number, scope: Scope = null, weekStart: WeekStart = 1): Bucket[] {
  const end = startOfWeek(today, weekStart)
  const buckets: Bucket[] = []
  for (let k = weeks - 1; k >= 0; k--) buckets.push({ start: addDays(end, -7 * k), commits: 0, completed: 0 })
  const index = (d: ISODate) => {
    const n = daysBetween(buckets[0].start, startOfWeek(d, weekStart)) / 7
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
  const items = workOf(data, project.id)
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

// ——— Notificaciones ————————————————————————————————————————————————————————

export type NotificationKind =
  | 'overdue'
  | 'dueToday'
  | 'eventSoon'
  | 'eventStale'
  | 'blocked'
  | 'newFeedback'
  | 'reminder'
  | 'registrationSoon'
  | 'releaseSoon'
  | 'releaseLate'
  | 'budgetOver'

export interface StudioNotification {
  /** Estable mientras la situación no cambie: si vuelve a vencer otra fecha, es otra notificación. */
  id: string
  kind: NotificationKind
  tone: 'danger' | 'warning' | 'info'
  title: string
  date?: ISODate
  projectId?: ID
  target: { collection: CollectionKey; id: ID }
}

/**
 * Lo que merece un aviso hoy: lo vencido, lo que vence hoy, eventos de los próximos 14
 * días, eventos pasados sin actualizar, bloqueos importantes, feedback sin revisar,
 * recordatorios del día, inscripciones que cierran, versiones que se acercan o cuya fecha
 * ya pasó y presupuestos superados.
 */
export function notificationsFor(data: StudioData, today: ISODate): StudioNotification[] {
  const out: StudioNotification[] = []
  for (const i of data.items) {
    if (!isOpen(i) || !isWork(i)) continue
    if (i.dueDate && i.dueDate < today)
      out.push({ id: `overdue:${i.id}:${i.dueDate}`, kind: 'overdue', tone: 'danger', title: i.title, date: i.dueDate, projectId: i.projectId, target: { collection: 'items', id: i.id } })
    else if (i.dueDate === today)
      out.push({ id: `due:${i.id}:${today}`, kind: 'dueToday', tone: 'warning', title: i.title, date: today, projectId: i.projectId, target: { collection: 'items', id: i.id } })
    if (i.status === 'blocked' && PRIORITIES[i.priority].weight >= 3)
      out.push({ id: `blocked:${i.id}`, kind: 'blocked', tone: 'danger', title: i.title, projectId: i.projectId, target: { collection: 'items', id: i.id } })
  }
  for (const e of data.events) {
    if (!e.date || e.status === 'cancelled' || e.status === 'done') continue
    const days = daysBetween(today, e.date)
    if (days >= 0 && days <= 14)
      out.push({ id: `event:${e.id}:${e.date}`, kind: 'eventSoon', tone: days <= 3 ? 'warning' : 'info', title: e.title, date: e.date, projectId: e.projectId, target: { collection: 'events', id: e.id } })
    else if ((e.endDate ?? e.date) < today && (e.status === 'planned' || e.status === 'confirmed'))
      out.push({ id: `stale:${e.id}:${e.date}`, kind: 'eventStale', tone: 'warning', title: e.title, date: e.date, projectId: e.projectId, target: { collection: 'events', id: e.id } })
  }
  for (const e of registrationsClosingSoon(data, today)) {
    const days = daysBetween(today, e.registrationDeadline!)
    out.push({
      id: `registration:${e.id}:${e.registrationDeadline}`,
      kind: 'registrationSoon',
      tone: days <= 3 ? 'warning' : 'info',
      title: e.title,
      date: e.registrationDeadline,
      projectId: e.projectId,
      target: { collection: 'events', id: e.id },
    })
  }
  for (const f of data.feedback)
    if (f.status === 'new')
      out.push({ id: `feedback:${f.id}`, kind: 'newFeedback', tone: 'info', title: f.title, date: f.receivedAt, projectId: f.projectId, target: { collection: 'feedback', id: f.id } })
  for (const r of data.reminders)
    if (!r.done && r.date <= today)
      out.push({ id: `reminder:${r.id}:${r.date}`, kind: 'reminder', tone: r.date < today ? 'warning' : 'info', title: r.title, date: r.date, projectId: r.projectId, target: { collection: 'reminders', id: r.id } })
  for (const r of data.releases) {
    if (r.releasedAt || !r.targetDate || r.status === 'released' || r.status === 'cancelled') continue
    const days = daysBetween(today, r.targetDate)
    if (days < 0)
      out.push({ id: `releaseLate:${r.id}:${r.targetDate}`, kind: 'releaseLate', tone: 'warning', title: r.name, date: r.targetDate, projectId: r.projectId, target: { collection: 'releases', id: r.id } })
    else if (days <= 14)
      out.push({ id: `release:${r.id}:${r.targetDate}`, kind: 'releaseSoon', tone: days <= 3 ? 'warning' : 'info', title: r.name, date: r.targetDate, projectId: r.projectId, target: { collection: 'releases', id: r.id } })
  }
  for (const b of data.budgets) {
    const u = budgetUsage(data, b)
    if (u.over && b.from <= today)
      out.push({ id: `budget:${b.id}:${u.spent}`, kind: 'budgetOver', tone: 'warning', title: b.name, projectId: b.projectId, target: { collection: 'budgets', id: b.id } })
  }
  const rank = { danger: 0, warning: 1, info: 2 }
  return out.sort((a, b) => rank[a.tone] - rank[b.tone] || (a.date ?? '9999').localeCompare(b.date ?? '9999'))
}

// ——— Por sección ——————————————————————————————————————————————————————————
// Cada sección tiene sus cálculos en domain/secciones/<sección>.ts; las pantallas los piden
// aquí. Esos ficheros importan de este, así que solo usan lo importado dentro de funciones.
export * from './secciones/panel'
export * from './secciones/proyectos'
export * from './secciones/tareas'
export * from './secciones/roadmap'
export * from './secciones/calendario'
export * from './secciones/builds'
export * from './secciones/publicacion'
export * from './secciones/feedback'
export * from './secciones/eventos'
export * from './secciones/documentacion'
export * from './secciones/recursos'
export * from './secciones/equipo'
export * from './secciones/finanzas'
export * from './secciones/estadisticas'
export * from './secciones/ajustes'
export * from './secciones/etiquetas'
