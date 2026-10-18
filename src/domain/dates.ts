// Fechas como texto «AAAA-MM-DD» en hora local: se comparan como cadenas y no
// bailan con las zonas horarias. Las conversiones a Date se hacen a mediodía.
import type { ISODate, ISODateTime } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function nowISODateTime(): ISODateTime {
  const d = new Date()
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parseISODate(s)
  return toISODate(d) === s
}

export function isValidISODateTime(s: unknown): s is ISODateTime {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && isValidISODate(s.slice(0, 10))
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Días de a a b (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/** Lunes de la semana de esa fecha. */
export function startOfWeek(s: ISODate): ISODate {
  const d = parseISODate(s)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** «14 oct» (y el año si no es el de referencia). */
export function formatDate(s: ISODate | undefined, refYear?: number): string {
  if (!s) return 'Sin fecha'
  const d = parseISODate(s)
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return refYear !== undefined && d.getFullYear() === refYear ? base : `${base} ${d.getFullYear()}`
}

/** «sábado, 18 de octubre de 2026». */
export function formatLongDate(s: ISODate): string {
  const d = parseISODate(s)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`
}

export function formatDateTime(s: ISODateTime): string {
  return `${formatDate(s.slice(0, 10))}, ${s.slice(11, 16)}`
}

/** «hoy», «ayer», «hace 4 días», «dentro de 3 días», «hace 2 semanas»… */
export function relativeDays(s: ISODate, today: ISODate): string {
  const n = daysBetween(today, s)
  if (n === 0) return 'hoy'
  if (n === -1) return 'ayer'
  if (n === 1) return 'mañana'
  const abs = Math.abs(n)
  const text = abs < 14 ? `${abs} días` : abs < 60 ? `${Math.round(abs / 7)} semanas` : `${Math.round(abs / 30)} meses`
  return n < 0 ? `hace ${text}` : `dentro de ${text}`
}
