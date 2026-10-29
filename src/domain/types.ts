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
/** Hora «HH:mm», en la hora local del estudio. */
export type ClockTime = string
/** Importe en céntimos (entero), en la moneda del estudio. */
export type Cents = number

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
 * - goal: un objetivo (su progreso sale de los elementos que cuelgan de él con parentId).
 */
export type ItemKind = 'task' | 'feature' | 'milestone' | 'decision' | 'issue' | 'goal'

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
  /** Moneda de todos los importes (ISO 4217). Por defecto, EUR. */
  currency?: string
  /** Nombres propios del estudio para los estados de las tareas. */
  statusLabels?: Partial<Record<ItemStatus, string>>
  /** Columnas del tablero, en orden (las que no estén, ocultas). Por defecto, todas. */
  statusOrder?: ItemStatus[]
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
  /** El objetivo, hito o funcionalidad del que cuelga. */
  parentId?: ID
  /** Quién lo lleva (members). */
  assigneeId?: ID
  /** En una incidencia: la build en la que aparece. */
  buildId?: ID
  /** La versión (actualización, DLC…) en la que sale. */
  releaseId?: ID
  /** La reunión o el evento del que sale (p. ej. una decisión tomada en una reunión). */
  eventId?: ID
}

export type BuildChannel = 'full' | 'demo' | 'event' | 'playtest' | 'beta' | 'internal'
export type BuildStatus = 'in_progress' | 'ready' | 'candidate' | 'published' | 'superseded' | 'withdrawn' | 'to_confirm'

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
  /** Qué cambió en esta build, una línea por cambio. */
  changelog?: string
  /** La versión que sale a los jugadores de la que es esta build (una versión puede tener varias). */
  releaseId?: ID
  /** Si es la demo de una feria: el evento. */
  eventId?: ID
  tags?: string[]
  sources: SourceRef[]
  confidence: Confidence
}

/**
 * Tipos de evento. «release» y «steam» vienen de la versión 1 de los datos: se siguen
 * leyendo, pero ya no se crean (las fechas de publicación son de Release y el estado de la
 * tienda, de StoreListing).
 */
export type EventType =
  | 'fair'
  | 'festival'
  | 'award'
  | 'showcase'
  | 'presentation'
  | 'meeting'
  | 'deadline'
  | 'delivery'
  | 'release'
  | 'steam'
  | 'other'

export type RegistrationStatus = 'not_open' | 'open' | 'submitted' | 'accepted' | 'rejected' | 'not_needed'

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
  /** Hora de inicio y de fin (reuniones, presentaciones). */
  time?: ClockTime
  endTime?: ClockTime
  location?: string
  url?: string
  notes?: string
  /** Quién va (members), sobre todo en reuniones. */
  memberIds?: ID[]
  /** Inscripción (ferias, festivales, premios). La tasa es un gasto (Transaction con eventId). */
  registrationStatus?: RegistrationStatus
  registrationDeadline?: ISODate
  /** false o sin poner: el plazo es previsto, no confirmado. */
  registrationDeadlineConfirmed?: boolean
  registrationUrl?: string
  /** Lo que salió del evento y lo que queda por hacer después. */
  followUp?: string
  tags?: string[]
  sources: SourceRef[]
  confidence: Confidence
}

export type FeedbackOrigin = 'event' | 'playtest' | 'community' | 'steam' | 'internal' | 'other'
/** Qué es: un comentario, un fallo o una petición de mejora. Sin poner: sin clasificar. */
export type FeedbackKind = 'comment' | 'bug' | 'request'
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
  kind?: FeedbackKind
  /** Del evento o de la prueba de la que sale (origin event / playtest). */
  eventId?: ID
  playtestId?: ID
  /** La build con la que se vio. */
  buildId?: ID
  tags?: string[]
  sources: SourceRef[]
  confidence: Confidence
}

/**
 * Tipos de documento y de material. Los de la versión 1 (repo, doc, link, design, asset,
 * tool, guide) no cambian; el catálogo dice en qué sección sale cada uno.
 */
export type ResourceType =
  | 'repo'
  | 'doc'
  | 'link'
  | 'design'
  | 'asset'
  | 'tool'
  | 'guide'
  | 'technical'
  | 'note'
  | 'minutes'
  | 'screenshot'
  | 'video'
  | 'image'
  | 'logo'
  | 'reference'
  | 'marketing'

