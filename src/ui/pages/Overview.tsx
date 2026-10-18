// El panel: responde de un vistazo a las preguntas del día a día. Sirve para todo el
// estudio y, con un proyecto como ámbito, como resumen de ese proyecto.
import { Link } from 'react-router-dom'
import { EVENT_TYPES, STAGES } from '../../domain/catalog'
import { addDays, formatDate, formatLongDate, parseISODate, relativeDays, todayISO } from '../../domain/dates'
import {
  activityOf,
  blockedItems,
  checklistsOf,
  currentBuilds,
  dailyCommits,
  decisions,
  feedbackToPrioritize,
  isActionable,
  itemsOf,
  pausedItems,
  pendingInAreas,
  projectSummaries,
  projectSummary,
  staleEvents,
  todayItems,
  toConfirmItems,
  undatedEvents,
  upcoming,
  weeklyEvolution,
  type ProjectSummary,
  type Scope,
  type TodayReason,
} from '../../domain/selectors'
import type { StudioData, StudioEvent } from '../../domain/types'
import { useStudioData } from '../../data/store'
import {
  BuildChannelPill,
  BuildStatusPill,
  EventStatusPill,
  FeedbackStatusPill,
  HealthPill,
  Pill,
  ProjectChip,
  StagePill,
} from '../components/Badges'
import { Card, Empty, ExternalLink, PageHeader, Progress, Stat } from '../components/Common'
import { Sparkline, WeeklyChart } from '../components/Charts'
import { Icon } from '../components/Icon'
import { ItemList } from '../components/ItemList'
import { useScope, useUI } from '../context'
import { plural } from '../util'

const REASON: Record<TodayReason, { label: string; tone: 'danger' | 'warning' | 'info' | 'progress' | 'accent' }> = {
  overdue: { label: 'Vencida', tone: 'danger' },
  due: { label: 'Vence hoy', tone: 'warning' },
  focus: { label: 'Para hoy', tone: 'info' },
  in_progress: { label: 'En curso', tone: 'progress' },
  review: { label: 'En revisión', tone: 'accent' },
}

interface CardProps {
  data: StudioData
  scope: Scope
  today: string
  year: number
}

/** Panel del estudio (ruta «/»). */
export function DashboardPage() {
  const data = useStudioData()
  const { scope, project } = useScope()
  const today = todayISO()
  const props = { data, scope, today, year: parseISODate(today).getFullYear() }
  const active = data.projects.filter((p) => p.stage !== 'archived' && p.stage !== 'paused')
  return (
    <div className="page">
      <PageHeader
        title={project ? `Panel · ${project.name}` : 'Panel del estudio'}
        subtitle={`${formatLongDate(today)} · ${plural(active.length, 'proyecto activo', 'proyectos activos')}`}
      />
      <OverviewSections {...props} showProjects={!scope} />
    </div>
  )
}

export function OverviewSections(props: CardProps & { showProjects: boolean }) {
  return (
    <>
      <StatsRow {...props} />
      <div className="grid grid-2">
        <AttentionCard {...props} />
        <TodayCard {...props} />
      </div>
      {props.showProjects && <ProjectsGrid {...props} />}
      <div className="grid grid-2">
        <BlockedCard {...props} />
        <AgendaCard {...props} />
      </div>
      <div className="grid grid-2">
        <BuildsCard {...props} />
        <PublishCard {...props} />
      </div>
      <div className="grid grid-2">
        <LaunchCard {...props} />
        <FeedbackCard {...props} />
      </div>
      <EvolutionCard {...props} />
      <div className="grid grid-3">
        <DecisionsCard {...props} />
        <RecentDoneCard {...props} />
        <ResourcesCard {...props} />
      </div>
    </>
  )
}

function StatsRow({ data, scope, today }: CardProps) {
  const { href } = useScope()
  const items = itemsOf(data, scope)
  const blocked = blockedItems(data, scope).length
  const confirm = toConfirmItems(data, scope).length
  const agenda = upcoming(data, today, 60, scope).length
  const undated = undatedEvents(data, scope).length
  const builds = currentBuilds(data, scope).filter((b) => b.status === 'published' || b.status === 'ready').length
  const feedback = feedbackToPrioritize(data, scope).length
  const activeProjects = data.projects.filter((p) => p.stage !== 'archived' && p.stage !== 'paused').length
  return (
    <div className="stats" role="list">
      {!scope && <Stat label="Proyectos activos" value={activeProjects} to="/proyectos" />}
      <Stat label="Abiertas" value={items.filter(isActionable).length} hint="En marcha o por hacer" to={href('/trabajo')} />
      <Stat label="Para hoy" value={todayItems(data, today, scope).length} tone="info" to={href('/hoy')} />
      <Stat label="Bloqueadas" value={blocked} tone={blocked ? 'danger' : 'neutral'} to={href('/trabajo?estado=blocked')} />
      <Stat label="Por confirmar" value={confirm} tone={confirm ? 'warning' : 'neutral'} to={href('/trabajo?estado=to_confirm')} />
      <Stat label="Próximas fechas" value={agenda} hint={undated ? `${undated} sin fecha confirmada` : '60 días'} to={href('/agenda')} />
      <Stat label="Builds disponibles" value={builds} to={href('/builds')} />
      <Stat label="Feedback abierto" value={feedback} to={href('/feedback')} />
    </div>
  )
}

