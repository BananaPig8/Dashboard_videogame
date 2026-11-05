// Cada valor del modelo con su nombre en pantalla y su tono. Los colores de estado son
// los mismos en toda la aplicación:
//   success (verde)  → hecho, publicado, al día
//   warning (ámbar)  → por confirmar, vence pronto, pide atención
//   danger  (rojo)   → bloqueado, vencido, crítico
//   info    (azul)   → información y trabajo en curso
//   special (violeta)→ en revisión, hitos
//   neutral / muted  → el resto
// Nunca van solos: las etiquetas llevan siempre su icono y su texto (ver Badges.tsx).
// Los nombres salen del diccionario del idioma (src/i18n), no de aquí.
import { tr } from '../i18n'
import type {
  AchievementStatus,
  BuildChannel,
  BuildStatus,
  ChecklistTarget,
  Confidence,
  EventStatus,
  EventType,
  FeedbackKind,
  FeedbackOrigin,
  FeedbackStatus,
  ItemKind,
  ItemStatus,
  ListingKind,
  ListingStatus,
  MemberKind,
  MetricKind,
  PhaseStatus,
  PlaytestMethod,
  Priority,
  ComponentKind,
  DevPhase,
  ProjectRelationKind,
  ProjectStatusDef,
  ProjectStatusGroup,
  ProjectStatusId,
  RiskLevel,
  RiskStatus,
  RegistrationStatus,
  ReleaseKind,
  ReleaseStatus,
  ResourceType,
  SourceType,
  StorePlatform,
  StoreTextKind,
  TransactionCategory,
  TransactionKind,
  TransactionStatus,
} from './types'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted' | 'special'

export interface Entry {
  readonly label: string
  tone: Tone
}

/** Tabla con tono y nombre traducido (el nombre se lee al usarlo, en el idioma de ese momento). */
/** Nombres que el estudio ha cambiado (Ajustes › Estados personalizables), por tabla. */
const OVERRIDES: Record<string, Record<string, string>> = {}

/** Cambia los nombres de una tabla del catálogo (p. ej. los estados). Vacío = los de siempre. */
export function setCatalogLabels(ns: 'status', labels: Partial<Record<string, string>> | undefined): void {
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(labels ?? {})) if (typeof v === 'string' && v.trim()) clean[k] = v.trim()
  OVERRIDES[ns] = clean
}

function entries<K extends string, X extends { tone: Tone }>(ns: string, spec: Record<K, X>): Record<K, X & Entry> {
  const out = {} as Record<K, X & Entry>
  for (const key of Object.keys(spec) as K[]) {
    const value = { ...spec[key] } as X & Entry
    Object.defineProperty(value, 'label', { get: () => OVERRIDES[ns]?.[key] || tr(`catalog.${ns}.${key}`), enumerable: true })
    out[key] = value
  }
  return out
}

/** Tabla de solo nombres traducidos. */
function names<K extends string>(ns: string, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>
  for (const key of keys) Object.defineProperty(out, key, { get: () => tr(`catalog.${ns}.${key}`), enumerable: true })
  return out
}

/** Las fases de desarrollo, en orden (la del proyecto y las del Roadmap). */
export const PHASES = entries<DevPhase, { tone: Tone; order: number }>('phase', {
  concept: { tone: 'muted', order: 0 },
  prototype: { tone: 'info', order: 1 },
  preproduction: { tone: 'info', order: 2 },
  production: { tone: 'info', order: 3 },
  polish: { tone: 'special', order: 4 },
  release: { tone: 'warning', order: 5 },
  live: { tone: 'success', order: 6 },
})

export const PHASE_ORDER = Object.keys(PHASES) as DevPhase[]

// ——— Estados de proyecto (configurables) ——————————————————————————————————

/** Los grupos de estados, en el orden en que salen en Proyectos. */
export const PROJECT_STATUS_GROUPS: ProjectStatusGroup[] = ['activos', 'planificacion', 'pausa', 'lanzados', 'archivados']

/**
 * Los estados de serie. El estudio puede cambiarles el nombre y el tono, reordenarlos y
 * añadir los suyos (Ajustes › Estados); «archivado» y «cancelado» no se pueden quitar.
 */
