// La línea de etapas: cómo avanza un proyecto, de la idea a la publicación, agrupada como
// las subsecciones de Proyectos (planificación → activos → lanzados; pausa y archivo aparte).
// Con `counts`, cuántos proyectos hay en cada etapa; con `current`, dónde está uno.
import { Link } from 'react-router-dom'
import { STAGE_GROUPS, STAGES } from '../../../domain/catalog'
import { stageGroupOf, type ProjectStageGroup } from '../../../domain/selectors'
import type { ProjectStage } from '../../../domain/types'
import { t } from '../../../i18n'
import { StagePill } from '../../components/Badges'
import './proyectos.css'

/** Los grupos en el orden de la vida de un proyecto. */
const LIFECYCLE: ProjectStageGroup[] = ['planificacion', 'activos', 'lanzados', 'pausa', 'archivados']

export function StageLine({
  counts,
  current,
  activeGroup,
  groupHref,
}: {
  counts?: Record<ProjectStage, number>
  /** La etapa de un proyecto concreto (se marca). */
  current?: ProjectStage
  /** El grupo que se está viendo (se resalta). */
  activeGroup?: ProjectStageGroup | null
  /** Enlace a la subsección de cada grupo. */
  groupHref?: (g: ProjectStageGroup) => string
}) {
  const highlighted = activeGroup ?? (current ? stageGroupOf(current) : null)
  return (
    <ol className="proyectos-stages">
      {LIFECYCLE.map((g) => {
        const title = t(`secciones.proyectos.groups.${g}.title`)
        return (
          <li key={g} className={g === highlighted ? 'proyectos-stage-group is-current' : 'proyectos-stage-group'}>
            <span className="proyectos-stage-group-name">{groupHref ? <Link to={groupHref(g)}>{title}</Link> : title}</span>
            <ul className="stage-line">
              {STAGE_GROUPS[g].map((s) => (
                <li key={s} className={s === current ? 'is-current' : undefined} aria-current={s === current ? 'step' : undefined}>
                  <StagePill stage={s} />
                  {counts && counts[s] > 0 && (
                    <span className="muted small num" title={t('secciones.proyectos.stages.count', { n: counts[s], stage: STAGES[s].label })}>
                      <span aria-hidden="true">{counts[s]}</span>
                      <span className="visually-hidden">{t('secciones.proyectos.stages.count', { n: counts[s], stage: STAGES[s].label })}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
