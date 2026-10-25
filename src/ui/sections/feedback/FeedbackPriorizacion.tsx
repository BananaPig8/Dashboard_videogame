// Priorización: el feedback abierto por impacto × estado. Arriba, el cuadro (cada casilla
// filtra la lista); debajo, la cola con lo nuevo y lo revisado primero, por impacto, y los
// cambios rápidos de estado. En Bugs, también las incidencias de Tareas que ningún bug enlaza.
import { Link, useLocation } from 'react-router-dom'
import { FEEDBACK_STATUSES, PRIORITIES } from '../../../domain/catalog'
import {
  FEEDBACK_OPEN_STATUSES,
  IMPACT_ORDER,
  byPriority,
  feedbackMatrix,
  feedbackQueue,
  feedbackQuickStatuses,
  issueMatches,
  unlinkedIssues,
} from '../../../domain/selectors'
import type { Feedback, FeedbackStatus } from '../../../domain/types'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { useUndoable } from '../../feedback'
import { useScope } from '../../context'
import { yearOf } from '../../../domain/dates'
import { useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { FEEDBACK_STATUS_ICON, FeedbackFiltros, FeedbackPage, FeedbackRow, ImpactTag, useFeedbackQuery } from './comunes'

export function FeedbackPriorizacion({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const today = useToday()
  const { tipo, query } = useFeedbackQuery()
  const location = useLocation()
  const showProject = scope === null
  // El cuadro cuenta todo lo abierto con los demás filtros (sin el de impacto ni el de estado).
  const queue = feedbackQueue(data, query)
  const matrix = feedbackMatrix(feedbackQueue(data, { ...query, impacto: null, estado: null }))
  const issues = tipo === 'bugs' ? unlinkedIssues(data, scope).filter((i) => issueMatches(i, { ...query, estado: 'abierto' })).sort(byPriority) : []
  const key = tipo ?? 'todo'

  /** La casilla del cuadro: filtra por ese impacto y ese estado (o quita el filtro si ya está). */
  const cellHref = (impact: string, status: string) => {
    const next = new URLSearchParams(location.search)
    const on = query.impacto === impact && query.estado === status
    if (on) {
      next.delete('impacto')
      next.delete('estado')
    } else {
      next.set('impacto', impact)
      next.set('estado', status)
    }
    return `${location.pathname}?${next}`
  }

  return (
    <FeedbackPage
      embedded={embedded}
      tipo={tipo}
      intro={
        <>
          <p>{t('secciones.feedback.priorizacion.intro')}</p>
          {tipo && <p>{t(`secciones.feedback.priorizacion.tipo.${tipo}`)}</p>}
        </>
      }
    >
      <Card title={t('secciones.feedback.priorizacion.matrix')} icon="layout" subtitle={t('secciones.feedback.priorizacion.matrixHint')}>
        <div className="table-wrap">
          <table className="table feedback-matrix">
            <caption className="visually-hidden">{t('secciones.feedback.priorizacion.matrixCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('secciones.feedback.priorizacion.impactCol')}</th>
                {FEEDBACK_OPEN_STATUSES.map((s) => (
                  <th key={s} scope="col" className="num">
                    {FEEDBACK_STATUSES[s].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {IMPACT_ORDER.map((p) => (
                <tr key={p}>
                  <th scope="row">
                    <ImpactTag impact={p} />
                  </th>
                  {FEEDBACK_OPEN_STATUSES.map((s) => {
                    const n = matrix[p][s].length
                    const on = query.impacto === p && query.estado === s
                    const label = t('secciones.feedback.priorizacion.cell', { n, impact: PRIORITIES[p].label.toLowerCase(), status: FEEDBACK_STATUSES[s].label.toLowerCase() })
                    return (
                      <td key={s} data-label={FEEDBACK_STATUSES[s].label} className="num">
                        {n > 0 ? (
                          <Link
                            to={cellHref(p, s)}
                            replace
                            className={on ? 'feedback-cell active' : 'feedback-cell'}
                            aria-label={label}
                            aria-current={on ? 'true' : undefined}
                            title={label}
                          >
                            {n}
                          </Link>
                        ) : (
                          <>
                            <span className="muted" aria-hidden="true">
                              0
                            </span>
                            <span className="visually-hidden">{label}</span>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <FeedbackFiltros query={query} />
      <Card
        title={t('secciones.feedback.priorizacion.queue')}
        icon="list"
        subtitle={t(queue.length === 1 ? 'secciones.feedback.count.one' : 'secciones.feedback.count.many', { n: queue.length })}
      >
        {queue.length ? (
          <ul className="item-list">
            {queue.map((f) => (
              <FeedbackRow key={f.id} feedback={f} showProject={showProject}>
                <QuickStatus feedback={f} />
              </FeedbackRow>
            ))}
          </ul>
        ) : (
          <Empty icon="checkCircle">{t(`secciones.feedback.priorizacion.empty.${key}`)}</Empty>
        )}
      </Card>
      {tipo === 'bugs' && (
        <Card
          title={t('secciones.feedback.priorizacion.issues')}
          icon="bug"
          subtitle={t(issues.length === 1 ? 'secciones.feedback.bugs.issues.one' : 'secciones.feedback.bugs.issues.many', { n: issues.length })}
        >
          <p className="muted small">{t('secciones.feedback.priorizacion.issuesHint')}</p>
          <ItemList items={issues} data={data} showProject={showProject} year={yearOf(today)} today={today} showTags empty={t('secciones.feedback.priorizacion.issuesEmpty')} />
        </Card>
      )}
    </FeedbackPage>
  )
}

/** Los cambios de estado rápidos de una fila (con «Deshacer»). Solo si se puede editar. */
function QuickStatus({ feedback: f }: { feedback: Feedback }) {
  const canEdit = useCanEdit()
  const undoable = useUndoable()
  if (!canEdit) return null
  const move = (status: FeedbackStatus) =>
    undoable(t('secciones.feedback.quick.done', { title: f.title, status: FEEDBACK_STATUSES[status].label }), () => store.patch('feedback', f.id, { status }))
  return (
    <div className="button-row feedback-quick" role="group" aria-label={t('secciones.feedback.quick.label', { title: f.title })}>
      {feedbackQuickStatuses(f.status).map((s) => (
        <button
          key={s}
          type="button"
          className="btn btn-small btn-ghost"
          onClick={() => move(s)}
          aria-label={t('secciones.feedback.quick.move', { title: f.title, status: FEEDBACK_STATUSES[s].label })}
        >
          <Icon name={FEEDBACK_STATUS_ICON[s]} size={14} /> {FEEDBACK_STATUSES[s].label}
        </button>
      ))}
    </div>
  )
}