const DEFAULT_STATUS_SPEC: [ProjectStatusId, ProjectStatusGroup, Tone][] = [
  ['idea', 'planificacion', 'muted'],
  ['investigacion', 'planificacion', 'muted'],
  ['planificacion', 'planificacion', 'info'],
  ['prototipo', 'activos', 'info'],
  ['desarrollo', 'activos', 'info'],
  ['pruebas', 'activos', 'special'],
  ['preparacion_demo', 'activos', 'warning'],
  ['demo_publica', 'activos', 'success'],
  ['preparacion_lanzamiento', 'activos', 'warning'],
  ['lanzado', 'lanzados', 'success'],
  ['mantenimiento', 'lanzados', 'success'],
  ['en_pausa', 'pausa', 'neutral'],
  ['cancelado', 'archivados', 'danger'],
  ['archivado', 'archivados', 'muted'],
]

/** Los dos estados que no se pueden quitar: archivar y cancelar dependen de ellos. */
export const ARCHIVED_STATUS: ProjectStatusId = 'archivado'
export const CANCELLED_STATUS: ProjectStatusId = 'cancelado'
export const FIXED_PROJECT_STATUSES: readonly ProjectStatusId[] = [ARCHIVED_STATUS, CANCELLED_STATUS]

export function defaultProjectStatuses(): ProjectStatusDef[] {
  return DEFAULT_STATUS_SPEC.map(([id, group, tone]) => ({ id, group, tone, label: tr(`catalog.projectStatus.${id}`) }))
}

/** Los estados del estudio: los suyos o los de serie (y nunca sin archivado ni cancelado). */
export function projectStatusesOf(studio: { projectStatuses?: ProjectStatusDef[] }): ProjectStatusDef[] {
  const own = studio.projectStatuses?.length ? studio.projectStatuses : defaultProjectStatuses()
  const missing = defaultProjectStatuses().filter((d) => FIXED_PROJECT_STATUSES.includes(d.id) && !own.some((s) => s.id === d.id))
  return [...own, ...missing]
}

/** Un estado por su id; si no está (de otra versión o borrado), uno «activo» con su id por nombre. */
export function projectStatusOf(studio: { projectStatuses?: ProjectStatusDef[] }, id: ProjectStatusId): ProjectStatusDef {
  return projectStatusesOf(studio).find((s) => s.id === id) ?? { id, label: id, group: 'activos', tone: 'neutral' }
}

/** El grupo de un estado (activos, en pausa, archivados…). */
export const projectStatusGroup = (studio: { projectStatuses?: ProjectStatusDef[] }, id: ProjectStatusId): ProjectStatusGroup =>
  projectStatusOf(studio, id).group

/** Las etapas de antes (un solo campo para fase y estado) y su estado y su fase de ahora. */
export const OLD_STAGES: Record<string, { status: ProjectStatusId; phase?: DevPhase }> = {
  idea: { status: 'idea', phase: 'concept' },
  concept: { status: 'investigacion', phase: 'concept' },
  prototype: { status: 'prototipo', phase: 'prototype' },
  preproduction: { status: 'planificacion', phase: 'preproduction' },
  production: { status: 'desarrollo', phase: 'production' },
  polish: { status: 'pruebas', phase: 'polish' },
  release: { status: 'preparacion_lanzamiento', phase: 'release' },
  live: { status: 'lanzado', phase: 'live' },
  paused: { status: 'en_pausa' },
  archived: { status: 'archivado' },
}

export const RISK_LEVELS = entries<RiskLevel, { tone: Tone; weight: number }>('riskLevel', {
  low: { tone: 'neutral', weight: 1 },
  medium: { tone: 'warning', weight: 2 },
  high: { tone: 'danger', weight: 3 },
})

export const RISK_STATUSES = entries<RiskStatus, { tone: Tone; open: boolean }>('riskStatus', {
  open: { tone: 'danger', open: true },
  watching: { tone: 'warning', open: true },
  mitigated: { tone: 'success', open: false },
  occurred: { tone: 'danger', open: false },
  closed: { tone: 'muted', open: false },
})

export const COMPONENT_KINDS = names<ComponentKind>('componentKind', ['system', 'library', 'tool', 'asset', 'service', 'other'])

export const RELATION_KINDS = names<ProjectRelationKind>('relationKind', ['shares_resources', 'shares_tech', 'shares_component', 'depends_on', 'related'])

const KIND_TONES = entries<ItemKind, { tone: Tone }>('kind', {
  task: { tone: 'neutral' },
  feature: { tone: 'info' },
  milestone: { tone: 'special' },
  decision: { tone: 'warning' },
  issue: { tone: 'danger' },
  goal: { tone: 'special' },
})
const KIND_PLURALS = names<ItemKind>('kindPlural', ['task', 'feature', 'milestone', 'decision', 'issue', 'goal'])