function AttentionCard({ data, scope, today }: CardProps) {
  const summaries = scope
    ? [projectSummary(data, data.projects.find((p) => p.id === scope)!, today)]
    : projectSummaries(data, today)
  const flagged = summaries.filter((s) => s.health.reasons.length > 0)
  return (
    <Card title="Necesita atención" icon="alert" subtitle="Qué proyecto mirar primero y por qué">
      {flagged.length === 0 ? (
        <Empty>Ningún proyecto pide atención ahora mismo.</Empty>
      ) : (
        <ul className="attention-list">
          {flagged.map((s) => (
            <li key={s.project.id}>
              <div className="attention-head">
                <Link to={`/proyectos/${s.project.slug}`} className="strong-link">
                  <span className="dot" style={{ background: s.project.color }} />
                  {s.project.name}
                </Link>
                <HealthPill level={s.health.level} />
              </div>
              <ul className="reasons">
                {s.health.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {!scope && summaries.length > flagged.length && (
        <p className="muted small">
          Al día: {summaries.filter((s) => s.health.reasons.length === 0).map((s) => s.project.name).join(', ')}
        </p>
      )}
    </Card>
  )
}

function TodayCard({ data, scope, today, year }: CardProps) {
  const { href } = useScope()
  const entries = todayItems(data, today, scope)
  const reasons = new Map(entries.map((e) => [e.item.id, e.reason]))
  return (
    <Card
      title="Hoy"
      icon="sun"
      subtitle="Lo marcado para hoy, lo que vence y lo que está en marcha"
      action={
        <Link to={href('/hoy')} className="btn btn-small btn-ghost">
          Planificar el día <Icon name="chevronRight" size={14} />
        </Link>
      }
    >
      <ItemList
        items={entries.map((e) => e.item)}
        data={data}
        showProject={!scope}
        limit={7}
        year={year}
        hideStatus
        empty="Nada marcado para hoy. Elige qué hacer en «Planificar el día»."
        aside={(item) => {
          const r = REASON[reasons.get(item.id)!]
          return <Pill tone={r.tone}>{r.label}</Pill>
        }}
      />
    </Card>
  )
}

export function ProjectCard({ summary, data, today }: { summary: ProjectSummary; data: StudioData; today: string }) {
  const p = summary.project
  const days = 30
  return (
    <article className="project-card" style={{ ['--project-color' as string]: p.color }}>
      <header>
        <Link to={`/proyectos/${p.slug}`} className="project-name">
          {p.name}
        </Link>
        <div className="pills">
          <StagePill stage={p.stage} />
          <HealthPill level={summary.health.level} />
        </div>
      </header>
      {(p.nextGoal || p.tagline) && <p className="project-goal">{p.nextGoal ?? p.tagline}</p>}
      {p.versions.length > 0 && (
        <div className="versions">
          {p.versions.map((v) => (
            <span key={v.label} className="version" title={v.note}>
              {v.label} <strong>{v.version}</strong>
            </span>
          ))}
        </div>
      )}
      <dl className="project-counts">
        <div>
          <dt>Abiertas</dt>
          <dd>{summary.actionable}</dd>
        </div>
        <div>
          <dt>Bloqueadas</dt>
          <dd className={summary.blocked ? 'text-danger' : undefined}>{summary.blocked}</dd>
        </div>
        <div>
          <dt>Por confirmar</dt>
          <dd className={summary.toConfirm ? 'text-warning' : undefined}>{summary.toConfirm}</dd>
        </div>
        <div>
          <dt>Hechas</dt>
          <dd>{summary.done}</dd>
        </div>
      </dl>
      <footer>
        <span className="muted small">
          {summary.lastActivity ? `Última actividad ${relativeDays(summary.lastActivity, today)}` : 'Sin actividad registrada'}
        </span>
        <Sparkline values={dailyCommits(data, today, days, p.id)} label={`Commits de los últimos ${days} días`} startLabel={formatDate(addDays(today, -(days - 1)))} />
      </footer>
    </article>
  )
}

function ProjectsGrid({ data, today }: CardProps) {
  const { create } = useUI()
  const summaries = projectSummaries(data, today).sort((a, b) => STAGES[a.project.stage].order - STAGES[b.project.stage].order || a.project.name.localeCompare(b.project.name))
  return (
    <Card
      title="Proyectos del estudio"
      icon="folder"
      subtitle="Estado real de cada juego"
      action={
        <button type="button" className="btn btn-small btn-ghost" onClick={() => create('projects')}>
          <Icon name="plus" size={14} /> Nuevo proyecto
        </button>
      }
    >
      <div className="project-grid">
        {summaries.map((s) => (
          <ProjectCard key={s.project.id} summary={s} data={data} today={today} />
        ))}
        <button type="button" className="project-card project-card-new" onClick={() => create('projects')}>
          <Icon name="plus" size={20} />
          <span>Añadir un videojuego</span>
          <span className="muted small">De la idea a la publicación, con el mismo panel.</span>
        </button>
      </div>
    </Card>
  )
}

function BlockedCard({ data, scope, year }: CardProps) {
  const blocked = blockedItems(data, scope)
  const paused = pausedItems(data, scope)
  return (
    <Card title="Bloqueado y en pausa" icon="lock" subtitle="Qué está parado y qué hace falta para seguir">
      <ItemList items={blocked} data={data} showProject={!scope} detail="blocked" year={year} empty="Nada bloqueado." />
      {paused.length > 0 && (
        <details className="subsection">
          <summary>
            Aparcado a propósito ({paused.length}) <span className="muted small">— en pausa hasta que se cumpla una condición</span>
          </summary>
          <ItemList items={paused} data={data} showProject={!scope} detail="blocked" year={year} />
        </details>
      )}
    </Card>
  )
}

function EventLine({ event, data, today, year }: { event: StudioEvent; data: StudioData; today: string; year: number }) {
  const { edit } = useUI()
  const project = data.projects.find((p) => p.id === event.projectId)
  return (
    <li className="agenda-row">
      <div className="agenda-date">
        {event.date ? (
          <>
            <strong>{formatDate(event.date, year)}</strong>
            <span className="muted small">{event.dateConfirmed ? relativeDays(event.date, today) : 'sin confirmar'}</span>
          </>
        ) : (
          <strong className="muted">Sin fecha</strong>
        )}
      </div>
      <div className="agenda-main">
        <button type="button" className="item-title" onClick={() => edit({ collection: 'events', id: event.id })}>
          {event.title}
        </button>
        <div className="item-meta">
          <span className="meta-date">{EVENT_TYPES[event.type]}</span>
          {event.location && <span className="meta-date">{event.location}</span>}
          <ProjectChip project={project} />
        </div>
      </div>
      <EventStatusPill status={event.status} />
    </li>
  )
}

function AgendaCard({ data, scope, today, year }: CardProps) {
  const { href } = useScope()
  const { openItem } = useUI()
  const next = upcoming(data, today, 60, scope)
  const undated = undatedEvents(data, scope).filter((e) => !e.date)
  const stale = staleEvents(data, today, scope)
  return (
    <Card
      title="Próximas fechas"
      icon="calendar"
      subtitle="Eventos, entregas y fechas límite (60 días)"
      action={
        <Link to={href('/agenda')} className="btn btn-small btn-ghost">
          Agenda <Icon name="chevronRight" size={14} />
        </Link>
      }
    >
      {next.length === 0 ? (
        <Empty icon="calendar">No hay fechas en los próximos 60 días.</Empty>
      ) : (
        <ul className="agenda-list">
          {next.map((e) =>
            e.kind === 'event' ? (
              <EventLine key={e.event.id} event={e.event} data={data} today={today} year={year} />
            ) : (
              <li key={e.item.id} className="agenda-row">
                <div className="agenda-date">
                  <strong>{formatDate(e.date, year)}</strong>
                  <span className="muted small">{relativeDays(e.date, today)}</span>
                </div>
                <div className="agenda-main">
                  <button type="button" className="item-title" onClick={() => openItem(e.item.id)}>
                    {e.item.title}
                  </button>
                  <div className="item-meta">
                    <span className="meta-date">Fecha límite</span>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {stale.length > 0 && (
        <div className="subsection">
          <h3 className="subhead">¿Se celebró? Actualiza su estado</h3>
          <ul className="agenda-list">
            {stale.map((ev) => (
              <EventLine key={ev.id} event={ev} data={data} today={today} year={year} />
            ))}
          </ul>
        </div>
      )}
      {undated.length > 0 && (
        <div className="subsection">
          <h3 className="subhead">Previstos sin fecha confirmada</h3>
          <ul className="agenda-list">
            {undated.map((ev) => (
              <EventLine key={ev.id} event={ev} data={data} today={today} year={year} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function BuildsCard({ data, scope, year }: CardProps) {
  const { href } = useScope()
  const builds = currentBuilds(data, scope)
  return (
    <Card
      title="Builds y versiones"
      icon="box"
      subtitle="Lo que está compilado y dónde"
      action={
        <Link to={href('/builds')} className="btn btn-small btn-ghost">
          Todas <Icon name="chevronRight" size={14} />
        </Link>
      }
    >
      {builds.length === 0 ? (
        <Empty icon="box">No hay builds registradas.</Empty>
      ) : (
        <ul className="build-list">
          {builds.map((b) => (
            <li key={b.id} className="build-row">
              <div>
                <strong>{b.name}</strong> <span className="version-tag">v{b.version}</span>
                <div className="item-meta">
                  <BuildChannelPill channel={b.channel} />
                  {b.platforms.length > 0 && <span className="meta-date">{b.platforms.join(' · ')}</span>}
                  {b.date && <span className="meta-date">{formatDate(b.date, year)}</span>}
                  {!scope && <ProjectChip project={data.projects.find((p) => p.id === b.projectId)} />}
                </div>
              </div>
              <div className="item-side">
                <BuildStatusPill status={b.status} />
                {b.url && (
                  <a href={b.url} target="_blank" rel="noreferrer noopener" className="icon-btn" aria-label={`Abrir ${b.name}`}>
                    <Icon name="external" size={16} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function PublishCard({ data, scope }: CardProps) {
  const { href } = useScope()
  const lists = checklistsOf(data, scope)
  return (
    <Card
      title="Publicar y actualizar"
      icon="rocket"
      subtitle="Qué falta para publicar o sacar una versión"
      action={
        <Link to={href('/publicacion')} className="btn btn-small btn-ghost">
          Ver pasos <Icon name="chevronRight" size={14} />
        </Link>
      }
    >
      {lists.length === 0 ? (
        <Empty icon="rocket">Sin listas de publicación.</Empty>
      ) : (
        <ul className="checklist-summary">
          {lists.map(({ checklist, done, total, ratio }) => (
            <li key={checklist.id}>
              <div className="checklist-summary-head">
                <Link to={href(`/publicacion#${checklist.id}`)}>{checklist.title}</Link>
                <span className="muted small">
                  {done}/{total}
                </span>
              </div>
              <Progress ratio={ratio} label={checklist.title} tone={ratio === 1 ? 'success' : 'progress'} />
              {(() => {
                const next = checklist.items.find((i) => !i.done)
                return next ? <p className="muted small">Siguiente: {next.label}</p> : null
              })()}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function LaunchCard({ data, scope, year }: CardProps) {
  const steam = pendingInAreas(data, ['steam'], scope)
  const events = pendingInAreas(data, ['events', 'marketing'], scope)
  const release = pendingInAreas(data, ['release', 'demo'], scope)
  return (
    <Card title="Steam, ferias y presentaciones" icon="flag" subtitle="Lo pendiente para salir fuera">
      <h3 className="subhead">Steam ({steam.length})</h3>
      <ItemList items={steam} data={data} showProject={!scope} limit={5} year={year} empty="Nada pendiente para Steam." />
      <h3 className="subhead">Ferias, eventos y comunidad ({events.length})</h3>
      <ItemList items={events} data={data} showProject={!scope} limit={4} year={year} empty="Nada pendiente para ferias." />
      <h3 className="subhead">Demos y versiones ({release.length})</h3>
      <ItemList items={release} data={data} showProject={!scope} limit={4} year={year} empty="Nada pendiente en demos y versiones." />
    </Card>
  )
}

function FeedbackCard({ data, scope, year }: CardProps) {
  const { href } = useScope()
  const { edit } = useUI()
  const open = feedbackToPrioritize(data, scope)
  const all = data.feedback.filter((f) => !scope || f.projectId === scope)
  const addressed = all.filter((f) => f.status === 'addressed').length
  return (
    <Card
      title="Feedback"
      icon="message"
      subtitle="Lo que dicen los jugadores y qué priorizar"
      action={
        <Link to={href('/feedback')} className="btn btn-small btn-ghost">
          Todo <Icon name="chevronRight" size={14} />
        </Link>
      }
    >
      {open.length === 0 ? (
        <Empty icon="message">
          {all.length ? `Todo el feedback registrado está atendido (${addressed} resueltos).` : 'Aún no hay feedback registrado.'}
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
                  {f.originDetail && <span className="meta-date">{f.originDetail}</span>}
                  {f.receivedAt && <span className="meta-date">{formatDate(f.receivedAt, year)}</span>}
                </div>
              </div>
              <div className="item-side">
                <FeedbackStatusPill status={f.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 && addressed > 0 && <p className="muted small">{addressed} ya resueltos.</p>}
    </Card>
  )
}

function EvolutionCard({ data, scope, today, year }: CardProps) {
  const buckets = weeklyEvolution(data, today, 8, scope)
  const activity = activityOf(data, scope)
  const last7 = activity.filter((a) => a.type === 'commit' && a.at.slice(0, 10) > addDays(today, -7)).length
  const prev7 = activity.filter((a) => a.type === 'commit' && a.at.slice(0, 10) > addDays(today, -14) && a.at.slice(0, 10) <= addDays(today, -7)).length
  const doneTotal = itemsOf(data, scope).filter((i) => i.status === 'done').length
  return (
    <Card title="Evolución" icon="activity" subtitle="Commits y elementos terminados por semana (últimas 8)">
      <div className="evolution">
        <WeeklyChart buckets={buckets} year={year} />
        <dl className="evolution-stats">
          <div>
            <dt>Commits en los últimos 7 días</dt>
            <dd>
              {last7} <span className="muted small">(semana anterior: {prev7})</span>
            </dd>
          </div>
          <div>
            <dt>Elementos terminados en total</dt>
            <dd>{doneTotal}</dd>
          </div>
          <div>
            <dt>Commits registrados</dt>
            <dd>{activity.filter((a) => a.type === 'commit').length}</dd>
          </div>
        </dl>
      </div>
    </Card>
  )
}

function DecisionsCard({ data, scope, year }: CardProps) {
  const { href } = useScope()
  const { open, taken } = decisions(data, scope)
  return (
    <Card
      title="Decisiones"
      icon="scale"
      action={
        <Link to={href('/decisiones')} className="btn btn-small btn-ghost">
          Registro <Icon name="chevronRight" size={14} />
        </Link>
      }
    >
      {open.length > 0 && (
        <>
          <h3 className="subhead">Por decidir ({open.length})</h3>
          <ItemList items={open} data={data} showProject={!scope} detail="decision" limit={3} year={year} />
        </>
      )}
      <h3 className="subhead">Últimas tomadas</h3>
      <ItemList items={taken} data={data} showProject={!scope} limit={4} year={year} hideStatus empty="Sin decisiones registradas." />
    </Card>
  )
}

function RecentDoneCard({ data, scope, year }: CardProps) {
  const { href } = useScope()
  const done = itemsOf(data, scope)
    .filter((i) => i.status === 'done' && i.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
  return (
    <Card
      title="Últimos avances"
      icon="check"
      action={
        <Link to={href('/historial')} className="btn btn-small btn-ghost">
          Historial <Icon name="chevronRight" size={14} />
        </Link>
      }
    >
      <ItemList items={done} data={data} showProject={!scope} limit={7} hideStatus year={year} empty="Aún no hay nada terminado." />
    </Card>
  )
}

function ResourcesCard({ data, scope }: CardProps) {
  const { href } = useScope()
  const resources = data.resources.filter((r) => !scope || !r.projectId || r.projectId === scope).slice(0, 8)
  return (
    <Card
      title="Documentación y recursos"
      icon="book"
      action={
        <Link to={href('/recursos')} className="btn btn-small btn-ghost">
          Todos <Icon name="chevronRight" size={14} />
        </Link>
      }
    >
      {resources.length === 0 ? (
        <Empty icon="book">Sin recursos.</Empty>
      ) : (
        <ul className="resource-mini">
          {resources.map((r) => {
            const project = data.projects.find((p) => p.id === r.projectId)
            const url = r.url ?? (r.path && project?.repoUrl ? `${project.repoUrl}/blob/main/${r.path}` : undefined)
            return <li key={r.id}>{url ? <ExternalLink href={url}>{r.title}</ExternalLink> : r.title}</li>
          })}
        </ul>
      )}
    </Card>
  )
}
