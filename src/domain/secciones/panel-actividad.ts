// Cálculos del Dashboard: actividad. Se reexportan desde panel.ts (y este, desde selectors.ts).
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
//
// Dos piezas:
// - La actividad del estudio (studioTimeline): el registro de cambios, las fechas de los datos
//   y el historial del código, juntos, sin repetir y de lo más reciente a lo más antiguo.
// - El resumen del feedback (panelFeedback) y «convertir en tarea».
import {
  ACHIEVEMENT_STATUSES,
  BUILD_STATUSES,
  EVENT_STATUSES,
  FEEDBACK_STATUSES,
  LISTING_STATUSES,
  PHASE_STATUSES,
  RELEASE_STATUSES,
  STATUSES,
  STORE_TEXT_STATUSES,
  type Entry,
} from '../catalog'
import { COLLECTION_BY_KEY, type CollectionKey } from '../collections'
import type { ChangeEntry, Confidence, Feedback, FeedbackKind, ID, ISODate, ItemKind, SourceRef, StudioData, WorkItem } from '../types'
import { feedbackBugs, feedbackList, feedbackQueryOf, feedbackToPrioritize, normalize, statsActivityMember, type Scope } from '../selectors'

// ——— Actividad del estudio ————————————————————————————————————————————————

/** De dónde sale una entrada: el registro de cambios, una fecha de los datos o el historial del código. */
export type TimelineSource = 'registro' | 'fecha' | 'codigo'

/**
 * Qué pasó. Las cinco primeras son las del registro (y las de las fechas de los datos);
 * «dated» es un documento con su fecha; commit, merge, release y note, el historial del código.
 */
export type TimelineVerb = 'created' | 'updated' | 'status' | 'completed' | 'deleted' | 'dated' | 'commit' | 'merge' | 'release' | 'note'

/** Qué es lo afectado: el tipo de un elemento de trabajo, otra colección o el código. */
export type TimelineNoun =
  | ItemKind
  | 'build'
  | 'release'
  | 'feedback'
  | 'playtest'
  | 'document'
  | 'event'
  | 'project'
  | 'reminder'
  | 'checklist'
  | 'member'
  | 'timeEntry'
  | 'phase'
  | 'storeListing'
  | 'storeText'
  | 'achievement'
  | 'metric'
  | 'area'
  | 'studio'
  | 'code'
  | 'other'

/** Las categorías del filtro (?cat=). */
export type TimelineCategory = 'tareas' | 'hitos' | 'bugs' | 'decisiones' | 'builds' | 'feedback' | 'documentos' | 'eventos' | 'proyectos' | 'codigo' | 'otros'

export const TIMELINE_CATEGORIES: readonly TimelineCategory[] = [
  'tareas',
  'hitos',
  'bugs',
  'decisiones',
  'builds',
  'feedback',
  'documentos',
  'eventos',
  'proyectos',
  'codigo',
  'otros',
]

/** Lo de cada categoría: los objetivos van con las tareas; las versiones, con las builds; las pruebas, con el feedback. */
export const NOUN_CATEGORY: Record<TimelineNoun, TimelineCategory> = {
  task: 'tareas',
  feature: 'tareas',
  goal: 'tareas',
  milestone: 'hitos',
  issue: 'bugs',
  decision: 'decisiones',
  build: 'builds',
  release: 'builds',
  feedback: 'feedback',
  playtest: 'feedback',
  document: 'documentos',
  event: 'eventos',
  project: 'proyectos',
  code: 'codigo',
  reminder: 'otros',
  checklist: 'otros',
  member: 'otros',
  timeEntry: 'otros',
  phase: 'otros',
  storeListing: 'otros',
  storeText: 'otros',
  achievement: 'otros',
  metric: 'otros',
  area: 'otros',
  studio: 'otros',
  other: 'otros',
}

