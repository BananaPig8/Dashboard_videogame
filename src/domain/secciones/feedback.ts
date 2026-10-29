// Cálculos de la sección «Feedback y pruebas»: qué feedback sale en cada subsección (Todo,
// Comentarios, Bugs, Mejoras), los filtros finos de la URL, la cola de priorización, lo que
// ya ha cambiado por el feedback y los informes de cada prueba. Las pantallas los piden a
// selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { FEEDBACK_ORIGINS, FEEDBACK_STATUSES, PRIORITIES } from '../catalog'
import type {
  Build,
  Feedback,
  FeedbackKind,
  FeedbackOrigin,
  FeedbackStatus,
  ID,
  ISODate,
  Playtest,
  Priority,
  StudioData,
  StudioEvent,
  WorkItem,
} from '../types'
import { byPriority, feedbackToPrioritize, isOpen, normalize, type Scope } from '../selectors'
import { hasTag } from './etiquetas'

/** Subsecciones de la faceta «tipo» (null = todo el feedback). */
export type FeedbackTipo = 'comentarios' | 'bugs' | 'mejoras'

export const FEEDBACK_TIPO_KIND: Record<FeedbackTipo, FeedbackKind> = { comentarios: 'comment', bugs: 'bug', mejoras: 'request' }

/** El valor de ?tipo= si es una subsección; si no, null (todo). */
export function feedbackTipoOf(value: string | null): FeedbackTipo | null {
  return value && value in FEEDBACK_TIPO_KIND ? (value as FeedbackTipo) : null
}

/** Lo que lleva un feedback nuevo creado desde cada subsección. */
export function feedbackTipoDefaults(tipo: FeedbackTipo | null): Partial<Feedback> {
  return tipo ? { kind: FEEDBACK_TIPO_KIND[tipo] } : {}
}

/** Orden de los estados: del que pide atención al que ya está cerrado. */
export const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = ['new', 'triaged', 'planned', 'addressed', 'wont_do']

export const IMPACT_ORDER: Priority[] = ['critical', 'high', 'medium', 'low']

export const isFeedbackOpen = (f: Feedback) => FEEDBACK_STATUSES[f.status].open

// ——— Filtros finos (?estado=, ?impacto=, ?origen=, ?clase=, ?evento=, ?q=) ———————————

/** ?estado=: abierto (por atender), cerrado (atendido) o un estado concreto. */
export type FeedbackStateFilter = 'abierto' | 'cerrado' | FeedbackStatus

/** ?clase=sin-clasificar: solo el feedback que aún no dice qué es. */
export const FEEDBACK_UNCLASSIFIED = 'sin-clasificar'

export interface FeedbackQuery {
  scope?: Scope
  tipo?: FeedbackTipo | null
  /** Solo lo que no tiene «qué es» (solo tiene sentido en Todo). */
  unclassified?: boolean
  estado?: FeedbackStateFilter | null
  impacto?: Priority | null
  origen?: FeedbackOrigin | null
  q?: string
  tag?: string | null
  /** ?evento=: solo el feedback de ese evento (el que dice venir de él y el de sus pruebas). */
  evento?: ID | null
  /** Las pruebas de ese evento (las rellena feedbackQueryOf si se le pasan los datos). */
  eventoTests?: ID[]
}

/** Los filtros finos leídos de la URL; lo que no se entiende se ignora. */
export function feedbackQueryOf(params: URLSearchParams, scope: Scope = null, data?: StudioData): FeedbackQuery {
  const evento = params.get('evento') || null
  const estado = params.get('estado')
  const impacto = params.get('impacto')
  const origen = params.get('origen')
  const tipo = feedbackTipoOf(params.get('tipo'))
  return {
    scope,
    tipo,
    unclassified: tipo === null && params.get('clase') === FEEDBACK_UNCLASSIFIED,
    estado: estado === 'abierto' || estado === 'cerrado' || (estado && estado in FEEDBACK_STATUSES) ? (estado as FeedbackStateFilter) : null,
    impacto: impacto && impacto in PRIORITIES ? (impacto as Priority) : null,
    origen: origen && origen in FEEDBACK_ORIGINS ? (origen as FeedbackOrigin) : null,
    q: params.get('q') ?? '',
    tag: params.get('etiqueta') || null,
    evento,
    eventoTests: evento && data ? data.playtests.filter((p) => p.eventId === evento).map((p) => p.id) : [],
  }
}

