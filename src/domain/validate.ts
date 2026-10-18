// Comprueba que unos datos tienen sentido antes de usarlos: al importar un JSON, al
// cargar lo guardado y en las pruebas de los datos iniciales. Devuelve los problemas en
// castellano en vez de lanzar, para poder enseñarlos.
import {
  BUILD_CHANNELS,
  BUILD_STATUSES,
  CONFIDENCES,
  EVENT_STATUSES,
  EVENT_TYPES,
  FEEDBACK_ORIGINS,
  FEEDBACK_STATUSES,
  KINDS,
  PRIORITIES,
  RESOURCE_TYPES,
  SOURCE_TYPES,
  STAGES,
  STATUSES,
  CHECKLIST_TARGETS,
} from './catalog'
import { isValidISODate, isValidISODateTime } from './dates'
import type { SourceRef, StudioData } from './types'

const COLLECTIONS = ['areas', 'projects', 'items', 'builds', 'events', 'feedback', 'resources', 'checklists', 'activity'] as const

export function validateStudioData(raw: unknown): string[] {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return ['No es un objeto JSON.']
  const data = raw as StudioData
  if (typeof data.schemaVersion !== 'number') errors.push('Falta schemaVersion.')
  if (!data.studio || typeof data.studio.name !== 'string') errors.push('Falta el estudio (studio.name).')
  for (const c of COLLECTIONS) if (!Array.isArray(data[c])) errors.push(`Falta la lista «${c}».`)
  if (errors.length) return errors

  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`)
  const oneOf = (where: string, field: string, value: unknown, table: object, optional = false) => {
    if (optional && value === undefined) return
    if (typeof value !== 'string' || !(value in table)) err(where, `${field} no válido («${String(value)}»)`)
  }
  const date = (where: string, field: string, value: unknown) => {
    if (value !== undefined && !isValidISODate(value)) err(where, `${field} no es una fecha AAAA-MM-DD («${String(value)}»)`)
  }
  const sources = (where: string, list: SourceRef[] | undefined, required: boolean) => {
    if (list === undefined) {
      if (required) err(where, 'faltan sources')
      return
    }
    if (!Array.isArray(list)) return err(where, 'sources no es una lista')
    list.forEach((s, k) => {
      oneOf(`${where} fuente ${k + 1}`, 'type', s?.type, SOURCE_TYPES)
      if (typeof s?.ref !== 'string' || !s.ref) err(`${where} fuente ${k + 1}`, 'falta ref')
      date(`${where} fuente ${k + 1}`, 'date', s?.date)
    })
  }

  // ids únicos por colección
  for (const c of COLLECTIONS) {
    const seen = new Set<string>()
    for (const x of data[c] as { id?: unknown }[]) {
      if (typeof x?.id !== 'string' || !x.id) err(c, 'elemento sin id')
      else if (seen.has(x.id)) err(c, `id repetido «${x.id}»`)
      else seen.add(x.id)
    }
  }

  const projectIds = new Set(data.projects.map((p) => p.id))
  const areaIds = new Set(data.areas.map((a) => a.id))
  const itemIds = new Set(data.items.map((i) => i.id))
  const project = (where: string, id: unknown, optional = false) => {
    if (optional && id === undefined) return
    if (typeof id !== 'string' || !projectIds.has(id)) err(where, `projectId desconocido («${String(id)}»)`)
  }

  const slugs = new Set<string>()
  for (const p of data.projects) {
    const w = `Proyecto ${p.id}`
    if (!p.name) err(w, 'falta el nombre')
    if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) err(w, `slug no válido («${p.slug}»)`)
    else if (slugs.has(p.slug)) err(w, `slug repetido «${p.slug}»`)
    else slugs.add(p.slug)
    oneOf(w, 'stage', p.stage, STAGES)
    date(w, 'startedAt', p.startedAt)
    if (!Array.isArray(p.platforms) || !Array.isArray(p.versions) || !Array.isArray(p.tags) || !Array.isArray(p.links))
      err(w, 'platforms, versions, tags y links tienen que ser listas')
  }

  for (const i of data.items) {
    const w = `Elemento ${i.id}`
    project(w, i.projectId)
    if (!i.title) err(w, 'falta el título')
    oneOf(w, 'kind', i.kind, KINDS)
    oneOf(w, 'status', i.status, STATUSES)
    oneOf(w, 'priority', i.priority, PRIORITIES)
    oneOf(w, 'confidence', i.confidence, CONFIDENCES)
    if (i.areaId !== undefined && !areaIds.has(i.areaId)) err(w, `área desconocida («${i.areaId}»)`)
    for (const f of ['createdAt', 'startedAt', 'completedAt', 'dueDate', 'focusDate'] as const) date(w, f, i[f])
    if (i.startedAt && i.completedAt && i.startedAt > i.completedAt) err(w, 'startedAt es posterior a completedAt')
    if (i.status === 'done' && !i.completedAt) err(w, 'está hecho pero no tiene completedAt')
    if (i.status !== 'done' && i.status !== 'cancelled' && i.completedAt) err(w, 'tiene completedAt pero no está hecho')
    if (i.parentId !== undefined && !itemIds.has(i.parentId)) err(w, `parentId desconocido («${i.parentId}»)`)
    if (!Array.isArray(i.tags)) err(w, 'tags no es una lista')
    sources(w, i.sources, true)
    // Lo anotado a mano por el estudio cuenta como fuente: el estudio es quien lo sabe.
    if (i.confidence === 'verified' && !i.sources?.length) err(w, 'está como verificado pero no tiene ninguna fuente')
  }

  for (const b of data.builds) {
    const w = `Build ${b.id}`
    project(w, b.projectId)
    oneOf(w, 'channel', b.channel, BUILD_CHANNELS)
    oneOf(w, 'status', b.status, BUILD_STATUSES)
    oneOf(w, 'confidence', b.confidence, CONFIDENCES)
    date(w, 'date', b.date)
    sources(w, b.sources, true)
  }

  for (const e of data.events) {
    const w = `Evento ${e.id}`
    project(w, e.projectId, true)
    oneOf(w, 'type', e.type, EVENT_TYPES)
    oneOf(w, 'status', e.status, EVENT_STATUSES)
    oneOf(w, 'confidence', e.confidence, CONFIDENCES)
    date(w, 'date', e.date)
    date(w, 'endDate', e.endDate)
    if (typeof e.dateConfirmed !== 'boolean') err(w, 'falta dateConfirmed')
    if (e.dateConfirmed && !e.date) err(w, 'tiene la fecha confirmada pero no tiene fecha')
    sources(w, e.sources, true)
  }

  for (const f of data.feedback) {
    const w = `Feedback ${f.id}`
    project(w, f.projectId)
    oneOf(w, 'origin', f.origin, FEEDBACK_ORIGINS)
    oneOf(w, 'status', f.status, FEEDBACK_STATUSES)
    oneOf(w, 'impact', f.impact, PRIORITIES)
    oneOf(w, 'confidence', f.confidence, CONFIDENCES)
    date(w, 'receivedAt', f.receivedAt)
    for (const id of f.linkedItemIds ?? []) if (!itemIds.has(id)) err(w, `enlaza un elemento que no existe («${id}»)`)
    sources(w, f.sources, true)
  }

  for (const r of data.resources) {
    const w = `Recurso ${r.id}`
    project(w, r.projectId, true)
    oneOf(w, 'type', r.type, RESOURCE_TYPES)
    if (!r.url && !r.path) err(w, 'necesita url o path')
  }

  for (const c of data.checklists) {
    const w = `Lista ${c.id}`
    project(w, c.projectId)
    oneOf(w, 'target', c.target, CHECKLIST_TARGETS)
    const seen = new Set<string>()
    for (const it of c.items ?? []) {
      if (!it.id || seen.has(it.id)) err(w, `paso sin id o repetido («${it.id}»)`)
      seen.add(it.id)
      if (typeof it.done !== 'boolean') err(w, `el paso «${it.id}» no dice si está hecho`)
      sources(`${w} paso ${it.id}`, it.sources, false)
    }
  }

  for (const a of data.activity) {
    const w = `Actividad ${a.id}`
    project(w, a.projectId)
    if (!isValidISODateTime(a.at)) err(w, `at no es AAAA-MM-DDTHH:mm («${a.at}»)`)
    if (a.areaId !== undefined && !areaIds.has(a.areaId)) err(w, `área desconocida («${a.areaId}»)`)
  }

  return errors
}
