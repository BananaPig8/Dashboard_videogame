// Eventos del sector (ferias, festivales, premios, presentaciones): qué sale en cada
// subsección, las inscripciones, los materiales de cada evento próximo y su seguimiento.
// Las reuniones, entregas y fechas límite son del Calendario, no de aquí.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones.
import { EVENT_SECTION_TYPES, SECTOR_EVENT_TYPES } from '../catalog'
import { addDays } from '../dates'
import type { Build, Cents, EventType, Feedback, ID, ISODate, Playtest, RegistrationStatus, Resource, StudioData, StudioEvent, Transaction } from '../types'
import { checklistProgress, type ChecklistProgress, type Scope } from '../selectors'
import { hasTag } from './etiquetas'

/** Cuántos días antes avisan de una inscripción que cierra la barra, la campana y Eventos. */
export const REGISTRATION_SOON_DAYS = 14

/** Inscripciones abiertas (o por abrir) cuyo plazo cierra entre hoy y dentro de `days` días. */
export function registrationsClosingSoon(data: StudioData, today: ISODate, days = REGISTRATION_SOON_DAYS, scope: Scope = null): StudioEvent[] {
  const until = addDays(today, days)
  return data.events
    .filter((e) => scope === null || !e.projectId || e.projectId === scope)
    .filter(
      (e) =>
        e.status !== 'cancelled' &&
        (e.registrationStatus === 'open' || e.registrationStatus === 'not_open') &&
        !!e.registrationDeadline &&
        e.registrationDeadline >= today &&
        e.registrationDeadline <= until,
    )
    .sort((a, b) => a.registrationDeadline!.localeCompare(b.registrationDeadline!))
}

// ——— Qué eventos salen ————————————————————————————————————————————————————————

/** Subsecciones de la faceta «tipo» (null = todos los del sector). */
export type EventoTipo = keyof typeof EVENT_SECTION_TYPES & ('ferias' | 'festivales' | 'premios' | 'presentaciones')

/** El valor de ?tipo= si es una subsección; si no, null (todos). */
export function eventoTipoOf(value: string | null): EventoTipo | null {
  return value && value in EVENT_SECTION_TYPES ? (value as EventoTipo) : null
}

/** Los tipos de evento de una subsección (null = todos los del sector). */
export function eventoTypes(tipo: EventoTipo | null): EventType[] {
  return tipo ? EVENT_SECTION_TYPES[tipo] : SECTOR_EVENT_TYPES
}

/** El tipo con el que se crea un evento desde cada subsección. */
export function eventoDefaultType(tipo: EventoTipo | null): EventType {
  return tipo ? EVENT_SECTION_TYPES[tipo][0] : 'fair'
}

/** Los eventos de todo el estudio (sin proyecto) salen también en cada proyecto. */
export const eventoInScope = (scope: Scope) => (e: { projectId?: ID }) => scope === null || !e.projectId || e.projectId === scope

export interface EventoQuery {
  scope?: Scope
  tipo?: EventoTipo | null
  tag?: string | null
}

/** Los eventos del sector de una subsección, en el ámbito y con la etiqueta (sin ordenar). */
export function sectorEvents(data: StudioData, q: EventoQuery = {}): StudioEvent[] {
  const types = eventoTypes(q.tipo ?? null)
  return data.events.filter((e) => types.includes(e.type) && eventoInScope(q.scope ?? null)(e) && hasTag(e, q.tag ?? null))
}

/** El último día del evento (o su único día). */
export const eventoEnd = (e: StudioEvent): ISODate | undefined => e.endDate ?? e.date

/** ¿Ya pasó? (tiene fecha y su último día es anterior a hoy). */
export const eventoIsPast = (e: StudioEvent, today: ISODate): boolean => !!e.date && eventoEnd(e)! < today

/** Ya pasó, pero sigue como previsto o confirmado: ¿se celebró? */
export const eventoIsStale = (e: StudioEvent, today: ISODate): boolean =>
  eventoIsPast(e, today) && (e.status === 'idea' || e.status === 'planned' || e.status === 'confirmed')

