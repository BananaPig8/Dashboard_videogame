// Los campos de cada tipo de elemento, descritos como datos: un solo componente
// (EntityForm, en forms.tsx) los pinta y los valida. Añadir un campo es añadir una línea.
// Las referencias a otros elementos (build, evento, versión…) se eligen entre los del mismo
// proyecto y se vacían si cambia el proyecto.
import {
  ACHIEVEMENT_STATUSES,
  BUILD_CHANNELS,
  BUILD_STATUSES,
  CHECKLIST_TARGETS,
  CONFIDENCES,
  CREATABLE_EVENT_TYPES,
  EVENT_STATUSES,
  EVENT_TYPES,
  FEEDBACK_KINDS,
  FEEDBACK_ORIGINS,
  FEEDBACK_STATUSES,
  KINDS,
  LISTING_KINDS,
  LISTING_STATUSES,
  MEMBER_KINDS,
  METRIC_KINDS,
  PHASE_STATUSES,
  PLAYTEST_METHODS,
  PRIORITIES,
  REGISTRATION_STATUSES,
  RELEASE_KINDS,
  RELEASE_STATUSES,
  RESOURCE_TYPES,
  SECTOR_EVENT_TYPES,
  STAGES,
  STATUSES,
  STATUS_ORDER,
  STORE_PLATFORMS,
  STORE_TEXT_KINDS,
  STORE_TEXT_STATUSES,
  TRANSACTION_CATEGORIES,
  TRANSACTION_KINDS,
  TRANSACTION_STATUSES,
  label,
} from '../domain/catalog'
import type { CollectionKey } from '../domain/collections'
import type { StudioData } from '../domain/types'

export type Draft = Record<string, unknown>
export type Option = { value: string; label: string }

export interface ListField {
  key: string
  label: string
  type: 'text' | 'url'
  required?: boolean
}

export interface FieldSpec {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'time' | 'checkbox' | 'tags' | 'url' | 'color' | 'multi' | 'number' | 'money' | 'list'
  required?: boolean
  hint?: string
  /** Opciones de los desplegables; se calculan con los datos (proyectos, áreas…). */
  options?: (data: StudioData, draft: Draft) => Option[]
  /** Opción vacía del desplegable (si el campo es opcional). */
  empty?: string
  show?: (draft: Draft) => boolean
  wide?: boolean
  /** Apunta a algo del proyecto del borrador: se vacía si cambia el proyecto. */
  sameProject?: boolean
  /** Números: mínimo, máximo y si tienen que ser enteros. */
  min?: number
  max?: number
  integer?: boolean
  /** Listas («list»): las columnas de cada fila. */
  fields?: ListField[]
}

const fromTable = (table: Record<string, unknown>, order?: readonly string[]) => () =>
  (order ?? Object.keys(table)).map((value) => ({ value, label: label(table as Record<string, string>, value) }))

const byProject = <T extends { projectId?: string }>(list: T[], d: Draft) => list.filter((x) => !d.projectId || x.projectId === d.projectId)

const projectOptions = (data: StudioData) => data.projects.map((p) => ({ value: p.id, label: p.name }))
const areaOptions = (data: StudioData) => data.areas.map((a) => ({ value: a.id, label: a.name }))
const memberOptions = (data: StudioData, d: Draft, key = 'assigneeId') =>
  data.members.filter((m) => m.active || m.id === d[key]).map((m) => ({ value: m.id, label: m.kind === 'external' ? `${m.name} (externo)` : m.name }))
const buildOptions = (data: StudioData, d: Draft) => byProject(data.builds, d).map((b) => ({ value: b.id, label: `${b.name} ${b.version}` }))
const releaseOptions = (data: StudioData, d: Draft) => byProject(data.releases, d).map((r) => ({ value: r.id, label: r.version ? `${r.name} (${r.version})` : r.name }))
const eventOptions = (data: StudioData, d: Draft) =>
  data.events.filter((e) => !d.projectId || !e.projectId || e.projectId === d.projectId).map((e) => ({ value: e.id, label: e.date ? `${e.title} (${e.date})` : e.title }))
