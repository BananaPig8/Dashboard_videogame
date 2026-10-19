// Comprueba que unos datos tienen sentido antes de usarlos: al importar un JSON, al
// cargar lo guardado, al guardar un formulario y en las pruebas de los datos iniciales.
// Devuelve los problemas en castellano en vez de lanzar, para poder enseñarlos.
// Los datos se normalizan antes (migrate.ts): aquí las referencias opcionales ya existen.
import {
  ACHIEVEMENT_STATUSES,
  BUILD_CHANNELS,
  BUILD_STATUSES,
  CHECKLIST_TARGETS,
  CONFIDENCES,
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
  SOURCE_TYPES,
  STAGES,
  STATUSES,
  STORE_PLATFORMS,
  STORE_TEXT_KINDS,
  STORE_TEXT_STATUSES,
  TRANSACTION_CATEGORIES,
  TRANSACTION_KINDS,
  TRANSACTION_STATUSES,
} from './catalog'
import { COLLECTIONS, COLLECTION_BY_KEY, type CollectionKey } from './collections'
import { isValidISODate, isValidISODateTime } from './dates'
import type { SourceRef, StudioData } from './types'

type Row = Record<string, unknown>

/** Lo que necesita cada comprobación: los ids que existen y cómo apuntar un problema. */
interface Ctx {
  ids: Record<CollectionKey, Set<string>>
  err: (where: string, msg: string) => void
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

/** Colecciones que afirman estados externos: «verificado» necesita una fuente que se pueda comprobar. */
const EXTERNAL_FACTS: CollectionKey[] = ['metrics', 'storeListings', 'achievements', 'releases']

function checks(ctx: Ctx) {
  const { err } = ctx
  const oneOf = (where: string, field: string, value: unknown, table: object, optional = false) => {
    if (optional && value === undefined) return
    if (typeof value !== 'string' || !(value in table)) err(where, `${field} no válido («${String(value)}»)`)
  }
  const date = (where: string, field: string, value: unknown) => {
    if (value !== undefined && !isValidISODate(value)) err(where, `${field} no es una fecha AAAA-MM-DD («${String(value)}»)`)
  }
  const clock = (where: string, field: string, value: unknown) => {
    if (value !== undefined && (typeof value !== 'string' || !CLOCK.test(value))) err(where, `${field} no es una hora HH:mm («${String(value)}»)`)
  }
  const text = (where: string, field: string, value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) err(where, `falta ${field}`)
  }
  const int = (where: string, field: string, value: unknown, optional = false, min = 0) => {
    if (optional && value === undefined) return
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) err(where, `${field} tiene que ser un número entero${min > 0 ? ` desde ${min}` : ''} («${String(value)}»)`)
  }
  const list = (where: string, field: string, value: unknown, optional = false) => {
    if (optional && value === undefined) return
    if (!Array.isArray(value)) err(where, `${field} no es una lista`)
  }
  const sources = (where: string, value: unknown, required: boolean) => {
    if (value === undefined) {
      if (required) err(where, 'faltan sources')
      return
    }
    if (!Array.isArray(value)) return err(where, 'sources no es una lista')
    ;(value as SourceRef[]).forEach((s, k) => {
      oneOf(`${where} fuente ${k + 1}`, 'type', s?.type, SOURCE_TYPES)
      if (typeof s?.ref !== 'string' || !s.ref) err(`${where} fuente ${k + 1}`, 'falta ref')
      date(`${where} fuente ${k + 1}`, 'date', s?.date)
    })
  }
  const confidence = (where: string, e: Row) => oneOf(where, 'confidence', e.confidence, CONFIDENCES)
  const project = (where: string, id: unknown, optional = false) => {
    if (optional && id === undefined) return
    if (typeof id !== 'string' || !ctx.ids.projects.has(id)) err(where, `projectId desconocido («${String(id)}»)`)
  }
  const ref = (where: string, field: string, value: unknown, to: CollectionKey) => {
    if (value === undefined) return
    if (typeof value !== 'string' || !ctx.ids[to].has(value)) err(where, `${field} desconocido («${String(value)}»)`)
  }
  const refs = (where: string, field: string, value: unknown, to: CollectionKey) => {
    if (value === undefined) return
    if (!Array.isArray(value)) return err(where, `${field} no es una lista`)
    for (const id of value) if (!ctx.ids[to].has(id)) err(where, `${field}: «${String(id)}» no existe`)
  }
  const tags = (where: string, e: Row) => list(where, 'tags', e.tags, true)

  const by: Record<CollectionKey, (e: Row, w: string) => void> = {
    areas: (a, w) => {
      text(w, 'el nombre', a.name)
      if (typeof a.color !== 'string') err(w, 'falta el color')
    },
    projects: (p, w) => {
      text(w, 'el nombre', p.name)
      if (typeof p.slug !== 'string' || !/^[a-z0-9-]+$/.test(p.slug)) err(w, `slug no válido («${String(p.slug)}»)`)
      oneOf(w, 'stage', p.stage, STAGES)
      date(w, 'startedAt', p.startedAt)
      if (!Array.isArray(p.platforms) || !Array.isArray(p.versions) || !Array.isArray(p.tags) || !Array.isArray(p.links))
        err(w, 'platforms, versions, tags y links tienen que ser listas')
    },
    items: (i, w) => {
      project(w, i.projectId)
      text(w, 'el título', i.title)
      oneOf(w, 'kind', i.kind, KINDS)
      oneOf(w, 'status', i.status, STATUSES)
      oneOf(w, 'priority', i.priority, PRIORITIES)
      confidence(w, i)
      ref(w, 'área', i.areaId, 'areas')
      for (const f of ['createdAt', 'startedAt', 'completedAt', 'dueDate', 'focusDate']) date(w, f, i[f])
      if (i.startedAt && i.completedAt && String(i.startedAt) > String(i.completedAt)) err(w, 'startedAt es posterior a completedAt')
      if (i.status === 'done' && !i.completedAt) err(w, 'está hecho pero no tiene completedAt')
      if (i.status !== 'done' && i.status !== 'cancelled' && i.completedAt) err(w, 'tiene completedAt pero no está hecho')
      ref(w, 'parentId', i.parentId, 'items')
      if (i.parentId !== undefined && i.parentId === i.id) err(w, 'cuelga de sí mismo')
      ref(w, 'assigneeId', i.assigneeId, 'members')
      ref(w, 'buildId', i.buildId, 'builds')
      ref(w, 'releaseId', i.releaseId, 'releases')
      ref(w, 'eventId', i.eventId, 'events')
      list(w, 'tags', i.tags)
      sources(w, i.sources, true)
      // Lo anotado a mano por el estudio cuenta como fuente: el estudio es quien lo sabe.
      if (i.confidence === 'verified' && !(i.sources as unknown[] | undefined)?.length) err(w, 'está como verificado pero no tiene ninguna fuente')
    },
    builds: (b, w) => {
      project(w, b.projectId)
      text(w, 'el nombre', b.name)
      oneOf(w, 'channel', b.channel, BUILD_CHANNELS)
      oneOf(w, 'status', b.status, BUILD_STATUSES)
      confidence(w, b)
      date(w, 'date', b.date)
      ref(w, 'releaseId', b.releaseId, 'releases')
      ref(w, 'eventId', b.eventId, 'events')
      tags(w, b)
      sources(w, b.sources, true)
    },
    events: (e, w) => {
      project(w, e.projectId, true)
      text(w, 'el título', e.title)
      oneOf(w, 'type', e.type, EVENT_TYPES)
      oneOf(w, 'status', e.status, EVENT_STATUSES)
      confidence(w, e)
      date(w, 'date', e.date)
      date(w, 'endDate', e.endDate)
      if (e.date && e.endDate && String(e.endDate) < String(e.date)) err(w, 'endDate es anterior a date')
      clock(w, 'time', e.time)
      clock(w, 'endTime', e.endTime)
      if (typeof e.dateConfirmed !== 'boolean') err(w, 'falta dateConfirmed')
      if (e.dateConfirmed && !e.date) err(w, 'tiene la fecha confirmada pero no tiene fecha')
      refs(w, 'memberIds', e.memberIds, 'members')
      oneOf(w, 'registrationStatus', e.registrationStatus, REGISTRATION_STATUSES, true)
      date(w, 'registrationDeadline', e.registrationDeadline)
      tags(w, e)
      sources(w, e.sources, true)
    },
    feedback: (f, w) => {
      project(w, f.projectId)
      text(w, 'el título', f.title)
      oneOf(w, 'origin', f.origin, FEEDBACK_ORIGINS)
      oneOf(w, 'status', f.status, FEEDBACK_STATUSES)
      oneOf(w, 'impact', f.impact, PRIORITIES)
      oneOf(w, 'kind', f.kind, FEEDBACK_KINDS, true)
      confidence(w, f)
      date(w, 'receivedAt', f.receivedAt)
      for (const id of (f.linkedItemIds as unknown[]) ?? []) if (!ctx.ids.items.has(id as string)) err(w, `enlaza un elemento que no existe («${String(id)}»)`)
      ref(w, 'eventId', f.eventId, 'events')
      ref(w, 'playtestId', f.playtestId, 'playtests')
      ref(w, 'buildId', f.buildId, 'builds')
      if (f.playtestId !== undefined && f.origin !== 'playtest') err(w, 'viene de una prueba pero su origen no es «prueba con jugadores»')
      if (f.eventId !== undefined && f.origin !== 'event') err(w, 'viene de un evento pero su origen no es «evento o feria»')
      tags(w, f)
      sources(w, f.sources, true)
    },
    resources: (r, w) => {
      project(w, r.projectId, true)
      text(w, 'el título', r.title)
      oneOf(w, 'type', r.type, RESOURCE_TYPES)
      if (!r.url && !r.path && !r.body) err(w, 'necesita url, path o texto')
      date(w, 'date', r.date)
      ref(w, 'eventId', r.eventId, 'events')
      ref(w, 'releaseId', r.releaseId, 'releases')
      list(w, 'tags', r.tags)
    },
    checklists: (c, w) => {
      project(w, c.projectId)
      text(w, 'el título', c.title)
      oneOf(w, 'target', c.target, CHECKLIST_TARGETS)
      const seen = new Set<string>()
      for (const it of (c.items as Row[]) ?? []) {
        if (!it.id || seen.has(it.id as string)) err(w, `paso sin id o repetido («${String(it.id)}»)`)
        seen.add(it.id as string)
        if (typeof it.done !== 'boolean') err(w, `el paso «${String(it.id)}» no dice si está hecho`)
        sources(`${w} paso ${String(it.id)}`, it.sources, false)
      }
      ref(w, 'eventId', c.eventId, 'events')
      ref(w, 'releaseId', c.releaseId, 'releases')
      ref(w, 'listingId', c.listingId, 'storeListings')
      tags(w, c)
    },
    activity: (a, w) => {
      project(w, a.projectId)
      if (!isValidISODateTime(a.at)) err(w, `at no es AAAA-MM-DDTHH:mm («${String(a.at)}»)`)
      ref(w, 'área', a.areaId, 'areas')
      ref(w, 'memberId', a.memberId, 'members')
    },
    members: (m, w) => {
      text(w, 'el nombre', m.name)
      oneOf(w, 'kind', m.kind, MEMBER_KINDS)
      refs(w, 'areaIds', m.areaIds, 'areas')
      int(w, 'weeklyHours', m.weeklyHours, true)
      if (typeof m.active !== 'boolean') err(w, 'falta active')
      list(w, 'aliases', m.aliases, true)
    },
    timeEntries: (t, w) => {
      project(w, t.projectId)
      ref(w, 'memberId', t.memberId, 'members')
      ref(w, 'itemId', t.itemId, 'items')
      if (!isValidISODate(t.date)) err(w, `date no es una fecha AAAA-MM-DD («${String(t.date)}»)`)
      int(w, 'minutes', t.minutes, false, 1)
    },
    phases: (p, w) => {
      project(w, p.projectId)
      oneOf(w, 'stage', p.stage, STAGES)
      oneOf(w, 'status', p.status, PHASE_STATUSES)
      date(w, 'startDate', p.startDate)
      date(w, 'endDate', p.endDate)
      if (p.startDate && p.endDate && String(p.endDate) < String(p.startDate)) err(w, 'endDate es anterior a startDate')
    },
    releases: (r, w) => {
      project(w, r.projectId)
      text(w, 'el nombre', r.name)
      oneOf(w, 'kind', r.kind, RELEASE_KINDS)
      oneOf(w, 'status', r.status, RELEASE_STATUSES)
      confidence(w, r)
      date(w, 'targetDate', r.targetDate)
      date(w, 'releasedAt', r.releasedAt)
      if (r.status === 'released' && !r.releasedAt) err(w, 'está publicada pero no tiene releasedAt')
      if (r.targetConfirmed && !r.targetDate) err(w, 'tiene la fecha confirmada pero no tiene fecha')
      tags(w, r)
      sources(w, r.sources, true)
    },
    storeListings: (l, w) => {
      project(w, l.projectId)
      oneOf(w, 'platform', l.platform, STORE_PLATFORMS)
      oneOf(w, 'kind', l.kind, LISTING_KINDS)
      oneOf(w, 'status', l.status, LISTING_STATUSES)
      confidence(w, l)
      ref(w, 'releaseId', l.releaseId, 'releases')
      tags(w, l)
      sources(w, l.sources, true)
    },
    storeTexts: (t, w) => {
      project(w, t.projectId)
      if (typeof t.listingId !== 'string' || !ctx.ids.storeListings.has(t.listingId)) err(w, `listingId desconocido («${String(t.listingId)}»)`)
      oneOf(w, 'kind', t.kind, STORE_TEXT_KINDS)
      oneOf(w, 'status', t.status, STORE_TEXT_STATUSES)
      text(w, 'el idioma', t.language)
      if (typeof t.text !== 'string') err(w, 'falta el texto')
    },
    achievements: (a, w) => {
      project(w, a.projectId)
      text(w, 'el nombre', a.name)
      oneOf(w, 'status', a.status, ACHIEVEMENT_STATUSES)
      confidence(w, a)
      tags(w, a)
      sources(w, a.sources, true)
    },
    playtests: (p, w) => {
      project(w, p.projectId)
      text(w, 'el título', p.title)
      oneOf(w, 'method', p.method, PLAYTEST_METHODS)
      confidence(w, p)
      date(w, 'date', p.date)
      ref(w, 'buildId', p.buildId, 'builds')
      ref(w, 'eventId', p.eventId, 'events')
      int(w, 'participants', p.participants, true)
      tags(w, p)
      sources(w, p.sources, true)
    },
    reminders: (r, w) => {
      project(w, r.projectId, true)
      text(w, 'el título', r.title)
      if (!isValidISODate(r.date)) err(w, `date no es una fecha AAAA-MM-DD («${String(r.date)}»)`)
      clock(w, 'time', r.time)
      if (typeof r.done !== 'boolean') err(w, 'falta done')
      if ((r.targetCollection === undefined) !== (r.targetId === undefined)) err(w, 'targetCollection y targetId van juntos')
      if (r.targetCollection !== undefined && !(COLLECTIONS as string[]).includes(String(r.targetCollection))) err(w, `targetCollection no válido («${String(r.targetCollection)}»)`)
    },
    transactions: (t, w) => {
      project(w, t.projectId, true)
      oneOf(w, 'kind', t.kind, TRANSACTION_KINDS)
      oneOf(w, 'category', t.category, TRANSACTION_CATEGORIES)
      oneOf(w, 'status', t.status, TRANSACTION_STATUSES)
      confidence(w, t)
      text(w, 'la descripción', t.description)
      int(w, 'amount (céntimos)', t.amount)
      int(w, 'originalAmount (céntimos)', t.originalAmount, true)
      if ((t.originalAmount === undefined) !== (t.originalCurrency === undefined)) err(w, 'originalAmount y originalCurrency van juntos')
      if (!isValidISODate(t.date)) err(w, `date no es una fecha AAAA-MM-DD («${String(t.date)}»)`)
      ref(w, 'eventId', t.eventId, 'events')
      tags(w, t)
      sources(w, t.sources, true)
    },
    budgets: (b, w) => {
      project(w, b.projectId, true)
      text(w, 'el nombre', b.name)
      oneOf(w, 'category', b.category, TRANSACTION_CATEGORIES, true)
      int(w, 'amount (céntimos)', b.amount)
      if (!isValidISODate(b.from) || !isValidISODate(b.to)) err(w, 'from y to tienen que ser fechas AAAA-MM-DD')
      else if (String(b.to) < String(b.from)) err(w, 'to es anterior a from')
    },
    metrics: (m, w) => {
      project(w, m.projectId)
      oneOf(w, 'kind', m.kind, METRIC_KINDS)
      oneOf(w, 'platform', m.platform, STORE_PLATFORMS, true)
      confidence(w, m)
      if (typeof m.value !== 'number' || !Number.isFinite(m.value)) err(w, `value no es un número («${String(m.value)}»)`)
      if (!isValidISODate(m.date)) err(w, `date no es una fecha AAAA-MM-DD («${String(m.date)}»)`)
      sources(w, m.sources, true)
      if (!(m.sources as unknown[] | undefined)?.length) err(w, 'una métrica necesita su fuente')
    },
  }
  return by
}

