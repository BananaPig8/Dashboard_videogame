// Proyectos: una tarjeta por juego, con un filtro de estado (los grupos de Proyectos, en la URL
// como ?estado=, «activos» por defecto). Dentro de un proyecto, su estado y por qué.
import { useSearchParams } from 'react-router-dom'
import { isProjectStageGroup, PROJECT_GROUPS, projectGroupCounts, projectsInGroup, projectSummary, type ProjectStageGroup } from '../../../../domain/selectors'
import type { StudioData } from '../../../../domain/types'
import { t } from '../../../../i18n'
import { useCanEdit } from '../../../../data/store'
import { Empty } from '../../../components/Common'
import { Icon } from '../../../components/Icon'
import { useUI } from '../../../context'
import { ProjectCard } from '../../proyectos/ProjectCard'
import { StageLine } from '../../proyectos/StageLine'
import { type WidgetProps, MoreLink } from './comunes'
import './proyectos.css'

/** «todos» (sin filtro) o un grupo de etapas. */
type ProjectFilter = ProjectStageGroup | 'todos'

/** El filtro por defecto: lo que se está haciendo. */
const DEFAULT_FILTER: ProjectFilter = 'activos'

/** En el orden del filtro: activos, todos y el resto de grupos. */
const FILTERS: ProjectFilter[] = ['activos', 'todos', ...PROJECT_GROUPS.filter((g) => g !== 'activos')]

/** El filtro de la URL (?estado=); si no vale, el de por defecto. */
function useProjectFilter(): [ProjectFilter, (f: ProjectFilter) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('estado')
  const filter: ProjectFilter = raw === 'todos' || isProjectStageGroup(raw) ? raw : DEFAULT_FILTER
  const set = (f: ProjectFilter) =>
    setParams(
      (p) => {
        const out = new URLSearchParams(p)
        if (f === DEFAULT_FILTER) out.delete('estado')
        else out.set('estado', f)
        return out
      },
      { replace: true },
    )
  return [filter, set]
}

export function ProjectsAction({ scope }: WidgetProps) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  if (scope) return <MoreLink to="/proyectos" label={t('secciones.panel.projects.all')} />
  if (!canEdit) return null
  return (
    <button type="button" className="btn btn-small btn-link" onClick={() => create('projects')}>
      <Icon name="plus" size={14} /> {t('secciones.panel.projects.new')}
    </button>
  )
}

export function ProjectsBody({ data, scope, today }: WidgetProps) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  const [filter, setFilter] = useProjectFilter()
  if (scope) return <ProjectStateBody data={data} scope={scope} today={today} />
  if (data.projects.length === 0)
    return (
      <Empty icon="folder" action={canEdit ? { label: t('secciones.panel.projects.add'), onClick: () => create('projects') } : undefined}>
        {t('secciones.panel.tarjetas.proyectos.noneAll')}
      </Empty>
    )
  const group = filter === 'todos' ? null : filter
  const projects = projectsInGroup(data, group)
  const counts = projectGroupCounts(data)
  const label = (f: ProjectFilter) => (f === 'todos' ? t('secciones.panel.tarjetas.proyectos.all') : t(`secciones.proyectos.groups.${f}.title`))
  const count = (f: ProjectFilter) => (f === 'todos' ? data.projects.length : counts[f])
  return (
    <>
      <div className="panel-project-filter" role="group" aria-label={t('secciones.panel.tarjetas.proyectos.filter')}>
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label(f)} <span className="panel-project-filter-n num">{count(f)}</span>
          </button>
        ))}
      </div>
      {projects.length === 0 ? (
        <div className="panel-project-empty">
          <Empty icon="folder">
            <strong>{t(`secciones.proyectos.groups.${group!}.empty`)}</strong> {t(`secciones.proyectos.groups.${group!}.emptyHint`)}
          </Empty>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} summary={projectSummary(data, p, today)} data={data} today={today} />
          ))}
          {canEdit && (filter === 'activos' || filter === 'todos') && (
            <button type="button" className="project-card project-card-new" onClick={() => create('projects')}>
              <Icon name="plus" size={20} />
              <span>{t('secciones.panel.projects.add')}</span>
              <span className="muted small">{t('secciones.panel.projects.addHint')}</span>
            </button>
          )}
        </div>
      )}
      <div>
        <MoreLink to={filter === 'todos' ? '/proyectos' : `/proyectos?estado=${filter}`} label={t('secciones.panel.tarjetas.proyectos.more')} />
      </div>
    </>
  )
}

/** Dentro de un proyecto: su tarjeta, por qué está como está y dónde está en las etapas. */
export function ProjectStateBody({ data, scope, today }: { data: StudioData; scope: string; today: string }) {
  const project = data.projects.find((p) => p.id === scope)
  if (!project) return null
  const summary = projectSummary(data, project, today)
  return (
    <div className="panel-project-state">
      <ProjectCard summary={summary} data={data} today={today} showOpen={false} />
      <div className="panel-project-why">
        <h3 className="subhead">{t('secciones.panel.projects.whyTitle')}</h3>
        {summary.health.reasons.length === 0 ? (
          <Empty>{t('secciones.panel.projects.whyNone')}</Empty>
        ) : (
          <ul className="reasons">
            {summary.health.reasons.map((r) => (
              <li key={r}>
                <Icon name="chevronRight" size={12} />
                {r}
              </li>
            ))}
          </ul>
        )}
        <h3 className="subhead">{t('secciones.proyectos.stages.title')}</h3>
        <StageLine current={project.stage} />
      </div>
    </div>
  )
}
