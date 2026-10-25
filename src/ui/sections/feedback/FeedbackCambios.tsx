// Cambios por el feedback: el feedback que tiene elementos de trabajo que lo resuelven. Lo
// que ya cambió (todo lo enlazado está hecho), lo que está en marcha y, si queda, lo enlazado
// sin nada hecho. Si todo está hecho y el feedback sigue abierto, se ofrece cerrarlo.
import { Link } from 'react-router-dom'
import { FEEDBACK_STATUSES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { feedbackChanges, type FeedbackChange } from '../../../domain/selectors'
import type { WorkItem } from '../../../domain/types'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { KindIcon, StatusPill } from '../../components/Badges'
import { Card, Empty, Progress, Stat } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useSectionNav } from '../../components/SectionHeader'
import { useScope, useUI } from '../../context'
import { useUndoable } from '../../feedback'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { FeedbackFiltros, FeedbackPage, FeedbackRow, useFeedbackQuery } from './comunes'

export function FeedbackCambios({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const nav = useSectionNav('feedback')
  const { tipo, query } = useFeedbackQuery()
  const c = feedbackChanges(data, query)
  const showProject = scope === null
  const prioritize = nav.section.children.find((x) => x.id === 'priorizacion')!
  const total = c.changed.length + c.inProgress.length + c.none.length

  return (
    <FeedbackPage
      embedded={embedded}
      tipo={tipo}
      intro={
        <>
          <p>{t('secciones.feedback.cambios.intro')}</p>
          {tipo === 'bugs' && <p>{t('secciones.feedback.cambios.bugs')}</p>}
        </>
      }
    >
      <FeedbackFiltros query={query} />
      <div className="stats feedback-stats">
        <Stat label={t('secciones.feedback.cambios.stats.changed')} value={c.changed.length} tone={c.changed.length ? 'info' : 'neutral'} icon="checkCircle" />
        <Stat label={t('secciones.feedback.cambios.stats.inProgress')} value={c.inProgress.length} icon="play" />
        <Stat label={t('secciones.feedback.cambios.stats.unlinked')} value={c.unlinkedOpen.length} tone={c.unlinkedOpen.length ? 'warning' : 'neutral'} icon="link" />
      </div>
      {c.unlinkedOpen.length > 0 && (
        <p className="feedback-note">
          <Icon name="info" size={14} />{' '}
          {t(c.unlinkedOpen.length === 1 ? 'secciones.feedback.cambios.unlinked.one' : 'secciones.feedback.cambios.unlinked.many', { n: c.unlinkedOpen.length })}{' '}
          <Link to={nav.href(prioritize)}>{t('secciones.feedback.cambios.unlinked.link')}</Link>
        </p>
      )}
      {total === 0 ? (
        <Card>
          <Empty icon="link">{t('secciones.feedback.cambios.empty')}</Empty>
        </Card>
      ) : (
        <>
          <Card title={t('secciones.feedback.cambios.changed')} icon="checkCircle" subtitle={t('secciones.feedback.cambios.changedHint')}>
            {c.changed.length ? (
              <ul className="item-list">
                {c.changed.map((x) => (
                  <ChangeRow key={x.feedback.id} change={x} showProject={showProject} />
                ))}
              </ul>
            ) : (
              <Empty>{t('secciones.feedback.cambios.changedEmpty')}</Empty>
            )}
          </Card>
          <Card title={t('secciones.feedback.cambios.inProgress')} icon="play" subtitle={t('secciones.feedback.cambios.inProgressHint')}>
            {c.inProgress.length ? (
              <ul className="item-list">
                {c.inProgress.map((x) => (
                  <ChangeRow key={x.feedback.id} change={x} showProject={showProject} />
                ))}
              </ul>
            ) : (
              <Empty>{t('secciones.feedback.cambios.inProgressEmpty')}</Empty>
            )}
          </Card>
          {c.none.length > 0 && (
            <Card title={t('secciones.feedback.cambios.none')} icon="xCircle" subtitle={t('secciones.feedback.cambios.noneHint')}>
              <ul className="item-list">
                {c.none.map((x) => (
                  <ChangeRow key={x.feedback.id} change={x} showProject={showProject} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </FeedbackPage>
  )
}

function ChangeRow({ change: c, showProject }: { change: FeedbackChange; showProject: boolean }) {
  const canEdit = useCanEdit()
  const undoable = useUndoable()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const items = [...c.done, ...c.open, ...c.cancelled]
  const counted = c.done.length + c.open.length
  return (
    <FeedbackRow feedback={c.feedback} showProject={showProject} compact>
      {c.state === 'in_progress' && (
        <div className="feedback-progress">
          <Progress ratio={counted ? c.done.length / counted : 0} tone="info" label={t('secciones.feedback.cambios.progress', { done: c.done.length, total: counted })} />
          <span className="muted small">{t('secciones.feedback.cambios.progress', { done: c.done.length, total: counted })}</span>
        </div>
      )}
      {c.changedAt && c.state === 'changed' && (
        <span className="meta-date">{t('secciones.feedback.cambios.changedAt', { date: fmt.date(c.changedAt, year) })}</span>
      )}
      <ul className="feedback-change-items">
        {items.map((i) => (
          <ChangeItem key={i.id} item={i} />
        ))}
        {c.missing.length > 0 && <li className="muted small">{t('secciones.feedback.cambios.missing', { n: c.missing.length })}</li>}
      </ul>
      {c.canClose && (
        <div className="feedback-close">
          <span className="small">
            <Icon name="info" size={14} /> {t('secciones.feedback.cambios.canClose', { status: FEEDBACK_STATUSES[c.feedback.status].label })}
          </span>
          {canEdit && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() =>
                undoable(t('secciones.feedback.quick.done', { title: c.feedback.title, status: FEEDBACK_STATUSES.addressed.label }), () =>
                  store.patch('feedback', c.feedback.id, { status: 'addressed' }),
                )
              }
            >
              <Icon name="checkCircle" size={14} /> {t('secciones.feedback.cambios.close')}
            </button>
          )}
        </div>
      )}
    </FeedbackRow>
  )
}

function ChangeItem({ item: i }: { item: WorkItem }) {
  const { openItem } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  return (
    <li>
      <KindIcon kind={i.kind} />
      <button type="button" className="link-btn" onClick={() => openItem(i.id)}>
        {i.title}
      </button>
      <StatusPill status={i.status} />
      {i.status === 'done' && i.completedAt && <span className="meta-date">{fmt.date(i.completedAt, year)}</span>}
    </li>
  )
}