/** Un estado externo «verificado» necesita una fuente comprobable, no solo «anotado a mano». */
function externalFactCheck(k: CollectionKey, e: Row, err: Ctx['err'], where: string) {
  if (!EXTERNAL_FACTS.includes(k) || e.confidence !== 'verified') return
  const list = (e.sources as SourceRef[] | undefined) ?? []
  const checkable = list.some((s) => s.type !== 'manual' || !!s.url || !!s.note)
  if (!checkable) err(where, 'está como verificado, pero su única fuente es «anotado a mano» sin enlace ni nota de dónde sale')
}

function whereOf(k: CollectionKey, e: Row): string {
  const names: Partial<Record<CollectionKey, string>> = {
    projects: 'Proyecto',
    items: 'Elemento',
    builds: 'Build',
    events: 'Evento',
    feedback: 'Feedback',
    resources: 'Recurso',
    checklists: 'Lista',
    activity: 'Actividad',
  }
  return `${names[k] ?? k} ${String(e?.id)}`
}

function idSets(data: StudioData): Record<CollectionKey, Set<string>> {
  return Object.fromEntries(COLLECTIONS.map((k) => [k, new Set(((data[k] as unknown[]) ?? []).map((e) => (e as Row)?.id as string))])) as Record<
    CollectionKey,
    Set<string>
  >
}

