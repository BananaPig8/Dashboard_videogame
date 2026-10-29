// Seguimiento de los eventos pasados o celebrados: qué salió y qué queda por hacer, el feedback
// recogido, las pruebas que se hicieron allí y los gastos e ingresos apuntados. Si un evento
// pasó y sigue como previsto, pregunta si se celebró.
import { Link } from 'react-router-dom'
import { PLAYTEST_METHODS, TRANSACTION_CATEGORIES, TRANSACTION_KINDS, TRANSACTION_STATUSES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { eventoFollowUps, sectorEvents, type EventoFollowUp } from '../../../domain/selectors'
import type { EventStatus } from '../../../domain/types'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { EventStatusPill, Pill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useScope, useUI } from '../../context'
import { useUndoable } from '../../feedback'
import { useFormat, useToday } from '../../hooks'
import { usePreferences } from '../../prefs'
import { FeedbackRow } from '../feedback/comunes'
import type { SectionPageProps } from '../registry'
import { EVENT_TYPE_ICON, EventProject, EventTypePill, EventosPage, useEventDate, useEventosQuery } from './comunes'

export function EventosSeguimiento({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const today = useToday()
  const { tipo, query } = useEventosQuery()
  const list = eventoFollowUps(data, today, query)
  const any = sectorEvents(data, { ...query, tag: null }).length > 0
  const stale = list.filter((f) => f.stale).length

  return (
    <EventosPage embedded={embedded} tipo={tipo} intro={<p>{t('secciones.eventos.seguimiento.intro')}</p>}>
      {stale > 0 && (
        <p className="eventos-stale-note">
          <Icon name="question" size={14} />{' '}
          {t(stale === 1 ? 'secciones.eventos.seguimiento.staleOne' : 'secciones.eventos.seguimiento.staleMany', { n: stale })}
        </p>
      )}
      {list.length === 0 ? (
        <Card>
          <Empty icon="history">{any ? t('secciones.eventos.seguimiento.empty') : t(`secciones.eventos.tipos.${tipo ?? 'todos'}.empty`)}</Empty>
        </Card>
      ) : (
        list.map((f) => <FollowUp key={f.event.id} followUp={f} showProject={scope === null} />)
      )}
    </EventosPage>
  )
}

function FollowUp({ followUp: f, showProject }: { followUp: EventoFollowUp; showProject: boolean }) {
  const data = useStudioData()
  const { create, edit } = useUI()
  const { href } = useScope()
  const canEdit = useCanEdit()
  const undoable = useUndoable()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const when = useEventDate()
  const { hiddenSections } = usePreferences()
  const currency = data.studio.currency ?? 'EUR'
  const e = f.event
  const own = { eventId: e.id, ...(e.projectId ? { projectId: e.projectId } : {}) }
  const setStatus = (status: EventStatus) =>
    undoable(t(status === 'done' ? 'secciones.eventos.seguimiento.markedDone' : 'secciones.eventos.seguimiento.markedCancelled', { title: e.title }), () =>
      store.patch('events', e.id, { status }),
    )
  // Si el estudio no usa Finanzas (sección oculta), no se enseñan los gastos.
  const finances = !hiddenSections.includes('finanzas')
  const feedbackCount = (id: string) => data.feedback.filter((x) => x.playtestId === id).length

  return (
    <Card
      title={e.title}
      icon={EVENT_TYPE_ICON[e.type]}
      subtitle={[when(e), e.location].filter(Boolean).join(' · ')}
      action={
        canEdit ? (
          <button
            type="button"
            className="icon-btn small"
            onClick={() => edit({ collection: 'events', id: e.id })}
            aria-label={t('secciones.eventos.actions.edit', { title: e.title })}
            title={t('secciones.eventos.actions.edit', { title: e.title })}
          >
            <Icon name="edit" size={14} />
          </button>
        ) : undefined
      }
    >
      <div className="item-meta">
        <EventTypePill type={e.type} />
        <EventStatusPill status={e.status} />
        <EventProject event={e} showProject={showProject} />
      </div>
      {f.stale && (
        <div className="eventos-question" role="group" aria-label={t('secciones.eventos.stale')}>
          <span>
            <Icon name="question" size={14} /> {t('secciones.eventos.seguimiento.question')}
          </span>
          {canEdit && (
            <div className="button-row">
              <button type="button" className="btn btn-small" onClick={() => setStatus('done')}>
                <Icon name="check" size={14} /> {t('secciones.eventos.seguimiento.yes')}
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setStatus('cancelled')}>
                <Icon name="xCircle" size={14} /> {t('secciones.eventos.seguimiento.no')}
              </button>
            </div>
          )}
        </div>
      )}

      <section className="eventos-block">
        <h3 className="subhead">{t('secciones.eventos.seguimiento.followUp')}</h3>
        {e.followUp ? <p className="eventos-followup">{e.followUp}</p> : <p className="muted small">{t('secciones.eventos.seguimiento.noFollowUp')}</p>}
        {canEdit && !e.followUp && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => edit({ collection: 'events', id: e.id })}>
            <Icon name="edit" size={14} /> {t('secciones.eventos.seguimiento.writeFollowUp')}
          </button>
        )}
      </section>

      <section className="eventos-block">
        <div className="eventos-block-head">
          <h3 className="subhead">{t('secciones.eventos.seguimiento.feedback', { n: f.feedback.length })}</h3>
          {f.feedback.length > 0 && (
            <Link className="small" to={href(`/feedback?${new URLSearchParams({ evento: e.id })}`)}>
              {t('secciones.eventos.seguimiento.feedbackLink')}
            </Link>
          )}
        </div>
        {f.feedback.length ? (
          <ul className="item-list">
            {f.feedback.map((x) => (
              <FeedbackRow key={x.id} feedback={x} compact />
            ))}
          </ul>
        ) : (
          <p className="muted small">{t('secciones.eventos.seguimiento.noFeedback')}</p>
        )}
        {canEdit && (
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => create('feedback', { ...own, origin: 'event', ...(e.date ? { receivedAt: e.date } : {}) })}
          >
            <Icon name="plus" size={14} /> {t('secciones.eventos.seguimiento.addFeedback')}
          </button>
        )}
      </section>

      {f.playtests.length > 0 && (
        <section className="eventos-block">
          <h3 className="subhead">{t('secciones.eventos.seguimiento.playtests', { n: f.playtests.length })}</h3>
          <ul className="eventos-mini-list">
            {f.playtests.map((p) => (
              <li key={p.id}>
                <button type="button" className="link-btn" onClick={() => edit({ collection: 'playtests', id: p.id })}>
                  {p.title}
                </button>
                <span className="meta-date">
                  {' · '}
                  {[
                    p.date ? fmt.date(p.date, year) : t('secciones.eventos.noDate'),
                    PLAYTEST_METHODS[p.method],
                    p.participants !== undefined ? t('secciones.eventos.seguimiento.people', { n: p.participants }) : undefined,
                    t('secciones.eventos.seguimiento.playtestFeedback', { n: feedbackCount(p.id) }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finances && (
        <section className="eventos-block">
          <h3 className="subhead">{t('secciones.eventos.seguimiento.money')}</h3>
          {f.transactions.length ? (
            <>
              <ul className="eventos-money">
                {f.transactions.map((x) => (
                  <li key={x.id}>
                    <button type="button" className="link-btn" onClick={() => edit({ collection: 'transactions', id: x.id })}>
                      {x.description}
                    </button>
                    <span className="meta-date">
                      {TRANSACTION_KINDS[x.kind].label} · {TRANSACTION_CATEGORIES[x.category]} · {fmt.date(x.date, year)}
                    </span>
                    {x.status !== 'done' && (
                      <Pill tone={TRANSACTION_STATUSES[x.status].tone} icon="clock">
                        {TRANSACTION_STATUSES[x.status].label}
                      </Pill>
                    )}
                    <span className={x.kind === 'income' ? 'eventos-amount income' : 'eventos-amount'}>
                      {x.kind === 'income' ? '+' : '−'}
                      {fmt.money(x.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="eventos-totals small">
                {t('secciones.eventos.seguimiento.spent', { amount: fmt.money(f.spent, currency) })}
                {f.plannedSpend > 0 && ` · ${t('secciones.eventos.seguimiento.plannedSpend', { amount: fmt.money(f.plannedSpend, currency) })}`}
                {f.income > 0 && ` · ${t('secciones.eventos.seguimiento.income', { amount: fmt.money(f.income, currency) })}`}
              </p>
            </>
          ) : (
            <p className="muted small">{t('secciones.eventos.seguimiento.noMoney')}</p>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => create('transactions', { ...own, kind: 'expense', category: 'events', ...(e.date ? { date: e.date } : {}) })}
            >
              <Icon name="plus" size={14} /> {t('secciones.eventos.seguimiento.addExpense')}
            </button>
          )}
        </section>
      )}
    </Card>
  )
}
