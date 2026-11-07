// La línea de estados: cómo avanza un proyecto, de la idea al lanzamiento, agrupada como las
// subsecciones de Proyectos (planificación → activos → lanzados; pausa y archivo aparte). Los
// estados son los del estudio (Ajustes › Estados). Con `counts`, cuántos proyectos hay en cada
// uno; con `current`, dónde está uno.
import { Link } from 'react-router-dom'
import { projectStatusesOf, projectStatusOf } from '../../../domain/catalog'
import type { ProjectStageGroup } from '../../../domain/selectors'
import type { ProjectStatusId } from '../../../domain/types'
import { t } from '../../../i18n'
import { useStudioData } from '../../../data/store'
import { ProjectStatusPill } from '../../components/Badges'
import './proyectos.css'

/** Los grupos en el orden de la vida de un proyecto. */
const LIFECYCLE: ProjectStageGroup[] = ['planificacion', 'activos', 'lanzados', 'pausa', 'archivados']

export function StatusLine({
  counts,
  current,
  activeGroup,
  groupHref,
}: {
  counts?: Record<ProjectStatusId, number>
  /** El estado de un proyecto concreto (se marca). */
  current?: ProjectStatusId
  /** El grupo que se está viendo (se resalta). */
  activeGroup?: ProjectStageGroup | null
  /** Enlace a la subsección de cada grupo. */
  groupHref?: (g: ProjectStageGroup) => string
}) {
  const { studio } = useStudioData()
  const statuses = projectStatusesOf(studio)
  const highlighted = activeGroup ?? (current ? projectStatusOf(studio, current).group : null)
  return (
    <ol className="proyectos-stages">
      {LIFECYCLE.map((g) => {
        const title = t(`secciones.proyectos.groups.${g}.title`)
        const inGroup = statuses.filter((s) => s.group === g)
        if (!inGroup.length) return null
        return (
          <li key={g} className={g === highlighted ? 'proyectos-stage-group is-current' : 'proyectos-stage-group'}>
            <span className="proyectos-stage-group-name">{groupHref ? <Link to={groupHref(g)}>{title}</Link> : title}</span>
            <ul className="stage-line">
              {inGroup.map((s) => {
                const n = counts?.[s.id] ?? 0
                return (
                  <li key={s.id} className={s.id === current ? 'is-current' : undefined} aria-current={s.id === current ? 'step' : undefined}>
                    <ProjectStatusPill status={s.id} />
                    {n > 0 && (
                      <span className="muted small num" title={t('secciones.proyectos.stages.count', { n, stage: s.label })}>
                        <span aria-hidden="true">{n}</span>
                        <span className="visually-hidden">{t('secciones.proyectos.stages.count', { n, stage: s.label })}</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
