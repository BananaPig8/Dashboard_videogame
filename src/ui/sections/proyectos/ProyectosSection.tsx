// Proyectos: todos los videojuegos del estudio, por estado (?estado=, los grupos de etapas de
// catalog.ts). Cada uno con su tarjeta (etapa, salud, cifras, actividad) y, abajo, la línea
// de etapas con cuántos hay en cada una. Las vistas aparte (?vista=) tienen su fichero:
// plantillas, componentes compartidos y relaciones entre proyectos.
import { lazy, Suspense, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  isProjectStageGroup,
  PROJECT_GROUPS,
  projectGroupCounts,
  projectsInGroup,
  projectGroupOf,
  projectStatusCounts,
  projectSummary,
  type ProjectStageGroup,
} from '../../../domain/selectors'
import type { Project } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { SectionHeader, useSectionNav } from '../../components/SectionHeader'
import { TagFilterNotice, useTagFilter } from '../../components/TagFilter'
import { useUI } from '../../context'
import { useToday } from '../../hooks'
import { PageSkeleton } from '../../feedback'
import type { SectionPageProps } from '../registry'
import { ProjectCard } from './ProjectCard'
import { StatusLine } from './StatusLine'
import './proyectos.css'

/** Con qué estado empieza un proyecto nuevo creado desde un grupo (pausa y archivo no se crean así). */
const NEW_IN_GROUP: Partial<Record<ProjectStageGroup, Project['status']>> = {
  planificacion: 'idea',
  activos: 'prototipo',
  lanzados: 'lanzado',
}

/** Las vistas aparte de Proyectos (?vista=): cada una pinta su cabecera. */
const VISTAS = {
  plantillas: lazy(() => import('./plantillas/ProyectosPlantillas')),
  componentes: lazy(() => import('./relaciones/ProyectosComponentes')),
  relaciones: lazy(() => import('./relaciones/ProyectosRelaciones')),
}

const isVista = (v: string | null): v is keyof typeof VISTAS => !!v && v in VISTAS

export default function ProyectosSection(props: SectionPageProps) {
  const [params] = useSearchParams()
  const vista = params.get('vista')
  if (!isVista(vista)) return <ProyectosLista {...props} />
  const Vista = VISTAS[vista]
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Vista {...props} />
    </Suspense>
  )
}

function ProyectosLista({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const today = useToday()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const [params] = useSearchParams()
  const nav = useSectionNav('proyectos')
  const tag = useTagFilter()
  const estado = params.get('estado')
  const group = isProjectStageGroup(estado) ? estado : null
  const counts = projectGroupCounts(data, tag)
  const projects = projectsInGroup(data, group, tag)
  const childOf = (g: ProjectStageGroup) => nav.section.children.find((c) => c.value === g)!
  const groupHref = (g: ProjectStageGroup) => nav.href(childOf(g))
  const newProject = (status?: Project['status']) => create('projects', status ? { status } : undefined)

  const card = (p: Project) => <ProjectCard key={p.id} summary={projectSummary(data, p, today)} data={data} today={today} />

  return (
    <div className={embedded ? 'stack' : 'page'}>
      <SectionHeader
        id="proyectos"
        embedded={embedded}
        subtitle={group ? t(`secciones.proyectos.groups.${group}.hint`) : undefined}
        actions={
          canEdit && (
            <button type="button" className="btn btn-primary" onClick={() => newProject(group ? NEW_IN_GROUP[group] : undefined)}>
              <Icon name="plus" size={16} /> {t('secciones.proyectos.new')}
            </button>
          )
        }
      />
      <TagFilterNotice />

      <nav className="proyectos-counts" aria-label={t('secciones.proyectos.countsLabel')}>
        <ul>
          {PROJECT_GROUPS.map((g) => (
            <li key={g}>
              <Link
                to={groupHref(g)}
                className={g === group ? 'proyectos-count is-current' : 'proyectos-count'}
                aria-current={g === group ? 'page' : undefined}
              >
                <span className="proyectos-count-value">{counts[g]}</span>
                <span className="proyectos-count-label">{t(`secciones.proyectos.groups.${g}.title`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {data.projects.length === 0 ? (
        <Empty icon="folder" action={canEdit ? { label: t('secciones.proyectos.new'), onClick: () => newProject() } : undefined}>
          {t('secciones.proyectos.none')}
        </Empty>
      ) : group ? (
        <GroupList group={group} projects={projects} tag={tag} onNew={canEdit && NEW_IN_GROUP[group] ? () => newProject(NEW_IN_GROUP[group]) : undefined}>
          {projects.map(card)}
        </GroupList>
      ) : projects.length === 0 ? (
        <Empty icon="tag">{t('secciones.proyectos.noneWithTag')}</Empty>
      ) : (
        // Todos: por grupos, en el orden de las subsecciones; los grupos vacíos no ocupan sitio (están en las cifras de arriba).
        PROJECT_GROUPS.filter((g) => projects.some((p) => projectGroupOf(data.studio, p) === g)).map((g) => {
          const inGroup = projects.filter((p) => projectGroupOf(data.studio, p) === g)
          return (
            <Card
              key={g}
              title={t(`secciones.proyectos.groups.${g}.title`)}
              subtitle={t(`secciones.proyectos.groups.${g}.hint`)}
              icon="folder"
              action={
                <span className="muted small">
                  {inGroup.length === 1 ? t('secciones.proyectos.countOne') : t('secciones.proyectos.countOther', { n: inGroup.length })}
                </span>
              }
            >
              <div className="project-grid">{inGroup.map(card)}</div>
            </Card>
          )
        })
      )}

      <Card title={t('secciones.proyectos.stages.title')} subtitle={t('secciones.proyectos.stages.subtitle')} icon="flag">
        <StatusLine counts={projectStatusCounts(data)} activeGroup={group} groupHref={groupHref} />
      </Card>
    </div>
  )
}

/** Los proyectos de un grupo o, si no hay, qué significa el grupo y cómo se llega a él. */
function GroupList({
  group,
  projects,
  tag,
  onNew,
  children,
}: {
  group: ProjectStageGroup
  projects: Project[]
  tag: string | null
  onNew?: () => void
  children: ReactNode
}) {
  if (projects.length > 0) return <div className="project-grid">{children}</div>
  if (tag) return <Empty icon="tag">{t('secciones.proyectos.noneWithTag')}</Empty>
  return (
    <div className="proyectos-empty">
      <Empty icon="folder" action={onNew ? { label: t('secciones.proyectos.new'), onClick: onNew } : undefined}>
        <strong>{t(`secciones.proyectos.groups.${group}.empty`)}</strong> {t(`secciones.proyectos.groups.${group}.emptyHint`)}
      </Empty>
    </div>
  )
}
