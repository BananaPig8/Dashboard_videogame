// Evolución, decisiones y documentación.
import { addDays } from '../../../../domain/dates'
import { activityOf, decisions, itemsOf, weeklyEvolution } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { useCanEdit } from '../../../../data/store'
import { Empty, ExternalLink } from '../../../components/Common'
import { WeeklyChart } from '../../../components/Charts'
import { ItemList } from '../../../components/ItemList'
import { useUI } from '../../../context'
import { usePreferences } from '../../../prefs'
import { type WidgetProps } from './comunes'

/** «—» con el motivo (se lee el motivo): una cifra sin datos detrás no es un 0. */
function NoFigure({ reason }: { reason: string }) {
  return (
    <>
      <span aria-hidden="true">—</span> <span className="muted small">{reason}</span>
    </>
  )
}

/**
 * Evolución: commits y elementos terminados por semana. Sin historial del código ni nada
 * terminado, no hay gráfica (sería toda a cero): se dice que todavía no hay historial. Sin
 * commits, sus cifras son «—» con el motivo, nunca «0 (semana anterior: 0)».
 */
export function EvolutionBody({ data, scope, today, year }: WidgetProps) {
  const { weekStart } = usePreferences()
  const commits = activityOf(data, scope).filter((a) => a.type === 'commit')
  const items = itemsOf(data, scope)
  const doneTotal = items.filter((i) => i.status === 'done').length
  if (commits.length === 0 && doneTotal === 0) return <Empty icon="activity">{t('secciones.panel.evolution.empty')}</Empty>
  const buckets = weeklyEvolution(data, today, 8, scope, weekStart)
  const last7 = commits.filter((a) => a.at.slice(0, 10) > addDays(today, -7)).length
  const prev7 = commits.filter((a) => a.at.slice(0, 10) > addDays(today, -14) && a.at.slice(0, 10) <= addDays(today, -7)).length
  const noCommits = t('secciones.panel.evolution.noCommits')
  return (
    <div className="evolution">
      <WeeklyChart buckets={buckets} year={year} />
      <dl className="evolution-stats">
        <div>
          <dt>{t('secciones.panel.evolution.last7')}</dt>
          <dd>
            {commits.length === 0 ? (
              <NoFigure reason={noCommits} />
            ) : (
              <>
                {last7} <span className="muted small">{t('secciones.panel.evolution.previous', { n: prev7 })}</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('secciones.panel.evolution.doneTotal')}</dt>
          <dd>{items.length === 0 ? <NoFigure reason={t('secciones.panel.evolution.noItems')} /> : doneTotal}</dd>
        </div>
        <div>
          <dt>{t('secciones.panel.evolution.commits')}</dt>
          <dd>{commits.length === 0 ? <NoFigure reason={noCommits} /> : commits.length}</dd>
        </div>
      </dl>
    </div>
  )
}

export function DecisionsBody({ data, scope, year }: WidgetProps) {
  const { open, taken } = decisions(data, scope)
  return (
    <>
      {open.length > 0 && (
        <>
          <h3 className="subhead">{t('secciones.panel.decisions.open', { n: open.length })}</h3>
          <ItemList items={open} data={data} showProject={!scope} detail="decision" limit={3} year={year} />
        </>
      )}
      <h3 className="subhead">{t('secciones.panel.decisions.taken')}</h3>
      <ItemList items={taken} data={data} showProject={!scope} limit={4} year={year} hideStatus empty={t('secciones.panel.decisions.none')} />
    </>
  )
}

export function ResourcesBody({ data, scope }: WidgetProps) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  const resources = data.resources.filter((r) => !scope || !r.projectId || r.projectId === scope).slice(0, 8)
  if (resources.length === 0)
    return (
      <Empty icon="book" action={canEdit ? { label: t('secciones.panel.resources.add'), onClick: () => create('resources') } : undefined}>
        {t('secciones.panel.resources.empty')}
      </Empty>
    )
  return (
    <ul className="resource-mini">
      {resources.map((r) => {
        const project = data.projects.find((p) => p.id === r.projectId)
        const url = r.url ?? (r.path && project?.repoUrl ? `${project.repoUrl}/blob/main/${r.path}` : undefined)
        return <li key={r.id}>{url ? <ExternalLink href={url}>{r.title}</ExternalLink> : r.title}</li>
      })}
    </ul>
  )
}