const listingOptions = (data: StudioData, d: Draft) =>
  byProject(data.storeListings, d).map((l) => ({ value: l.id, label: `${label(STORE_PLATFORMS, l.platform)} · ${label(LISTING_KINDS, l.kind)}` }))
const playtestOptions = (data: StudioData, d: Draft) => byProject(data.playtests, d).map((p) => ({ value: p.id, label: p.title }))
const itemOptions = (data: StudioData, d: Draft) =>
  byProject(data.items, d)
    .filter((i) => i.id !== d.id)
    .map((i) => ({ value: i.id, label: `${i.title} (${label(KINDS, i.kind)})` }))

const confidence: FieldSpec = { key: 'confidence', label: 'Fiabilidad del dato', type: 'select', required: true, options: fromTable(CONFIDENCES) }
const tags: FieldSpec = { key: 'tags', label: 'Etiquetas', type: 'tags', hint: 'Separadas por comas. Las mismas en todo el estudio.', wide: true }
const project = (required = true): FieldSpec =>
  required
    ? { key: 'projectId', label: 'Proyecto', type: 'select', required: true, options: projectOptions }
    : { key: 'projectId', label: 'Proyecto', type: 'select', empty: 'Todo el estudio', options: projectOptions }

/** Eventos que se pueden elegir al crear (los de la versión 1 se conservan si ya lo eran). */
const eventTypeOptions = (_: StudioData, d: Draft) => {
  const types = [...CREATABLE_EVENT_TYPES]
  if (typeof d.type === 'string' && !types.includes(d.type as never)) types.push(d.type as never)
  return types.map((value) => ({ value, label: label(EVENT_TYPES, value) }))
}

