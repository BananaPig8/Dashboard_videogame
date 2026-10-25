// Finanzas › Tasas y gastos de eventos: los movimientos con evento (eventId), agrupados por
// evento y separados en tasas («Tasas»), gastos del evento («Eventos y ferias») y otros.
// Debajo, los gastos de eventos sin evento enlazado y los eventos sin nada anotado.
import { REGISTRATION_STATUSES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { financeEventCosts, financeEventsWithoutCosts, financeUnlinkedEventCosts, type FinanceEventCost } from '../../../domain/selectors'
import type { StudioEvent } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { EventStatusPill, Pill, ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { categoryName, FinanceNote, LatePill, SignedAmount, TransactionStatusPill, useMoney } from './comunes'

/** La fecha de un evento, diciendo si está sin confirmar. */
function EventDate({ event }: { event: StudioEvent }) {
  const fmt = useFormat()
  const year = yearOf(useToday())
  if (!event.date) return <span className="meta-date">{t('secciones.finanzas.eventos.noDate')}</span>
  return (
    <>
      <span className="meta-date">
        <Icon name="calendar" size={12} /> {fmt.date(event.date, year)}
      </span>
      {!event.dateConfirmed && (
        <Pill tone="warning" icon="question">
          {t('secciones.finanzas.eventos.dateUnconfirmed')}
        </Pill>
      )}
    </>
  )
}

function EventBlock({ c, showProject }: { c: FinanceEventCost; showProject: boolean }) {
  const data = useStudioData()
  const { edit, create } = useUI()
  const canEdit = useCanEdit()
  const money = useMoney()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const name = c.event?.title ?? t('secciones.finanzas.common.eventGone')
  const E = (k: 'fees' | 'costs' | 'other' | 'spent' | 'upcoming' | 'income') => t(`secciones.finanzas.eventos.${k}`)
  // Solo las cifras que dicen algo; el total gastado, siempre.
  const figures: [string, number, boolean?][] = [
    [E('fees'), c.fees],
    [E('costs'), c.costs],
    [E('other'), c.other],
    [E('spent'), c.spent, true],
    [E('upcoming'), c.upcoming],
    [E('income'), c.income],
  ]
  return (
    <li className="finanzas-event">
      <div className="finanzas-budget-head">
        <h3>
          {c.event ? (
            <button type="button" className="item-title" onClick={() => edit({ collection: 'events', id: c.eventId })}>
              {name}
            </button>
          ) : (
            <span className="muted">{name}</span>
          )}
        </h3>
        {c.event && <EventStatusPill status={c.event.status} />}
      </div>
      {c.event && (
        <div className="item-meta">
          <EventDate event={c.event} />
          {showProject && c.event.projectId && <ProjectChip project={data.projects.find((p) => p.id === c.event!.projectId)} />}
        </div>
      )}
      <dl className="finanzas-figures">
        {figures
          .filter(([, value, always]) => always || value > 0)
          .map(([label, value, always]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="num">{always ? <strong>{money(value)}</strong> : money(value)}</dd>
            </div>
          ))}
      </dl>
      <ul className="finanzas-list" aria-label={t('secciones.finanzas.eventos.movements', { name })}>
        {c.transactions.map((x) => (
          <li key={x.id} className="finanzas-row">
            <span className="finanzas-row-date meta-date">{fmt.date(x.date, year)}</span>
            <div className="finanzas-row-main">
              <button type="button" className="item-title" onClick={() => edit({ collection: 'transactions', id: x.id })}>
                {x.description}
              </button>
              <div className="item-meta">
                <span className="meta-date">{categoryName(x)}</span>
                <TransactionStatusPill status={x.status} />
                <LatePill tx={x} />
              </div>
            </div>
            <SignedAmount tx={x} />
          </li>
        ))}
      </ul>
      {canEdit && c.event && (
        <div className="button-row">
          <button
            type="button"
            className="btn btn-small btn-ghost"
            aria-label={t('secciones.finanzas.eventos.addCostTo', { name })}
            onClick={() => create('transactions', { kind: 'expense', category: 'events', eventId: c.eventId, projectId: c.event?.projectId })}
          >
            <Icon name="plus" size={14} /> {t('secciones.finanzas.eventos.addCost')}
          </button>
        </div>
      )}
    </li>
  )
}

export function FinanzasEventos() {
  const data = useStudioData()
  const { scope } = useScope()
  const { edit, create } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const tag = useTagFilter()
  const costs = financeEventCosts(data, { scope, tag })
  const unlinked = financeUnlinkedEventCosts(data, { scope, tag })
  // «Sin nada anotado» no depende de etiquetas: con una etiqueta elegida no se enseña.
  const missing = tag ? [] : financeEventsWithoutCosts(data, scope)
  const showProject = scope === null

  return (
    <>
      <Card title={t('secciones.finanzas.eventos.title')} icon="ticket" subtitle={t('secciones.finanzas.eventos.subtitle')}>
        {costs.length ? (
          <ul className="finanzas-events">
            {costs.map((c) => (
              <EventBlock key={c.eventId} c={c} showProject={showProject} />
            ))}
          </ul>
        ) : (
          <Empty icon="ticket">{tag ? t('secciones.finanzas.eventos.noneTagged') : t('secciones.finanzas.eventos.none')}</Empty>
        )}
        <FinanceNote>{t('secciones.finanzas.eventos.note')}</FinanceNote>
      </Card>
      {unlinked.length > 0 && (
        <Card title={t('secciones.finanzas.eventos.unlinkedTitle')} icon="link" subtitle={t('secciones.finanzas.eventos.unlinkedSubtitle')}>
          <ul className="finanzas-list">
            {unlinked.map((x) => (
              <li key={x.id} className="finanzas-row">
                <span className="finanzas-row-date meta-date">{fmt.date(x.date, year)}</span>
                <div className="finanzas-row-main">
                  <button type="button" className="item-title" onClick={() => edit({ collection: 'transactions', id: x.id })}>
                    {x.description}
                  </button>
                  <div className="item-meta">
                    <span className="meta-date">{categoryName(x)}</span>
                    {showProject && x.projectId && <ProjectChip project={data.projects.find((p) => p.id === x.projectId)} />}
                    <TransactionStatusPill status={x.status} />
                  </div>
                </div>
                <SignedAmount tx={x} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      {!tag && (
        <Card title={t('secciones.finanzas.eventos.missingTitle')} icon="calendar" subtitle={t('secciones.finanzas.eventos.missingSubtitle')}>
          {missing.length ? (
            <ul className="finanzas-list">
              {missing.map((e) => (
                <li key={e.id} className="finanzas-row finanzas-row-event">
                  <div className="finanzas-row-main">
                    <button type="button" className="item-title" onClick={() => edit({ collection: 'events', id: e.id })}>
                      {e.title}
                    </button>
                    <div className="item-meta">
                      <EventStatusPill status={e.status} />
                      <EventDate event={e} />
                      {e.registrationStatus && (
                        <span className="meta-date">{t('secciones.finanzas.eventos.registration', { status: REGISTRATION_STATUSES[e.registrationStatus].label })}</span>
                      )}
                      {showProject && e.projectId && <ProjectChip project={data.projects.find((p) => p.id === e.projectId)} />}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      aria-label={t('secciones.finanzas.eventos.addFeeTo', { name: e.title })}
                      onClick={() => create('transactions', { kind: 'expense', category: 'fees', eventId: e.id, projectId: e.projectId })}
                    >
                      <Icon name="plus" size={14} /> {t('secciones.finanzas.eventos.addFee')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('secciones.finanzas.eventos.missingNone')}</p>
          )}
        </Card>
      )}
    </>
  )
}