/** ¿Hay algún filtro fino puesto (además de la subsección)? */
export function feedbackFiltered(q: FeedbackQuery): boolean {
  return !!(q.unclassified || q.estado || q.impacto || q.origen || q.evento || q.q?.trim())
}

const words = (q: string | undefined) =>
  normalize(q ?? '')
    .split(/\s+/)
    .filter(Boolean)
const matchesWords = (text: (string | undefined)[], ws: string[]) => {
  if (!ws.length) return true
  const hay = normalize(text.filter(Boolean).join(' '))
  return ws.every((w) => hay.includes(w))
}

const stateMatches = (estado: FeedbackStateFilter | null | undefined, status: FeedbackStatus) =>
  !estado || (estado === 'abierto' ? FEEDBACK_STATUSES[status].open : estado === 'cerrado' ? !FEEDBACK_STATUSES[status].open : status === estado)

/** ¿Entra este feedback con estos filtros (ámbito, subsección y filtros finos)? */
export function feedbackMatches(f: Feedback, q: FeedbackQuery): boolean {
  if (q.scope && f.projectId !== q.scope) return false
  if (q.tipo && f.kind !== FEEDBACK_TIPO_KIND[q.tipo]) return false
  if (q.unclassified && f.kind) return false
  if (!stateMatches(q.estado, f.status)) return false
  if (q.impacto && f.impact !== q.impacto) return false
  if (q.origen && f.origin !== q.origen) return false
  if (!hasTag(f, q.tag ?? null)) return false
  if (q.evento && f.eventId !== q.evento && !(f.playtestId && q.eventoTests?.includes(f.playtestId))) return false
  return matchesWords([f.title, f.detail, f.originDetail, ...(f.tags ?? [])], words(q.q))
}

/** De más a menos urgente: por estado, por impacto y del más nuevo al más viejo. */
export function compareFeedback(a: Feedback, b: Feedback): number {
  return (
    FEEDBACK_STATUS_ORDER.indexOf(a.status) - FEEDBACK_STATUS_ORDER.indexOf(b.status) ||
    PRIORITIES[b.impact].weight - PRIORITIES[a.impact].weight ||
    (b.receivedAt ?? '').localeCompare(a.receivedAt ?? '') ||
    a.title.localeCompare(b.title, 'es')
  )
}

/** El feedback que entra con estos filtros, ordenado (ver compareFeedback). */
export function feedbackList(data: StudioData, q: FeedbackQuery): Feedback[] {
  return data.feedback.filter((f) => feedbackMatches(f, q)).sort(compareFeedback)
}

export interface FeedbackStatusGroup {
  status: FeedbackStatus
  list: Feedback[]
}

/** Agrupado por estado, en el orden de FEEDBACK_STATUS_ORDER (solo los estados con algo). */
export function feedbackByStatus(list: Feedback[]): FeedbackStatusGroup[] {
  return FEEDBACK_STATUS_ORDER.map((status) => ({ status, list: list.filter((f) => f.status === status) })).filter((g) => g.list.length > 0)
}

/** Cuántos hay de cada clase (para el filtro «Sin clasificar» y las cifras de Todo). */
export function feedbackKindCounts(data: StudioData, scope: Scope = null): Record<FeedbackKind | 'none', number> {
  const out: Record<FeedbackKind | 'none', number> = { comment: 0, bug: 0, request: 0, none: 0 }
  for (const f of data.feedback) if (scope === null || f.projectId === scope) out[f.kind ?? 'none']++
  return out
}

// ——— Bugs: el feedback que es un bug y las incidencias de Tareas, sin repetir ————————

export type BugEntry = { type: 'feedback'; feedback: Feedback } | { type: 'item'; item: WorkItem }

export const bugEntryId = (e: BugEntry) => (e.type === 'feedback' ? `feedback:${e.feedback.id}` : `items:${e.item.id}`)
export const bugEntryOpen = (e: BugEntry) => (e.type === 'feedback' ? isFeedbackOpen(e.feedback) : isOpen(e.item))
const bugWeight = (e: BugEntry) => PRIORITIES[e.type === 'feedback' ? e.feedback.impact : e.item.priority].weight
const bugDate = (e: BugEntry) => (e.type === 'feedback' ? e.feedback.receivedAt : (e.item.completedAt ?? e.item.createdAt)) ?? ''

/**
 * Las incidencias (items de tipo «issue») que ningún bug enlaza: las que sí lo están salen
 * una sola vez, dentro de ese feedback. Se cuenta todo el feedback del ámbito que es un bug,
 * aunque los filtros lo escondan (si no, al filtrar saldría la incidencia suelta).
 */
