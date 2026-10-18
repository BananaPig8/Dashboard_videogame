// Modelo de datos de Studio Hub.
//
// Todo cuelga del estudio: los proyectos son datos, no código. Añadir un videojuego
// nuevo es añadir un Project y sus elementos; ninguna pantalla conoce a un juego concreto.

/** Identificador estable, en minúsculas y con guiones (p. ej. «idt-demo-valladolid»). */
export type ID = string
/** Fecha de calendario «AAAA-MM-DD», en la hora local del estudio. */
export type ISODate = string
/** Fecha y hora «AAAA-MM-DDTHH:mm», en la hora local del estudio. */
export type ISODateTime = string

/** Etapa del ciclo de vida de un proyecto, de la idea al mantenimiento. */
export type ProjectStage =
  | 'idea'
  | 'concept'
  | 'prototype'
  | 'preproduction'
  | 'production'
  | 'polish'
  | 'release'
  | 'live'
  | 'paused'
  | 'archived'

/**
 * Qué es cada elemento de trabajo:
 * - task: algo que hay que hacer.
 * - feature: una funcionalidad del juego (hecha, en marcha o por hacer).
 * - milestone: un hito (una versión, una demo, una feria…).
 * - decision: una decisión tomada o pendiente de tomar.
 * - issue: un problema o fallo.
 */
export type ItemKind = 'task' | 'feature' | 'milestone' | 'decision' | 'issue'

export type ItemStatus =
  | 'idea'
  | 'backlog'
  | 'planned'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'paused'
  | 'to_confirm'
  | 'done'
  | 'cancelled'

export type Priority = 'low' | 'medium' | 'high' | 'critical'

/**
 * Cuánto nos fiamos de un dato:
 * - verified: sale tal cual de una fuente (commit, PR, release, README).
 * - inferred: se deduce de una fuente, pero no lo dice con esas palabras.
 * - to_confirm: no hay fuente que lo confirme; lo tiene que confirmar el estudio.
 */
export type Confidence = 'verified' | 'inferred' | 'to_confirm'

export type SourceType = 'commit' | 'pr' | 'release' | 'readme' | 'doc' | 'manual'

/** De dónde sale un dato, para poder comprobarlo. */
export interface SourceRef {
  type: SourceType
  /** Hash corto del commit, «#18» para una PR, nombre del documento o de la sección… */
  ref: string
  url?: string
  date?: ISODate
  note?: string
}

/** Línea de trabajo (UX, Steam, ferias…). Son del estudio y valen para todos los proyectos. */
export interface Area {
  id: ID
  name: string
  description?: string
  /** Color de la etiqueta, en hexadecimal. */
  color: string
}

export interface Studio {
  id: ID
  name: string
  tagline?: string
  createdAt: ISODate
}

export interface ProjectVersion {
  /** Qué versión es: «Juego completo», «Demo», «Demo de feria»… */
  label: string
  version: string
  note?: string
}

export interface ProjectLink {
  label: string
  url: string
}

export interface Project {
  id: ID
  /** Para la URL: /proyectos/<slug>. */
  slug: string
  name: string
  tagline?: string
  description: string
  engine?: string
  engineVersion?: string
  genre?: string
  platforms: string[]
  stage: ProjectStage
  /** Objetivo inmediato del proyecto, en una frase. */
  nextGoal?: string
  startedAt?: ISODate
  color: string
  repoUrl?: string
  versions: ProjectVersion[]
  tags: string[]
  links: ProjectLink[]
}

export interface WorkItem {
  id: ID
  projectId: ID
  kind: ItemKind
  title: string
  description?: string
  status: ItemStatus
  priority: Priority
  areaId?: ID
  createdAt?: ISODate
  startedAt?: ISODate
  completedAt?: ISODate
  dueDate?: ISODate
  /** Día en que se ha marcado para hacerlo («Hoy»). */
  focusDate?: ISODate
  /** Por qué está bloqueado o en pausa. */
  blockedReason?: string
  /** En las decisiones: lo que se decidió (o las opciones, si sigue abierta). */
  decisionOutcome?: string
  tags: string[]
  sources: SourceRef[]
  confidence: Confidence
  parentId?: ID
}

