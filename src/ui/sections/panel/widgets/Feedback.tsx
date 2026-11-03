// Feedback: lo que dicen los jugadores y qué se hace con ello. Cifras que llevan a Feedback con
// su filtro y el ámbito (contadas con los mismos filtros que allí: panelFeedback), lo que pide
// mirarse (con «Convertir en tarea») y lo descartado con su motivo.
import { FEEDBACK_ORIGINS } from '../../../../domain/catalog'
import { feedbackLinkedToTask, feedbackTaskDefaults, panelFeedback, type PanelFeedbackFigure, type PanelFeedbackFigureId } from '../../../../domain/selectors'
import type { Feedback, SourceRef } from '../../../../domain/types'
import type { Tone } from '../../../../domain/catalog'
import { store, useCanEdit } from '../../../../data/store'
import { t } from '../../../../i18n'
import { FeedbackStatusPill, ProjectChip } from '../../../components/Badges'
import { Empty, Stat } from '../../../components/Common'
import { Icon, type IconName } from '../../../components/Icon'
import { useScope, useUI } from '../../../context'
import { useUndoable } from '../../../feedback'
import { FeedbackKindPill, ImpactTag } from '../../feedback/comunes'
import { MoreLink, ScopedMore, type WidgetProps } from './comunes'
import './feedback.css'

/** Cuánto se enseña de cada lista (a dos columnas, algo más). */
const REVIEW_LIMIT = 5
const REVIEW_LIMIT_WIDE = 8
const DISCARDED_LIMIT = 3
const DISCARDED_LIMIT_WIDE = 5

const FIGURE_ICON: Record<PanelFeedbackFigureId, IconName> = {
  new: 'bell',
  triaged: 'eye',
  accepted: 'calendar',
  criticalBugs: 'bug',
  implemented: 'checkCircle',
  discarded: 'xCircle',
}

/** El tono de cada cifra: los de los estados del feedback (nuevo, ámbar; crítico, rojo…). */
function figureTone(f: PanelFeedbackFigure): Tone {
  if (f.value === null || f.value === 0) return 'neutral'
  switch (f.id) {
    case 'new':
      return 'warning'
    case 'criticalBugs':
      return 'danger'
    case 'triaged':
    case 'accepted':
      return 'info'
    case 'implemented':
      return 'success'
    default:
      return 'muted'
  }
}

function figureHint(f: PanelFeedbackFigure): string {
  if (f.gap) return t(`secciones.panel.actividad.feedback.gaps.${f.gap}`)
  if (f.id === 'criticalBugs' && f.fromTasks)
    return f.fromTasks === 1
      ? t('secciones.panel.actividad.feedback.hints.criticalBugsTasksOne')
      : t('secciones.panel.actividad.feedback.hints.criticalBugsTasksOther', { n: f.fromTasks })
  return t(`secciones.panel.actividad.feedback.hints.${f.id}`)
}

