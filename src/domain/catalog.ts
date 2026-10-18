// Nombres en pantalla y tono (color) de cada valor del modelo. Una sola tabla por tipo:
// así las pantallas no repiten textos y añadir un estado nuevo es tocar un sitio.
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

/** Tonos de las etiquetas; cada uno tiene su color en styles.css (.tone-…). */
export type Tone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger' | 'muted' | 'accent'

interface Entry {
  label: string
  tone: Tone
}

export const STAGES: Record<ProjectStage, Entry & { order: number }> = {
  idea: { label: 'Idea', tone: 'muted', order: 0 },
  concept: { label: 'Concepto', tone: 'muted', order: 1 },
  prototype: { label: 'Prototipo', tone: 'info', order: 2 },
  preproduction: { label: 'Preproducción', tone: 'info', order: 3 },
  production: { label: 'Producción', tone: 'progress', order: 4 },
  polish: { label: 'Pulido', tone: 'accent', order: 5 },
  release: { label: 'Lanzamiento', tone: 'warning', order: 6 },
  live: { label: 'Publicado', tone: 'success', order: 7 },
  paused: { label: 'En pausa', tone: 'neutral', order: 8 },
  archived: { label: 'Archivado', tone: 'muted', order: 9 },
}

export const KINDS: Record<ItemKind, Entry & { plural: string }> = {
  task: { label: 'Tarea', plural: 'Tareas', tone: 'neutral' },
  feature: { label: 'Funcionalidad', plural: 'Funcionalidades', tone: 'info' },
  milestone: { label: 'Hito', plural: 'Hitos', tone: 'accent' },
  decision: { label: 'Decisión', plural: 'Decisiones', tone: 'warning' },
  issue: { label: 'Incidencia', plural: 'Incidencias', tone: 'danger' },
}

export const STATUSES: Record<ItemStatus, Entry & { open: boolean }> = {
  idea: { label: 'Idea', tone: 'muted', open: true },
  backlog: { label: 'Pendiente', tone: 'neutral', open: true },
  planned: { label: 'Planificado', tone: 'info', open: true },
  in_progress: { label: 'En curso', tone: 'progress', open: true },
  review: { label: 'En revisión', tone: 'accent', open: true },
  blocked: { label: 'Bloqueado', tone: 'danger', open: true },
  paused: { label: 'En pausa', tone: 'neutral', open: true },
  to_confirm: { label: 'Por confirmar', tone: 'warning', open: true },
  done: { label: 'Hecho', tone: 'success', open: false },
  cancelled: { label: 'Descartado', tone: 'muted', open: false },
}

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

export const PRIORITIES: Record<Priority, Entry & { weight: number }> = {
  critical: { label: 'Crítica', tone: 'danger', weight: 4 },
  high: { label: 'Alta', tone: 'warning', weight: 3 },
  medium: { label: 'Media', tone: 'neutral', weight: 2 },
  low: { label: 'Baja', tone: 'muted', weight: 1 },
}

export const CONFIDENCES: Record<Confidence, Entry & { hint: string }> = {
  verified: { label: 'Verificado', tone: 'success', hint: 'Sale tal cual de una fuente (commit, PR, release o README).' },
  inferred: { label: 'Deducido', tone: 'info', hint: 'Se deduce de una fuente, pero no lo dice con esas palabras.' },
  to_confirm: { label: 'Sin confirmar', tone: 'warning', hint: 'Ninguna fuente lo confirma: lo tiene que confirmar el estudio.' },
}

export const SOURCE_TYPES: Record<SourceType, string> = {
  commit: 'Commit',
  pr: 'Pull request',
  release: 'Release',
  readme: 'README',
  doc: 'Documento',
  manual: 'Anotado a mano',
}

export const BUILD_CHANNELS: Record<BuildChannel, Entry> = {
  full: { label: 'Juego completo', tone: 'accent' },
  demo: { label: 'Demo', tone: 'info' },
  event: { label: 'Demo de evento', tone: 'warning' },
  playtest: { label: 'Playtest', tone: 'neutral' },
  beta: { label: 'Beta', tone: 'progress' },
  internal: { label: 'Interna', tone: 'muted' },
}

export const BUILD_STATUSES: Record<BuildStatus, Entry> = {
  in_progress: { label: 'En preparación', tone: 'progress' },
  ready: { label: 'Lista', tone: 'info' },
  published: { label: 'Publicada', tone: 'success' },
  superseded: { label: 'Sustituida', tone: 'muted' },
  withdrawn: { label: 'Retirada', tone: 'danger' },
  to_confirm: { label: 'Por confirmar', tone: 'warning' },
}

export const EVENT_TYPES: Record<EventType, string> = {
  fair: 'Feria',
  festival: 'Festival',
  showcase: 'Showcase',
  presentation: 'Presentación',
  deadline: 'Fecha límite',
  release: 'Lanzamiento',
  steam: 'Steam',
  meeting: 'Reunión',
  other: 'Otro',
}

export const EVENT_STATUSES: Record<EventStatus, Entry> = {
  idea: { label: 'Idea', tone: 'muted' },
  planned: { label: 'Previsto', tone: 'info' },
  confirmed: { label: 'Confirmado', tone: 'success' },
  done: { label: 'Celebrado', tone: 'neutral' },
  cancelled: { label: 'Cancelado', tone: 'muted' },
}

export const FEEDBACK_ORIGINS: Record<FeedbackOrigin, string> = {
  event: 'Evento o feria',
  playtest: 'Prueba con jugadores',
  community: 'Comunidad',
  steam: 'Steam',
  internal: 'Del estudio',
  other: 'Otro',
}

export const FEEDBACK_STATUSES: Record<FeedbackStatus, Entry & { open: boolean }> = {
  new: { label: 'Nuevo', tone: 'warning', open: true },
  triaged: { label: 'Revisado', tone: 'info', open: true },
  planned: { label: 'Planificado', tone: 'progress', open: true },
  addressed: { label: 'Resuelto', tone: 'success', open: false },
  wont_do: { label: 'No se hará', tone: 'muted', open: false },
}

export const RESOURCE_TYPES: Record<ResourceType, string> = {
  repo: 'Repositorio',
  doc: 'Documento',
  link: 'Enlace',
  design: 'Diseño',
  asset: 'Recurso gráfico',
  tool: 'Herramienta',
  guide: 'Guía',
}

export const CHECKLIST_TARGETS: Record<ChecklistTarget, string> = {
  steam: 'Steam',
  demo: 'Demo',
  update: 'Actualización',
  event: 'Evento',
  release: 'Lanzamiento',
  other: 'Otro',
}

export function label<K extends string>(table: Record<K, string | Entry>, key: K | undefined): string {
  if (key === undefined) return ''
  const v = table[key]
  if (v === undefined) return String(key)
  return typeof v === 'string' ? v : v.label
}
