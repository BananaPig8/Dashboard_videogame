// Cómo se escriben fechas, horas y números en pantalla, según las preferencias
// (idioma, formato de fecha, formato de hora). Funciones puras: se prueban en Node.
import { daysBetween, parseISODate } from '../domain/dates'
import type { ISODate, ISODateTime } from '../domain/types'

export type DateFormat = 'short' | 'numeric' | 'long' | 'iso'
export type HourCycle = 'h23' | 'h12'

export interface FormatOptions {
  /** Etiqueta BCP 47, p. ej. «es-ES». */
  locale: string
  dateFormat: DateFormat
  hourCycle: HourCycle
  /** Texto para cuando no hay fecha. */
  noDate: string
}

export interface Formatter {
  /** «14 oct» (con el año si no es refYear), «14/10/2026», «14 de octubre de 2026» o «2026-10-14». */
  date(s: ISODate | undefined, refYear?: number): string
  /** Con el día de la semana: «domingo, 18 de octubre de 2026». */
  longDate(s: ISODate): string
  /** Fecha y hora de un «AAAA-MM-DDTHH:mm» (ya en la zona del estudio). */
  dateTime(s: ISODateTime): string
  time(s: ISODateTime): string
  /** «hoy», «ayer», «hace 4 días», «dentro de 2 semanas»… */
  relative(s: ISODate, today: ISODate): string
  /** «octubre de 2026». */
  monthYear(yyyyMM: string): string
  number(n: number): string
}

// Las fechas del modelo son de calendario: se pintan en UTC para que no cambien de día.
const UTC = 'UTC'

export function makeFormatter(o: FormatOptions): Formatter {
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(o.locale, { timeZone: UTC, ...opts })
  const short = fmt({ day: 'numeric', month: 'short' })
  const shortYear = fmt({ day: 'numeric', month: 'short', year: 'numeric' })
  const numeric = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' })
  const long = fmt({ day: 'numeric', month: 'long', year: 'numeric' })
  const withWeekday = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const monthYear = fmt({ month: 'long', year: 'numeric' })
  const time = fmt({ hour: o.hourCycle === 'h12' ? 'numeric' : '2-digit', minute: '2-digit', hourCycle: o.hourCycle })
  const rel = new Intl.RelativeTimeFormat(o.locale, { numeric: 'auto' })
  const num = new Intl.NumberFormat(o.locale)

  const date = (s: ISODate | undefined, refYear?: number) => {
    if (!s) return o.noDate
    const d = parseISODate(s)
    switch (o.dateFormat) {
      case 'iso':
        return s.slice(0, 10)
      case 'numeric':
        return numeric.format(d)
      case 'long':
        return long.format(d)
      default:
        return refYear !== undefined && d.getUTCFullYear() === refYear ? short.format(d) : shortYear.format(d)
    }
  }

  const instant = (s: ISODateTime) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    const [hh, mm] = s.slice(11, 16).split(':').map(Number)
    return new Date(Date.UTC(y, m - 1, d, hh, mm))
  }

  return {
    date,
    longDate: (s) => withWeekday.format(parseISODate(s)),
    dateTime: (s) => `${date(s.slice(0, 10))}, ${time.format(instant(s))}`,
    time: (s) => time.format(instant(s)),
    relative: (s, today) => {
      const n = daysBetween(today, s)
      const abs = Math.abs(n)
      if (abs < 14) return rel.format(n, 'day')
      if (abs < 60) return rel.format(Math.round(n / 7), 'week')
      return rel.format(Math.round(n / 30), 'month')
    },
    monthYear: (yyyyMM) => monthYear.format(parseISODate(`${yyyyMM}-15`)),
    number: (n) => num.format(n),
  }
}