/** Documentación, notas, actas, enlaces, herramientas y material (capturas, vídeos, logos…). */
export interface Resource {
  id: ID
  projectId?: ID
  title: string
  type: ResourceType
  url?: string
  /** Ruta dentro del repositorio del proyecto. */
  path?: string
  /** El texto, si se escribe aquí mismo (notas, actas). */
  body?: string
  description?: string
  /** Fecha del documento (un acta, una nota). */
  date?: ISODate
  /** La reunión o el evento al que pertenece (el acta de una reunión, el material de una feria). */
  eventId?: ID
  /** La versión para la que es (material de una actualización o un DLC). */
  releaseId?: ID
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
  /** Para qué es: un evento, una versión o una ficha de tienda. */
  eventId?: ID
  releaseId?: ID
  listingId?: ID
  tags?: string[]
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
  /** Autor tal cual viene de git. */
  author?: string
  /** El miembro del equipo (si su ficha tiene ese autor entre sus alias). */
  memberId?: ID
}

// ——— Equipo ———————————————————————————————————————————————————————————————

export type MemberKind = 'core' | 'external'

/** Una persona del estudio o un colaborador externo. No se borra si tiene trabajo: se desactiva. */
export interface Member {
  id: ID
  name: string
  role?: string
  kind: MemberKind
  /** Áreas de las que es responsable. */
  areaIds: ID[]
  /** De qué se encarga, en palabras. */
  responsibilities?: string
  /** Horas a la semana (para la carga de trabajo). */
  weeklyHours?: number
  active: boolean
  /** Nombres con los que firma en git (para atribuirle commits). */
  aliases?: string[]
  notes?: string
}

/** Horas dedicadas, apuntadas a mano. */
export interface TimeEntry {
  id: ID
  projectId: ID
  memberId?: ID
  itemId?: ID
  date: ISODate
  minutes: number
  note?: string
}

// ——— Roadmap y publicación ————————————————————————————————————————————————

export type PhaseStatus = 'planned' | 'done'

/** Una fase del desarrollo (la fase actual es la etapa del proyecto). */
export interface Phase {
  id: ID
  projectId: ID
  stage: ProjectStage
  title?: string
  startDate?: ISODate
  endDate?: ISODate
  status: PhaseStatus
  notes?: string
}

export type ReleaseKind = 'launch' | 'update' | 'patch' | 'dlc' | 'expansion' | 'demo'
export type ReleaseStatus = 'idea' | 'planned' | 'in_progress' | 'released' | 'cancelled'

/**
 * Lo que sale a los jugadores: el lanzamiento, una actualización, un parche, un DLC, una
 * demo. Es la única fuente de las fechas de publicación; las builds apuntan a su versión.
 */
export interface Release {
  id: ID
  projectId: ID
  kind: ReleaseKind
  name: string
  version?: string
  status: ReleaseStatus
  targetDate?: ISODate
  /** false o sin poner: la fecha prevista no está confirmada. */
  targetConfirmed?: boolean
  releasedAt?: ISODate
  notes?: string
  tags?: string[]
  sources: SourceRef[]
  confidence: Confidence
}

export type StorePlatform = 'steam' | 'itch' | 'epic' | 'gog' | 'console' | 'web' | 'other'
export type ListingKind = 'game' | 'demo' | 'dlc' | 'playtest'
export type ListingStatus = 'not_started' | 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'coming_soon' | 'released'

/** La ficha de un juego (o su demo, o un DLC) en una tienda, llevada a mano. */
export interface StoreListing {
  id: ID
  projectId: ID
  platform: StorePlatform
  kind: ListingKind
  releaseId?: ID
  status: ListingStatus
  /** App ID u otro identificador de la tienda, si existe y se ha comprobado. */
  appId?: string
  url?: string
  notes?: string
  tags?: string[]
  sources: SourceRef[]
  confidence: Confidence
}

export type StoreTextKind = 'short' | 'long' | 'about' | 'features' | 'tags' | 'requirements' | 'other'

/** Un texto de una ficha de tienda (descripción corta, larga, características…). */
export interface StoreText {
  id: ID
  projectId: ID
  listingId: ID
  kind: StoreTextKind
  /** Idioma (BCP 47: es, en, …). */
  language: string
  text: string
  status: 'draft' | 'final'
}

