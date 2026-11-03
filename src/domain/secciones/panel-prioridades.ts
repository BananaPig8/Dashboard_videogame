// Cálculos del Dashboard: prioridades, el calendario resumido y qué avisos se quedan en
// «Necesita atención». Se reexportan desde panel.ts (y este, desde selectors.ts).
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { LISTING_KINDS, STORE_PLATFORMS, TASK_KINDS } from '../catalog'
import { addDays, daysBetween, startOfWeek, type WeekStart } from '../dates'
import type { EventType, ID, ISODate, ListingKind, Priority, ReleaseKind, StudioData, WorkItem } from '../types'
import type { CalendarEntry } from './calendario'
import {
  isOpen,
  panelAlerts,
  registrationsClosingSoon,
  releaseLabel,
  upcomingEntries,
  type NotificationKind,
  type Scope,
  type StudioNotification,
} from '../selectors'

// ——— Prioridades ———————————————————————————————————————————————————————————

/** «Vence pronto»: de hoy a dentro de estos días (hoy incluido). */
export const PRIORITY_SOON_DAYS = 3

/** Hitos en riesgo, entregas, inscripciones y eventos: lo que cae de hoy a dentro de estos días. */
export const PRIORITY_HORIZON_DAYS = 14

/** Filas que enseña el bloque fuera del modo foco (el resto, con «Ver todas»). */
export const PRIORITY_LIMIT = 8

/**
 * Por qué sale una fila. Una cosa sale una sola vez, con todas las que cumple:
 * - overdue / dueToday / dueSoon: su fecha límite ya pasó, es hoy o llega en ≤ 3 días.
 * - critical: prioridad crítica. focus: marcada para hoy (focusDate).
 * - blocked: bloqueada (con su motivo). issue: incidencia bloqueada o crítica.
 * - blocking: hay cosas abiertas que dependen de ella. waiting: depende de cosas abiertas.
 * - milestoneRisk: hito en riesgo (ver `milestoneRisk`).
 * - release: versión que sale en ≤ 14 días. registration: inscripción que cierra en ≤ 14 días.
 * - eventSteps: evento en ≤ 14 días con pasos sin hacer. listingChanges: la tienda pide cambios.
 */
export type PriorityFlag =
  | { kind: 'overdue'; date: ISODate; days: number }
  | { kind: 'dueToday'; date: ISODate }
  | { kind: 'dueSoon'; date: ISODate; days: number }
  | { kind: 'critical' }
  | { kind: 'focus' }
  | { kind: 'blocked' }
  | { kind: 'issue' }
  | { kind: 'blocking'; n: number }
  | { kind: 'waiting'; n: number }
  | { kind: 'milestoneRisk'; late: boolean; stuck: number; open: number; total: number }
  | { kind: 'release'; date: ISODate; days: number; confirmed: boolean }
  | { kind: 'registration'; date: ISODate; days: number; confirmed: boolean }
  | { kind: 'eventSteps'; date: ISODate; days: number; missing: number; total: number; confirmed: boolean }
  | { kind: 'listingChanges' }

export type PriorityFlagKind = PriorityFlag['kind']

/** Lo que se puede abrir desde una fila. */
export type PriorityTarget = { collection: 'items' | 'events' | 'releases' | 'storeListings'; id: ID }

/** Los puntos de una fila, por partes (ver `priorityPoints`). */
export interface PriorityPoints {
  impact: number
  deadline: number
  urgency: number
  dependencies: number
}

export interface PriorityRow {
  /** Estable: «colección:id». */
  id: string
  target: PriorityTarget
  title: string
  projectId?: ID
  /** El elemento de trabajo, si la fila es uno (tarea, hito, incidencia…): con él se actúa desde el panel. */
  item?: WorkItem
  /** La fecha que manda: la límite, la prevista o el cierre de la inscripción (la más próxima). */
  date?: ISODate
  /** false si esa fecha es prevista y nadie la ha confirmado. */
  confirmed: boolean
  flags: PriorityFlag[]
  /** Lo abierto de lo que depende y que aún no está hecho. */
  waitingOn: WorkItem[]
  /** Lo abierto que depende de esto. */
  blocking: WorkItem[]
  points: PriorityPoints
  score: number
}

