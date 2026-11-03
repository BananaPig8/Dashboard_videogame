// Próximas fechas: el calendario resumido. Se ve como lista (por días) o como cuadrícula de
// los próximos 14 días; el modo es de cada persona (layout.agendaView). Cada fecha abre lo
// suyo en el editor y dice si está sin confirmar.
import { useState } from 'react'
import { CALENDAR_KINDS, KINDS } from '../../../../domain/catalog'
import { addDays } from '../../../../domain/dates'
import {
  AGENDA_GRID_DAYS,
  agendaByDay,
  agendaGrid,
  panelAgenda,
  staleEvents,
  undatedEvents,
  type AgendaCell,
  type AgendaEntry,
} from '../../../../domain/selectors'
import type { ISODate, StudioData } from '../../../../domain/types'
import { t } from '../../../../i18n'
import type { Formatter } from '../../../../i18n/format'
import { useCanEdit } from '../../../../data/store'
import { ConfidenceTag, KIND_ICON, Pill, ProjectChip } from '../../../components/Badges'
import { Empty } from '../../../components/Common'
import { Icon } from '../../../components/Icon'
import { CALENDAR_ICON } from '../../../components/MonthCalendar'
import { useScope, useUI } from '../../../context'
import { updateDashboardLayout, useDashboardLayout, usePreferences } from '../../../prefs'
import { AGENDA_LIMIT, EventLine, MoreLink, UPCOMING_DAYS, type WidgetProps } from './comunes'
import './agenda.css'

/** «Hoy», «Mañana», «Dentro de 3 días»…, con mayúscula al principio. */
const capitalized = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

/** Una fecha: qué es (icono y texto), qué, si está sin confirmar, a qué hora y de qué proyecto. Al pulsarla, se abre. */
function AgendaItem({ entry, data, today, year, fmt, showProject }: { entry: AgendaEntry; data: StudioData; today: ISODate; year: number; fmt: Formatter; showProject: boolean }) {
  const { edit } = useUI()
  const kind = CALENDAR_KINDS[entry.kind]
  const ongoing = entry.date < today && entry.endDate
  return (
    <li className="agenda-entry">
      <button type="button" className="item-title" onClick={() => edit({ collection: entry.target.collection, id: entry.target.id })}>
        {entry.title}
      </button>
      <div className="item-meta">
        {entry.milestone ? (
          <Pill tone={KINDS.milestone.tone} icon={KIND_ICON.milestone}>
            {KINDS.milestone.label}
          </Pill>
        ) : (
          <Pill tone={kind.tone} icon={CALENDAR_ICON[entry.kind]}>
            {kind.label}
          </Pill>
        )}
        {!entry.confirmed && (
          <Pill tone="warning" icon="question">
            {t('secciones.panel.agenda.unconfirmed')}
          </Pill>
        )}
        {entry.confidence && (entry.confirmed || entry.confidence !== 'to_confirm') && <ConfidenceTag confidence={entry.confidence} compact />}
        {entry.time && <span className="meta-date">{entry.time}</span>}
        {ongoing && <span className="meta-date">{t('secciones.panel.agenda.until', { date: fmt.date(entry.endDate!, year) })}</span>}
        {showProject && <ProjectChip project={data.projects.find((p) => p.id === entry.projectId)} />}
      </div>
    </li>
  )
}

/** Un día de la lista: la fecha a la izquierda y lo que pasa ese día. */
function DayRow({ date, entries, ...p }: { date: ISODate; entries: AgendaEntry[]; data: StudioData; today: ISODate; year: number; fmt: Formatter; showProject: boolean }) {
  return (
    <li className="agenda-row agenda-day">
      <div className="agenda-date">
        <strong>{p.fmt.date(date, p.year)}</strong>
        <span className="muted small">{p.fmt.relative(date, p.today)}</span>
      </div>
      <ul className="agenda-day-entries">
        {entries.map((e) => (
          <AgendaItem key={e.id} entry={e} {...p} />
        ))}
      </ul>
    </li>
  )
}