const COLLECTION_NOUN: Partial<Record<string, TimelineNoun>> = {
  builds: 'build',
  releases: 'release',
  feedback: 'feedback',
  playtests: 'playtest',
  resources: 'document',
  events: 'event',
  projects: 'project',
  reminders: 'reminder',
  checklists: 'checklist',
  members: 'member',
  timeEntries: 'timeEntry',
  phases: 'phase',
  storeListings: 'storeListing',
  storeTexts: 'storeText',
  achievements: 'achievement',
  metrics: 'metric',
  areas: 'area',
  studio: 'studio',
}

const ITEM_KINDS: readonly string[] = ['task', 'feature', 'milestone', 'decision', 'issue', 'goal']

/** Qué es algo del registro: en los elementos de trabajo, su tipo (task si no lo dice). */
export function timelineNoun(collection: string, entityKind?: string): TimelineNoun {
  if (collection === 'items') return entityKind && ITEM_KINDS.includes(entityKind) ? (entityKind as ItemKind) : 'task'
  return COLLECTION_NOUN[collection] ?? 'other'
}

/** Los verbos que tiene cada cosa (para los textos: cada combinación lleva el suyo). */
export function timelineVerbsOf(noun: TimelineNoun): TimelineVerb[] {
  if (noun === 'code') return ['commit', 'merge', 'release', 'note']
  const base: TimelineVerb[] = ['created', 'updated', 'status', 'completed', 'deleted']
  return noun === 'document' ? [...base, 'dated'] : base
}

/**
 * La clave del texto de cada acción («Tarea completada», «Hito alcanzado», «Bug resuelto»…) en
 * `secciones.panel.actividad.accion`. Un cambio de estado se dice igual en todo.
 */
export function timelineActionKey(noun: TimelineNoun, verb: TimelineVerb): string {
  const base = 'secciones.panel.actividad.accion'
  if (noun === 'code') return `${base}.code.${verb}`
  if (verb === 'status') return `${base}.status`
  return `${base}.${noun}.${verb}`
}

export interface TimelineEntry {
  /** Único en la lista: «registro:<id>», «fecha:<colección>:<id>:<verbo>» o «codigo:<id>». */
  key: string
  source: TimelineSource
  /** «AAAA-MM-DD» (lo que sale de una fecha de los datos) o «AAAA-MM-DDTHH:mm». */
  at: string
  date: ISODate
  /** «HH:mm», solo si se sabe (el registro y el código; las fechas de los datos no la tienen). */
  time?: string
  verb: TimelineVerb
  noun: TimelineNoun
  category: TimelineCategory
  /** La colección de lo afectado («studio» para los datos del estudio, «activity» para el código). */
  collection: string
  entityId: ID
  /** Su título (en el registro, el que tenía en ese momento). */
  title: string
  /** El registro no guardó un nombre (solo su id): la pantalla pone el de la colección. */
  untitled?: boolean
  /** Lo que se abre al pulsarlo (si sigue existiendo). */
  target?: { collection: CollectionKey; id: ID }
  /** Lo afectado ya no existe: se enseña su título sin enlace. */
  deleted?: boolean
  projectId?: ID
  /** Quién, si se sabe: la persona del registro o la del commit (por su ficha o sus nombres en git). */
  memberId?: ID
  /** El autor tal cual viene de git, cuando no se reconoce a nadie del equipo. */
  author?: string
  /** Cambio de estado: de qué valor a qué valor. */
  from?: string
  to?: string
  /** Los campos cambiados (updated). */
  fields?: string[]
  /** La versión de una build (lo que sale de su fecha). */
  version?: string
  /** Commits y PR: referencia («35b2c6c», «#18») y enlace. */
  ref?: string
  url?: string
  /** Lo que sale de una fecha de los datos: cuánto nos fiamos de ese dato. */
  confidence?: Confidence
  /**
   * Del registro: el dato dice otro día para lo mismo (una build compilada antes de apuntarla,
   * un feedback recibido ayer, una tarea con otra fecha de fin). No sale dos veces: la pantalla
   * lo dice en esta entrada.
   */
  dataDate?: ISODate
}

