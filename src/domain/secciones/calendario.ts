// El calendario del estudio: todas las fechas de todas las colecciones en una sola lista.
// Lo usan el Panel (próximas fechas), la sección Calendario, la ficha de cada proyecto y
// los avisos, para que una fecha salga igual en todas partes.
// Regla de los selectores por sección: nada de usar al cargar el módulo lo que se importa de
// '../selectors' (selectors.ts reexporta este fichero; solo dentro de funciones).
import { CALENDAR_SECTION_KINDS, type CalendarKind } from '../catalog'
import type { CollectionKey } from '../collections'
import { addDays, DEFAULT_TIME_ZONE, isValidTimeZone, yearOf } from '../dates'
import type { ClockTime, Confidence, ID, ISODate, StudioData, StudioEvent } from '../types'
import { buildLabel, isOpen, type Scope } from '../selectors'
import { hasTag } from './etiquetas'

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
  /** Cuánto fiarse del dato del que sale la fecha (los recordatorios no lo dicen). */
  confidence?: Confidence
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
        confidence: i.confidence,
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
        confidence: e.confidence,
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
        confidence: e.confidence,
        target: { collection: 'events', id: e.id },
      })
  }
  for (const r of data.releases.filter(own)) {
    if (r.status === 'cancelled') continue
    if (r.releasedAt)
      out.push({
        id: `releases:${r.id}:released`,
        kind: 'release',
        date: r.releasedAt,
        title: r.name,
        projectId: r.projectId,
        confirmed: true,
        done: true,
        confidence: r.confidence,
        target: { collection: 'releases', id: r.id },
      })
    else if (r.targetDate)
      out.push({
        id: `releases:${r.id}:target`,
        kind: 'release',
        date: r.targetDate,
        title: r.name,
        projectId: r.projectId,
        confirmed: !!r.targetConfirmed,
        done: false,
        confidence: r.confidence,
        target: { collection: 'releases', id: r.id },
      })
  }
  // Una build sale el día que se hizo. Las que están en preparación aún no se han entregado
  // (su fecha es la de cuando se empezó) y las retiradas ya no están: fuera las dos.
  for (const b of data.builds.filter(own))
    if (b.date && b.status !== 'withdrawn' && b.status !== 'in_progress')
      out.push({
        id: `builds:${b.id}:date`,
        kind: 'build',
        date: b.date,
        title: buildLabel(b),
        projectId: b.projectId,
        confirmed: b.status !== 'to_confirm',
        done: true,
        confidence: b.confidence,
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

// ——— Sección Calendario ————————————————————————————————————————————————————

/** El mes de ?mes=AAAA-MM (su día 1); si falta o no vale, el de hoy. */
export function calendarMonthParam(mes: string | null, today: ISODate): ISODate {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? `${mes}-01` : `${today.slice(0, 7)}-01`
}

/** Con ?etiqueta=, solo las fechas de lo que la lleva (los recordatorios no tienen etiquetas). */
export function calendarWithTag<T extends { target: { collection: CollectionKey; id: ID } }>(data: StudioData, entries: T[], tag: string | null): T[] {
  if (!tag) return entries
  const tagged = new Set<string>()
  for (const k of ['items', 'events', 'releases', 'builds'] as const)
    for (const x of data[k] as { id: ID; tags?: string[] }[]) if (hasTag(x, tag)) tagged.add(`${k}:${x.id}`)
  return entries.filter((e) => tagged.has(`${e.target.collection}:${e.target.id}`))
}

/**
 * Lo que tendría que haber pasado y sigue pendiente: fechas límite vencidas, eventos sin
 * cerrar, inscripciones sin enviar, versiones sin publicar, recordatorios sin hacer. Las
 * builds no cuentan (su fecha es la de la build, no un plazo).
 */
export function calendarOverdue(data: StudioData, today: ISODate, scope: Scope = null, kinds?: readonly CalendarKind[]): CalendarEntry[] {
  return allCalendarEntries(data, scope).filter((e) => !e.done && e.kind !== 'build' && (e.endDate ?? e.date) < today && (!kinds || kinds.includes(e.kind)))
}

/** De hoy en adelante, con fecha prevista pero sin confirmar. */
export function calendarTentative(data: StudioData, today: ISODate, scope: Scope = null, kinds?: readonly CalendarKind[]): CalendarEntry[] {
  return calendarEntries(data, { from: today, to: '9999-12-31', scope, kinds, pendingOnly: true }).filter((e) => !e.confirmed)
}

/** Algo que debería estar en el calendario y aún no tiene fecha. */
export interface CalendarUndated {
  /** Estable: «colección:id:qué». */
  id: string
  kind: CalendarKind
  title: string
  projectId?: ID
  target: { collection: CollectionKey; id: ID }
}

/**
 * Lo que falta en el calendario: eventos sin fecha, inscripciones sin plazo, versiones
 * previstas sin fecha y hitos abiertos sin fecha límite (las tareas sin fecha no: no todas
 * la necesitan). Los eventos del estudio salen también en cada proyecto.
 */
export function calendarUndated(data: StudioData, scope: Scope = null, kinds?: readonly CalendarKind[]): CalendarUndated[] {
  const out: CalendarUndated[] = []
  const own = (x: { projectId?: ID }) => scope === null || x.projectId === scope
  for (const e of data.events.filter(inScope(scope))) {
    if (e.status === 'cancelled' || e.status === 'done') continue
    const target = { collection: 'events' as const, id: e.id }
    if (!e.date) out.push({ id: `events:${e.id}:date`, kind: eventKind(e), title: e.title, projectId: e.projectId, target })
    if ((e.registrationStatus === 'open' || e.registrationStatus === 'not_open') && !e.registrationDeadline)
      out.push({ id: `events:${e.id}:registration`, kind: 'registration', title: e.title, projectId: e.projectId, target })
  }
  for (const r of data.releases.filter(own))
    if ((r.status === 'idea' || r.status === 'planned' || r.status === 'in_progress') && !r.targetDate && !r.releasedAt)
      out.push({ id: `releases:${r.id}:target`, kind: 'release', title: r.name, projectId: r.projectId, target: { collection: 'releases', id: r.id } })
  for (const i of data.items.filter(own))
    if (i.kind === 'milestone' && isOpen(i) && !i.dueDate)
      out.push({ id: `items:${i.id}:due`, kind: 'deadline', title: i.title, projectId: i.projectId, target: { collection: 'items', id: i.id } })
  return out.filter((u) => !kinds || kinds.includes(u.kind)).sort((a, b) => a.title.localeCompare(b.title))
}

/** Lo que se exporta a .ics: lo pendiente de hoy en adelante de esa vista (tipos, ámbito y etiqueta). */
export function calendarForExport(
  data: StudioData,
  today: ISODate,
  scope: Scope = null,
  kinds?: readonly CalendarKind[],
  tag: string | null = null,
): CalendarEntry[] {
  return calendarWithTag(data, calendarEntries(data, { from: today, to: '9999-12-31', scope, kinds, pendingOnly: true }), tag)
}

// ——— Exportar a .ics (RFC 5545) ——————————————————————————————————————————————
// Un fichero para importar en Google Calendar, Outlook o Apple Calendar: una copia de las
// fechas de hoy, no una sincronización (no hay ninguna integración activa).

/** Una fecha del calendario con lo que se quiera añadir al exportarla. */
export interface IcsEntry extends CalendarEntry {
  /** Hora de fin (de una reunión, por ejemplo). */
  endTime?: ClockTime
  description?: string
  location?: string
  url?: string
}

export interface IcsOptions {
  /** Nombre del calendario al importarlo. */
  calName: string
  /** Zona horaria de las horas (la del estudio). */
  timeZone: string
  /** Momento de la exportación (DTSTAMP). Por defecto, ahora. */
  now?: Date
}

const CRLF = '\r\n'
const encoder = new TextEncoder()
const pad2 = (n: number) => String(n).padStart(2, '0')

/** Escapa un texto (TEXT de RFC 5545): barra, punto y coma, coma y saltos de línea. */
export const icsText = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')

/** Pliega una línea a 75 octetos (sin partir un carácter UTF-8): las siguientes empiezan por un espacio. */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  let limit = 75
  for (const ch of line) {
    const n = encoder.encode(ch).length
    if (bytes + n > limit) {
      parts.push(current)
      current = ''
      bytes = 0
      limit = 74
    }
    current += ch
    bytes += n
  }
  parts.push(current)
  return parts.join(`${CRLF} `)
}

const icsDate = (d: ISODate) => d.replace(/-/g, '')
const icsLocal = (d: ISODate, time: ClockTime) => `${icsDate(d)}T${time.replace(':', '')}00`
const icsStamp = (instant: Date) =>
  `${instant.getUTCFullYear()}${pad2(instant.getUTCMonth() + 1)}${pad2(instant.getUTCDate())}T${pad2(instant.getUTCHours())}${pad2(instant.getUTCMinutes())}${pad2(instant.getUTCSeconds())}Z`
const icsOffset = (minutes: number) => `${minutes < 0 ? '-' : '+'}${pad2(Math.floor(Math.abs(minutes) / 60))}${pad2(Math.abs(minutes) % 60)}`

/** Minutos que la zona va por delante de UTC en ese instante. */
function zoneOffset(fmt: Intl.DateTimeFormat, ms: number): number {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return Math.round((local - Math.floor(ms / 1000) * 1000) / 60_000)
}

/**
 * VTIMEZONE de una zona para esos años: sus cambios de hora reales (los da Intl), cada uno
 * con su hora local de antes del cambio, como pide RFC 5545.
 */
function vtimezone(timeZone: string, fromYear: number, toYear: number): string[] {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const DAY = 86_400_000
  const MIN = 60_000
  const start = Date.UTC(fromYear, 0, 1)
  const end = Date.UTC(toYear + 1, 0, 1)
  const changes: { at: number; from: number; to: number }[] = []
  let prev = zoneOffset(fmt, start)
  const initial = prev
  for (let t = start; t < end; t += DAY) {
    const next = zoneOffset(fmt, t + DAY)
    if (next === prev) continue
    // El minuto exacto del cambio, entre t y t + 1 día.
    let lo = t
    let hi = t + DAY
    while (hi - lo > MIN) {
      const mid = lo + Math.floor((hi - lo) / 2 / MIN) * MIN
      if (zoneOffset(fmt, mid) === prev) lo = mid
      else hi = mid
    }
    changes.push({ at: hi, from: prev, to: next })
    prev = next
  }
  const wall = (ms: number) => icsStamp(new Date(ms)).slice(0, 15)
  const observance = (type: 'STANDARD' | 'DAYLIGHT', at: number, from: number, to: number) => [
    `BEGIN:${type}`,
    `DTSTART:${wall(at + from * MIN)}`,
    `TZOFFSETFROM:${icsOffset(from)}`,
    `TZOFFSETTO:${icsOffset(to)}`,
    `END:${type}`,
  ]
  // Lo que rige desde el 1 de enero del primer año (a las 0:00 de allí) hasta el primer cambio.
  const firstType = changes.length && changes[0].to < initial ? 'DAYLIGHT' : 'STANDARD'
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${timeZone}`,
    ...observance(firstType, start - initial * MIN, initial, initial),
    ...changes.flatMap((c) => observance(c.to > c.from ? 'DAYLIGHT' : 'STANDARD', c.at, c.from, c.to)),
    'END:VTIMEZONE',
  ]
}

/**
 * El calendario como fichero iCalendar (RFC 5545): un VEVENT por fecha, con UID estable
 * («entrada@studio-hub», así al volver a importarlo se actualiza en vez de duplicarse).
 * Los días completos van con VALUE=DATE y DTEND exclusivo (el día siguiente al último);
 * con hora, en la zona del estudio (TZID y su VTIMEZONE). Lo no confirmado va TENTATIVE.
 * Líneas con CRLF y plegadas a 75 octetos.
 */
export function toICS(entries: readonly IcsEntry[], opts: IcsOptions): string {
  const timeZone = isValidTimeZone(opts.timeZone) ? opts.timeZone : DEFAULT_TIME_ZONE
  const stamp = icsStamp(opts.now ?? new Date())
  // Con hora: si dura varios días sin hora de fin, se exporta como días completos (no se inventa el fin).
  const timed = (e: IcsEntry) => !!e.time && (!e.endDate || e.endDate === e.date || !!e.endTime)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Studio Hub//Calendario del estudio//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${icsText(opts.calName)}`,
    `X-WR-CALNAME:${icsText(opts.calName)}`,
    `X-WR-TIMEZONE:${timeZone}`,
  ]
  const withTime = entries.filter(timed)
  if (withTime.length) {
    const years = withTime.flatMap((e) => [yearOf(e.date), yearOf(e.endDate ?? e.date)])
    lines.push(...vtimezone(timeZone, Math.min(...years), Math.max(...years)))
  }
  for (const e of entries) {
    lines.push('BEGIN:VEVENT', `UID:${icsText(`${e.id}@studio-hub`)}`, `DTSTAMP:${stamp}`)
    if (timed(e)) {
      lines.push(`DTSTART;TZID=${timeZone}:${icsLocal(e.date, e.time!)}`)
      const endDay = e.endDate ?? e.date
      if (e.endTime && (endDay > e.date || e.endTime > e.time!)) lines.push(`DTEND;TZID=${timeZone}:${icsLocal(endDay, e.endTime)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(e.endDate && e.endDate > e.date ? e.endDate : e.date, 1))}`)
    }
    lines.push(`SUMMARY:${icsText(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`)
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    lines.push(`STATUS:${e.confirmed ? 'CONFIRMED' : 'TENTATIVE'}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join(CRLF) + CRLF
}
