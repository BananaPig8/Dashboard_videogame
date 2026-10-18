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
  BuildChannel,
  BuildStatus,
  ChecklistTarget,
  Confidence,
  EventStatus,
  EventType,
  FeedbackOrigin,
  FeedbackStatus,
  ItemKind,
  ItemStatus,
  Priority,
  ProjectStage,
  ResourceType,
  SourceType,
} from './types'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted' | 'special'

export interface Entry {
  readonly label: string
  tone: Tone
}

/** Tabla con tono y nombre traducido (el nombre se lee al usarlo, en el idioma de ese momento). */
function entries<K extends string, X extends { tone: Tone }>(ns: string, spec: Record<K, X>): Record<K, X & Entry> {
  const out = {} as Record<K, X & Entry>
  for (const key of Object.keys(spec) as K[]) {
    const value = { ...spec[key] } as X & Entry
    Object.defineProperty(value, 'label', { get: () => tr(`catalog.${ns}.${key}`), enumerable: true })
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

export const STAGES = entries<ProjectStage, { tone: Tone; order: number }>('stage', {
  idea: { tone: 'muted', order: 0 },
  concept: { tone: 'muted', order: 1 },
  prototype: { tone: 'info', order: 2 },
  preproduction: { tone: 'info', order: 3 },
  production: { tone: 'info', order: 4 },
  polish: { tone: 'special', order: 5 },
  release: { tone: 'warning', order: 6 },
  live: { tone: 'success', order: 7 },
  paused: { tone: 'neutral', order: 8 },
  archived: { tone: 'muted', order: 9 },
})

const KIND_TONES = entries<ItemKind, { tone: Tone }>('kind', {
  task: { tone: 'neutral' },
  feature: { tone: 'info' },
  milestone: { tone: 'special' },
  decision: { tone: 'warning' },
  issue: { tone: 'danger' },
})
const KIND_PLURALS = names<ItemKind>('kindPlural', ['task', 'feature', 'milestone', 'decision', 'issue'])

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
  published: { tone: 'success' },
  superseded: { tone: 'muted' },
  withdrawn: { tone: 'danger' },
  to_confirm: { tone: 'warning' },
})

export const EVENT_TYPES = names<EventType>('eventType', [
  'fair',
  'festival',
  'showcase',
  'presentation',
  'deadline',
  'release',
  'steam',
  'meeting',
  'other',
])

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

export const RESOURCE_TYPES = names<ResourceType>('resourceType', ['repo', 'doc', 'link', 'design', 'asset', 'tool', 'guide'])

export const CHECKLIST_TARGETS = names<ChecklistTarget>('checklistTarget', ['steam', 'demo', 'update', 'event', 'release', 'other'])

export function label<K extends string>(table: Record<K, string | Entry>, key: K | undefined): string {
  if (key === undefined) return ''
  const v = table[key]
  if (v === undefined) return String(key)
  return typeof v === 'string' ? v : v.label
}