/** Aún por delante: ni celebrado, ni cancelado, ni pasado (los que no tienen fecha cuentan). */
export const eventoIsAhead = (e: StudioEvent, today: ISODate): boolean => e.status !== 'done' && e.status !== 'cancelled' && !eventoIsPast(e, today)

/** Por fecha, del más cercano al más lejano; los que no tienen fecha, al final. */
export function compareEventos(a: StudioEvent, b: StudioEvent): number {
  if (!!a.date !== !!b.date) return a.date ? -1 : 1
  return (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'es')
}

export interface EventosAgenda {
  /** Por delante y con fecha, del más cercano al más lejano. */
  upcoming: StudioEvent[]
  /** Por delante y sin fecha. */
  undated: StudioEvent[]
  /** Pasados o celebrados, del más reciente al más antiguo. */
  past: StudioEvent[]
  cancelled: StudioEvent[]
}

export function eventosAgenda(events: StudioEvent[], today: ISODate): EventosAgenda {
  const out: EventosAgenda = { upcoming: [], undated: [], past: [], cancelled: [] }
  for (const e of [...events].sort(compareEventos)) {
    if (e.status === 'cancelled') out.cancelled.push(e)
    else if (e.status === 'done' || eventoIsPast(e, today)) out.past.push(e)
    else if (!e.date) out.undated.push(e)
    else out.upcoming.push(e)
  }
  out.past.reverse()
  return out
}

// ——— Inscripciones —————————————————————————————————————————————————————————

export type RegistrationGroup = 'soon' | 'overdue' | 'open' | 'submitted' | 'decided' | 'missing' | 'notNeeded'

/** En qué orden se enseñan los grupos: lo que cierra pronto, primero. */
export const REGISTRATION_GROUPS: RegistrationGroup[] = ['soon', 'overdue', 'open', 'submitted', 'decided', 'missing', 'notNeeded']

const pendingRegistration = (s: RegistrationStatus | undefined) => s === 'open' || s === 'not_open'

/**
 * Las inscripciones de los eventos que aún están por delante, por grupos: las que cierran
 * en los próximos `soonDays` días (registrationsClosingSoon), las que tenían el plazo y no
 * consta que se enviaran, las abiertas o por abrir, las enviadas, las resueltas, los
 * eventos sin datos de inscripción y los que no la necesitan.
 */
export function eventoRegistrations(data: StudioData, today: ISODate, q: EventoQuery = {}, soonDays = 14): Record<RegistrationGroup, StudioEvent[]> {
  const base = sectorEvents(data, q).filter((e) => eventoIsAhead(e, today))
  const ids = new Set(base.map((e) => e.id))
  const soon = registrationsClosingSoon(data, today, soonDays, q.scope ?? null).filter((e) => ids.has(e.id))
  const soonIds = new Set(soon.map((e) => e.id))
  const byDeadline = (a: StudioEvent, b: StudioEvent) =>
    (a.registrationDeadline ?? '9999').localeCompare(b.registrationDeadline ?? '9999') || compareEventos(a, b)
  const rest = base.filter((e) => !soonIds.has(e.id)).sort(byDeadline)
  return {
    soon,
    overdue: rest.filter((e) => pendingRegistration(e.registrationStatus) && !!e.registrationDeadline && e.registrationDeadline < today),
    open: rest.filter((e) => pendingRegistration(e.registrationStatus) && !(e.registrationDeadline && e.registrationDeadline < today)),
    submitted: rest.filter((e) => e.registrationStatus === 'submitted'),
    decided: rest.filter((e) => e.registrationStatus === 'accepted' || e.registrationStatus === 'rejected'),
    missing: rest.filter((e) => !e.registrationStatus),
    notNeeded: rest.filter((e) => e.registrationStatus === 'not_needed'),
  }
}

// ——— Materiales de cada evento próximo ———————————————————————————————————————

/** Lo que le falta a un evento próximo para ir preparado (sin inventar exigencias: lo apuntado o no). */
export type EventoMissing = 'checklist' | 'steps' | 'build' | 'resources'