export type AchievementStatus = 'idea' | 'designed' | 'implemented' | 'in_store'

/** Un logro del juego: en el código, y si está dado de alta en la tienda. */
export interface Achievement {
  id: ID
  projectId: ID
  name: string
  description?: string
  /** Oculto en la tienda hasta conseguirlo. Sin poner: aún no se ha decidido (no es «visible»). */
  hidden?: boolean
  /** Nombre interno (API) del logro. */
  apiName?: string
  status: AchievementStatus
  tags?: string[]
  sources: SourceRef[]
  confidence: Confidence
}

// ——— Feedback y pruebas ———————————————————————————————————————————————————

export type PlaytestMethod = 'internal' | 'friends' | 'closed' | 'public' | 'event' | 'other'

/** Una sesión de pruebas. Lo que se vio va como feedback con su playtestId. */
export interface Playtest {
  id: ID
  projectId: ID
  title: string
  date?: ISODate
  method: PlaytestMethod
  buildId?: ID
  eventId?: ID
  participants?: number
  summary?: string
  tags?: string[]
  sources: SourceRef[]
  confidence: Confidence
}

// ——— Calendario ———————————————————————————————————————————————————————————

/** Un recordatorio: avisa el mismo día. Puede apuntar a cualquier elemento. */
export interface Reminder {
  id: ID
  projectId?: ID
  title: string
  date: ISODate
  time?: ClockTime
  /** A qué se refiere («items», «idt-…»). */
  targetCollection?: string
  targetId?: ID
  done: boolean
  notes?: string
}

// ——— Finanzas y métricas ——————————————————————————————————————————————————

export type TransactionKind = 'expense' | 'income'
export type TransactionStatus = 'planned' | 'pending' | 'done' | 'cancelled'
export type TransactionCategory =
  | 'software'
  | 'hardware'
  | 'assets'
  | 'services'
  | 'marketing'
  | 'events'
  | 'fees'
  | 'people'
  | 'taxes'
  | 'sales'
  | 'grants'
  | 'other'

/** Un gasto o un ingreso, anotado a mano. Siempre en la moneda del estudio. */
export interface Transaction {
  id: ID
  kind: TransactionKind
  projectId?: ID
  eventId?: ID
  category: TransactionCategory
  description: string
  amount: Cents
  date: ISODate
  status: TransactionStatus
  /** Si se pagó en otra moneda: lo que se pagó y en cuál. */
  originalAmount?: Cents
  originalCurrency?: string
  tags?: string[]
  sources: SourceRef[]
  confidence: Confidence
}

/** Un presupuesto: cuánto se prevé gastar (en un proyecto, una categoría o en general). */
export interface Budget {
  id: ID
  name: string
  projectId?: ID
  category?: TransactionCategory
  amount: Cents
  from: ISODate
  to: ISODate
  notes?: string
}

export type MetricKind =
  | 'wishlists'
  | 'followers'
  | 'demo_players'
  | 'downloads'
  | 'units'
  | 'players'
  | 'peak_players'
  | 'reviews'
  | 'review_score'
  | 'revenue_reported'
  | 'other'

/**
 * Un dato de una plataforma (wishlists, ventas, reseñas…), apuntado a mano con su fuente.
 * El grupo (lanzamiento o comercial) sale del tipo; los comerciales solo cuentan verificados.
 */
export interface Metric {
  id: ID
  projectId: ID
  kind: MetricKind
  label?: string
  value: number
  date: ISODate
  platform?: StorePlatform
  sources: SourceRef[]
  confidence: Confidence
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
  members: Member[]
  timeEntries: TimeEntry[]
  phases: Phase[]
  releases: Release[]
  storeListings: StoreListing[]
  storeTexts: StoreText[]
  achievements: Achievement[]
  playtests: Playtest[]
  reminders: Reminder[]
  transactions: Transaction[]
  budgets: Budget[]
  metrics: Metric[]
}

/**
 * Versión del esquema. La 2 añade colecciones y campos opcionales; los datos de la 1 se
 * leen sin reescribirlos (domain/migrate.ts los completa al cargarlos).
 */
export const SCHEMA_VERSION = 2