/** Impacto de un elemento de trabajo: su prioridad. */
const ITEM_IMPACT: Record<Priority, number> = { critical: 40, high: 30, medium: 20, low: 10 }
/** Impacto de una versión: un lanzamiento pesa como lo crítico; una demo, un DLC o una expansión, como lo alto. */
const RELEASE_IMPACT: Record<ReleaseKind, number> = { launch: 40, demo: 30, dlc: 30, expansion: 30, update: 20, patch: 20 }
/** Impacto de una ficha de tienda: la del juego, como lo crítico. */
const LISTING_IMPACT: Record<ListingKind, number> = { game: 40, demo: 30, dlc: 30, playtest: 20 }
/** Impacto de un evento: ferias, festivales, premios, presentaciones y entregas, como lo alto; reuniones y el resto, como lo medio. */
const eventImpact = (type: EventType) => (type === 'meeting' || type === 'other' ? 20 : 30)

/**
 * Puntos por la fecha que manda la fila (`days` = días de hoy a esa fecha):
 * - ya pasó: 30 + 1 por día de retraso (como mucho, +10);
 * - de hoy a 3 días: 24 − 4 × días (hoy 24, mañana 20, en 2 días 16, en 3 días 12);
 * - de 4 a 14 días: 14 − días (de 10 a 0);
 * - más adelante o sin fecha: 0.
 */
export function priorityDeadlinePoints(days: number | undefined): number {
  if (days === undefined) return 0
  if (days < 0) return 30 + Math.min(-days, 10)
  if (days <= PRIORITY_SOON_DAYS) return 24 - 4 * days
  if (days <= PRIORITY_HORIZON_DAYS) return PRIORITY_HORIZON_DAYS - days
  return 0
}

/**
 * La fórmula del orden, en puntos (más puntos, más arriba):
 *
 *   puntos = impacto + plazo + urgencia + dependencias
 *
 * - impacto: la prioridad de un elemento de trabajo (crítica 40, alta 30, media 20, baja 10);
 *   la importancia de una versión (lanzamiento 40; demo, DLC o expansión 30; actualización o
 *   parche 20), de un evento (feria, festival, premio, presentación o entrega 30; reunión u
 *   otro 20) o de una ficha de tienda (juego 40; demo o DLC 30; prueba 20).
 * - plazo: `priorityDeadlinePoints` de la fecha que manda.
 * - urgencia: bloqueada +15, hito en riesgo +15, la tienda pide cambios +15, incidencia
 *   bloqueante +10, marcada para hoy +10, inscripción por cerrar +10, pasos sin hacer de un
 *   evento +1 por paso (como mucho, +10).
 * - dependencias: +6 por cada cosa abierta que espera a esta (como mucho, +30); −10 si espera
 *   a otras que siguen abiertas (hasta que acaben, no se puede hacer).
 *
 * Empate: primero la fecha más próxima (sin fecha, al final) y después el título.
 */
export function priorityPoints(impact: number, flags: readonly PriorityFlag[], days: number | undefined): PriorityPoints {
  let urgency = 0
  let dependencies = 0
  for (const f of flags) {
    switch (f.kind) {
      case 'blocked':
      case 'milestoneRisk':
      case 'listingChanges':
        urgency += 15
        break
      case 'issue':
      case 'focus':
      case 'registration':
        urgency += 10
        break
      case 'eventSteps':
        urgency += Math.min(f.missing, 10)
        break
      case 'blocking':
        dependencies += Math.min(6 * f.n, 30)
        break
      case 'waiting':
        dependencies -= 10
        break
    }
  }
  return { impact, deadline: priorityDeadlinePoints(days), urgency, dependencies }
}