export interface TimelineFilter {
  /** null o sin poner: todo el estudio. En un proyecto, solo lo suyo (lo del estudio no). */
  scope?: Scope
  category?: TimelineCategory | null
  /** El id de una persona o un autor de git sin ficha («autor:<nombre>», ver timelinePersonKey). */
  person?: string | null
  /** Solo lo de estos días (los dos incluidos). */
  period?: { from: ISODate; to: ISODate } | null
  /** Lo que sale de una fecha de los datos posterior a hoy no ha pasado: no se enseña. */
  today?: ISODate
}

/** Prefijo de un autor de git que no es nadie del equipo, en el filtro de persona. */
export const TIMELINE_AUTHOR_PREFIX = 'autor:'

/** La clave de quién hizo algo (para el filtro): el id de la persona o «autor:<nombre>». */
export function timelinePersonKey(e: Pick<TimelineEntry, 'memberId' | 'author'>): string | undefined {
  if (e.memberId) return e.memberId
  if (e.author) return `${TIMELINE_AUTHOR_PREFIX}${e.author}`
  return undefined
}

function personMatches(e: TimelineEntry, person: string): boolean {
  if (person.startsWith(TIMELINE_AUTHOR_PREFIX)) return !e.memberId && !!e.author && normalize(e.author) === normalize(person.slice(TIMELINE_AUTHOR_PREFIX.length))
  return e.memberId === person
}

/** Lo que pasa después en el mismo instante va antes (en la lista, lo más reciente arriba). */
const VERB_RANK: Record<TimelineVerb, number> = {
  deleted: 0,
  completed: 1,
  status: 2,
  updated: 3,
  release: 4,
  merge: 5,
  commit: 6,
  note: 7,
  dated: 8,
  created: 9,
}
const SOURCE_RANK: Record<TimelineSource, number> = { registro: 0, codigo: 1, fecha: 2 }
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Orden: de lo más reciente a lo más antiguo. Lo que solo tiene día va al final de ese día
 * (después de lo que tiene hora). Si coinciden, lo que pasa después (terminar antes que crear),
 * luego el registro, el código y las fechas, y al final por título.
 */
export function compareTimeline(a: TimelineEntry, b: TimelineEntry): number {
  return (
    cmp(b.at, a.at) ||
    VERB_RANK[a.verb] - VERB_RANK[b.verb] ||
    SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
    a.title.localeCompare(b.title, 'es') ||
    cmp(a.key, b.key)
  )
}

/**
 * Qué fecha de los datos cuenta el mismo hecho que una entrada del registro (el registro manda:
 * tiene hora y persona). Crear cubre la fecha de creación (createdAt, la fecha de una build, la
 * de llegada de un feedback) y terminar, la de fin (completedAt), sea el día que sea: una build
 * compilada el 31 y apuntada el 3 se creó una sola vez. En un documento, su fecha es otra cosa
 * (de cuándo es, no cuándo se apuntó): la cubre cualquier cambio de ese mismo día.
 */
function coveredKey(c: ChangeEntry): string | null {
  if (c.collection === 'resources') return dayKey(c.collection, c.entityId, c.at.slice(0, 10))
  if (c.action === 'created' || c.action === 'completed') return factKey(c.collection, c.entityId, c.action)
  return null
}

/** «colección:id:verbo»: crear o terminar algo (una vez, el día que sea). */
const factKey = (collection: string, id: ID, verb: TimelineVerb) => `${collection}:${id}:${verb}`
/** «colección:id:día:dated»: la fecha de un documento ese día. */
const dayKey = (collection: string, id: ID, date: ISODate) => `${collection}:${id}:${date}:dated`

const timeOf = (at: string) => (at.length >= 16 ? at.slice(11, 16) : undefined)