function AgendaList({ data, scope, today, year, fmt: format, focus }: WidgetProps) {
  const { create } = useUI()
  const { href } = useScope()
  const canEdit = useCanEdit()
  const next = panelAgenda(data, today, UPCOMING_DAYS, scope)
  const shown = focus ? next : next.slice(0, AGENDA_LIMIT)
  const days = agendaByDay(shown, today)
  const p = { data, today, year, fmt: format, showProject: !scope }
  if (next.length === 0)
    return (
      <Empty icon="calendar" action={canEdit ? { label: t('secciones.panel.agenda.add'), onClick: () => create('events') } : undefined}>
        {t('secciones.panel.agenda.empty')}
      </Empty>
    )
  // En el modo foco, por meses.
  const months: { month: string; days: typeof days }[] = []
  for (const d of days) {
    const month = d.date.slice(0, 7)
    const last = months[months.length - 1]
    if (focus && last?.month === month) last.days.push(d)
    else months.push({ month, days: [d] })
  }
  return (
    <>
      {focus ? (
        months.map((m) => (
          <div key={m.month} className="panel-month">
            <h3 className="subhead">{format.monthYear(m.month)}</h3>
            <ul className="agenda-list">
              {m.days.map((d) => (
                <DayRow key={d.date} date={d.date} entries={d.entries} {...p} />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <ul className="agenda-list">
          {days.map((d) => (
            <DayRow key={d.date} date={d.date} entries={d.entries} {...p} />
          ))}
        </ul>
      )}
      <div>
        {next.length > shown.length ? (
          <MoreLink to={href('/calendario')} label={t('secciones.panel.agenda.more', { n: next.length - shown.length })} />
        ) : (
          <MoreLink to={href('/calendario')} label={t('secciones.panel.prioridades.agenda.open')} />
        )}
      </div>
    </>
  )
}

/** El nombre de un día de la cuadrícula para el lector de pantalla: «martes, 3 de noviembre de 2026: 2 fechas (1 sin confirmar)». */
function cellLabel(cell: AgendaCell, format: Formatter): string {
  const date = format.longDate(cell.date)
  const n = cell.entries.length
  const base =
    n === 0
      ? t('secciones.panel.prioridades.agenda.dayNone', { date })
      : n === 1
        ? t('secciones.panel.prioridades.agenda.dayOne', { date })
        : t('secciones.panel.prioridades.agenda.dayOther', { date, n })
  const unconfirmed = cell.entries.filter((e) => !e.confirmed).length
  return unconfirmed ? `${base} (${t('secciones.panel.prioridades.agenda.dayUnconfirmed', { n: unconfirmed })})` : base
}

/** Cuántas marcas caben en un día de la cuadrícula (el resto, «+N»). */
const MARKS = 3

function AgendaCalendar({ data, scope, today, year, fmt: format }: WidgetProps) {
  const { href } = useScope()
  const { weekStart } = usePreferences()
  const [picked, setPicked] = useState<ISODate | null>(null)
  const last = addDays(today, AGENDA_GRID_DAYS - 1)
  const entries = panelAgenda(data, today, AGENDA_GRID_DAYS - 1, scope)
  const weeks = agendaGrid(entries, today, weekStart)
  const cells = weeks.flat().filter((c) => c.inRange)
  const todayCell = cells.find((c) => c.date === today)
  // Sin elegir: hoy si tiene algo; si no, el primer día con algo; si no hay nada, hoy.
  const selected =
    cells.find((c) => c.date === picked) ?? (todayCell?.entries.length ? todayCell : cells.find((c) => c.entries.length > 0)) ?? todayCell ?? cells[0]
  const later = panelAgenda(data, today, UPCOMING_DAYS, scope).filter((e) => e.date > last).length
  const p = { data, today, year, fmt: format, showProject: !scope }
  return (
    <>
      <div className="agenda-cal">
        <div className="agenda-cal-inner">
        <table className="agenda-grid">
          <caption className="visually-hidden">
            {t('secciones.panel.prioridades.agenda.gridCaption', { from: format.date(today, year), to: format.date(last, year) })}
          </caption>
          <thead>
            <tr>
              {weeks[0].map((c) => (
                <th key={c.date} scope="col">
                  {format.weekday(c.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w[0].date}>
                {w.map((c) => (
                  <td key={c.date} className={c.inRange ? undefined : 'outside'}>
                    {c.inRange ? (
                      <button
                        type="button"
                        className={`agenda-cell ${c.date === today ? 'today' : ''}`}
                        aria-pressed={c.date === selected?.date}
                        aria-current={c.date === today ? 'date' : undefined}
                        aria-label={cellLabel(c, format)}
                        title={cellLabel(c, format)}
                        onClick={() => setPicked(c.date)}
                      >
                        <span className="agenda-cell-day">{Number(c.date.slice(8))}</span>
                        <span className="agenda-cell-marks" aria-hidden="true">
                          {c.entries.slice(0, MARKS).map((e) => (
                            <span key={e.id} className={`agenda-mark mark-${e.milestone ? KINDS.milestone.tone : CALENDAR_KINDS[e.kind].tone}`}>
                              <Icon name={e.milestone ? KIND_ICON.milestone : CALENDAR_ICON[e.kind]} size={11} />
                            </span>
                          ))}
                          {c.entries.length > MARKS && <span className="agenda-more">+{c.entries.length - MARKS}</span>}
                        </span>
                      </button>
                    ) : (
                      <span className="agenda-cell-out" title={t('secciones.panel.prioridades.agenda.outside')}>
                        {Number(c.date.slice(8))}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {selected && (
          <div className="agenda-cal-day" aria-live="polite">
            <h3 className="subhead">
              {capitalized(format.relative(selected.date, today))} · {format.longDate(selected.date)}
            </h3>
            {selected.entries.length ? (
              <ul className="agenda-day-entries">
                {selected.entries.map((e) => (
                  <AgendaItem key={e.id} entry={e} {...p} />
                ))}
              </ul>
            ) : (
              <p className="muted small">{entries.length ? t('secciones.panel.prioridades.agenda.dayEmpty') : t('secciones.panel.prioridades.agenda.gridEmpty')}</p>
            )}
          </div>
        )}
        </div>
      </div>
      <div className="agenda-cal-foot">
        {later > 0 && <span className="muted small">{t('secciones.panel.prioridades.agenda.later', { n: later })}</span>}
        <MoreLink to={href('/calendario')} label={t('secciones.panel.prioridades.agenda.open')} />
      </div>
    </>
  )
}

export function AgendaBody(props: WidgetProps) {
  const { data, scope, today, year } = props
  const view = useDashboardLayout().agendaView
  const undated = undatedEvents(data, scope).filter((e) => !e.date)
  const stale = staleEvents(data, today, scope)
  return (
    <>
      {view === 'calendar' ? <AgendaCalendar {...props} /> : <AgendaList {...props} />}
      {stale.length > 0 && (
        <div className="subsection">
          <h3 className="subhead">{t('secciones.panel.agenda.stale')}</h3>
          <ul className="agenda-list">
            {stale.map((ev) => (
              <EventLine key={ev.id} event={ev} data={data} today={today} year={year} showProject={!scope} />
            ))}
          </ul>
        </div>
      )}
      {undated.length > 0 && (
        <div className="subsection">
          <h3 className="subhead">{t('secciones.panel.agenda.undated')}</h3>
          <ul className="agenda-list">
            {undated.map((ev) => (
              <EventLine key={ev.id} event={ev} data={data} today={today} year={year} showProject={!scope} />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/** Lista o cuadrícula: un grupo de dos botones (aria-pressed) que se recuerda para cada persona. */
export function AgendaAction() {
  const view = useDashboardLayout().agendaView
  const set = (agendaView: 'list' | 'calendar') => updateDashboardLayout(() => ({ agendaView }))
  return (
    <div className="segmented agenda-toggle" role="group" aria-label={t('secciones.panel.prioridades.agenda.view')}>
      <button type="button" className={view === 'list' ? 'active' : undefined} aria-pressed={view === 'list'} onClick={() => set('list')}>
        <Icon name="list" size={14} />
        <span className="agenda-toggle-text">{t('secciones.panel.prioridades.agenda.list')}</span>
      </button>
      <button type="button" className={view === 'calendar' ? 'active' : undefined} aria-pressed={view === 'calendar'} onClick={() => set('calendar')}>
        <Icon name="calendar" size={14} />
        <span className="agenda-toggle-text">{t('secciones.panel.prioridades.agenda.calendar')}</span>
      </button>
    </div>
  )
}