const sumPoints = (p: PriorityPoints) => p.impact + p.deadline + p.urgency + p.dependencies

/** Orden del bloque: puntos, luego la fecha más próxima (sin fecha, al final) y luego el título. */
export function comparePriorityRows(a: PriorityRow, b: PriorityRow): number {
  return b.score - a.score || (a.date ?? '9999-12-31').localeCompare(b.date ?? '9999-12-31') || a.title.localeCompare(b.title, 'es')
}

/** Todo lo que cuelga de un elemento (sus hijos, los hijos de sus hijos…), sin lo cancelado. */
function descendants(data: StudioData, rootId: ID): WorkItem[] {
  const children = new Map<ID, WorkItem[]>()
  for (const i of data.items) if (i.parentId) children.set(i.parentId, [...(children.get(i.parentId) ?? []), i])
  const out: WorkItem[] = []
  const seen = new Set<ID>([rootId])
  const stack = [...(children.get(rootId) ?? [])]
  while (stack.length) {
    const i = stack.pop()!
    if (seen.has(i.id)) continue
    seen.add(i.id)
    if (i.status !== 'cancelled') out.push(i)
    stack.push(...(children.get(i.id) ?? []))
  }
  return out
}

/**
 * ¿Está en riesgo un hito? Un hito abierto lo está si:
 * - ya pasó su fecha límite, o
 * - vence en 14 días o menos y lo que cuelga de él (parentId, a cualquier profundidad, sin
 *   lo cancelado) tiene algo bloqueado o vencido, o más de la mitad sin hacer.
 * Sin fecha límite no se puede decir (sale en el Calendario como «sin fecha»).
 */
export function milestoneRisk(
  data: StudioData,
  m: WorkItem,
  today: ISODate,
): Extract<PriorityFlag, { kind: 'milestoneRisk' }> | null {
  if (m.kind !== 'milestone' || !isOpen(m) || !m.dueDate) return null
  const days = daysBetween(today, m.dueDate)
  const below = descendants(data, m.id)
  const open = below.filter(isOpen)
  const stuck = open.filter((i) => i.status === 'blocked' || (!!i.dueDate && i.dueDate < today)).length
  const late = days < 0
  const behind = below.length > 0 && open.length / below.length > 0.5
  if (!late && !(days <= PRIORITY_HORIZON_DAYS && (stuck > 0 || behind))) return null
  return { kind: 'milestoneRisk', late, stuck, open: open.length, total: below.length }
}

/**
 * El panel de prioridades: lo que hay que mirar hoy, una fila por cosa y de más a menos puntos
 * (`priorityPoints`). Junta:
 * - de los elementos de trabajo abiertos (nunca lo terminado ni lo cancelado; los objetivos
 *   no cuentan): lo crítico, lo vencido, lo que vence de hoy a 3 días, lo marcado para hoy, lo
 *   bloqueado, las incidencias bloqueadas o críticas, lo que impide seguir a otras cosas
 *   abiertas («Bloquea a 3»), lo que espera a otras que siguen abiertas y los hitos en riesgo;
 * - las versiones que salen en los próximos 14 días y no han salido;
 * - las inscripciones que cierran en 14 días (`registrationsClosingSoon`) y los eventos de los
 *   próximos 14 días con pasos sin hacer en sus listas (checklist.eventId);
 * - las fichas de tienda a las que la tienda ha pedido cambios.
 * En un proyecto, lo suyo y los eventos de todo el estudio (como en el Calendario).
 */
