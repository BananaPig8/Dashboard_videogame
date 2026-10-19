// El calendario del estudio: todas las fechas de todas las colecciones en una sola lista.
// Lo usan el Panel (próximas fechas), la sección Calendario, la ficha de cada proyecto y
// los avisos, para que una fecha salga igual en todas partes.
// Regla de los selectores por sección: nada de usar al cargar el módulo lo que se importa de
// '../selectors' (selectors.ts reexporta este fichero; solo dentro de funciones).
import { CALENDAR_SECTION_KINDS, type CalendarKind } from '../catalog'
import type { CollectionKey } from '../collections'
import { addDays } from '../dates'
import type { ClockTime, ID, ISODate, StudioData, StudioEvent } from '../types'
import { isOpen, type Scope } from '../selectors'

export interface CalendarEntry {
  /** Estable: «colección:id:qué». */
  id: string
  kind: CalendarKind
  date: ISODate
  endDate?: ISODate
  time?: ClockTime
  title: string
  projectId?: ID
  /** La fecha está confirmada (una fecha límite propia lo está; una prevista sin confirmar, no). */
  confirmed: boolean
  /** Ya pasó o ya está hecho (tarea terminada, evento celebrado, versión publicada…). */
  done: boolean
  target: { collection: CollectionKey; id: ID }
}

/** Qué tipo de entrada es cada evento. Los «release» y «steam» de la versión 1 cuentan como publicación. */
export function eventKind(e: StudioEvent): CalendarKind {
  switch (e.type) {
    case 'meeting':
      return 'meeting'
    case 'deadline':
      return 'deadline'
    case 'delivery':
      return 'delivery'
    case 'festival':
      return 'festival'
    case 'release':
    case 'steam':
      return 'release'
    default:
      return 'event'
  }
}

const inScope = (scope: Scope) => (x: { projectId?: ID }) => scope === null || !x.projectId || x.projectId === scope

/** Todas las fechas, sin filtrar por días (ordenadas por fecha y hora). */
export function allCalendarEntries(data: StudioData, scope: Scope = null): CalendarEntry[] {
  const out: CalendarEntry[] = []
  const own = (x: { projectId?: ID }) => scope === null || x.projectId === scope
  for (const i of data.items.filter(own))
    if (i.dueDate)
      out.push({
        id: `items:${i.id}:due`,
        kind: 'deadline',
        date: i.dueDate,
        title: i.title,
        projectId: i.projectId,
        confirmed: true,
        done: !isOpen(i),
        target: { collection: 'items', id: i.id },
      })
  // Los eventos de todo el estudio salen también en cada proyecto.
  for (const e of data.events.filter(inScope(scope))) {
    if (e.status === 'cancelled') continue
    if (e.date)
      out.push({
        id: `events:${e.id}:date`,
        kind: eventKind(e),
        date: e.date,
        endDate: e.endDate,
        time: e.time,
        title: e.title,
        projectId: e.projectId,
        confirmed: e.dateConfirmed,
        done: e.status === 'done',
        target: { collection: 'events', id: e.id },
      })
    if (e.registrationDeadline && e.registrationStatus !== 'not_needed')
      out.push({
        id: `events:${e.id}:registration`,
        kind: 'registration',
        date: e.registrationDeadline,
        title: e.title,
        projectId: e.projectId,
        confirmed: !!e.registrationDeadlineConfirmed,
        done: e.registrationStatus !== 'open' && e.registrationStatus !== 'not_open',
        target: { collection: 'events', id: e.id },
      })
  }
  for (const r of data.releases.filter(own)) {
    if (r.status === 'cancelled') continue
    if (r.releasedAt)
      out.push({ id: `releases:${r.id}:released`, kind: 'release', date: r.releasedAt, title: r.name, projectId: r.projectId, confirmed: true, done: true, target: { collection: 'releases', id: r.id } })
    else if (r.targetDate)
      out.push({
        id: `releases:${r.id}:target`,
        kind: 'release',
        date: r.targetDate,
        title: r.name,
        projectId: r.projectId,
        confirmed: !!r.targetConfirmed,
        done: false,
        target: { collection: 'releases', id: r.id },
      })
  }
  for (const b of data.builds.filter(own))
    if (b.date && b.status !== 'withdrawn')
      out.push({
        id: `builds:${b.id}:date`,
        kind: 'build',
        date: b.date,
        title: `${b.name} ${b.version}`,
        projectId: b.projectId,
        confirmed: true,
        done: b.status !== 'in_progress',
        target: { collection: 'builds', id: b.id },
      })
  for (const r of data.reminders.filter(inScope(scope)))
    out.push({ id: `reminders:${r.id}:date`, kind: 'reminder', date: r.date, time: r.time, title: r.title, projectId: r.projectId, confirmed: true, done: r.done, target: { collection: 'reminders', id: r.id } })
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.title.localeCompare(b.title))
}

export interface CalendarQuery {
  from: ISODate
  to: ISODate
  scope?: Scope
  /** Solo estos tipos (la subsección del calendario, p. ej. CALENDAR_SECTION_KINDS.reuniones). */
  kinds?: readonly CalendarKind[]
  /** Sin lo que ya está hecho. */
  pendingOnly?: boolean
}

/** Las fechas que tocan un periodo (un evento de varios días cuenta si se solapa). */
export function calendarEntries(data: StudioData, q: CalendarQuery): CalendarEntry[] {
  return allCalendarEntries(data, q.scope ?? null).filter(
    (e) => (e.endDate ?? e.date) >= q.from && e.date <= q.to && (!q.kinds || q.kinds.includes(e.kind)) && (!q.pendingOnly || !e.done),
  )
}

/** Lo que queda por delante: de hoy a dentro de `days` días, sin lo hecho. Es la lista de «Próximas fechas». */
export function upcomingEntries(data: StudioData, today: ISODate, days: number, scope: Scope = null): CalendarEntry[] {
  return calendarEntries(data, { from: today, to: addDays(today, days), scope, pendingOnly: true })
}

/** Los tipos de una subsección del calendario (?tipo=); sin subsección, todos. */
export function calendarKindsFor(tipo: string | null): readonly CalendarKind[] | undefined {
  return tipo ? CALENDAR_SECTION_KINDS[tipo] : undefined
}
