// Decisiones importantes (?tipo=decisiones): lo que queda por decidir, con sus opciones y lo que
// falta, y el registro de lo decidido por meses, con el día en que se cerró. Son elementos de
// trabajo de tipo «decisión»; se abren con el editor común.
import { decisionDate, decisionLog, decisions, hasTag, pausedItems } from '../../../domain/selectors'
import { yearOf } from '../../../domain/dates'
import type { WorkItem } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, PriorityTag, ProjectChip, StatusPill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { ItemList } from '../../components/ItemList'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { BodyText } from '../recursos/comunes'
import { DocumentacionPage, EventRef, NewButton } from './comunes'

export const NEW_DECISION = { kind: 'decision', status: 'to_confirm' }

const plural = (key: 'openCount' | 'logCount', n: number) => t(`secciones.documentacion.decisions.${key}.${n === 1 ? 'one' : 'many'}`, { n })

export function DocumentacionDecisiones({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const showProject = scope === null
  const { open: allOpen, taken } = decisions(data, scope)
  const open = allOpen.filter((d) => hasTag(d, tag))
  const log = decisionLog(data, scope)
    .map((m) => ({ ...m, decisions: m.decisions.filter((d) => hasTag(d, tag)) }))
    .filter((m) => m.decisions.length > 0)
  const closed = log.reduce((n, m) => n + m.decisions.length, 0)
  const parked = pausedItems(data, scope).filter((i) => hasTag(i, tag))
  const label = t('secciones.documentacion.actions.new.decisiones')
  const emptyAction = canEdit && !tag ? { label, onClick: () => create('items', NEW_DECISION) } : undefined
  const events = new Map(data.events.map((e) => [e.id, e]))
  const meta = (d: WorkItem) => (
    <div className="item-meta">
      {showProject && <ProjectChip project={data.projects.find((p) => p.id === d.projectId)} />}
      <EventRef event={d.eventId ? events.get(d.eventId) : undefined} missing={!!d.eventId} />
      <ConfidenceTag confidence={d.confidence} compact />
      <TagLinks tags={d.tags} />
    </div>
  )

  return (
    <DocumentacionPage
      embedded={embedded}
      intro={t('secciones.documentacion.intro.decisiones')}
      actions={<NewButton collection="items" defaults={NEW_DECISION} label={label} primary />}
    >
      <Card title={t('secciones.documentacion.decisions.open')} icon="question" subtitle={open.length ? plural('openCount', open.length) : undefined}>
        {open.length === 0 ? (
          <Empty action={emptyAction}>{tag && allOpen.length ? t('secciones.documentacion.emptyTag') : t('secciones.documentacion.decisions.openEmpty')}</Empty>
        ) : (
          <ul className="documentacion-decisions">
            {open.map((d) => (
              <li key={d.id} className="documentacion-decision">
                <div className="documentacion-decision-head">
                  <h3 className="documentacion-decision-title">
                    <OpenItem item={d} />
                  </h3>
                  <StatusPill status={d.status} />
                  <PriorityTag priority={d.priority} hideMedium />
                </div>
                {d.description && <p className="item-detail">{d.description}</p>}
                {d.decisionOutcome && (
                  <div className="documentacion-options">
                    <span className="subhead">{t('secciones.documentacion.decisions.options')}</span>
                    <BodyText text={d.decisionOutcome} />
                  </div>
                )}
                {d.blockedReason && (
                  <p className="documentacion-missing">
                    <strong>{t('secciones.documentacion.decisions.missing')}:</strong> {d.blockedReason}
                  </p>
                )}
                {meta(d)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-2-1">
        <Card
          title={t('secciones.documentacion.decisions.log')}
          icon="scale"
          subtitle={closed ? plural('logCount', closed) : t('secciones.documentacion.decisions.logSub')}
        >
          {log.length === 0 ? (
            <Empty icon="scale" action={taken.length ? undefined : emptyAction}>
              {tag && taken.length ? t('secciones.documentacion.emptyTag') : t('secciones.documentacion.decisions.logEmpty')}
            </Empty>
          ) : (
            log.map((m) => (
              <div key={m.month ?? 'sin-fecha'} className="documentacion-month">
                <h3 className="subhead">{m.month ? fmt.monthYear(m.month) : t('secciones.documentacion.decisions.noDateMonth')}</h3>
                <ol className="timeline documentacion-timeline">
                  {m.decisions.map((d) => {
                    const date = decisionDate(d)
                    return (
                      <li key={d.id}>
                        <span className="timeline-date">{date ? fmt.date(date, year) : t('secciones.documentacion.decisions.noDate')}</span>
                        <div>
                          <div className="documentacion-decision-head">
                            <OpenItem item={d} />
                            {d.status === 'cancelled' && <StatusPill status={d.status} />}
                          </div>
                          {d.decisionOutcome && <p className="documentacion-outcome">{d.decisionOutcome}</p>}
                          {meta(d)}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))
          )}
        </Card>
        <Card title={t('secciones.documentacion.decisions.parked')} icon="pause" subtitle={t('secciones.documentacion.decisions.parkedSub')}>
          <ItemList
            items={parked}
            data={data}
            showProject={showProject}
            detail="blocked"
            year={year}
            showTags
            empty={t('secciones.documentacion.decisions.parkedEmpty')}
          />
        </Card>
      </div>
    </DocumentacionPage>
  )
}

/** El título de una decisión: abre el editor. */
function OpenItem({ item }: { item: WorkItem }) {
  const { openItem } = useUI()
  return (
    <button type="button" className="item-title" onClick={() => openItem(item.id)}>
      {item.title}
    </button>
  )
}