/** Lo que cuenta como trabajo en Tareas, Hoy y los avisos (los objetivos no vencen como una tarea). */
export const TASK_KINDS: ItemKind[] = ['task', 'feature', 'milestone', 'decision', 'issue']

export const KINDS = Object.fromEntries(
  (Object.keys(KIND_TONES) as ItemKind[]).map((k) => {
    const v = KIND_TONES[k]
    const out = {} as Entry & { plural: string }
    Object.defineProperty(out, 'label', { get: () => v.label, enumerable: true })
    Object.defineProperty(out, 'plural', { get: () => KIND_PLURALS[k], enumerable: true })
    out.tone = v.tone
    return [k, out]
  }),
) as Record<ItemKind, Entry & { readonly plural: string }>

export const STATUSES = entries<ItemStatus, { tone: Tone; open: boolean }>('status', {
  idea: { tone: 'muted', open: true },
  backlog: { tone: 'neutral', open: true },
  planned: { tone: 'neutral', open: true },
  in_progress: { tone: 'info', open: true },
  review: { tone: 'special', open: true },
  blocked: { tone: 'danger', open: true },
  paused: { tone: 'muted', open: true },
  to_confirm: { tone: 'warning', open: true },
  done: { tone: 'success', open: false },
  cancelled: { tone: 'muted', open: false },
})

/** Orden en el que se enseñan los estados (tablero y filtros). */
export const STATUS_ORDER: ItemStatus[] = [
  'in_progress',
  'review',
  'blocked',
  'to_confirm',
  'planned',
  'backlog',
  'paused',
  'idea',
  'done',
  'cancelled',
]

export const PRIORITIES = entries<Priority, { tone: Tone; weight: number }>('priority', {
  critical: { tone: 'danger', weight: 4 },
  high: { tone: 'warning', weight: 3 },
  medium: { tone: 'neutral', weight: 2 },
  low: { tone: 'muted', weight: 1 },
})

const CONFIDENCE_TONES = entries<Confidence, { tone: Tone }>('confidence', {
  verified: { tone: 'success' },
  inferred: { tone: 'info' },
  to_confirm: { tone: 'warning' },
})
const CONFIDENCE_HINTS = names<Confidence>('confidenceHint', ['verified', 'inferred', 'to_confirm'])

export const CONFIDENCES = Object.fromEntries(
  (Object.keys(CONFIDENCE_TONES) as Confidence[]).map((k) => {
    const v = CONFIDENCE_TONES[k]
    const out = {} as Entry & { hint: string }
    Object.defineProperty(out, 'label', { get: () => v.label, enumerable: true })
    Object.defineProperty(out, 'hint', { get: () => CONFIDENCE_HINTS[k], enumerable: true })
    out.tone = v.tone
    return [k, out]
  }),
) as Record<Confidence, Entry & { readonly hint: string }>

export const SOURCE_TYPES = names<SourceType>('source', ['commit', 'pr', 'release', 'readme', 'doc', 'manual'])

export const BUILD_CHANNELS = entries<BuildChannel, { tone: Tone }>('buildChannel', {
  full: { tone: 'special' },
  demo: { tone: 'info' },
  event: { tone: 'warning' },
  playtest: { tone: 'neutral' },
  beta: { tone: 'info' },
  internal: { tone: 'muted' },
})

export const BUILD_STATUSES = entries<BuildStatus, { tone: Tone }>('buildStatus', {
  in_progress: { tone: 'info' },
  ready: { tone: 'success' },
  candidate: { tone: 'special' },
  published: { tone: 'success' },
  superseded: { tone: 'muted' },
  withdrawn: { tone: 'danger' },
  to_confirm: { tone: 'warning' },
})

export const EVENT_TYPES = names<EventType>('eventType', [
  'fair',
  'festival',
  'award',
  'showcase',
  'presentation',
  'meeting',
  'deadline',
  'delivery',
  'release',
  'steam',
  'other',
])

/** Los tipos que se pueden crear («release» y «steam» solo se leen de datos antiguos). */
export const CREATABLE_EVENT_TYPES: EventType[] = ['fair', 'festival', 'award', 'showcase', 'presentation', 'meeting', 'deadline', 'delivery', 'other']