export function unlinkedIssues(data: StudioData, scope: Scope = null): WorkItem[] {
  const linked = new Set<ID>()
  for (const f of data.feedback) if (f.kind === 'bug' && (scope === null || f.projectId === scope)) for (const id of f.linkedItemIds) linked.add(id)
  return data.items.filter((i) => i.kind === 'issue' && (scope === null || i.projectId === scope) && !linked.has(i.id))
}

/** ¿Entra esta incidencia con los filtros finos? (las incidencias no tienen origen ni estados de feedback). */
export function issueMatches(i: WorkItem, q: FeedbackQuery): boolean {
  if (q.origen || q.unclassified || q.evento) return false
  if (q.estado && q.estado !== 'abierto' && q.estado !== 'cerrado') return false
  if (q.estado === 'abierto' && !isOpen(i)) return false
  if (q.estado === 'cerrado' && isOpen(i)) return false
  if (q.impacto && i.priority !== q.impacto) return false
  if (!hasTag(i, q.tag ?? null)) return false
  return matchesWords([i.title, i.description, ...i.tags], words(q.q))
}

/**
 * Bugs = feedback que es un bug ∪ incidencias de Tareas que ningún bug enlaza. Abiertos
 * primero; dentro, de más a menos impacto (o prioridad, que van en la misma escala).
 */
export function feedbackBugs(data: StudioData, q: FeedbackQuery): BugEntry[] {
  const fq = { ...q, tipo: 'bugs' as const }
  const out: BugEntry[] = [
    ...data.feedback.filter((f) => feedbackMatches(f, fq)).map((feedback) => ({ type: 'feedback' as const, feedback })),
    ...unlinkedIssues(data, q.scope ?? null)
      .filter((i) => issueMatches(i, q))
      .map((item) => ({ type: 'item' as const, item })),
  ]
  return out.sort(
    (a, b) =>
      Number(bugEntryOpen(b)) - Number(bugEntryOpen(a)) ||
      bugWeight(b) - bugWeight(a) ||
      bugDate(b).localeCompare(bugDate(a)) ||
      bugEntryId(a).localeCompare(bugEntryId(b)),
  )
}

// ——— Priorización: impacto × estado ———————————————————————————————————————

/** Los estados abiertos, que son los que se priorizan. */
export const FEEDBACK_OPEN_STATUSES: FeedbackStatus[] = ['new', 'triaged', 'planned']

/**
 * La cola de priorización: el feedback abierto (feedbackToPrioritize) con lo nuevo y lo
 * revisado primero y lo ya planificado después; dentro, de más a menos impacto.
 */
export function feedbackQueue(data: StudioData, q: FeedbackQuery): Feedback[] {
  const open = feedbackToPrioritize(data, q.scope ?? null).filter((f) => feedbackMatches(f, q))
  return [...open.filter((f) => f.status !== 'planned'), ...open.filter((f) => f.status === 'planned')]
}

export type FeedbackMatrix = Record<Priority, Record<FeedbackStatus, Feedback[]>>

/** Impacto × estado (solo los estados abiertos tienen sentido aquí, pero se cuentan todos). */
export function feedbackMatrix(list: Feedback[]): FeedbackMatrix {
  const out = {} as FeedbackMatrix
  for (const p of IMPACT_ORDER) out[p] = { new: [], triaged: [], planned: [], addressed: [], wont_do: [] }
  for (const f of list) out[f.impact][f.status].push(f)
  return out
}

/** Los cambios de estado que se ofrecen como acción rápida desde cada estado. */
export function feedbackQuickStatuses(status: FeedbackStatus): FeedbackStatus[] {
  switch (status) {
    case 'new':
      return ['triaged', 'planned', 'wont_do']
    case 'triaged':
      return ['planned', 'addressed', 'wont_do']
    case 'planned':
      return ['addressed', 'wont_do']
    default:
      return ['triaged']
  }
}

// ——— Cambios por el feedback ————————————————————————————————————————————————

export type FeedbackChangeState = 'changed' | 'in_progress' | 'none'

export interface FeedbackChange {
  feedback: Feedback
  /** Elementos enlazados ya hechos. */
  done: WorkItem[]
  /** Elementos enlazados aún abiertos. */
  open: WorkItem[]
  /** Elementos enlazados descartados. */
  cancelled: WorkItem[]
  /** Enlaces a elementos que ya no existen. */
  missing: ID[]
  /** Cuándo se terminó el último elemento hecho. */
  changedAt?: ISODate
  /**
   * changed: todo lo enlazado está hecho (o descartado) y algo se hizo; in_progress: algo
   * sigue abierto; none: nada se hizo (solo descartados o enlaces rotos).
   */
  state: FeedbackChangeState
  /** Todo lo enlazado está hecho, pero el feedback sigue abierto: ¿marcarlo como resuelto? */
  canClose: boolean
}

