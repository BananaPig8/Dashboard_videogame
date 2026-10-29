// La agenda de eventos de una subsección (?tipo=): los próximos por meses, los que no tienen
// fecha, los pasados y los cancelados.
import { Link } from 'react-router-dom'
import { eventosAgenda, sectorEvents } from '../../../domain/selectors'
import type { StudioEvent } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { Card, Empty } from '../../components/Common'
import { useSectionNav } from '../../components/SectionHeader'
import { useScope } from '../../context'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { EventRow, EventosPage, useEventosQuery, useNewEvent } from './comunes'

/** Cuántos pasados se enseñan antes de mandar al seguimiento. */
const PAST_LIMIT = 10

export function EventosLista({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, href } = useScope()
  const today = useToday()
  const fmt = useFormat()
  const canEdit = useCanEdit()
  const nav = useSectionNav('eventos')
  const { tipo, query } = useEventosQuery()
  const newEvent = useNewEvent(tipo)
  const key = tipo ?? 'todos'
  const events = sectorEvents(data, query)
  const any = query.tag ? sectorEvents(data, { ...query, tag: null }).length > 0 : events.length > 0
  const a = eventosAgenda(events, today)
  const showProject = scope === null
  const followUp = nav.section.children.find((c) => c.id === 'seguimiento')!

  const byMonth = new Map<string, StudioEvent[]>()
  for (const e of a.upcoming) byMonth.set(e.date!.slice(0, 7), [...(byMonth.get(e.date!.slice(0, 7)) ?? []), e])

  const list = (es: StudioEvent[]) => (
    <ul className="agenda-list">
      {es.map((e) => (
        <EventRow key={e.id} event={e} showProject={showProject} today={today} />
      ))}
    </ul>
  )

  return (
    <EventosPage
      embedded={embedded}
      tipo={tipo}
      intro={
        <p>
          {t(`secciones.eventos.tipos.${key}.intro`)} {t('secciones.eventos.calendarNote')}{' '}
          <Link to={href('/calendario')}>{t('secciones.eventos.calendarLink')}</Link>
        </p>
      }
    >
      {events.length === 0 ? (
        <Card>
          <Empty icon="ticket" action={canEdit && !query.tag ? { label: t('secciones.eventos.actions.new'), onClick: newEvent } : undefined}>
            {any ? t('secciones.eventos.list.emptyTag') : t(`secciones.eventos.tipos.${key}.empty`)}
          </Empty>
        </Card>
      ) : (
        <>
          <Card title={t('secciones.eventos.list.upcoming')} icon="calendar" subtitle={count(a.upcoming.length)}>
            {a.upcoming.length ? (
              [...byMonth.entries()].map(([month, es]) => (
                <div key={month} className="month-group">
                  <h3 className="subhead">{fmt.monthYear(month)}</h3>
                  {list(es)}
                </div>
              ))
            ) : (
              <Empty icon="calendar" action={canEdit ? { label: t('secciones.eventos.actions.new'), onClick: newEvent } : undefined}>
                {t('secciones.eventos.list.noUpcoming')}
              </Empty>
            )}
          </Card>
          {a.undated.length > 0 && (
            <Card title={t('secciones.eventos.list.undated')} icon="question" subtitle={t('secciones.eventos.list.undatedHint')}>
              {list(a.undated)}
            </Card>
          )}
          {a.past.length > 0 && (
            <Card title={t('secciones.eventos.list.past')} icon="history" subtitle={count(a.past.length)}>
              {list(a.past.slice(0, PAST_LIMIT))}
              <p className="muted small">
                {a.past.length > PAST_LIMIT && `${t('secciones.eventos.list.more', { n: a.past.length - PAST_LIMIT })} `}
                <Link to={nav.href(followUp)}>{t('secciones.eventos.list.followUpLink')}</Link>
              </p>
            </Card>
          )}
          {a.cancelled.length > 0 && (
            <details className="card eventos-cancelled">
              <summary>{t('secciones.eventos.list.cancelled', { n: a.cancelled.length })}</summary>
              {list(a.cancelled)}
            </details>
          )}
        </>
      )}
    </EventosPage>
  )
}

const count = (n: number) => t(n === 1 ? 'secciones.eventos.count.one' : 'secciones.eventos.count.many', { n })
