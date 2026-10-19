// La lista de proyectos y la ficha de cada uno. La ficha reutiliza las mismas pantallas
// del estudio con el proyecto como ámbito: se pasa de lo general al detalle sin cambiar
// de herramienta ni perder el sitio.
import { Suspense } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { STAGES } from '../../domain/catalog'
import { yearOf } from '../../domain/dates'
import { useFormat, useToday } from '../hooks'
import { projectSummaries, projectSummary } from '../../domain/selectors'
import { useCanEdit, useStudioData } from '../../data/store'
import { HealthPill, StagePill } from '../components/Badges'
import { Card, ExternalLink, PageHeader } from '../components/Common'
import { Icon } from '../components/Icon'
import { useUI } from '../context'
import { PageSkeleton } from '../feedback'
import { isOldTab, migratePath, projectTabs, type NavSection, type SectionId } from '../navigation'
import { useDocumentTitle } from '../components/SectionHeader'
import { Popover } from '../components/Popover'
import { usePreferences } from '../prefs'
import { t } from '../../i18n'
import { SECTION_PAGES } from '../sections/registry'
import { ProjectCard } from '../sections/proyectos/ProjectCard'

export function ProjectsPage() {
  const data = useStudioData()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const summaries = projectSummaries(data, today).sort(
    (a, b) => STAGES[a.project.stage].order - STAGES[b.project.stage].order || a.project.name.localeCompare(b.project.name),
  )
  return (
    <div className="page">
      <PageHeader
        title="Proyectos"
        subtitle="Todos los videojuegos del estudio, de la idea a la publicación"
        actions={
          canEdit && (
            <button type="button" className="btn btn-primary" onClick={() => create('projects')}>
              <Icon name="plus" size={16} /> Nuevo proyecto
            </button>
          )
        }
      />
      <div className="project-grid">
        {summaries.map((s) => (
          <ProjectCard key={s.project.id} summary={s} data={data} today={today} />
        ))}
      </div>
      <Card title="Etapas" icon="flag" subtitle="Cómo avanza un proyecto">
        <ol className="stage-line">
          {Object.keys(STAGES).map((id) => (
            <li key={id}>
              <StagePill stage={id as keyof typeof STAGES} />
              <span className="muted small">{summaries.filter((x) => x.project.stage === id).length || ''}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

export function ProjectPage() {
  const { slug, tab = 'resumen' } = useParams()
  const location = useLocation()
  const data = useStudioData()
  const prefs = usePreferences()
  const { edit } = useUI()
  const today = useToday()
  const fmt = useFormat()
  const year = yearOf(today)
  const project = data.projects.find((p) => p.slug === slug)
  const tabs = projectTabs(prefs.hiddenSections)
  const current = tabs.find((s) => s.tab === tab)
  useDocumentTitle([current && current.tab !== 'resumen' ? current.tabLabel : undefined, project?.name])
  if (!project) return <Navigate to="/proyectos" replace />
  // Pestañas antiguas (trabajo, agenda…): a las de ahora, con los filtros de la URL.
  if (isOldTab(tab)) return <Navigate to={migratePath(location.pathname + location.search)} replace />
  if (!current) return <Navigate to={`/proyectos/${project.slug}`} replace />
  const summary = projectSummary(data, project, today)
  const counts: Partial<Record<SectionId, number>> = {
    tareas: summary.open,
    builds: data.builds.filter((b) => b.projectId === project.id).length,
    feedback: data.feedback.filter((f) => f.projectId === project.id && f.status === 'new').length,
  }
  const Section = SECTION_PAGES[current.id]
  const isSummary = current.tab === 'resumen'
  // Las primeras pestañas siempre a la vista; el resto, en «Más» (y la activa, si está ahí, también fuera).
  const shown = tabs.filter((s, i) => i < VISIBLE_TABS || s === current)
  const more = tabs.filter((s) => !shown.includes(s))
  const tabHref = (s: NavSection) => `/proyectos/${project.slug}${s.tab === 'resumen' ? '' : `/${s.tab}`}`

  return (
    <div className="page">
      <header className={isSummary ? 'project-hero' : 'project-hero compact'} style={{ ['--project-color' as string]: project.color }}>
        <div className="project-hero-main">
          <nav className="breadcrumb" aria-label={t('nav.breadcrumb')}>
            <Link to="/">{t('projectPage.studio')}</Link> <Icon name="chevronRight" size={12} /> <Link to="/proyectos">{t('nav.sections.proyectos')}</Link>
          </nav>
          <h1>
            {project.name}
            <button type="button" className="icon-btn" aria-label={t('projectPage.edit')} onClick={() => edit({ collection: 'projects', id: project.id })}>
              <Icon name="edit" size={16} />
            </button>
          </h1>
          {isSummary && project.tagline && <p className="project-tagline">{project.tagline}</p>}
          <div className="pills">
            <StagePill stage={project.stage} />
            <HealthPill level={summary.health.level} />
            {isSummary && project.engine && (
              <span className="meta-date">
                {project.engine} {project.engineVersion}
              </span>
            )}
            {isSummary && project.genre && <span className="meta-date">{project.genre}</span>}
            {isSummary && project.platforms.length > 0 && <span className="meta-date">{project.platforms.join(' · ')}</span>}
            {isSummary && project.startedAt && (
              <span className="meta-date">
                {t('projectPage.since', {
                  date: fmt.date(project.startedAt, year),
                })}
              </span>
            )}
          </div>
          {isSummary && project.nextGoal && (
            <p className="next-goal">
              <Icon name="target" size={16} /> <strong>{t('projectPage.nextGoal')}</strong> {project.nextGoal}
            </p>
          )}
        </div>
        {isSummary && (project.versions.length > 0 || project.links.length > 0) && (
          <aside className="project-hero-side">
            {project.versions.length > 0 && (
              <dl className="version-list">
                {project.versions.map((v) => (
                  <div key={v.label} title={v.note}>
                    <dt>{v.label}</dt>
                    <dd>
                      {v.version}
                      {v.note && <span className="muted small"> · {v.note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {project.links.length > 0 && (
              <ul className="link-list">
                {project.links.map((l) => (
                  <li key={l.url}>
                    <ExternalLink href={l.url}>{l.label}</ExternalLink>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </header>

      <nav className="tabs-bar" aria-label={t('projectPage.tabs')}>
        <div className="tabs">
          {shown.map((s) => (
            <Link key={s.id} to={tabHref(s)} className={s === current ? 'tab active' : 'tab'} aria-current={s === current ? 'page' : undefined}>
              {s.tabLabel}
              {counts[s.id] ? (
                <span className="tab-count" title={t(`projectPage.counts.${s.id as 'tareas' | 'builds' | 'feedback'}`, { n: counts[s.id]! })}>
                  <span aria-hidden="true">{counts[s.id]}</span>
                  <span className="visually-hidden">{t(`projectPage.counts.${s.id as 'tareas' | 'builds' | 'feedback'}`, { n: counts[s.id]! })}</span>
                </span>
              ) : null}
            </Link>
          ))}
        </div>
        {more.length > 0 && (
          <Popover
            label={t('nav.moreTabs')}
            trigger={(p) => (
              <button type="button" className="tab" onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup="menu">
                {t('nav.more')} <Icon name="chevronDown" size={14} />
              </button>
            )}
          >
            {(close) =>
              more.map((s) => (
                <div key={s.id} role="none">
                  <Link role="menuitem" className="menu-item" to={tabHref(s)} onClick={close}>
                    <Icon name={s.icon} size={16} /> {s.tabLabel}
                  </Link>
                </div>
              ))
            }
          </Popover>
        )}
      </nav>

      <Suspense fallback={<PageSkeleton />}>
        <Section embedded />
      </Suspense>
    </div>
  )
}

/** Pestañas de la ficha que siempre se ven (el resto va en «Más»). */
const VISIBLE_TABS = 7
