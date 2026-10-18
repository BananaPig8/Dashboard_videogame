// La lista de proyectos y la ficha de cada uno. La ficha reutiliza las mismas pantallas
// del estudio con el proyecto como ámbito: se pasa de lo general al detalle sin cambiar
// de herramienta ni perder el sitio.
import { Link, Navigate, useParams } from 'react-router-dom'
import { STAGES } from '../../domain/catalog'
import { formatDate, parseISODate, todayISO } from '../../domain/dates'
import { itemsOf, projectSummaries, projectSummary } from '../../domain/selectors'
import { useStudioData } from '../../data/store'
import { HealthPill, StagePill } from '../components/Badges'
import { Card, ExternalLink, PageHeader } from '../components/Common'
import { Icon } from '../components/Icon'
import { useUI } from '../context'
import { HistoryPage } from './History'
import { OverviewSections, ProjectCard } from './Overview'
import { AgendaPage, BuildsPage, DecisionsPage, FeedbackPage, PublishPage, ResourcesPage } from './Production'
import { WorkPage } from './Work'

export function ProjectsPage() {
  const data = useStudioData()
  const { create } = useUI()
  const today = todayISO()
  const summaries = projectSummaries(data, today).sort(
    (a, b) => STAGES[a.project.stage].order - STAGES[b.project.stage].order || a.project.name.localeCompare(b.project.name),
  )
  return (
    <div className="page">
      <PageHeader
        title="Proyectos"
        subtitle="Todos los videojuegos del estudio, de la idea a la publicación"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => create('projects')}>
            <Icon name="plus" size={16} /> Nuevo proyecto
          </button>
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

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'builds', label: 'Builds' },
  { id: 'publicacion', label: 'Publicación' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'decisiones', label: 'Decisiones' },
  { id: 'recursos', label: 'Recursos' },
  { id: 'historial', label: 'Historial' },
] as const

type TabId = (typeof TABS)[number]['id']

export function ProjectPage() {
  const { slug, tab = 'resumen' } = useParams()
  const data = useStudioData()
  const { edit } = useUI()
  const project = data.projects.find((p) => p.slug === slug)
  if (!project) return <Navigate to="/proyectos" replace />
  if (!TABS.some((t) => t.id === tab)) return <Navigate to={`/proyectos/${project.slug}`} replace />
  const today = todayISO()
  const year = parseISODate(today).getFullYear()
  const summary = projectSummary(data, project, today)
  const items = itemsOf(data, project.id)
  const counts: Partial<Record<TabId, number>> = {
    trabajo: summary.open,
    builds: data.builds.filter((b) => b.projectId === project.id).length,
    feedback: data.feedback.filter((f) => f.projectId === project.id).length,
    decisiones: items.filter((i) => i.kind === 'decision').length,
    recursos: data.resources.filter((r) => r.projectId === project.id).length,
  }

  return (
    <div className="page">
      <header className="project-hero" style={{ ['--project-color' as string]: project.color }}>
        <div className="project-hero-main">
          <nav className="breadcrumb" aria-label="Ruta">
            <Link to="/">Estudio</Link> <Icon name="chevronRight" size={12} /> <Link to="/proyectos">Proyectos</Link>
          </nav>
          <h1>
            {project.name}
            <button type="button" className="icon-btn" aria-label="Editar el proyecto" onClick={() => edit({ collection: 'projects', id: project.id })}>
              <Icon name="edit" size={16} />
            </button>
          </h1>
          {project.tagline && <p className="project-tagline">{project.tagline}</p>}
          <div className="pills">
            <StagePill stage={project.stage} />
            <HealthPill level={summary.health.level} />
            {project.engine && (
              <span className="meta-date">
                {project.engine} {project.engineVersion}
              </span>
            )}
            {project.genre && <span className="meta-date">{project.genre}</span>}
            {project.platforms.length > 0 && <span className="meta-date">{project.platforms.join(' · ')}</span>}
            {project.startedAt && <span className="meta-date">Desde el {formatDate(project.startedAt, year)}</span>}
          </div>
          {project.nextGoal && (
            <p className="next-goal">
              <Icon name="target" size={16} /> <strong>Objetivo inmediato:</strong> {project.nextGoal}
            </p>
          )}
        </div>
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
      </header>

      <nav className="tabs" aria-label="Secciones del proyecto">
        {TABS.map((t) => (
          <Link key={t.id} to={`/proyectos/${project.slug}${t.id === 'resumen' ? '' : `/${t.id}`}`} className={t.id === tab ? 'tab active' : 'tab'} aria-current={t.id === tab ? 'page' : undefined}>
            {t.label}
            {counts[t.id] !== undefined && <span className="tab-count">{counts[t.id]}</span>}
          </Link>
        ))}
      </nav>

      {tab === 'resumen' && (
        <>
          <Card title="De qué va" icon="book">
            <p>{project.description}</p>
          </Card>
          <OverviewSections data={data} scope={project.id} today={today} year={year} showProjects={false} />
        </>
      )}
      {tab === 'trabajo' && <WorkPage embedded />}
      {tab === 'agenda' && <AgendaPage embedded />}
      {tab === 'builds' && <BuildsPage embedded />}
      {tab === 'publicacion' && <PublishPage embedded />}
      {tab === 'feedback' && <FeedbackPage embedded />}
      {tab === 'decisiones' && <DecisionsPage embedded />}
      {tab === 'recursos' && <ResourcesPage embedded />}
      {tab === 'historial' && <HistoryPage embedded />}
    </div>
  )
}
