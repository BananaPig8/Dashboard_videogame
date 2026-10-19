// El panel: responde de un vistazo a las preguntas del día a día. Cada bloque es un widget
// que se puede ocultar, reordenar y plegar (Personalizar). Sirve para todo el estudio y,
// con un proyecto como ámbito, como resumen de ese proyecto.
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EVENT_TYPES, STAGES } from '../../domain/catalog'
import { addDays, yearOf } from '../../domain/dates'
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
import { t, tr } from '../../i18n'
import type { Formatter } from '../../i18n/format'
import { useCanEdit, useStudioData } from '../../data/store'
import { BuildChannelPill, BuildStatusPill, EventStatusPill, FeedbackStatusPill, HealthPill, Pill, ProjectChip, StagePill } from '../components/Badges'
import { Card, Empty, ExternalLink, Modal, PageHeader, Progress, Stat } from '../components/Common'
import { Sparkline, WeeklyChart } from '../components/Charts'
import { Icon, type IconName } from '../components/Icon'
import { ItemList } from '../components/ItemList'
import { useScope, useUI } from '../context'
import { useFormat, useToday } from '../hooks'
import { DEFAULT_WIDGET_ORDER, updatePreferences, usePreferences, type WidgetId } from '../prefs'
import { plural } from '../util'

const REASON: Record<TodayReason, { label: string; tone: 'danger' | 'warning' | 'info' | 'special'; icon: IconName }> = {
  overdue: { label: 'Vencida', tone: 'danger', icon: 'clock' },
  due: { label: 'Vence hoy', tone: 'warning', icon: 'clock' },
  focus: { label: 'Para hoy', tone: 'info', icon: 'sun' },
  in_progress: { label: 'En curso', tone: 'info', icon: 'play' },
  review: { label: 'En revisión', tone: 'special', icon: 'eye' },
}

export function ReasonPill({ reason }: { reason: TodayReason }) {
  const r = REASON[reason]
  return (
    <Pill tone={r.tone} icon={r.icon}>
      {r.label}
    </Pill>
  )
}

export interface WidgetProps {
  data: StudioData
  scope: Scope
  today: string
  year: number
  fmt: Formatter
}

interface WidgetDef {
  icon: IconName
  /** Ocupa las dos columnas. */
  full?: boolean
  /** Solo tiene sentido en la vista de todo el estudio. */
  studioOnly?: boolean
  Body: (p: WidgetProps) => ReactNode
  Action?: (p: WidgetProps) => ReactNode
}

const MoreLink = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="btn btn-small btn-link">
    {label} <Icon name="chevronRight" size={14} />
  </Link>
)

export const WIDGETS: Record<WidgetId, WidgetDef> = {
  kpis: { icon: 'activity', full: true, Body: KpisBody },
  attention: { icon: 'alert', Body: AttentionBody },
  today: { icon: 'sun', Body: TodayBody, Action: () => <ScopedMore to="/hoy" label="Planificar el día" /> },
  projects: { icon: 'folder', full: true, studioOnly: true, Body: ProjectsBody, Action: NewProjectAction },
  blocked: { icon: 'lock', Body: BlockedBody },
  agenda: { icon: 'calendar', Body: AgendaBody, Action: () => <ScopedMore to="/agenda" label="Agenda" /> },
  launch: { icon: 'flag', Body: LaunchBody },
  builds: { icon: 'box', Body: BuildsBody, Action: () => <ScopedMore to="/builds" label="Todas" /> },
  publish: { icon: 'rocket', Body: PublishBody, Action: () => <ScopedMore to="/publicacion" label="Ver pasos" /> },
  feedback: { icon: 'message', Body: FeedbackBody, Action: () => <ScopedMore to="/feedback" label="Todo" /> },
  evolution: { icon: 'activity', full: true, Body: EvolutionBody },
  decisions: { icon: 'scale', Body: DecisionsBody, Action: () => <ScopedMore to="/decisiones" label="Registro" /> },
  recent: { icon: 'check', Body: RecentBody, Action: () => <ScopedMore to="/historial" label="Historial" /> },
  resources: { icon: 'book', Body: ResourcesBody, Action: () => <ScopedMore to="/recursos" label="Todos" /> },
}