/** Eventos del sector (los de la sección Eventos), frente a los de agenda (reuniones, entregas…). */
export const SECTOR_EVENT_TYPES: EventType[] = ['fair', 'festival', 'award', 'showcase', 'presentation', 'other']

/** Los tipos de fecha del calendario del estudio (secciones/calendario.ts). */
export type CalendarKind = 'deadline' | 'delivery' | 'event' | 'festival' | 'meeting' | 'release' | 'registration' | 'build' | 'reminder'

export const CALENDAR_KINDS = entries<CalendarKind, { tone: Tone }>('calendarKind', {
  deadline: { tone: 'danger' },
  delivery: { tone: 'warning' },
  event: { tone: 'info' },
  festival: { tone: 'special' },
  meeting: { tone: 'neutral' },
  release: { tone: 'success' },
  registration: { tone: 'warning' },
  build: { tone: 'muted' },
  reminder: { tone: 'neutral' },
})

/** Subsecciones del Calendario (?tipo=) → tipos de fecha. */
export const CALENDAR_SECTION_KINDS: Record<string, CalendarKind[]> = {
  limites: ['deadline', 'registration'],
  entregas: ['delivery', 'build'],
  eventos: ['event', 'festival'],
  festivales: ['festival'],
  reuniones: ['meeting'],
  publicacion: ['release'],
  recordatorios: ['reminder'],
}

/** Subsecciones de Eventos (?tipo=) → tipos. */
export const EVENT_SECTION_TYPES: Record<string, EventType[]> = {
  ferias: ['fair'],
  festivales: ['festival'],
  premios: ['award'],
  presentaciones: ['presentation', 'showcase'],
}

export const REGISTRATION_STATUSES = entries<RegistrationStatus, { tone: Tone }>('registrationStatus', {
  not_open: { tone: 'muted' },
  open: { tone: 'info' },
  submitted: { tone: 'special' },
  accepted: { tone: 'success' },
  rejected: { tone: 'danger' },
  not_needed: { tone: 'neutral' },
})

export const EVENT_STATUSES = entries<EventStatus, { tone: Tone }>('eventStatus', {
  idea: { tone: 'muted' },
  planned: { tone: 'info' },
  confirmed: { tone: 'success' },
  done: { tone: 'neutral' },
  cancelled: { tone: 'muted' },
})

export const FEEDBACK_ORIGINS = names<FeedbackOrigin>('feedbackOrigin', ['event', 'playtest', 'community', 'steam', 'internal', 'other'])

export const FEEDBACK_STATUSES = entries<FeedbackStatus, { tone: Tone; open: boolean }>('feedbackStatus', {
  new: { tone: 'warning', open: true },
  triaged: { tone: 'info', open: true },
  planned: { tone: 'info', open: true },
  addressed: { tone: 'success', open: false },
  wont_do: { tone: 'muted', open: false },
})

export const FEEDBACK_KINDS = entries<FeedbackKind, { tone: Tone }>('feedbackKind', {
  comment: { tone: 'neutral' },
  bug: { tone: 'danger' },
  request: { tone: 'info' },
})

export const RESOURCE_TYPES = names<ResourceType>('resourceType', [
  'design',
  'technical',
  'note',
  'minutes',
  'guide',
  'doc',
  'link',
  'repo',
  'tool',
  'screenshot',
  'video',
  'image',
  'logo',
  'asset',
  'reference',
  'marketing',
])

/**
 * En qué subsección sale cada tipo de recurso. Un tipo puede salir en dos (los enlaces y los
 * documentos son a la vez documentación y material). «todo» es la unión de la sección.
 */
export const RESOURCE_SECTIONS = {
  documentacion: {
    diseno: ['design'],
    tecnica: ['technical', 'repo', 'tool'],
    notas: ['note'],
    actas: ['minutes'],
    guias: ['guide'],
    enlaces: ['link'],
    todo: ['design', 'technical', 'repo', 'tool', 'note', 'minutes', 'guide', 'link', 'doc'],
  },
  recursos: {
    capturas: ['screenshot'],
    videos: ['video'],
    imagenes: ['image'],
    logos: ['logo'],
    documentos: ['doc'],
    enlaces: ['link'],
    arte: ['asset'],
    referencia: ['reference'],
    todo: ['screenshot', 'video', 'image', 'logo', 'doc', 'link', 'asset', 'reference', 'marketing'],
  },
  publicacion: {
    materiales: ['marketing'],
    capturas: ['screenshot', 'video'],
  },
} as const satisfies Record<string, Record<string, readonly ResourceType[]>>