export function validateStudioData(raw: unknown): string[] {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return ['No es un objeto JSON.']
  const data = raw as StudioData
  if (typeof data.schemaVersion !== 'number') errors.push('Falta schemaVersion.')
  if (!data.studio || typeof data.studio.name !== 'string') errors.push('Falta el estudio (studio.name).')
  for (const c of COLLECTIONS) if (!Array.isArray(data[c])) errors.push(`Falta la lista «${c}».`)
  if (errors.length) return errors

  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`)

  // ids únicos por colección
  for (const c of COLLECTIONS) {
    const seen = new Set<string>()
    for (const x of data[c] as { id?: unknown }[]) {
      if (typeof x?.id !== 'string' || !x.id) err(c, 'elemento sin id')
      else if (seen.has(x.id)) err(c, `id repetido «${x.id}»`)
      else seen.add(x.id)
    }
  }
  const slugs = new Set<string>()
  for (const p of data.projects) {
    if (slugs.has(p.slug)) err(`Proyecto ${p.id}`, `slug repetido «${p.slug}»`)
    slugs.add(p.slug)
  }

  const ctx: Ctx = { ids: idSets(data), err }
  const by = checks(ctx)
  for (const k of COLLECTIONS)
    for (const e of data[k] as unknown as Row[]) {
      const where = whereOf(k, e)
      by[k](e, where)
      externalFactCheck(k, e, err, where)
    }
  return errors
}

/**
 * Comprueba un solo elemento antes de guardarlo (formularios): las mismas reglas que al
 * cargar, con los ids de los datos actuales.
 */
export function validateEntity(k: CollectionKey, entity: Record<string, unknown>, data: StudioData): string[] {
  const errors: string[] = []
  const err = (_where: string, msg: string) => errors.push(msg)
  const ids = idSets(data)
  ids[k] = new Set([...ids[k], entity.id as string])
  const by = checks({ ids, err })
  by[k](entity, '')
  externalFactCheck(k, entity, err, '')
  if (k === 'projects' && data.projects.some((p) => p.slug === entity.slug && p.id !== entity.id)) errors.push(`el slug «${String(entity.slug)}» ya existe`)
  void COLLECTION_BY_KEY
  return errors
}