function ScopedMore({ to, label }: { to: string; label: string }) {
  const { href } = useScope()
  return <MoreLink to={href(to)} label={label} />
}

/** Panel del estudio (ruta «/»). */
export function DashboardPage() {
  const data = useStudioData()
  const { scope, project } = useScope()
  const today = useToday()
  const fmt = useFormat()
  const [customizing, setCustomizing] = useState(false)
  const active = data.projects.filter((p) => p.stage !== 'archived' && p.stage !== 'paused')
  return (
    <div className="page">
      <PageHeader
        title={project ? `Panel · ${project.name}` : 'Panel del estudio'}
        subtitle={`${fmt.longDate(today)} · ${plural(active.length, 'proyecto activo', 'proyectos activos')}`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => setCustomizing(true)}>
            <Icon name="layout" size={16} /> {t('actions.customize')}
          </button>
        }
      />
      <WidgetArea data={data} scope={scope} today={today} year={yearOf(today)} fmt={fmt} />
      <CustomizePanel open={customizing} onClose={() => setCustomizing(false)} />
    </div>
  )
}

/** Los widgets visibles, en el orden elegido. */
export function WidgetArea(props: WidgetProps) {
  const prefs = usePreferences()
  const hidden = new Set(prefs.widgets.hidden)
  const collapsed = new Set(prefs.widgets.collapsed)
  const ids = prefs.widgets.order.filter((id) => !hidden.has(id) && !(WIDGETS[id].studioOnly && props.scope))
  const toggle = (id: WidgetId) =>
    updatePreferences((p) => ({
      widgets: {
        ...p.widgets,
        collapsed: p.widgets.collapsed.includes(id) ? p.widgets.collapsed.filter((x) => x !== id) : [...p.widgets.collapsed, id],
      },
    }))
  return (
    <div className="widget-grid">
      {ids.map((id) => {
        const w = WIDGETS[id]
        return (
          <div key={id} className={w.full ? 'w-full' : undefined}>
            <Card
              title={tr(`widgets.${id}.title`)}
              subtitle={tr(`widgets.${id}.subtitle`)}
              icon={w.icon}
              action={w.Action ? <w.Action {...props} /> : undefined}
              collapsed={collapsed.has(id)}
              onToggle={() => toggle(id)}
            >
              {!collapsed.has(id) && <w.Body {...props} />}
            </Card>
          </div>
        )
      })}
    </div>
  )
}

export function CustomizePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = usePreferences()
  const order = prefs.widgets.order
  const hidden = new Set(prefs.widgets.hidden)
  const move = (id: WidgetId, delta: number) => {
    const n = order.indexOf(id)
    const m = n + delta
    if (m < 0 || m >= order.length) return
    const next = [...order]
    ;[next[n], next[m]] = [next[m], next[n]]
    updatePreferences((p) => ({ widgets: { ...p.widgets, order: next } }))
  }
  const toggle = (id: WidgetId) =>
    updatePreferences((p) => ({
      widgets: { ...p.widgets, hidden: p.widgets.hidden.includes(id) ? p.widgets.hidden.filter((x) => x !== id) : [...p.widgets.hidden, id] },
    }))
  return (
    <Modal
      open={open}
      side
      title={t('customize.title')}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => updatePreferences({ widgets: { order: DEFAULT_WIDGET_ORDER, hidden: [], collapsed: [] } })}
          >
            {t('actions.reset')}
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('actions.close')}
          </button>
        </>
      }
    >
      <p className="muted">{t('customize.intro')}</p>
      <WidgetOrderList order={order} hidden={hidden} onMove={move} onToggle={toggle} />
    </Modal>
  )
}