export function dashboardPriorities(data: StudioData, today: ISODate, scope: Scope = null): PriorityRow[] {
  const own = (x: { projectId?: ID }) => scope === null || x.projectId === scope
  const rows: PriorityRow[] = []
  const add = (row: Omit<PriorityRow, 'points' | 'score'>, impact: number) => {
    const points = priorityPoints(impact, row.flags, row.date ? daysBetween(today, row.date) : undefined)
    rows.push({ ...row, points, score: sumPoints(points) })
  }

  // Elementos de trabajo.
  const byId = new Map(data.items.map((i) => [i.id, i]))
  const dependents = new Map<ID, WorkItem[]>()
  for (const i of data.items) {
    if (!isOpen(i)) continue
    for (const d of new Set(i.dependsOnIds ?? [])) dependents.set(d, [...(dependents.get(d) ?? []), i])
  }
  for (const item of data.items) {
    if (!own(item) || !TASK_KINDS.includes(item.kind) || !isOpen(item)) continue
    const flags: PriorityFlag[] = []
    if (item.dueDate) {
      const days = daysBetween(today, item.dueDate)
      if (days < 0) flags.push({ kind: 'overdue', date: item.dueDate, days: -days })
      else if (days === 0) flags.push({ kind: 'dueToday', date: item.dueDate })
      else if (days <= PRIORITY_SOON_DAYS) flags.push({ kind: 'dueSoon', date: item.dueDate, days })
    }
    const risk = milestoneRisk(data, item, today)
    if (risk) flags.push(risk)
    if (item.priority === 'critical') flags.push({ kind: 'critical' })
    if (item.status === 'blocked') flags.push({ kind: 'blocked' })
    if (item.kind === 'issue' && (item.status === 'blocked' || item.priority === 'critical')) flags.push({ kind: 'issue' })
    const blocking = (dependents.get(item.id) ?? []).filter((d) => d.id !== item.id)
    if (blocking.length) flags.push({ kind: 'blocking', n: blocking.length })
    const waitingOn = [...new Set(item.dependsOnIds ?? [])]
      .map((id) => byId.get(id))
      .filter((d): d is WorkItem => !!d && d.id !== item.id && isOpen(d))
    if (waitingOn.length) flags.push({ kind: 'waiting', n: waitingOn.length })
    if (item.focusDate === today) flags.push({ kind: 'focus' })
    if (!flags.length) continue
    add(
      {
        id: `items:${item.id}`,
        target: { collection: 'items', id: item.id },
        title: item.title,
        projectId: item.projectId,
        item,
        date: item.dueDate,
        confirmed: true,
        flags,
        waitingOn,
        blocking,
      },
      ITEM_IMPACT[item.priority],
    )
  }

  // Versiones que salen pronto.
  for (const r of data.releases) {
    if (!own(r) || r.releasedAt || !r.targetDate || r.status === 'released' || r.status === 'cancelled') continue
    const days = daysBetween(today, r.targetDate)
    if (days < 0 || days > PRIORITY_HORIZON_DAYS) continue
    add(
      {
        id: `releases:${r.id}`,
        target: { collection: 'releases', id: r.id },
        title: releaseLabel(r),
        projectId: r.projectId,
        date: r.targetDate,
        confirmed: !!r.targetConfirmed,
        flags: [{ kind: 'release', date: r.targetDate, days, confirmed: !!r.targetConfirmed }],
        waitingOn: [],
        blocking: [],
      },
      RELEASE_IMPACT[r.kind] ?? 20,
    )
  }

  // Eventos: la inscripción que cierra y los pasos que faltan (una fila por evento).
  const until = addDays(today, PRIORITY_HORIZON_DAYS)
  const closing = new Set(registrationsClosingSoon(data, today, PRIORITY_HORIZON_DAYS, scope).map((e) => e.id))
  for (const e of data.events) {
    if (scope !== null && e.projectId && e.projectId !== scope) continue
    if (e.status === 'cancelled') continue
    const flags: PriorityFlag[] = []
    if (closing.has(e.id)) {
      const date = e.registrationDeadline!
      flags.push({ kind: 'registration', date, days: daysBetween(today, date), confirmed: !!e.registrationDeadlineConfirmed })
    }
    if (e.date && e.status !== 'done' && (e.endDate ?? e.date) >= today && e.date <= until) {
      const lists = data.checklists.filter((c) => c.eventId === e.id && own(c))
      const total = lists.reduce((n, c) => n + c.items.length, 0)
      const missing = lists.reduce((n, c) => n + c.items.filter((s) => !s.done).length, 0)
      if (missing > 0) flags.push({ kind: 'eventSteps', date: e.date, days: Math.max(0, daysBetween(today, e.date)), missing, total, confirmed: e.dateConfirmed })
    }
    if (!flags.length) continue
    // Manda la fecha más próxima de las dos (lo primero que hay que tener hecho).
    const dated = flags.filter((f): f is Extract<PriorityFlag, { date: ISODate; confirmed: boolean }> => 'date' in f && 'confirmed' in f)
    const first = dated.reduce((a, b) => (b.date < a.date ? b : a))
    add(
      {
        id: `events:${e.id}`,
        target: { collection: 'events', id: e.id },
        title: e.title,
        projectId: e.projectId,
        date: first.date < today ? today : first.date,
        confirmed: first.confirmed,
        flags,
        waitingOn: [],
        blocking: [],
      },
      eventImpact(e.type),
    )
  }

  // Fichas de tienda con cambios pedidos.
  for (const l of data.storeListings) {
    if (!own(l) || l.status !== 'changes_requested') continue
    add(
      {
        id: `storeListings:${l.id}`,
        target: { collection: 'storeListings', id: l.id },
        title: `${STORE_PLATFORMS[l.platform]} · ${LISTING_KINDS[l.kind]}`,
        projectId: l.projectId,
        confirmed: true,
        flags: [{ kind: 'listingChanges' }],
        waitingOn: [],
        blocking: [],
      },
      LISTING_IMPACT[l.kind] ?? 30,
    )
  }

  return rows.sort(comparePriorityRows)
}