export type BuildChannel = 'full' | 'demo' | 'event' | 'playtest' | 'beta' | 'internal'
export type BuildStatus = 'in_progress' | 'ready' | 'published' | 'superseded' | 'withdrawn' | 'to_confirm'

/** Una versión compilada: juego completo, demo, demo de feria, beta… */
export interface Build {
  id: ID
  projectId: ID
  name: string
  version: string
  channel: BuildChannel
  platforms: string[]
  status: BuildStatus
  date?: ISODate
  /** Dónde está: «GitHub Releases (descargas)», «Steam (rama beta)»… */
  distribution?: string
  url?: string
  notes?: string
  sources: SourceRef[]
  confidence: Confidence
}

export type EventType =
  | 'fair'
  | 'festival'
  | 'showcase'
  | 'presentation'
  | 'deadline'
  | 'release'
  | 'steam'
  | 'meeting'
  | 'other'

export type EventStatus = 'idea' | 'planned' | 'confirmed' | 'done' | 'cancelled'

/** Ferias, festivales, presentaciones, entregas y fechas límite. */
export interface StudioEvent {
  id: ID
  /** Sin proyecto, es del estudio. */
  projectId?: ID
  title: string
  type: EventType
  status: EventStatus
  date?: ISODate
  endDate?: ISODate
  /** false mientras la fecha no esté confirmada (aunque haya una prevista). */
  dateConfirmed: boolean
  location?: string
  notes?: string
  sources: SourceRef[]
  confidence: Confidence
}

export type FeedbackOrigin = 'event' | 'playtest' | 'community' | 'steam' | 'internal' | 'other'
export type FeedbackStatus = 'new' | 'triaged' | 'planned' | 'addressed' | 'wont_do'

export interface Feedback {
  id: ID
  projectId: ID
  title: string
  detail?: string
  origin: FeedbackOrigin
  /** «Feria de Valladolid», «Discord», «Prueba con amigos»… */
  originDetail?: string
  receivedAt?: ISODate
  status: FeedbackStatus
  impact: Priority
  /** Elementos de trabajo que lo resuelven. */
  linkedItemIds: ID[]
  sources: SourceRef[]
  confidence: Confidence
}

export type ResourceType = 'repo' | 'doc' | 'link' | 'design' | 'asset' | 'tool' | 'guide'

/** Documentación, enlaces y herramientas que hay que tener a mano. */
export interface Resource {
  id: ID
  projectId?: ID
  title: string
  type: ResourceType
  url?: string
  /** Ruta dentro del repositorio del proyecto. */
  path?: string
  description?: string
  tags: string[]
}

export interface ChecklistItem {
  id: ID
  label: string
  done: boolean
  note?: string
  sources?: SourceRef[]
}

export type ChecklistTarget = 'steam' | 'demo' | 'update' | 'event' | 'release' | 'other'

/** Lo que hay que hacer para publicar, actualizar o llevar el juego a un evento. */
export interface Checklist {
  id: ID
  projectId: ID
  title: string
  target: ChecklistTarget
  description?: string
  items: ChecklistItem[]
}

export type ActivityType = 'commit' | 'merge' | 'release' | 'note'

/** El historial: cada commit, cada PR fusionada, cada versión publicada. */
export interface Activity {
  id: ID
  projectId: ID
  at: ISODateTime
  type: ActivityType
  title: string
  /** Hash corto del commit o «#18». */
  ref?: string
  url?: string
  areaId?: ID
  /** Aclaración, p. ej. que el commit está en una rama sin fusionar. */
  note?: string
}

export interface StudioData {
  schemaVersion: number
  studio: Studio
  areas: Area[]
  projects: Project[]
  items: WorkItem[]
  builds: Build[]
  events: StudioEvent[]
  feedback: Feedback[]
  resources: Resource[]
  checklists: Checklist[]
  activity: Activity[]
}

export const SCHEMA_VERSION = 1
