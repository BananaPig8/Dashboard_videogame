// Fechas como texto «AAAA-MM-DD» (y «AAAA-MM-DDTHH:mm»): se comparan como cadenas y no
// bailan con los husos horarios. «Hoy» y «ahora» se calculan en la zona horaria del
// estudio (Europe/Madrid si no se cambia en Ajustes), no en la del navegador.
// Cómo se escriben en pantalla es cosa de src/i18n/format.ts.
import type { ISODate, ISODateTime } from './types'

export const DEFAULT_TIME_ZONE = 'Europe/Madrid'

let clockZone = DEFAULT_TIME_ZONE

/** ¿La reconoce el navegador? (`Intl` lanza RangeError con las que no existen). */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Zona horaria con la que se calcula «hoy». Si no es válida, se queda la de siempre. */
export function setClockTimeZone(tz: string): void {
  clockZone = isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE
}

export function getClockTimeZone(): string {
  return clockZone
}

const pad = (n: number) => String(n).padStart(2, '0')

/** La fecha y la hora de un instante en una zona horaria. */
export function zonedParts(instant: Date, timeZone = clockZone): { date: ISODate; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

export function todayISO(timeZone = clockZone): ISODate {
  return zonedParts(new Date(), timeZone).date
}

export function nowISODateTime(timeZone = clockZone): ISODateTime {
  const { date, time } = zonedParts(new Date(), timeZone)
  return `${date}T${time}`
}

/** Fecha de calendario como Date a mediodía UTC: sirve para contar días sin saltos de hora. */
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

export function toISODate(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toISODate(parseISODate(s)) === s
}

export function isValidISODateTime(s: unknown): s is ISODateTime {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && isValidISODate(s.slice(0, 10))
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s)
  d.setUTCDate(d.getUTCDate() + days)
  return toISODate(d)
}

/** Días de a a b (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/** 0 = domingo, 1 = lunes. */
export type WeekStart = 0 | 1

/** Primer día de la semana de esa fecha (lunes por defecto). */
export function startOfWeek(s: ISODate, weekStart: WeekStart = 1): ISODate {
  const d = parseISODate(s)
  const offset = (d.getUTCDay() - weekStart + 7) % 7
  return addDays(s, -offset)
}

export function yearOf(s: ISODate): number {
  return Number(s.slice(0, 4))
}