export const CHECKLIST_TARGETS = names<ChecklistTarget>('checklistTarget', ['steam', 'demo', 'update', 'event', 'release', 'other'])

export const MEMBER_KINDS = names<MemberKind>('memberKind', ['core', 'external'])

export const PHASE_STATUSES = entries<PhaseStatus, { tone: Tone }>('phaseStatus', {
  planned: { tone: 'info' },
  done: { tone: 'success' },
})

export const RELEASE_KINDS = names<ReleaseKind>('releaseKind', ['launch', 'update', 'patch', 'dlc', 'expansion', 'demo'])

export const RELEASE_STATUSES = entries<ReleaseStatus, { tone: Tone }>('releaseStatus', {
  idea: { tone: 'muted' },
  planned: { tone: 'info' },
  in_progress: { tone: 'info' },
  released: { tone: 'success' },
  cancelled: { tone: 'muted' },
})

export const STORE_PLATFORMS = names<StorePlatform>('storePlatform', ['steam', 'itch', 'epic', 'gog', 'console', 'web', 'other'])

export const LISTING_KINDS = names<ListingKind>('listingKind', ['game', 'demo', 'dlc', 'playtest'])

export const LISTING_STATUSES = entries<ListingStatus, { tone: Tone }>('listingStatus', {
  not_started: { tone: 'muted' },
  draft: { tone: 'neutral' },
  in_review: { tone: 'special' },
  changes_requested: { tone: 'warning' },
  approved: { tone: 'success' },
  coming_soon: { tone: 'info' },
  released: { tone: 'success' },
})

export const STORE_TEXT_KINDS = names<StoreTextKind>('storeTextKind', ['short', 'long', 'about', 'features', 'tags', 'requirements', 'other'])

export const STORE_TEXT_STATUSES = entries<'draft' | 'final', { tone: Tone }>('storeTextStatus', {
  draft: { tone: 'neutral' },
  final: { tone: 'success' },
})

export const ACHIEVEMENT_STATUSES = entries<AchievementStatus, { tone: Tone }>('achievementStatus', {
  idea: { tone: 'muted' },
  designed: { tone: 'neutral' },
  implemented: { tone: 'info' },
  in_store: { tone: 'success' },
})

export const PLAYTEST_METHODS = names<PlaytestMethod>('playtestMethod', ['internal', 'friends', 'closed', 'public', 'event', 'other'])

export const TRANSACTION_KINDS = entries<TransactionKind, { tone: Tone }>('transactionKind', {
  expense: { tone: 'neutral' },
  income: { tone: 'success' },
})

export const TRANSACTION_STATUSES = entries<TransactionStatus, { tone: Tone }>('transactionStatus', {
  planned: { tone: 'info' },
  pending: { tone: 'warning' },
  done: { tone: 'success' },
  cancelled: { tone: 'muted' },
})

export const TRANSACTION_CATEGORIES = names<TransactionCategory>('transactionCategory', [
  'software',
  'hardware',
  'assets',
  'services',
  'marketing',
  'events',
  'fees',
  'people',
  'taxes',
  'sales',
  'grants',
  'other',
])

export type MetricGroup = 'launch' | 'commercial'

/** Cada métrica es de lanzamiento (interés antes de salir) o comercial (después). */
export const METRIC_KINDS = entries<MetricKind, { tone: Tone; group: MetricGroup }>('metricKind', {
  wishlists: { tone: 'info', group: 'launch' },
  followers: { tone: 'info', group: 'launch' },
  demo_players: { tone: 'info', group: 'launch' },
  downloads: { tone: 'info', group: 'launch' },
  units: { tone: 'success', group: 'commercial' },
  players: { tone: 'success', group: 'commercial' },
  peak_players: { tone: 'success', group: 'commercial' },
  reviews: { tone: 'neutral', group: 'commercial' },
  review_score: { tone: 'neutral', group: 'commercial' },
  revenue_reported: { tone: 'success', group: 'commercial' },
  other: { tone: 'neutral', group: 'launch' },
})

export function label<K extends string>(table: Record<K, string | Entry>, key: K | undefined): string {
  if (key === undefined) return ''
  const v = table[key]
  if (v === undefined) return String(key)
  return typeof v === 'string' ? v : v.label
}