export const SPECS: Record<CollectionKey, FieldSpec[]> = {
  items: [
    { key: 'title', label: 'Título', type: 'text', required: true, wide: true },
    project(),
    { key: 'kind', label: 'Tipo', type: 'select', required: true, options: fromTable(KINDS) },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(STATUSES, STATUS_ORDER) },
    { key: 'priority', label: 'Prioridad', type: 'select', required: true, options: fromTable(PRIORITIES, ['critical', 'high', 'medium', 'low']) },
    { key: 'areaId', label: 'Área', type: 'select', empty: 'Sin área', options: areaOptions },
    { key: 'assigneeId', label: 'Quién lo lleva', type: 'select', empty: 'Sin asignar', options: (data, d) => memberOptions(data, d) },
    confidence,
    { key: 'description', label: 'Descripción', type: 'textarea', wide: true },
    {
      key: 'blockedReason',
      label: 'Qué lo bloquea o qué falta para retomarlo',
      type: 'textarea',
      wide: true,
      show: (d) => ['blocked', 'paused', 'to_confirm', 'review'].includes(String(d.status)) || !!d.blockedReason,
    },
    {
      key: 'decisionOutcome',
      label: 'Lo decidido (o las opciones, si sigue abierta)',
      type: 'textarea',
      wide: true,
      show: (d) => d.kind === 'decision' || !!d.decisionOutcome,
    },
    { key: 'dueDate', label: 'Fecha límite', type: 'date' },
    { key: 'focusDate', label: 'Para hacer el día', type: 'date', hint: 'Lo que tenga la fecha de hoy sale en «Hoy».' },
    { key: 'startedAt', label: 'Empezado', type: 'date' },
    { key: 'completedAt', label: 'Terminado', type: 'date', show: (d) => d.status === 'done' || d.status === 'cancelled' || !!d.completedAt },
    { key: 'parentId', label: 'Cuelga de', type: 'select', empty: 'De nada', hint: 'El objetivo, hito o funcionalidad del que forma parte.', options: itemOptions, sameProject: true, wide: true },
    { key: 'buildId', label: 'Build en la que aparece', type: 'select', empty: 'Ninguna', options: buildOptions, sameProject: true, show: (d) => d.kind === 'issue' || !!d.buildId },
    { key: 'releaseId', label: 'Versión en la que sale', type: 'select', empty: 'Ninguna', options: releaseOptions, sameProject: true },
    { key: 'eventId', label: 'Reunión o evento del que sale', type: 'select', empty: 'Ninguno', options: eventOptions, sameProject: true, show: (d) => d.kind === 'decision' || !!d.eventId },
    tags,
  ],
  builds: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true },
    project(),
    { key: 'version', label: 'Versión', type: 'text', required: true },
    { key: 'channel', label: 'Canal', type: 'select', required: true, options: fromTable(BUILD_CHANNELS) },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(BUILD_STATUSES) },
    { key: 'date', label: 'Fecha', type: 'date' },
    { key: 'platforms', label: 'Plataformas', type: 'tags', hint: 'Windows, Linux, macOS…' },
    { key: 'distribution', label: 'Dónde está', type: 'text', hint: 'GitHub Releases, Steam (rama beta), itch.io…' },
    { key: 'releaseId', label: 'Versión para jugadores', type: 'select', empty: 'Ninguna', options: releaseOptions, sameProject: true },
    { key: 'eventId', label: 'Evento', type: 'select', empty: 'Ninguno', options: eventOptions, sameProject: true, show: (d) => d.channel === 'event' || !!d.eventId },
    { key: 'url', label: 'Enlace', type: 'url', wide: true },
    confidence,
    { key: 'changelog', label: 'Qué cambia', type: 'textarea', hint: 'Una línea por cambio.', wide: true },
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
    tags,
  ],
  events: [
    { key: 'title', label: 'Nombre', type: 'text', required: true, wide: true },
    project(false),
    { key: 'type', label: 'Tipo', type: 'select', required: true, options: eventTypeOptions },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(EVENT_STATUSES) },
    { key: 'date', label: 'Fecha', type: 'date' },
    { key: 'endDate', label: 'Hasta', type: 'date' },
    { key: 'time', label: 'Hora', type: 'time' },
    { key: 'endTime', label: 'Hasta las', type: 'time', show: (d) => !!d.time || !!d.endTime },
    { key: 'dateConfirmed', label: 'Fecha confirmada', type: 'checkbox' },
    { key: 'location', label: 'Lugar', type: 'text' },
    { key: 'url', label: 'Web del evento', type: 'url', wide: true },
    { key: 'memberIds', label: 'Quién va', type: 'multi', wide: true, hint: 'Ctrl o Cmd + clic para elegir varios.', options: (data, d) => memberOptions(data, d, 'memberIds') },
    {
      key: 'registrationStatus',
      label: 'Inscripción',
      type: 'select',
      empty: 'Sin datos',
      options: fromTable(REGISTRATION_STATUSES),
      show: (d) => SECTOR_EVENT_TYPES.includes(d.type as never) || !!d.registrationStatus,
    },
    { key: 'registrationDeadline', label: 'Cierre de la inscripción', type: 'date', show: (d) => !!d.registrationStatus && d.registrationStatus !== 'not_needed' },
    {
      key: 'registrationDeadlineConfirmed',
      label: 'Plazo de inscripción confirmado',
      type: 'checkbox',
      show: (d) => !!d.registrationDeadline,
    },
    { key: 'registrationUrl', label: 'Enlace de la inscripción', type: 'url', wide: true, show: (d) => !!d.registrationStatus && d.registrationStatus !== 'not_needed' },
    confidence,
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
    { key: 'followUp', label: 'Seguimiento: qué salió y qué queda por hacer', type: 'textarea', wide: true, show: (d) => d.status === 'done' || !!d.followUp },
    tags,
  ],
  feedback: [
    { key: 'title', label: 'Qué se ha dicho', type: 'text', required: true, wide: true },
    project(),
    { key: 'kind', label: 'Qué es', type: 'select', empty: 'Sin clasificar', options: fromTable(FEEDBACK_KINDS) },
    { key: 'origin', label: 'Origen', type: 'select', required: true, options: fromTable(FEEDBACK_ORIGINS) },
    { key: 'originDetail', label: 'Dónde o quién', type: 'text', hint: 'Feria, Discord, prueba con amigos…' },
    { key: 'eventId', label: 'Evento', type: 'select', empty: 'Ninguno', options: eventOptions, sameProject: true, show: (d) => d.origin === 'event' || !!d.eventId },
    { key: 'playtestId', label: 'Prueba', type: 'select', empty: 'Ninguna', options: playtestOptions, sameProject: true, show: (d) => d.origin === 'playtest' || !!d.playtestId },
    { key: 'buildId', label: 'Build con la que se vio', type: 'select', empty: 'No se sabe', options: buildOptions, sameProject: true },
    { key: 'receivedAt', label: 'Recibido', type: 'date' },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(FEEDBACK_STATUSES) },
    { key: 'impact', label: 'Impacto', type: 'select', required: true, options: fromTable(PRIORITIES, ['critical', 'high', 'medium', 'low']) },
    confidence,
    { key: 'detail', label: 'Detalle', type: 'textarea', wide: true },
    {
      key: 'linkedItemIds',
      label: 'Elementos que lo resuelven',
      type: 'multi',
      wide: true,
      hint: 'Ctrl o Cmd + clic para elegir varios.',
      sameProject: true,
      options: (data, d) => byProject(data.items, d).map((i) => ({ value: i.id, label: `${i.title} (${label(STATUSES, i.status)})` })),
    },
    tags,
  ],
  resources: [
    { key: 'title', label: 'Título', type: 'text', required: true, wide: true },
    project(false),
    { key: 'type', label: 'Tipo', type: 'select', required: true, options: fromTable(RESOURCE_TYPES) },
    { key: 'date', label: 'Fecha del documento', type: 'date' },
    { key: 'url', label: 'Enlace', type: 'url', wide: true },
    { key: 'path', label: 'Ruta en el repositorio', type: 'text', wide: true },
    { key: 'body', label: 'Texto', type: 'textarea', hint: 'Para notas y actas escritas aquí mismo. Hace falta un enlace, una ruta o un texto.', wide: true },
    { key: 'eventId', label: 'Reunión o evento', type: 'select', empty: 'Ninguno', options: eventOptions, sameProject: true },
    { key: 'releaseId', label: 'Versión', type: 'select', empty: 'Ninguna', options: releaseOptions, sameProject: true },
    { key: 'description', label: 'Para qué sirve', type: 'textarea', wide: true },
    tags,
  ],
  checklists: [
    { key: 'title', label: 'Título', type: 'text', required: true, wide: true },
    project(),
    { key: 'target', label: 'Para', type: 'select', required: true, options: fromTable(CHECKLIST_TARGETS) },
    { key: 'eventId', label: 'Evento', type: 'select', empty: 'Ninguno', options: eventOptions, sameProject: true },
    { key: 'releaseId', label: 'Versión', type: 'select', empty: 'Ninguna', options: releaseOptions, sameProject: true },
    { key: 'listingId', label: 'Ficha de tienda', type: 'select', empty: 'Ninguna', options: listingOptions, sameProject: true },
    { key: 'description', label: 'Descripción', type: 'textarea', wide: true },
    tags,
  ],
  projects: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true },
    { key: 'stage', label: 'Etapa', type: 'select', required: true, options: fromTable(STAGES) },
    { key: 'color', label: 'Color', type: 'color' },
    { key: 'tagline', label: 'En una frase', type: 'text', wide: true },
    { key: 'description', label: 'Descripción', type: 'textarea', wide: true },
    { key: 'nextGoal', label: 'Objetivo inmediato', type: 'text', wide: true },
    { key: 'engine', label: 'Motor', type: 'text' },
    { key: 'engineVersion', label: 'Versión del motor', type: 'text' },
    { key: 'genre', label: 'Género', type: 'text' },
    { key: 'startedAt', label: 'Empezado', type: 'date' },
    { key: 'platforms', label: 'Plataformas', type: 'tags', wide: true },
    { key: 'repoUrl', label: 'Repositorio', type: 'url', wide: true },
    {
      key: 'versions',
      label: 'Versiones',
      type: 'list',
      wide: true,
      fields: [
        { key: 'label', label: 'Qué es', type: 'text', required: true },
        { key: 'version', label: 'Versión', type: 'text', required: true },
        { key: 'note', label: 'Nota', type: 'text' },
      ],
    },
    {
      key: 'links',
      label: 'Enlaces',
      type: 'list',
      wide: true,
      fields: [
        { key: 'label', label: 'Nombre', type: 'text', required: true },
        { key: 'url', label: 'Dirección', type: 'url', required: true },
      ],
    },
    tags,
  ],
  areas: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true },
    { key: 'color', label: 'Color', type: 'color' },
    { key: 'description', label: 'Qué abarca', type: 'textarea', wide: true },
  ],
  activity: [],
  members: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true },
    { key: 'kind', label: 'Relación', type: 'select', required: true, options: fromTable(MEMBER_KINDS) },
    { key: 'role', label: 'Papel', type: 'text', hint: 'Programación, arte, música, producción…' },
    { key: 'areaIds', label: 'Áreas de las que es responsable', type: 'multi', wide: true, hint: 'Ctrl o Cmd + clic para elegir varias.', options: areaOptions },
    { key: 'responsibilities', label: 'De qué se encarga', type: 'textarea', wide: true },
    { key: 'weeklyHours', label: 'Horas a la semana', type: 'number', min: 0, max: 168, integer: true },
    { key: 'active', label: 'Sigue en el estudio', type: 'checkbox' },
    { key: 'aliases', label: 'Nombres en git', type: 'tags', hint: 'Con los que firma sus commits (para atribuirle la actividad).', wide: true },
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
  ],
  timeEntries: [
    project(),
    { key: 'memberId', label: 'Quién', type: 'select', empty: 'Sin indicar', options: (data, d) => memberOptions(data, d, 'memberId') },
    { key: 'date', label: 'Día', type: 'date', required: true },
    { key: 'minutes', label: 'Minutos', type: 'number', required: true, min: 1, max: 1440, integer: true, hint: '90 = 1 h 30 min.' },
    { key: 'itemId', label: 'En qué', type: 'select', empty: 'En general', options: itemOptions, sameProject: true, wide: true },
    { key: 'note', label: 'Nota', type: 'text', wide: true },
  ],
  phases: [
    project(),
    { key: 'stage', label: 'Etapa', type: 'select', required: true, options: fromTable(STAGES) },
    { key: 'title', label: 'Nombre propio', type: 'text', hint: 'Si la fase tiene un nombre, p. ej. «Vertical slice».' },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(PHASE_STATUSES) },
    { key: 'startDate', label: 'Empieza', type: 'date' },
    { key: 'endDate', label: 'Termina', type: 'date' },
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
  ],
  releases: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true, hint: 'Lanzamiento en Steam, Actualización de invierno, DLC…' },
    project(),
    { key: 'kind', label: 'Qué es', type: 'select', required: true, options: fromTable(RELEASE_KINDS) },
    { key: 'version', label: 'Versión', type: 'text' },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(RELEASE_STATUSES) },
    { key: 'targetDate', label: 'Fecha prevista', type: 'date' },
    { key: 'targetConfirmed', label: 'Fecha confirmada', type: 'checkbox', show: (d) => !!d.targetDate },
    { key: 'releasedAt', label: 'Publicada el', type: 'date', show: (d) => d.status === 'released' || !!d.releasedAt },
    confidence,
    { key: 'notes', label: 'Qué incluye', type: 'textarea', wide: true },
    tags,
  ],
  storeListings: [
    project(),
    { key: 'platform', label: 'Tienda', type: 'select', required: true, options: fromTable(STORE_PLATFORMS) },
    { key: 'kind', label: 'De qué es la ficha', type: 'select', required: true, options: fromTable(LISTING_KINDS) },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(LISTING_STATUSES) },
    { key: 'releaseId', label: 'Versión', type: 'select', empty: 'Ninguna', options: releaseOptions, sameProject: true },
    { key: 'appId', label: 'App ID u otro identificador', type: 'text', hint: 'Solo si existe y se ha comprobado.' },
    { key: 'url', label: 'Página en la tienda', type: 'url', wide: true },
    confidence,
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
    tags,
  ],
  storeTexts: [
    project(),
    { key: 'listingId', label: 'Ficha', type: 'select', required: true, options: listingOptions, sameProject: true },
    { key: 'kind', label: 'Qué texto es', type: 'select', required: true, options: fromTable(STORE_TEXT_KINDS) },
    { key: 'language', label: 'Idioma', type: 'text', required: true, hint: 'es, en, fr…' },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(STORE_TEXT_STATUSES) },
    { key: 'text', label: 'Texto', type: 'textarea', required: true, wide: true },
  ],
  achievements: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true },
    project(),
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(ACHIEVEMENT_STATUSES) },
    { key: 'apiName', label: 'Nombre interno (API)', type: 'text' },
    { key: 'hidden', label: 'Oculto hasta conseguirlo', type: 'checkbox' },
    { key: 'description', label: 'Cómo se consigue', type: 'textarea', wide: true },
    confidence,
    tags,
  ],
  playtests: [
    { key: 'title', label: 'Nombre', type: 'text', required: true, wide: true },
    project(),
    { key: 'method', label: 'Cómo', type: 'select', required: true, options: fromTable(PLAYTEST_METHODS) },
    { key: 'date', label: 'Fecha', type: 'date' },
    { key: 'participants', label: 'Personas', type: 'number', min: 0, integer: true },
    { key: 'buildId', label: 'Build', type: 'select', empty: 'Sin indicar', options: buildOptions, sameProject: true },
    { key: 'eventId', label: 'Evento', type: 'select', empty: 'Ninguno', options: eventOptions, sameProject: true, show: (d) => d.method === 'event' || !!d.eventId },
    confidence,
    { key: 'summary', label: 'Resumen', type: 'textarea', hint: 'Cada cosa concreta que se vio va como feedback de esta prueba.', wide: true },
    tags,
  ],
  reminders: [
    { key: 'title', label: 'Qué recordar', type: 'text', required: true, wide: true },
    project(false),
    { key: 'date', label: 'Día', type: 'date', required: true },
    { key: 'time', label: 'Hora', type: 'time' },
    { key: 'done', label: 'Hecho', type: 'checkbox' },
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
  ],
  transactions: [
    { key: 'description', label: 'Concepto', type: 'text', required: true, wide: true },
    { key: 'kind', label: 'Tipo', type: 'select', required: true, options: fromTable(TRANSACTION_KINDS) },
    { key: 'amount', label: 'Importe', type: 'money', required: true, hint: 'En la moneda del estudio (Ajustes).' },
    { key: 'category', label: 'Categoría', type: 'select', required: true, options: fromTable(TRANSACTION_CATEGORIES) },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(TRANSACTION_STATUSES) },
    { key: 'date', label: 'Fecha', type: 'date', required: true },
    project(false),
    { key: 'eventId', label: 'Evento', type: 'select', empty: 'Ninguno', options: eventOptions, sameProject: true },
    confidence,
    tags,
  ],
  budgets: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true },
    { key: 'amount', label: 'Importe previsto', type: 'money', required: true },
    project(false),
    { key: 'category', label: 'Categoría', type: 'select', empty: 'Todas', options: fromTable(TRANSACTION_CATEGORIES) },
    { key: 'from', label: 'Desde', type: 'date', required: true },
    { key: 'to', label: 'Hasta', type: 'date', required: true },
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
  ],
  metrics: [
    project(),
    { key: 'kind', label: 'Qué se mide', type: 'select', required: true, options: fromTable(METRIC_KINDS) },
    { key: 'label', label: 'Nombre', type: 'text', show: (d) => d.kind === 'other' || !!d.label },
    {
      key: 'value',
      label: 'Valor',
      type: 'number',
      required: true,
      hint: 'Tal como lo da la plataforma. Los ingresos que informa, en unidades de la moneda del estudio (1250,50), no en céntimos.',
    },
    { key: 'date', label: 'Fecha del dato', type: 'date', required: true },
    { key: 'platform', label: 'Plataforma', type: 'select', empty: 'Sin indicar', options: fromTable(STORE_PLATFORMS) },
    confidence,
  ],
}