/**
 * La actividad del estudio, de lo más reciente a lo más antiguo, de tres fuentes:
 *
 * 1. El registro de cambios (`changes`): lo hecho en la aplicación, con hora y persona. No
 *    entra lo de las colecciones privadas (movimientos y presupuestos: solo los ven quienes editan).
 * 2. Las fechas de los datos, para lo anterior al registro (solo día, sin hora ni persona):
 *    `createdAt` de los elementos (creado), `completedAt` de lo hecho (terminado), la fecha de
 *    las builds (registrada), `receivedAt` del feedback (añadido) y la de los documentos.
 * 3. El historial del código (`activity`): commits, PR fusionadas, versiones y notas, con su
 *    autor (la persona del equipo si se le reconoce).
 *
 * Sin repetir: si el registro ya cuenta que se creó o se terminó algo, no sale otra vez por su
 * fecha (ver coveredKey); si la fecha del dato es de otro día, la entrada del registro lo dice
 * (`dataDate`). Con los filtros: ámbito, categoría, persona y periodo; lo que sale de una fecha
 * posterior a `today` no ha pasado todavía y no sale.
 */
export function studioTimeline(data: StudioData, filter: TimelineFilter = {}): TimelineEntry[] {
  const scope = filter.scope ?? null
  const own = (x: { projectId?: ID }) => scope === null || x.projectId === scope
  const out: TimelineEntry[] = []

  // ¿Sigue existiendo? (un conjunto de ids por colección, solo de las que hacen falta)
  const ids = new Map<string, Set<ID>>()
  const alive = (collection: string, id: ID) => {
    if (collection === 'studio') return true
    let set = ids.get(collection)
    if (!set) {
      const list = (data as unknown as Record<string, unknown>)[collection]
      set = new Set(Array.isArray(list) ? (list as { id: ID }[]).map((x) => x.id) : [])
      ids.set(collection, set)
    }
    return set.has(id)
  }

  // 1. El registro. `covered`: los hechos que ya cuenta, con su entrada más reciente (si se enseña).
  const covered = new Map<string, TimelineEntry | null>()
  for (const c of data.changes ?? []) {
    const date = c.at.slice(0, 10)
    const key = coveredKey(c)
    if (key && !covered.has(key)) covered.set(key, null)
    const def = c.collection in COLLECTION_BY_KEY ? COLLECTION_BY_KEY[c.collection as CollectionKey] : undefined
    if (def?.private || !own(c)) continue
    const noun = timelineNoun(c.collection, c.entityKind)
    const exists = alive(c.collection, c.entityId)
    const entry: TimelineEntry = {
      key: `registro:${c.id}`,
      source: 'registro',
      at: c.at,
      date,
      verb: c.action,
      noun,
      category: NOUN_CATEGORY[noun],
      collection: c.collection,
      entityId: c.entityId,
      title: c.title,
    }
    const time = timeOf(c.at)
    if (time) entry.time = time
    if (!c.title || c.title === c.entityId) entry.untitled = true
    if (def && exists) entry.target = { collection: def.key, id: c.entityId }
    if (!exists) entry.deleted = true
    if (c.projectId) entry.projectId = c.projectId
    if (c.memberId) entry.memberId = c.memberId
    if (c.from !== undefined) entry.from = c.from
    if (c.to !== undefined) entry.to = c.to
    if (c.fields?.length) entry.fields = c.fields
    out.push(entry)
    if (key) {
      const prev = covered.get(key)
      if (!prev || prev.at <= entry.at) covered.set(key, entry)
    }
  }

  // 2. Las fechas de los datos (lo que el registro ya cuenta ese día, no).
  const dated = (
    collection: CollectionKey,
    x: { id: ID; projectId?: ID; confidence?: Confidence },
    date: ISODate | undefined,
    verb: TimelineVerb,
    noun: TimelineNoun,
    title: string,
    extra: Partial<TimelineEntry> = {},
  ) => {
    if (!date || !own(x)) return
    const key = verb === 'dated' ? dayKey(collection, x.id, date) : factKey(collection, x.id, verb)
    if (covered.has(key)) {
      const reg = covered.get(key)
      if (reg && reg.date !== date) reg.dataDate = date
      return
    }
    if (filter.today && date > filter.today) return
    const entry: TimelineEntry = {
      key: `fecha:${collection}:${x.id}:${verb}`,
      source: 'fecha',
      at: date,
      date,
      verb,
      noun,
      category: NOUN_CATEGORY[noun],
      collection,
      entityId: x.id,
      title,
      target: { collection, id: x.id },
      ...extra,
    }
    if (x.projectId) entry.projectId = x.projectId
    if (x.confidence) entry.confidence = x.confidence
    out.push(entry)
  }
  for (const i of data.items) {
    dated('items', i, i.createdAt, 'created', i.kind, i.title)
    if (i.status === 'done') dated('items', i, i.completedAt, 'completed', i.kind, i.title)
  }
  for (const b of data.builds) dated('builds', b, b.date, 'created', 'build', b.name, { version: b.version })
  for (const f of data.feedback) dated('feedback', f, f.receivedAt, 'created', 'feedback', f.title)
  for (const r of data.resources) dated('resources', r, r.date, 'dated', 'document', r.title)

  // 3. El historial del código.
  for (const a of data.activity) {
    if (!own(a)) continue
    const member = statsActivityMember(data, a)
    const entry: TimelineEntry = {
      key: `codigo:${a.id}`,
      source: 'codigo',
      at: a.at,
      date: a.at.slice(0, 10),
      verb: a.type,
      noun: 'code',
      category: 'codigo',
      collection: 'activity',
      entityId: a.id,
      title: a.title,
      projectId: a.projectId,
    }
    const time = timeOf(a.at)
    if (time) entry.time = time
    if (member) entry.memberId = member.id
    else if (a.author?.trim()) entry.author = a.author.trim()
    if (a.ref) entry.ref = a.ref
    if (a.url) entry.url = a.url
    out.push(entry)
  }

  const { category, person, period } = filter
  return out
    .filter(
      (e) =>
        (!category || e.category === category) &&
        (!person || personMatches(e, person)) &&
        (!period || (e.date >= period.from && e.date <= period.to)),
    )
    .sort(compareTimeline)
}