export function feedbackChange(data: StudioData, f: Feedback): FeedbackChange {
  const items = new Map(data.items.map((i) => [i.id, i]))
  const done: WorkItem[] = []
  const open: WorkItem[] = []
  const cancelled: WorkItem[] = []
  const missing: ID[] = []
  for (const id of f.linkedItemIds) {
    const i = items.get(id)
    if (!i) missing.push(id)
    else if (i.status === 'done') done.push(i)
    else if (isOpen(i)) open.push(i)
    else cancelled.push(i)
  }
  done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  open.sort(byPriority)
  const changedAt = done.find((i) => i.completedAt)?.completedAt
  const state: FeedbackChangeState = open.length ? 'in_progress' : done.length ? 'changed' : 'none'
  return { feedback: f, done, open, cancelled, missing, changedAt, state, canClose: state === 'changed' && isFeedbackOpen(f) }
}

export interface FeedbackChanges {
  /** Lo que ya cambió, del cambio más reciente al más antiguo. */
  changed: FeedbackChange[]
  /** Lo que está en marcha, de más a menos impacto. */
  inProgress: FeedbackChange[]
  /** Enlazado, pero sin nada hecho ni abierto (descartado o enlaces rotos). */
  none: FeedbackChange[]
  /** Feedback abierto que aún no tiene elementos que lo resuelvan. */
  unlinkedOpen: Feedback[]
}

/** El feedback con elementos que lo resuelven: lo que ya cambió y lo que está en marcha. */
export function feedbackChanges(data: StudioData, q: FeedbackQuery): FeedbackChanges {
  const list = data.feedback.filter((f) => feedbackMatches(f, q))
  const all = list.filter((f) => f.linkedItemIds.length > 0).map((f) => feedbackChange(data, f))
  const byImpact = (a: FeedbackChange, b: FeedbackChange) => compareFeedback(a.feedback, b.feedback)
  return {
    changed: all.filter((c) => c.state === 'changed').sort((a, b) => (b.changedAt ?? '').localeCompare(a.changedAt ?? '') || byImpact(a, b)),
    inProgress: all.filter((c) => c.state === 'in_progress').sort(byImpact),
    none: all.filter((c) => c.state === 'none').sort(byImpact),
    unlinkedOpen: list.filter((f) => f.linkedItemIds.length === 0 && isFeedbackOpen(f)).sort(compareFeedback),
  }
}

// ——— Informes de pruebas ————————————————————————————————————————————————————

export interface PlaytestReport {
  playtest: Playtest
  build?: Build
  event?: StudioEvent
  /** El feedback que dice venir de esta prueba (playtestId). */
  feedback: Feedback[]
}

/** De la prueba más reciente a la más antigua; las que no tienen fecha, al final. */
export function comparePlaytests(a: Playtest, b: Playtest): number {
  if (!!a.date !== !!b.date) return a.date ? -1 : 1
  return (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title, 'es')
}

/** Cada prueba con su build, su evento y el feedback que tiene su playtestId. */
export function playtestReports(data: StudioData, scope: Scope = null, tag: string | null = null): PlaytestReport[] {
  const builds = new Map(data.builds.map((b) => [b.id, b]))
  const events = new Map(data.events.map((e) => [e.id, e]))
  return data.playtests
    .filter((p) => (scope === null || p.projectId === scope) && hasTag(p, tag))
    .sort(comparePlaytests)
    .map((playtest) => ({
      playtest,
      build: playtest.buildId ? builds.get(playtest.buildId) : undefined,
      event: playtest.eventId ? events.get(playtest.eventId) : undefined,
      feedback: data.feedback.filter((f) => f.playtestId === playtest.id).sort(compareFeedback),
    }))
}

/** Feedback que dice venir de una prueba con jugadores, pero no de cuál. */
export function playtestFeedbackWithoutTest(data: StudioData, scope: Scope = null, tag: string | null = null): Feedback[] {
  return data.feedback
    .filter((f) => f.origin === 'playtest' && !f.playtestId && (scope === null || f.projectId === scope) && hasTag(f, tag))
    .sort(compareFeedback)
}
