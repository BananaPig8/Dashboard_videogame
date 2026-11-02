// Proyectos: una tarjeta por juego (en un proyecto, su estado y por qué).
import { projectsByStage, projectSummary } from '../../../../domain/selectors'
import type { StudioData } from '../../../../domain/types'
import { t } from '../../../../i18n'
import { useCanEdit } from '../../../../data/store'
import { Empty } from '../../../components/Common'
import { Icon } from '../../../components/Icon'
import { useUI } from '../../../context'
import { ProjectCard } from '../../proyectos/ProjectCard'
import { StageLine } from '../../proyectos/StageLine'
import { type WidgetProps, MoreLink } from './comunes'

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
  if (scope) return <ProjectStateBody data={data} scope={scope} today={today} />
  // Los archivados no salen en el panel: están cerrados (se ven en Proyectos).
  const projects = data.projects.filter((p) => p.stage !== 'archived').sort(projectsByStage)
  const archived = data.projects.length - projects.length
  return (
    <>
      {projects.length === 0 && !canEdit && <Empty icon="folder">{t('secciones.panel.projects.none')}</Empty>}
      {(projects.length > 0 || canEdit) && (
        <div className="project-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} summary={projectSummary(data, p, today)} data={data} today={today} />
          ))}
          {canEdit && (
            <button type="button" className="project-card project-card-new" onClick={() => create('projects')}>
              <Icon name="plus" size={20} />
              <span>{t('secciones.panel.projects.add')}</span>
              <span className="muted small">{t('secciones.panel.projects.addHint')}</span>
            </button>
          )}
        </div>
      )}
      {archived > 0 && (
        <div>
          <MoreLink
            to="/proyectos?estado=archivados"
            label={archived === 1 ? t('secciones.panel.projects.archivedOne') : t('secciones.panel.projects.archivedOther', { n: archived })}
          />
        </div>
      )}
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
      <ProjectCard summary={summary} data={data} today={today} />
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