export interface EventoMaterials {
  event: StudioEvent
  checklists: ChecklistProgress[]
  builds: Build[]
  resources: Resource[]
  /** Pasos sin hacer de todas sus listas. */
  pendingSteps: number
  missing: EventoMissing[]
}

export function eventoMaterials(data: StudioData, event: StudioEvent): EventoMaterials {
  const checklists = data.checklists.filter((c) => c.eventId === event.id).map((c) => checklistProgress(c))
  const builds = data.builds
    .filter((b) => b.eventId === event.id)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.name.localeCompare(b.name, 'es'))
  const resources = data.resources.filter((r) => r.eventId === event.id).sort((a, b) => a.title.localeCompare(b.title, 'es'))
  const pendingSteps = checklists.reduce((n, c) => n + c.total - c.done, 0)
  const missing: EventoMissing[] = []
  if (!checklists.length) missing.push('checklist')
  if (pendingSteps > 0) missing.push('steps')
  if (!builds.length) missing.push('build')
  if (!resources.length) missing.push('resources')
  return { event, checklists, builds, resources, pendingSteps, missing }
}

/** Los materiales de cada evento que está por delante (los que no tienen fecha, al final). */
export function upcomingEventoMaterials(data: StudioData, today: ISODate, q: EventoQuery = {}): EventoMaterials[] {
  return sectorEvents(data, q)
    .filter((e) => eventoIsAhead(e, today))
    .sort(compareEventos)
    .map((e) => eventoMaterials(data, e))
}

// ——— Seguimiento de los eventos pasados ————————————————————————————————————————

export interface EventoFollowUp {
  event: StudioEvent
  /** Pasado y sigue como previsto: ¿se celebró? */
  stale: boolean
  /** El feedback del evento: el que dice venir de él y el de sus pruebas. */
  feedback: Feedback[]
  playtests: Playtest[]
  /** Gastos e ingresos apuntados al evento (Finanzas). */
  transactions: Transaction[]
  /** Gastado (hecho). */
  spent: Cents
  /** Gastos previstos o pendientes de pagar. */
  plannedSpend: Cents
  /** Ingresos hechos (un premio, por ejemplo). */
  income: Cents
}

export function eventoFollowUp(data: StudioData, event: StudioEvent, today: ISODate): EventoFollowUp {
  const playtests = data.playtests.filter((p) => p.eventId === event.id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const testIds = new Set(playtests.map((p) => p.id))
  const feedback = data.feedback
    .filter((f) => f.eventId === event.id || (!!f.playtestId && testIds.has(f.playtestId)))
    .sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? '') || a.title.localeCompare(b.title, 'es'))
  const transactions = data.transactions.filter((t) => t.eventId === event.id && t.status !== 'cancelled').sort((a, b) => b.date.localeCompare(a.date))
  let spent = 0
  let plannedSpend = 0
  let income = 0
  for (const t of transactions) {
    if (t.kind === 'expense' && t.status === 'done') spent += t.amount
    else if (t.kind === 'expense') plannedSpend += t.amount
    else if (t.status === 'done') income += t.amount
  }
  return { event, stale: eventoIsStale(event, today), feedback, playtests, transactions, spent, plannedSpend, income }
}

/** Cuánto feedback hay de un evento: el que dice venir de él y el de sus pruebas. */
export function eventoFeedbackCount(data: StudioData, event: StudioEvent): number {
  const tests = new Set(data.playtests.filter((p) => p.eventId === event.id).map((p) => p.id))
  return data.feedback.filter((f) => f.eventId === event.id || (!!f.playtestId && tests.has(f.playtestId))).length
}

/** El seguimiento de los eventos pasados o celebrados (no los cancelados), del más reciente al más antiguo. */
export function eventoFollowUps(data: StudioData, today: ISODate, q: EventoQuery = {}): EventoFollowUp[] {
  return eventosAgenda(sectorEvents(data, q), today).past.map((e) => eventoFollowUp(data, e, today))
}