/** ¿Hay algo abierto en este ámbito de lo que el bloque podría avisar? (para no decir «Nada urgente» sin datos). */
export function priorityHasData(data: StudioData, scope: Scope = null): boolean {
  const own = (x: { projectId?: ID }) => scope === null || x.projectId === scope
  return (
    data.items.some((i) => own(i) && TASK_KINDS.includes(i.kind) && isOpen(i)) ||
    data.releases.some((r) => own(r) && r.status !== 'released' && r.status !== 'cancelled' && !r.releasedAt) ||
    data.events.some((e) => (scope === null || !e.projectId || e.projectId === scope) && e.status !== 'cancelled' && e.status !== 'done') ||
    data.storeListings.some(own)
  )
}

// ——— Calendario resumido (Próximas fechas) ——————————————————————————————————

/** Días que pinta la cuadrícula del calendario resumido (de hoy en adelante, hoy incluido). */
export const AGENDA_GRID_DAYS = 14

/** Una fecha de «Próximas fechas»: la del calendario, y si es la de un hito (que no es una tarea más). */
export interface AgendaEntry extends CalendarEntry {
  milestone?: boolean
}

/**
 * Lo que queda por delante (`upcomingEntries`: de hoy a dentro de `days` días, sin lo hecho):
 * fechas límite de tareas e hitos, eventos, entregas, reuniones, inscripciones, versiones y
 * recordatorios. Las builds ya hechas no salen (son algo que pasó, no algo por llegar).
 */
export function panelAgenda(data: StudioData, today: ISODate, days: number, scope: Scope = null): AgendaEntry[] {
  const milestones = new Set(data.items.filter((i) => i.kind === 'milestone').map((i) => i.id))
  return upcomingEntries(data, today, days, scope).map((e) =>
    e.target.collection === 'items' && milestones.has(e.target.id) ? { ...e, milestone: true } : e,
  )
}

/**
 * Las fechas agrupadas por día, en orden. Lo que empezó antes de hoy y sigue (un evento de
 * varios días) va en el día de hoy.
 */
