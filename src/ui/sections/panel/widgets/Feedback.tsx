// Feedback: lo que dicen los jugadores y qué se hace con ello.
import { feedbackToPrioritize } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { useCanEdit } from '../../../../data/store'
import { FeedbackStatusPill, ProjectChip } from '../../../components/Badges'
import { Empty } from '../../../components/Common'
import { useUI } from '../../../context'
import { ScopedMore, type WidgetProps } from './comunes'

export function FeedbackBody({ data, scope, year, fmt }: WidgetProps) {
  const { edit, create } = useUI()
  const canEdit = useCanEdit()
  const open = feedbackToPrioritize(data, scope)
  const all = data.feedback.filter((f) => !scope || f.projectId === scope)
  const addressed = all.filter((f) => f.status === 'addressed').length
  return (
    <>
      {open.length === 0 ? (
        <Empty icon="message" action={canEdit ? { label: t('secciones.panel.feedback.add'), onClick: () => create('feedback') } : undefined}>
          {all.length === 0
            ? t('secciones.panel.feedback.empty')
            : t(addressed === 1 ? 'secciones.panel.feedback.allDoneOne' : 'secciones.panel.feedback.allDoneOther', { n: addressed })}
        </Empty>
      ) : (
        <ul className="item-list">
          {open.slice(0, 6).map((f) => (
            <li key={f.id} className="item-row">
              <div className="item-main">
                <button type="button" className="item-title" onClick={() => edit({ collection: 'feedback', id: f.id })}>
                  {f.title}
                </button>
                <div className="item-meta">
                  {!scope && <ProjectChip project={data.projects.find((p) => p.id === f.projectId)} />}
                  {f.originDetail && <span className="meta-date">{f.originDetail}</span>}
                  {f.receivedAt && <span className="meta-date">{fmt.date(f.receivedAt, year)}</span>}
                </div>
              </div>
              <div className="item-side">
                <FeedbackStatusPill status={f.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 && addressed > 0 && (
        <p className="muted small">
          {t(addressed === 1 ? 'secciones.panel.feedback.addressedOne' : 'secciones.panel.feedback.addressedOther', { n: addressed })}
        </p>
      )}
    </>
  )
}

export function FeedbackAction() {
  return <ScopedMore to="/feedback" label={t('secciones.panel.feedback.all')} />
}