/** El nombre de un proyecto que ya no existe, según el registro (el que tenía al borrarlo). */
export function timelineGoneProject(data: StudioData, id: ID): string | undefined {
  const changes = data.changes ?? []
  for (let n = changes.length - 1; n >= 0; n--) {
    const c = changes[n]
    if (c.collection === 'projects' && c.entityId === id && c.title && c.title !== id) return c.title
  }
  return undefined
}

/** La actividad agrupada por día, en el orden en que llega. */
export function timelineByDay(entries: TimelineEntry[]): { date: ISODate; entries: TimelineEntry[] }[] {
  const groups: { date: ISODate; entries: TimelineEntry[] }[] = []
  for (const e of entries) {
    const last = groups[groups.length - 1]
    if (last?.date === e.date) last.entries.push(e)
    else groups.push({ date: e.date, entries: [e] })
  }
  return groups
}

export interface TimelinePerson {
  /** El valor del filtro (timelinePersonKey). */
  key: string
  /** Su nombre en el equipo o el autor tal cual viene de git. */
  name: string
  memberId?: ID
  count: number
}

/** Quién aparece en esta actividad (para el filtro de persona), de quien más a quien menos. */
export function timelinePeople(data: StudioData, entries: TimelineEntry[]): TimelinePerson[] {
  const people = new Map<string, TimelinePerson>()
  for (const e of entries) {
    const raw = timelinePersonKey(e)
    if (!raw) continue
    const key = e.memberId ? raw : `${TIMELINE_AUTHOR_PREFIX}${normalize(e.author!)}`
    const found = people.get(key)
    if (found) found.count++
    else {
      const member = e.memberId ? data.members.find((m) => m.id === e.memberId) : undefined
      people.set(key, { key: raw, name: member?.name ?? e.author ?? raw, ...(member ? { memberId: member.id } : {}), count: 1 })
    }
  }
  return [...people.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
}

/** Cuántas entradas hay de cada categoría. */
export function timelineCategoryCounts(entries: TimelineEntry[]): Record<TimelineCategory, number> {
  const out = Object.fromEntries(TIMELINE_CATEGORIES.map((c) => [c, 0])) as Record<TimelineCategory, number>
  for (const e of entries) out[e.category]++
  return out
}

/** El valor de ?cat= si es una categoría; si no, null (todas). */
export function timelineCategoryOf(value: string | null): TimelineCategory | null {
  return value && (TIMELINE_CATEGORIES as readonly string[]).includes(value) ? (value as TimelineCategory) : null
}

/** Las tablas de estados de cada colección (para decir «de En curso a En revisión»). */
function statusTable(collection: string): Record<string, Entry> | undefined {
  const tables: Partial<Record<string, Record<string, Entry>>> = {
    items: STATUSES,
    feedback: FEEDBACK_STATUSES,
    builds: BUILD_STATUSES,
    events: EVENT_STATUSES,
    releases: RELEASE_STATUSES,
    phases: PHASE_STATUSES,
    storeListings: LISTING_STATUSES,
    storeTexts: STORE_TEXT_STATUSES,
    achievements: ACHIEVEMENT_STATUSES,
  }
  return tables[collection]
}

/** El nombre en pantalla de un estado de esa colección (o el valor tal cual, si no se conoce). */
export function timelineStatusLabel(collection: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return statusTable(collection)?.[value]?.label ?? value
}

// ——— Feedback ————————————————————————————————————————————————————————————————

export type PanelFeedbackFigureId = 'new' | 'triaged' | 'accepted' | 'criticalBugs' | 'implemented' | 'discarded'

export const PANEL_FEEDBACK_FIGURES: readonly PanelFeedbackFigureId[] = ['new', 'triaged', 'accepted', 'criticalBugs', 'implemented', 'discarded']

/**
 * Adónde lleva cada cifra: Feedback con el filtro que da esa misma cifra (la ruta del estudio;
 * la pantalla le pone el ámbito). Los bugs críticos son los de Feedback › Bugs: el feedback
 * marcado como bug y las incidencias de Tareas que ningún bug enlaza, abiertos y de impacto crítico.
 */
export const PANEL_FEEDBACK_LINKS: Record<PanelFeedbackFigureId, string> = {
  new: '/feedback?estado=new',
  triaged: '/feedback?estado=triaged',
  accepted: '/feedback?tipo=mejoras&estado=planned',
  criticalBugs: '/feedback?tipo=bugs&impacto=critical&estado=abierto',
  implemented: '/feedback?tipo=mejoras&estado=addressed',
  discarded: '/feedback?estado=wont_do',
}

/** Por qué una cifra no se puede dar: no hay feedback, ninguna mejora pedida o ningún bug. */
export type PanelFeedbackGap = 'noFeedback' | 'noRequests' | 'noBugs'

export interface PanelFeedbackFigure {
  id: PanelFeedbackFigureId
  /** null: no hay con qué contarla (se enseña «—» con el motivo). Un 0 es un 0 de verdad. */
  value: number | null
  gap?: PanelFeedbackGap
  to: string
  /** Bugs críticos: cuántos son incidencias de Tareas. */
  fromTasks?: number
}

export interface PanelFeedback {
  /** Todo el feedback del ámbito. */
  total: number
  figures: PanelFeedbackFigure[]
  /** Lo que pide mirarse: lo nuevo y lo revisado, de más a menos impacto y del más nuevo al más viejo. */
  toReview: Feedback[]
  /** Lo descartado («No se hará»), del más nuevo al más viejo; su motivo está en `resolution`. */
  discarded: Feedback[]
}

/**
 * Las cifras del bloque de feedback, contadas con los mismos filtros que Feedback (así la cifra
 * es lo que sale al pulsarla). Una cifra sin base no es un 0: sin feedback, todo «—»; sin
 * ninguna mejora pedida, las de mejoras «—»; sin ningún bug (ni feedback ni incidencias), la de
 * bugs «—».
 */
export function panelFeedback(data: StudioData, scope: Scope = null): PanelFeedback {
  const all = data.feedback.filter((f) => scope === null || f.projectId === scope)
  const requests = all.filter((f) => f.kind === 'request').length
  const bugs = feedbackBugs(data, { scope }).length
  const figures = PANEL_FEEDBACK_FIGURES.map((id): PanelFeedbackFigure => {
    const to = PANEL_FEEDBACK_LINKS[id]
    const q = feedbackQueryOf(new URLSearchParams(to.slice(to.indexOf('?') + 1)), scope, data)
    const gap: PanelFeedbackGap | undefined =
      all.length === 0 ? 'noFeedback' : (id === 'accepted' || id === 'implemented') && requests === 0 ? 'noRequests' : id === 'criticalBugs' && bugs === 0 ? 'noBugs' : undefined
    if (gap) return { id, value: null, gap, to }
    if (id === 'criticalBugs') {
      const list = feedbackBugs(data, q)
      return { id, value: list.length, to, fromTasks: list.filter((e) => e.type === 'item').length }
    }
    return { id, value: feedbackList(data, q).length, to }
  })
  return {
    total: all.length,
    figures,
    toReview: feedbackToPrioritize(data, scope).filter((f) => f.status === 'new' || f.status === 'triaged'),
    discarded: all
      .filter((f) => f.status === 'wont_do')
      .sort((a, b) => cmp(b.receivedAt ?? '', a.receivedAt ?? '') || a.title.localeCompare(b.title, 'es')),
  }
}

/** Qué tipo de elemento sale de cada clase de feedback (sin clasificar, una tarea). */
export const FEEDBACK_TASK_KIND: Record<FeedbackKind | 'none', ItemKind> = { bug: 'issue', request: 'feature', comment: 'task', none: 'task' }

/**
 * Los valores de partida de la tarea que sale de un feedback (el resto, los de siempre de una
 * tarea nueva): su título, su proyecto, el detalle como descripción, el tipo según lo que es
 * (bug → incidencia, mejora pedida → funcionalidad, comentario o sin clasificar → tarea), la
 * prioridad igual que el impacto (van en la misma escala), sus etiquetas, la build en la que
 * se vio (si es una incidencia) y la fuente que dice de qué feedback sale.
 */
export function feedbackTaskDefaults(f: Feedback, source: SourceRef): Partial<WorkItem> {
  const kind = FEEDBACK_TASK_KIND[f.kind ?? 'none']
  const out: Partial<WorkItem> = { title: f.title, projectId: f.projectId, kind, priority: f.impact, tags: [...(f.tags ?? [])], sources: [source] }
  if (f.detail?.trim()) out.description = f.detail
  if (kind === 'issue' && f.buildId) out.buildId = f.buildId
  return out
}

/** El feedback enlazado a la tarea que sale de él; si estaba nuevo o revisado, pasa a planificado. */
export function feedbackLinkedToTask(f: Feedback, itemId: ID): Feedback {
  return {
    ...f,
    linkedItemIds: f.linkedItemIds.includes(itemId) ? f.linkedItemIds : [...f.linkedItemIds, itemId],
    status: f.status === 'new' || f.status === 'triaged' ? 'planned' : f.status,
  }
}