export function FeedbackBody({ data, scope, today, year, fmt, wide }: WidgetProps) {
  const { edit, create } = useUI()
  const { href } = useScope()
  const canEdit = useCanEdit()
  const undoable = useUndoable()
  const summary = panelFeedback(data, scope)

  if (summary.total === 0) {
    return (
      <Empty icon="message" action={canEdit ? { label: t('secciones.feedback.actions.new'), onClick: () => create('feedback') } : undefined}>
        {t('secciones.panel.actividad.feedback.empty')}
      </Empty>
    )
  }

  /**
   * Convertir en tarea, en un solo flujo: el editor de una tarea nueva con lo del feedback; al
   * guardarla, el feedback queda enlazado a ella (y planificado, si estaba nuevo o revisado).
   * Si se cancela el editor, no cambia nada.
   */
  const convert = (f: Feedback) => {
    const origin = f.originDetail ? `${FEEDBACK_ORIGINS[f.origin]} · ${f.originDetail}` : FEEDBACK_ORIGINS[f.origin]
    const source: SourceRef = {
      type: 'manual',
      ref: t('secciones.panel.actividad.feedback.sourceRef', { title: f.title }),
      date: today,
      note: f.receivedAt
        ? t('secciones.panel.actividad.feedback.sourceNote', { title: f.title, origin, date: fmt.date(f.receivedAt) })
        : t('secciones.panel.actividad.feedback.sourceNoteNoDate', { title: f.title, origin }),
    }
    create('items', feedbackTaskDefaults(f, source) as Record<string, unknown>, (task) => {
      const current = store.getData().feedback.find((x) => x.id === f.id)
      if (!current || typeof task.id !== 'string') return
      const next = feedbackLinkedToTask(current, task.id)
      const message = next.status !== current.status ? 'linkedPlanned' : 'linked'
      undoable(t(`secciones.panel.actividad.feedback.${message}`, { title: current.title }), () => store.upsert('feedback', next))
    })
  }

  const reviewLimit = wide ? REVIEW_LIMIT_WIDE : REVIEW_LIMIT
  const discardedLimit = wide ? DISCARDED_LIMIT_WIDE : DISCARDED_LIMIT
  const review = summary.toReview.slice(0, reviewLimit)
  const discarded = summary.discarded.slice(0, discardedLimit)

  return (
    <div className="fb-block">
      <div className="stats fb-stats" role="group" aria-label={t('secciones.panel.actividad.feedback.cifras')}>
        {summary.figures.map((f) => (
          <Stat
            key={f.id}
            to={href(f.to)}
            icon={FIGURE_ICON[f.id]}
            tone={figureTone(f)}
            label={t(`secciones.panel.actividad.feedback.figures.${f.id}`)}
            hint={figureHint(f)}
            value={
              f.value === null ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="visually-hidden">{t('secciones.panel.actividad.feedback.noData')}</span>
                </>
              ) : (
                f.value
              )
            }
          />
        ))}
      </div>

      <section className="fb-section" aria-label={t('secciones.panel.actividad.feedback.toReview')}>
        <h3 className="subhead">
          {t('secciones.panel.actividad.feedback.toReview')} <span className="num">({summary.toReview.length})</span>
        </h3>
        {review.length === 0 ? (
          <p className="muted small">{t('secciones.panel.actividad.feedback.toReviewNone')}</p>
        ) : (
          <ul className="item-list">
            {review.map((f) => (
              <li key={f.id} className="item-row fb-row">
                <div className="item-main">
                  <button type="button" className="item-title" onClick={() => edit({ collection: 'feedback', id: f.id })}>
                    {f.title}
                  </button>
                  <div className="item-meta">
                    <FeedbackKindPill kind={f.kind} />
                    <ImpactTag impact={f.impact} />
                    {!scope && <ProjectChip project={data.projects.find((p) => p.id === f.projectId)} />}
                    <span className="meta-date">{f.originDetail ?? FEEDBACK_ORIGINS[f.origin]}</span>
                    {f.receivedAt && <span className="meta-date">{fmt.date(f.receivedAt, year)}</span>}
                    {f.linkedItemIds.length > 0 && (
                      <span className="meta-date">
                        {f.linkedItemIds.length === 1
                          ? t('secciones.panel.actividad.feedback.linkedOne')
                          : t('secciones.panel.actividad.feedback.linkedOther', { n: f.linkedItemIds.length })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="item-side">
                  <FeedbackStatusPill status={f.status} />
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => convert(f)}
                      aria-label={t('secciones.panel.actividad.feedback.convertLabel', { title: f.title })}
                    >
                      <Icon name="check" size={14} /> {t('secciones.panel.actividad.feedback.convert')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {summary.toReview.length > review.length && (
          <MoreLink to={href('/feedback?vista=priorizacion')} label={t('secciones.panel.actividad.feedback.toReviewMore', { n: summary.toReview.length })} />
        )}
      </section>

      {discarded.length > 0 && (
        <section className="fb-section" aria-label={t('secciones.panel.actividad.feedback.discarded')}>
          <h3 className="subhead">
            {t('secciones.panel.actividad.feedback.discarded')} <span className="num">({summary.discarded.length})</span>
          </h3>
          <ul className="fb-discarded">
            {discarded.map((f) => (
              <li key={f.id}>
                <button type="button" className="item-title" onClick={() => edit({ collection: 'feedback', id: f.id })}>
                  {f.title}
                </button>
                {!scope && <ProjectChip project={data.projects.find((p) => p.id === f.projectId)} />}
                <span className={f.resolution?.trim() ? 'fb-reason' : 'fb-reason fb-reason-none'}>
                  {f.resolution?.trim() || t('secciones.panel.actividad.feedback.noReason')}
                </span>
              </li>
            ))}
          </ul>
          {summary.discarded.length > discarded.length && (
            <MoreLink to={href('/feedback?estado=wont_do')} label={t('secciones.panel.actividad.feedback.discardedMore', { n: summary.discarded.length })} />
          )}
        </section>
      )}
    </div>
  )
}

export function FeedbackAction() {
  return <ScopedMore to="/feedback" label={t('secciones.panel.actividad.feedback.all')} />
}