export function WidgetOrderList({
  order,
  hidden,
  onMove,
  onToggle,
}: {
  order: WidgetId[]
  hidden: Set<WidgetId>
  onMove: (id: WidgetId, delta: number) => void
  onToggle: (id: WidgetId) => void
}) {
  return (
    <ul className="widget-list">
      {order.map((id, n) => (
        <li key={id}>
          <Icon name={WIDGETS[id].icon} size={16} />
          <label>
            <input type="checkbox" checked={!hidden.has(id)} onChange={() => onToggle(id)} />
            <span>
              {tr(`widgets.${id}.title`)}
              {WIDGETS[id].studioOnly && <span className="muted small"> · {t('customize.onlyStudio')}</span>}
            </span>
          </label>
          <button type="button" className="icon-btn small" onClick={() => onMove(id, -1)} disabled={n === 0} aria-label={`${t('actions.moveUp')}: ${tr(`widgets.${id}.title`)}`}>
            <Icon name="arrowUp" size={14} />
          </button>
          <button
            type="button"
            className="icon-btn small"
            onClick={() => onMove(id, 1)}
            disabled={n === order.length - 1}
            aria-label={`${t('actions.moveDown')}: ${tr(`widgets.${id}.title`)}`}
          >
            <Icon name="arrowDown" size={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}

// ——— Widgets ————————————————————————————————————————————————————————————————

function KpisBody({ data, scope, today }: WidgetProps) {
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
    <div className="stats">
      {!scope && <Stat label="Proyectos activos" value={activeProjects} icon="folder" to="/proyectos" />}
      <Stat label="Abiertas" value={items.filter(isActionable).length} hint="En marcha o por hacer" icon="list" to={href('/trabajo')} />
      <Stat label="Para hoy" value={todayItems(data, today, scope).length} tone="info" icon="sun" to={href('/hoy')} />
      <Stat label="Bloqueadas" value={blocked} tone={blocked ? 'danger' : 'neutral'} icon="lock" to={href('/trabajo?estado=blocked')} />
      <Stat label="Por confirmar" value={confirm} tone={confirm ? 'warning' : 'neutral'} icon="question" to={href('/trabajo?estado=to_confirm')} />
      <Stat label="Próximas fechas" value={agenda} hint={undated ? `${undated} sin fecha confirmada` : '60 días'} icon="calendar" to={href('/agenda')} />
      <Stat label="Builds disponibles" value={builds} icon="box" to={href('/builds')} />
      <Stat label="Feedback abierto" value={feedback} icon="message" to={href('/feedback')} />
    </div>
  )
}

function AttentionBody({ data, scope, today }: WidgetProps) {
  const summaries = scope ? [projectSummary(data, data.projects.find((p) => p.id === scope)!, today)] : projectSummaries(data, today)
  const flagged = summaries.filter((s) => s.health.reasons.length > 0)
  return (
    <>
      {flagged.length === 0 ? (
        <Empty>Ningún proyecto pide atención ahora mismo.</Empty>
      ) : (
        <ul className="attention-list">
          {flagged.map((s) => (
            <li key={s.project.id}>
              <div className="attention-head">
                <Link to={`/proyectos/${s.project.slug}`} className="strong-link">
                  <span className="dot" style={{ background: s.project.color }} aria-hidden="true" />
                  {s.project.name}
                </Link>
                <HealthPill level={s.health.level} />
              </div>
              <ul className="reasons">
                {s.health.reasons.map((r) => (
                  <li key={r}>
                    <Icon name="chevronRight" size={12} />
                    {r}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {!scope && summaries.length > flagged.length && (
        <p className="muted small">
          Al día:{' '}
          {summaries
            .filter((s) => s.health.reasons.length === 0)
            .map((s) => s.project.name)
            .join(', ')}
        </p>
      )}
    </>
  )
}

function TodayBody({ data, scope, today, year }: WidgetProps) {
  const entries = todayItems(data, today, scope)
  const reasons = new Map(entries.map((e) => [e.item.id, e.reason]))
  return (
    <ItemList
      items={entries.map((e) => e.item)}
      data={data}
      showProject={!scope}
      limit={7}
      year={year}
      hideStatus
      empty="Nada marcado para hoy. Elige qué hacer en «Planificar el día»."
      aside={(item) => <ReasonPill reason={reasons.get(item.id)!} />}
    />
  )
}

export function ProjectCard({ summary, data, today }: { summary: ProjectSummary; data: StudioData; today: string }) {
  const fmt = useFormat()
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
          {summary.lastActivity ? `Última actividad ${fmt.relative(summary.lastActivity, today)}` : 'Sin actividad registrada'}
        </span>
        <Sparkline values={dailyCommits(data, today, days, p.id)} label={`Commits de los últimos ${days} días`} startLabel={fmt.date(addDays(today, -(days - 1)))} />
      </footer>
    </article>
  )
}

function NewProjectAction() {
  const { create } = useUI()
  const canEdit = useCanEdit()
  if (!canEdit) return null
  return (
    <button type="button" className="btn btn-small btn-link" onClick={() => create('projects')}>
      <Icon name="plus" size={14} /> Nuevo proyecto
    </button>
  )
}

function ProjectsBody({ data, today }: WidgetProps) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  const summaries = projectSummaries(data, today).sort(
    (a, b) => STAGES[a.project.stage].order - STAGES[b.project.stage].order || a.project.name.localeCompare(b.project.name),
  )
  return (
    <div className="project-grid">
      {summaries.map((s) => (
        <ProjectCard key={s.project.id} summary={s} data={data} today={today} />
      ))}
      {canEdit && (
        <button type="button" className="project-card project-card-new" onClick={() => create('projects')}>
          <Icon name="plus" size={20} />
          <span>Añadir un videojuego</span>
          <span className="muted small">De la idea a la publicación, con el mismo panel.</span>
        </button>
      )}
    </div>
  )
}

function BlockedBody({ data, scope, year }: WidgetProps) {
  const blocked = blockedItems(data, scope)
  const paused = pausedItems(data, scope)
  return (
    <>
      <ItemList items={blocked} data={data} showProject={!scope} detail="blocked" year={year} empty="Nada bloqueado." />
      {paused.length > 0 && (
        <details className="subsection">
          <summary>
            Aparcado a propósito ({paused.length}) <span className="muted small">— en pausa hasta que se cumpla una condición</span>
          </summary>
          <ItemList items={paused} data={data} showProject={!scope} detail="blocked" year={year} />
        </details>
      )}
    </>
  )
}

export function EventLine({ event, data, today, year }: { event: StudioEvent; data: StudioData; today: string; year: number }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const project = data.projects.find((p) => p.id === event.projectId)
  return (
    <li className="agenda-row">
      <div className="agenda-date">
        {event.date ? (
          <>
            <strong>{fmt.date(event.date, year)}</strong>
            <span className="muted small">{event.dateConfirmed ? fmt.relative(event.date, today) : 'sin confirmar'}</span>
          </>
        ) : (
          <strong className="muted">{t('dates.none')}</strong>
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

function AgendaBody({ data, scope, today, year, fmt }: WidgetProps) {
  const { openItem, create } = useUI()
  const canEdit = useCanEdit()
  const next = upcoming(data, today, 60, scope)
  const undated = undatedEvents(data, scope).filter((e) => !e.date)
  const stale = staleEvents(data, today, scope)
  return (
    <>
      {next.length === 0 ? (
        <Empty icon="calendar" action={canEdit ? { label: 'Añadir fecha', onClick: () => create('events') } : undefined}>
          No hay fechas en los próximos 60 días.
        </Empty>
      ) : (
        <ul className="agenda-list">
          {next.map((e) =>
            e.kind === 'event' ? (
              <EventLine key={e.event.id} event={e.event} data={data} today={today} year={year} />
            ) : (
              <li key={e.item.id} className="agenda-row">
                <div className="agenda-date">
                  <strong>{fmt.date(e.date, year)}</strong>
                  <span className="muted small">{fmt.relative(e.date, today)}</span>
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
    </>
  )
}

function BuildsBody({ data, scope, year, fmt }: WidgetProps) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  const builds = currentBuilds(data, scope)
  if (builds.length === 0)
    return (
      <Empty icon="box" action={canEdit ? { label: 'Registrar build', onClick: () => create('builds') } : undefined}>
        No hay builds registradas.
      </Empty>
    )
  return (
    <ul className="build-list">
      {builds.map((b) => (
        <li key={b.id} className="build-row">
          <div>
            <strong>{b.name}</strong> <span className="version-tag">v{b.version}</span>
            <div className="item-meta">
              <BuildChannelPill channel={b.channel} />
              {b.platforms.length > 0 && <span className="meta-date">{b.platforms.join(' · ')}</span>}
              {b.date && <span className="meta-date">{fmt.date(b.date, year)}</span>}
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
  )
}

function PublishBody({ data, scope }: WidgetProps) {
  const { href } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const lists = checklistsOf(data, scope)
  if (lists.length === 0)
    return (
      <Empty icon="rocket" action={canEdit ? { label: 'Crear lista', onClick: () => create('checklists') } : undefined}>
        Sin listas de publicación.
      </Empty>
    )
  return (
    <ul className="checklist-summary">
      {lists.map(({ checklist, done, total, ratio }) => {
        const next = checklist.items.find((i) => !i.done)
        return (
          <li key={checklist.id}>
            <div className="checklist-summary-head">
              <Link to={href(`/publicacion#${checklist.id}`)}>{checklist.title}</Link>
              <span className="muted small num">
                {done}/{total}
              </span>
            </div>
            <Progress ratio={ratio} label={checklist.title} tone={ratio === 1 ? 'success' : 'info'} />
            {next && <p className="muted small">Siguiente: {next.label}</p>}
          </li>
        )
      })}
    </ul>
  )
}

function LaunchBody({ data, scope, year }: WidgetProps) {
  const steam = pendingInAreas(data, ['steam'], scope)
  const events = pendingInAreas(data, ['events', 'marketing'], scope)
  const release = pendingInAreas(data, ['release', 'demo'], scope)
  return (
    <>
      <h3 className="subhead">Steam ({steam.length})</h3>
      <ItemList items={steam} data={data} showProject={!scope} limit={5} year={year} empty="Nada pendiente para Steam." />
      <h3 className="subhead">Ferias, eventos y comunidad ({events.length})</h3>
      <ItemList items={events} data={data} showProject={!scope} limit={4} year={year} empty="Nada pendiente para ferias." />
      <h3 className="subhead">Demos y versiones ({release.length})</h3>
      <ItemList items={release} data={data} showProject={!scope} limit={4} year={year} empty="Nada pendiente en demos y versiones." />
    </>
  )
}

function FeedbackBody({ data, scope, year, fmt }: WidgetProps) {
  const { edit, create } = useUI()
  const canEdit = useCanEdit()
  const open = feedbackToPrioritize(data, scope)
  const all = data.feedback.filter((f) => !scope || f.projectId === scope)
  const addressed = all.filter((f) => f.status === 'addressed').length
  return (
    <>
      {open.length === 0 ? (
        <Empty icon="message" action={canEdit ? { label: 'Registrar feedback', onClick: () => create('feedback') } : undefined}>
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
      {open.length > 0 && addressed > 0 && <p className="muted small">{addressed} ya resueltos.</p>}
    </>
  )
}

function EvolutionBody({ data, scope, today, year }: WidgetProps) {
  const { weekStart } = usePreferences()
  const buckets = weeklyEvolution(data, today, 8, scope, weekStart)
  const activity = activityOf(data, scope)
  const last7 = activity.filter((a) => a.type === 'commit' && a.at.slice(0, 10) > addDays(today, -7)).length
  const prev7 = activity.filter((a) => a.type === 'commit' && a.at.slice(0, 10) > addDays(today, -14) && a.at.slice(0, 10) <= addDays(today, -7)).length
  const doneTotal = itemsOf(data, scope).filter((i) => i.status === 'done').length
  return (
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
  )
}

function DecisionsBody({ data, scope, year }: WidgetProps) {
  const { open, taken } = decisions(data, scope)
  return (
    <>
      {open.length > 0 && (
        <>
          <h3 className="subhead">Por decidir ({open.length})</h3>
          <ItemList items={open} data={data} showProject={!scope} detail="decision" limit={3} year={year} />
        </>
      )}
      <h3 className="subhead">Últimas tomadas</h3>
      <ItemList items={taken} data={data} showProject={!scope} limit={4} year={year} hideStatus empty="Sin decisiones registradas." />
    </>
  )
}

function RecentBody({ data, scope, year }: WidgetProps) {
  const done = itemsOf(data, scope)
    .filter((i) => i.status === 'done' && i.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
  return <ItemList items={done} data={data} showProject={!scope} limit={7} hideStatus year={year} empty="Aún no hay nada terminado." />
}

function ResourcesBody({ data, scope }: WidgetProps) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  const resources = data.resources.filter((r) => !scope || !r.projectId || r.projectId === scope).slice(0, 8)
  if (resources.length === 0)
    return (
      <Empty icon="book" action={canEdit ? { label: 'Añadir recurso', onClick: () => create('resources') } : undefined}>
        Sin recursos.
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
