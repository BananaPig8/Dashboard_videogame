// Calendario mensual de las fechas del estudio (secciones/calendario.ts): una cuadrícula
// con las entradas de cada día y, debajo de 640 px, una lista por días. Cada entrada lleva
// icono y texto de su tipo, y si la fecha no está confirmada, lo dice.
import type { ReactNode } from 'react'
import { CALENDAR_KINDS, type CalendarKind } from '../../domain/catalog'
import { addDays, startOfWeek } from '../../domain/dates'
import type { CalendarEntry } from '../../domain/selectors'
import type { ISODate } from '../../domain/types'
import { t } from '../../i18n'
import { useFormat } from '../hooks'
import { usePreferences } from '../prefs'
import { Icon, type IconName } from './Icon'

export const CALENDAR_ICON: Record<CalendarKind, IconName> = {
  deadline: 'clock',
  delivery: 'box',
  event: 'ticket',
  festival: 'star',
  meeting: 'users',
  release: 'rocket',
  registration: 'flag',
  build: 'box',
  reminder: 'bell',
}

/** Primer día del mes de una fecha («2026-10-01»). */
export const monthStart = (d: ISODate): ISODate => `${d.slice(0, 7)}-01`

/** El primer día del mes siguiente (o anterior, con −1). */
export function shiftMonth(month: ISODate, delta: number): ISODate {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + delta
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, '0')}-01`
}

/** Las fechas que pinta la cuadrícula de un mes (semanas completas). */
export function monthGrid(month: ISODate, weekStart: 0 | 1): ISODate[] {
  const first = startOfWeek(monthStart(month), weekStart)
  const next = shiftMonth(month, 1)
  const days: ISODate[] = []
  for (let d = first; d < next || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d)
  return days
}

/** Una entrada: icono + tipo + título (+ «sin confirmar»). */
export function CalendarChip({ entry, onOpen, compact }: { entry: CalendarEntry; onOpen?: (e: CalendarEntry) => void; compact?: boolean }) {
  const kind = CALENDAR_KINDS[entry.kind]
  const body = (
    <>
      <Icon name={CALENDAR_ICON[entry.kind]} size={12} />
      <span className={compact ? 'visually-hidden' : 'cal-kind'}>{kind.label}:</span> {entry.time && <span className="cal-time">{entry.time}</span>}{' '}
      <span className="cal-title">{entry.title}</span>
      {!entry.confirmed && <span className="cal-unconfirmed">{t('calendarUi.unconfirmed')}</span>}
    </>
  )
  const cls = `cal-chip tone-${kind.tone} ${entry.done ? 'done' : ''}`
  return onOpen ? (
    <button type="button" className={cls} onClick={() => onOpen(entry)}>
      {body}
    </button>
  ) : (
    <span className={cls}>{body}</span>
  )
}

export function MonthCalendar({
  month,
  entries,
  today,
  onOpen,
  onMonth,
  caption,
  footer,
}: {
  /** Cualquier día del mes que se enseña. */
  month: ISODate
  entries: CalendarEntry[]
  today: ISODate
  onOpen?: (e: CalendarEntry) => void
  /** Cambiar de mes (recibe el día 1 del mes nuevo). */
  onMonth: (month: ISODate) => void
  caption?: string
  footer?: ReactNode
}) {
  const fmt = useFormat()
  const { weekStart } = usePreferences()
  const first = monthStart(month)
  const days = monthGrid(first, weekStart)
  const byDay = new Map<ISODate, CalendarEntry[]>()
  for (const e of entries) {
    // Un evento de varios días sale en cada uno de sus días.
    for (let d = e.date; d <= (e.endDate ?? e.date) && d <= days[days.length - 1]; d = addDays(d, 1)) {
      if (d < days[0]) continue
      byDay.set(d, [...(byDay.get(d) ?? []), e])
    }
  }
  const weekdays = days.slice(0, 7).map((d) => fmt.weekday(d))
  const title = fmt.monthYear(first)
  const inMonth = (d: ISODate) => d.slice(0, 7) === first.slice(0, 7)
  const listDays = days.filter((d) => inMonth(d) && byDay.has(d))
  return (
    <div className="month-cal">
      <div className="month-cal-head">
        <button type="button" className="icon-btn" onClick={() => onMonth(shiftMonth(first, -1))} aria-label={t('calendarUi.prev')}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <h3 aria-live="polite">{title}</h3>
        <button type="button" className="icon-btn" onClick={() => onMonth(shiftMonth(first, 1))} aria-label={t('calendarUi.next')}>
          <Icon name="chevronRight" size={16} />
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => onMonth(monthStart(today))} disabled={inMonth(today) && first === monthStart(today)}>
          {t('calendarUi.today')}
        </button>
      </div>
      <table className="month-grid">
        <caption className="visually-hidden">{caption ?? title}</caption>
        <thead>
          <tr>
            {weekdays.map((w) => (
              <th key={w} scope="col">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, w) => (
            <tr key={w}>
              {days.slice(w * 7, w * 7 + 7).map((d) => (
                <td key={d} className={`${inMonth(d) ? '' : 'outside'} ${d === today ? 'today' : ''}`} aria-current={d === today ? 'date' : undefined}>
                  <span className="month-day">{Number(d.slice(8))}</span>
                  <div className="month-entries">
                    {(byDay.get(d) ?? []).map((e) => (
                      <CalendarChip key={`${e.id}-${d}`} entry={e} onOpen={onOpen} compact />
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* En móvil, la cuadrícula se esconde y se lee esta lista. */}
      <ol className="month-list">
        {listDays.length === 0 && <li className="muted">{t('calendarUi.emptyMonth')}</li>}
        {listDays.map((d) => (
          <li key={d}>
            <span className={d === today ? 'month-list-day today' : 'month-list-day'}>{fmt.longDate(d)}</span>
            <div className="month-entries">
              {(byDay.get(d) ?? []).map((e) => (
                <CalendarChip key={`${e.id}-${d}`} entry={e} onOpen={onOpen} />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {footer}
    </div>
  )
}