export function agendaByDay<T extends CalendarEntry>(entries: readonly T[], today: ISODate): { date: ISODate; entries: T[] }[] {
  const groups: { date: ISODate; entries: T[] }[] = []
  for (const e of entries) {
    const date = e.date < today ? today : e.date
    const last = groups[groups.length - 1]
    if (last?.date === date) last.entries.push(e)
    else {
      const found = groups.find((g) => g.date === date)
      if (found) found.entries.push(e)
      else groups.push({ date, entries: [e] })
    }
  }
  return groups.sort((a, b) => a.date.localeCompare(b.date))
}

export interface AgendaCell<T extends CalendarEntry = AgendaEntry> {
  date: ISODate
  /** Está entre hoy y el último día de la cuadrícula (los demás se pintan apagados). */
  inRange: boolean
  /** Lo de ese día (un evento de varios días sale en cada uno). */
  entries: T[]
}

/**
 * La cuadrícula del calendario resumido: semanas completas (empiezan en `weekStart`) que
 * cubren de hoy a hoy + `days` − 1. Los días de antes de hoy y de después, fuera de rango.
 */
export function agendaGrid<T extends CalendarEntry>(entries: readonly T[], today: ISODate, weekStart: WeekStart = 1, days = AGENDA_GRID_DAYS): AgendaCell<T>[][] {
  const last = addDays(today, days - 1)
  const weeks: AgendaCell<T>[][] = []
  for (let d = startOfWeek(today, weekStart); d <= last; ) {
    const week: AgendaCell<T>[] = []
    for (let k = 0; k < 7; k++, d = addDays(d, 1)) {
      const date = d
      const inRange = date >= today && date <= last
      week.push({ date, inRange, entries: inRange ? entries.filter((e) => e.date <= date && (e.endDate ?? e.date) >= date) : [] })
    }
    weeks.push(week)
  }
  return weeks
}

// ——— Necesita atención: los avisos que no salen en otro bloque ——————————————

/**
 * Qué bloque del panel enseña ya cada aviso de la campana. Los que no tienen bloque
 * (null) se quedan en «Necesita atención»: los recordatorios atrasados, las versiones cuya
 * fecha ya pasó y los presupuestos superados.
 * - Prioridades: lo vencido, lo que vence hoy, lo bloqueado, las inscripciones que cierran y
 *   las versiones que salen en 14 días.
 * - Próximas fechas: los eventos de los próximos días, los que ya pasaron sin actualizar y
 *   los recordatorios de hoy.
 * - Feedback: el feedback sin revisar.
 */
export const ATTENTION_ALERT_OWNER: Record<NotificationKind, string | null> = {
  overdue: 'priorities',
  dueToday: 'priorities',
  blocked: 'priorities',
  registrationSoon: 'priorities',
  releaseSoon: 'priorities',
  eventSoon: 'agenda',
  eventStale: 'agenda',
  newFeedback: 'feedback',
  reminder: null,
  releaseLate: null,
  budgetOver: null,
}

/**
 * Los avisos de «Necesita atención» fuera del modo foco: los de hoy (`panelAlerts`) menos los
 * que ya enseña otro bloque visible (`ATTENTION_ALERT_OWNER`; si el estudio ha ocultado ese
 * bloque, vuelven aquí). Los recordatorios de hoy salen en Próximas fechas; aquí, solo los
 * atrasados (salvo que Próximas fechas esté oculto).
 */
export function attentionAlerts(data: StudioData, today: ISODate, scope: Scope = null, hiddenBlocks: readonly string[] = []): StudioNotification[] {
  const hidden = new Set(hiddenBlocks)
  const shown = (block: string | null) => block !== null && !hidden.has(block)
  return panelAlerts(data, today, scope).filter((n) => {
    if (shown(ATTENTION_ALERT_OWNER[n.kind])) return false
    if (n.kind === 'reminder' && n.date === today && shown('agenda')) return false
    return true
  })
}
