// Próximas fechas: el calendario resumido.
import { panelEntriesByMonth, staleEvents, undatedEvents, upcomingEntries, type CalendarEntry } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { useCanEdit } from '../../../../data/store'
import { Empty } from '../../../components/Common'
import { useScope, useUI } from '../../../context'
import { AGENDA_LIMIT, EventLine, MoreLink, ScopedMore, UPCOMING_DAYS, UpcomingRow, type WidgetProps } from './comunes'

export function AgendaBody({ data, scope, today, year, fmt, focus }: WidgetProps) {
  const { create } = useUI()
  const { href } = useScope()
  const canEdit = useCanEdit()
  const next = upcomingEntries(data, today, UPCOMING_DAYS, scope)
  const shown = focus ? next : next.slice(0, AGENDA_LIMIT)
  const undated = undatedEvents(data, scope).filter((e) => !e.date)
  const stale = staleEvents(data, today, scope)
  const row = (e: CalendarEntry) => <UpcomingRow key={e.id} entry={e} data={data} today={today} year={year} showProject={!scope} />
  return (
    <>
      {next.length === 0 ? (
        <Empty icon="calendar" action={canEdit ? { label: t('secciones.panel.agenda.add'), onClick: () => create('events') } : undefined}>
          {t('secciones.panel.agenda.empty')}
        </Empty>
      ) : focus ? (
        panelEntriesByMonth(next).map((m) => (
          <div key={m.month} className="panel-month">
            <h3 className="subhead">{fmt.monthYear(m.month)}</h3>
            <ul className="agenda-list">{m.entries.map(row)}</ul>
          </div>
        ))
      ) : (
        <ul className="agenda-list">{shown.map(row)}</ul>
      )}
      {next.length > shown.length && (
        <div>
          <MoreLink to={href('/calendario')} label={t('secciones.panel.agenda.more', { n: next.length - shown.length })} />
        </div>
      )}
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

export function AgendaAction() {
  return <ScopedMore to="/calendario" label={t('secciones.panel.agenda.calendar')} />
}
