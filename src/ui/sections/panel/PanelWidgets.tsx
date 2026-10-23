// Los bloques del panel: responden de un vistazo a las preguntas del día a día. Cada bloque
// es un widget que se puede ocultar, reordenar y plegar (Personalizar). Sirven para todo el
// estudio y, con un proyecto como ámbito, como resumen de ese proyecto. En el modo foco
// (?ver=) se pintan solos, a todo el ancho y con todo su contenido (`focus`).
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CALENDAR_KINDS, EVENT_TYPES } from '../../../domain/catalog'
import { addDays, yearOf } from '../../../domain/dates'
import {
  activityOf,
  blockedItems,
  checklistsOf,
  currentBuilds,
  decisions,
  feedbackToPrioritize,
  isActionable,
  itemsOf,
  overdueItems,
  PANEL_ALERT_KINDS,
  panelAlerts,
  panelEntriesByMonth,
  panelRecentDone,
  panelToConfirm,
  pausedItems,
  pendingInAreas,
  projectsByStage,
  projectsInGroup,
  projectSummaries,
  projectSummary,
  staleEvents,
  todayItems,
  undatedEvents,
  upcomingEntries,
  weeklyEvolution,
  type CalendarEntry,
  type NotificationKind,
  type Scope,
  type StudioNotification,
  type TodayReason,
} from '../../../domain/selectors'
import type { Activity, StudioData, StudioEvent } from '../../../domain/types'
import { t, tr } from '../../../i18n'
import type { Formatter } from '../../../i18n/format'
import { useCanEdit, useStudioData } from '../../../data/store'
import { BuildChannelPill, BuildStatusPill, EventStatusPill, FeedbackStatusPill, HealthPill, Pill, ProjectChip } from '../../components/Badges'
import { Card, Empty, ExternalLink, Modal, Progress, Stat } from '../../components/Common'
import { WeeklyChart } from '../../components/Charts'
import { Icon, type IconName } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { CALENDAR_ICON } from '../../components/MonthCalendar'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { DEFAULT_WIDGET_ORDER, updatePreferences, usePreferences, type WidgetId } from '../../prefs'
import { ProjectCard } from '../proyectos/ProjectCard'
import { StageLine } from '../proyectos/StageLine'

/** Días que abarca «Próximas fechas» (el bloque y su cifra). */
const UPCOMING_DAYS = 60
/** Fechas que enseña el bloque fuera del modo foco (el resto, en el calendario). */
const AGENDA_LIMIT = 8

const REASON: Record<TodayReason, { tone: 'danger' | 'warning' | 'info' | 'special'; icon: IconName }> = {
  overdue: { tone: 'danger', icon: 'clock' },
  due: { tone: 'warning', icon: 'clock' },
  focus: { tone: 'info', icon: 'sun' },
  in_progress: { tone: 'info', icon: 'play' },
  review: { tone: 'special', icon: 'eye' },
}

function ReasonPill({ reason }: { reason: TodayReason }) {
  const r = REASON[reason]
  return (
    <Pill tone={r.tone} icon={r.icon}>
      {t(`secciones.panel.reason.${reason}`)}
    </Pill>
  )
}

export interface WidgetProps {
  data: StudioData
  scope: Scope
  today: string
  year: number
  fmt: Formatter
  /** Modo foco (?ver=): el bloque solo, a todo el ancho y sin recortar las listas. */
  focus?: boolean
}

interface WidgetDef {
  icon: IconName
  /** Ocupa las dos columnas. */
  full?: boolean
  /** Solo tiene sentido en la vista de todo el estudio (en un proyecto, solo en el modo foco). */
  studioOnly?: boolean
  Body: (p: WidgetProps) => ReactNode
  Action?: (p: WidgetProps) => ReactNode
}

const MoreLink = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="btn btn-small btn-link">
    {label} <Icon name="chevronRight" size={14} />
  </Link>
)

/** Enlace a otra sección en el ámbito de aquí (en la ficha, a su pestaña). */
function ScopedMore({ to, label }: { to: string; label: string }) {
  const { href } = useScope()
  return <MoreLink to={href(to)} label={label} />
}

export const WIDGETS: Record<WidgetId, WidgetDef> = {
  kpis: { icon: 'activity', full: true, Body: KpisBody },
  attention: { icon: 'alert', Body: AttentionBody },
  today: { icon: 'sun', Body: TodayBody, Action: () => <ScopedMore to="/tareas?vista=hoy" label={t('secciones.panel.today.plan')} /> },
  projects: { icon: 'folder', full: true, studioOnly: true, Body: ProjectsBody, Action: ProjectsAction },
  blocked: { icon: 'lock', Body: BlockedBody, Action: () => <ScopedMore to="/tareas?filtro=bloqueadas" label={t('secciones.panel.blocked.all')} /> },
  agenda: { icon: 'calendar', Body: AgendaBody, Action: () => <ScopedMore to="/calendario" label={t('secciones.panel.agenda.calendar')} /> },
  launch: { icon: 'flag', Body: LaunchBody, Action: () => <ScopedMore to="/publicacion" label={t('secciones.panel.launch.link')} /> },
  builds: { icon: 'box', Body: BuildsBody, Action: () => <ScopedMore to="/builds" label={t('secciones.panel.builds.all')} /> },
  publish: { icon: 'rocket', Body: PublishBody, Action: () => <ScopedMore to="/publicacion?vista=lanzamiento" label={t('secciones.panel.publish.steps')} /> },
  feedback: { icon: 'message', Body: FeedbackBody, Action: () => <ScopedMore to="/feedback" label={t('secciones.panel.feedback.all')} /> },
  evolution: {
    icon: 'activity',
    full: true,
    Body: EvolutionBody,
    Action: () => <ScopedMore to="/estadisticas?vista=actividad" label={t('secciones.panel.evolution.stats')} />,
  },
  decisions: {
    icon: 'scale',
    Body: DecisionsBody,
    Action: () => <ScopedMore to="/documentacion?tipo=decisiones" label={t('secciones.panel.decisions.log')} />,
  },
  recent: { icon: 'check', Body: RecentBody, Action: () => <ScopedMore to="/builds?vista=cambios" label={t('secciones.panel.recent.history')} /> },
  resources: { icon: 'book', Body: ResourcesBody, Action: () => <ScopedMore to="/recursos" label={t('secciones.panel.resources.all')} /> },
}

/** El título de un bloque (el de proyectos, dentro de un proyecto, es el estado de ese proyecto). */
function widgetTitle(id: WidgetId, scope: Scope): { title: string; subtitle: string } {
  if (id === 'projects' && scope) return { title: t('secciones.panel.projects.stateTitle'), subtitle: t('secciones.panel.projects.stateSubtitle') }
  return { title: tr(`widgets.${id}.title`), subtitle: tr(`widgets.${id}.subtitle`) }
}

/** El resumen de un proyecto: la pestaña «Resumen» de su ficha (sin ?ver=). */
export function ProjectSummaryTab() {
  const data = useStudioData()
  const { project } = useScope()
  const { edit } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const fmt = useFormat()
  if (!project) return null
  return (
    <>
      <Card title={t('secciones.panel.about.title')} icon="book">
        {project.description ? (
          <p>{project.description}</p>
        ) : (
          <Empty
            icon="edit"
            action={
              canEdit ? { label: t('secciones.panel.about.write'), icon: 'edit', onClick: () => edit({ collection: 'projects', id: project.id }) } : undefined
            }
          >
            {t('secciones.panel.about.empty')}
          </Empty>
        )}
      </Card>
      <WidgetArea data={data} scope={project.id} today={today} year={yearOf(today)} fmt={fmt} />
    </>
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
        const { title, subtitle } = widgetTitle(id, props.scope)
        return (
          <div key={id} className={w.full ? 'w-full' : undefined}>
            <Card
              title={title}
              subtitle={subtitle}
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

/**
 * Modo foco (?ver=): solo los bloques de esa subsección, a todo el ancho y enteros. No
 * mira las preferencias (un bloque oculto o plegado también sale) ni las cambia.
 */
export function FocusArea({ ids, ...props }: WidgetProps & { ids: WidgetId[] }) {
  return (
    <div className="panel-focus">
      {ids.map((id) => {
        const w = WIDGETS[id]
        const { title, subtitle } = widgetTitle(id, props.scope)
        return (
          <Card key={id} title={title} subtitle={subtitle} icon={w.icon} action={w.Action ? <w.Action {...props} focus /> : undefined}>
            <w.Body {...props} focus />
          </Card>
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
          <button
            type="button"
            className="icon-btn small"
            onClick={() => onMove(id, -1)}
            disabled={n === 0}
            aria-label={`${t('actions.moveUp')}: ${tr(`widgets.${id}.title`)}`}
          >
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
  const overdue = overdueItems(data, today, scope).length
  const confirm = panelToConfirm(data, scope)
  const next = upcomingEntries(data, today, UPCOMING_DAYS, scope).length
  const undated = undatedEvents(data, scope).length
  const builds = currentBuilds(data, scope).filter((b) => b.status === 'published' || b.status === 'ready').length
  const feedback = feedbackToPrioritize(data, scope).length
  const active = projectsInGroup(data, 'activos').length
  return (
    <div className="stats">
      {!scope && <Stat label={t('secciones.panel.kpis.activeProjects')} value={active} icon="folder" to={href('/proyectos?estado=activos')} />}
      <Stat
        label={t('secciones.panel.kpis.open')}
        value={items.filter(isActionable).length}
        hint={t('secciones.panel.kpis.openHint')}
        icon="list"
        to={href('/tareas')}
      />
      <Stat label={t('secciones.panel.kpis.today')} value={todayItems(data, today, scope).length} tone="info" icon="sun" to={href('/tareas?vista=hoy')} />
      <Stat label={t('secciones.panel.kpis.overdue')} value={overdue} tone={overdue ? 'danger' : 'neutral'} icon="clock" to={href('/tareas?filtro=vencidas')} />
      <Stat
        label={t('secciones.panel.kpis.blocked')}
        value={blocked}
        tone={blocked ? 'danger' : 'neutral'}
        icon="lock"
        to={href('/tareas?filtro=bloqueadas')}
      />
      <Stat
        label={t('secciones.panel.kpis.toConfirm')}
        value={confirm.status}
        hint={
          confirm.unverified
            ? t(confirm.unverified === 1 ? 'secciones.panel.kpis.unverifiedOne' : 'secciones.panel.kpis.unverifiedOther', { n: confirm.unverified })
            : undefined
        }
        tone={confirm.status ? 'warning' : 'neutral'}
        icon="question"
        to={href('/tareas?estado=to_confirm')}
      />
      <Stat
        label={t('secciones.panel.kpis.upcoming')}
        value={next}
        hint={
          undated
            ? t(undated === 1 ? 'secciones.panel.kpis.undatedOne' : 'secciones.panel.kpis.undatedOther', { n: undated })
            : t('secciones.panel.kpis.upcomingHint')
        }
        icon="calendar"
        to={href('/calendario')}
      />
      <Stat label={t('secciones.panel.kpis.builds')} value={builds} icon="box" to={href('/builds')} />
      <Stat label={t('secciones.panel.kpis.feedback')} value={feedback} icon="message" to={href('/feedback?vista=priorizacion')} />
    </div>
  )
}

const ALERT_ICON: Record<NotificationKind, IconName> = {
  overdue: 'clock',
  dueToday: 'clock',
  eventSoon: 'calendar',
  eventStale: 'question',
  blocked: 'lock',
  newFeedback: 'message',
  reminder: 'bell',
  registrationSoon: 'ticket',
  releaseSoon: 'rocket',
  releaseLate: 'question',
  budgetOver: 'wallet',
}

/** Avisos (los de la campana): icono y texto de qué pasa; al pulsarlos se abre lo que avisan. */
function AlertList({
  alerts,
  data,
  showProject,
  today,
  year,
}: {
  alerts: StudioNotification[]
  data: StudioData
  showProject: boolean
  today: string
  year: number
}) {
  const { edit } = useUI()
  const fmt = useFormat()
  return (
    <ul className="panel-alerts">
      {alerts.map((n) => (
        <li key={n.id} className="panel-alert">
          <span className={`panel-alert-icon panel-tone-${n.tone}`} aria-hidden="true">
            <Icon name={ALERT_ICON[n.kind]} size={16} />
          </span>
          <div className="panel-alert-main">
            <button type="button" className="item-title" onClick={() => edit({ collection: n.target.collection, id: n.target.id })}>
              {t(`notifications.${n.kind}`, { title: n.title, when: n.date ? fmt.relative(n.date, today) : '' })}
            </button>
            {(n.date || (showProject && n.projectId)) && (
              <div className="item-meta">
                {n.date && <span className="meta-date">{fmt.date(n.date, year)}</span>}
                {showProject && <ProjectChip project={data.projects.find((p) => p.id === n.projectId)} />}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function AttentionBody({ data, scope, today, year, focus }: WidgetProps) {
  const project = scope ? data.projects.find((p) => p.id === scope) : undefined
  const summaries = scope ? (project ? [projectSummary(data, project, today)] : []) : projectSummaries(data, today)
  // En todo el estudio, un proyecto en pausa o archivado no pide atención (está parado a propósito).
  const flagged = summaries.filter((s) => s.health.reasons.length > 0 && (scope || s.health.level !== 'idle'))
  const upToDate = summaries.filter((s) => s.health.reasons.length === 0 && s.health.level !== 'idle')
  // Fuera del modo foco, solo los avisos que no salen ya en otro bloque.
  const alerts = panelAlerts(data, today, scope, focus ? undefined : PANEL_ALERT_KINDS)
  return (
    <>
      {flagged.length === 0 ? (
        <Empty>{t('secciones.panel.attention.none')}</Empty>
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
      {!scope && flagged.length > 0 && upToDate.length > 0 && (
        <p className="muted small">{t('secciones.panel.attention.upToDate', { names: upToDate.map((s) => s.project.name).join(', ') })}</p>
      )}
      {(alerts.length > 0 || focus) && (
        <div className="subsection">
          <h3 className="subhead">{focus ? t('secciones.panel.attention.alertsAll', { n: alerts.length }) : t('secciones.panel.attention.alerts')}</h3>
          {alerts.length === 0 ? (
            <Empty>{t('secciones.panel.attention.alertsNone')}</Empty>
          ) : (
            <AlertList alerts={alerts} data={data} showProject={!scope} today={today} year={year} />
          )}
        </div>
      )}
    </>
  )
}

function TodayBody({ data, scope, today, year, focus }: WidgetProps) {
  const entries = todayItems(data, today, scope)
  const reasons = new Map(entries.map((e) => [e.item.id, e.reason]))
  return (
    <ItemList
      items={entries.map((e) => e.item)}
      data={data}
      showProject={!scope}
      limit={focus ? undefined : 7}
      year={year}
      hideStatus
      empty={t('secciones.panel.today.empty')}
      aside={(item) => <ReasonPill reason={reasons.get(item.id)!} />}
    />
  )
}

function ProjectsAction({ scope }: WidgetProps) {
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

function ProjectsBody({ data, scope, today }: WidgetProps) {
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
function ProjectStateBody({ data, scope, today }: { data: StudioData; scope: string; today: string }) {
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

function BlockedBody({ data, scope, year }: WidgetProps) {
  const blocked = blockedItems(data, scope)
  const paused = pausedItems(data, scope)
  return (
    <>
      <ItemList items={blocked} data={data} showProject={!scope} detail="blocked" year={year} empty={t('secciones.panel.blocked.none')} />
      {paused.length > 0 && (
        <details className="subsection">
          <summary>
            {t('secciones.panel.blocked.paused', { n: paused.length })} <span className="muted small">{t('secciones.panel.blocked.pausedHint')}</span>
          </summary>
          <ItemList items={paused} data={data} showProject={!scope} detail="blocked" year={year} />
        </details>
      )}
    </>
  )
}

function EventLine({ event, data, today, year, showProject }: { event: StudioEvent; data: StudioData; today: string; year: number; showProject: boolean }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const project = data.projects.find((p) => p.id === event.projectId)
  return (
    <li className="agenda-row">
      <div className="agenda-date">
        {event.date ? (
          <>
            <strong>{fmt.date(event.date, year)}</strong>
            <span className="muted small">{event.dateConfirmed ? fmt.relative(event.date, today) : t('calendarUi.unconfirmed')}</span>
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
          {showProject && <ProjectChip project={project} />}
        </div>
      </div>
      <EventStatusPill status={event.status} />
    </li>
  )
}

/** Una fecha del calendario unificado: cuándo, qué tipo (icono y texto), si está sin confirmar y de qué proyecto. */
function UpcomingRow({ entry, data, today, year, showProject }: { entry: CalendarEntry; data: StudioData; today: string; year: number; showProject: boolean }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const kind = CALENDAR_KINDS[entry.kind]
  // Un evento de varios días que ya empezó sigue en la lista hasta que acaba.
  const ongoing = entry.date < today && entry.endDate
  return (
    <li className="agenda-row">
      <div className="agenda-date">
        <strong>{fmt.date(entry.date, year)}</strong>
        <span className="muted small">
          {ongoing ? t('secciones.panel.agenda.until', { date: fmt.date(entry.endDate!, year) }) : fmt.relative(entry.date, today)}
        </span>
      </div>
      <div className="agenda-main">
        <button type="button" className="item-title" onClick={() => edit({ collection: entry.target.collection, id: entry.target.id })}>
          {entry.title}
        </button>
        <div className="item-meta">
          <Pill tone={kind.tone} icon={CALENDAR_ICON[entry.kind]}>
            {kind.label}
          </Pill>
          {!entry.confirmed && (
            <Pill tone="warning" icon="question">
              {t('secciones.panel.agenda.unconfirmed')}
            </Pill>
          )}
          {entry.time && <span className="meta-date">{entry.time}</span>}
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === entry.projectId)} />}
        </div>
      </div>
    </li>
  )
}

function AgendaBody({ data, scope, today, year, fmt, focus }: WidgetProps) {
  const { create } = useUI()
  const { href } = useScope()
  const canEdit = useCanEdit()
  const next = upcomingEntries(data, today, UPCOMING_DAYS, scope)
  const shown = focus ? next : next.slice(0, AGENDA_LIMIT)
  const undated = undatedEvents(data, scope).filter((e) => !e.date)
  const stale = staleEvents(data, today, scope)
  const row = (e: CalendarEntry) => <UpcomingRow key={e.id} entry={e} data={data} today={today} year={year} showProject={!scope} />
  return (
    <>
      {next.length === 0 ? (
        <Empty icon="calendar" action={canEdit ? { label: t('secciones.panel.agenda.add'), onClick: () => create('events') } : undefined}>
          {t('secciones.panel.agenda.empty')}
        </Empty>
      ) : focus ? (
        panelEntriesByMonth(next).map((m) => (
          <div key={m.month} className="panel-month">
            <h3 className="subhead">{fmt.monthYear(m.month)}</h3>
            <ul className="agenda-list">{m.entries.map(row)}</ul>
          </div>
        ))
      ) : (
        <ul className="agenda-list">{shown.map(row)}</ul>
      )}
      {next.length > shown.length && (
        <div>
          <MoreLink to={href('/calendario')} label={t('secciones.panel.agenda.more', { n: next.length - shown.length })} />
        </div>
      )}
      {stale.length > 0 && (
        <div className="subsection">
          <h3 className="subhead">{t('secciones.panel.agenda.stale')}</h3>
          <ul className="agenda-list">
            {stale.map((ev) => (
              <EventLine key={ev.id} event={ev} data={data} today={today} year={year} showProject={!scope} />
            ))}
          </ul>
        </div>
      )}
      {undated.length > 0 && (
        <div className="subsection">
          <h3 className="subhead">{t('secciones.panel.agenda.undated')}</h3>
          <ul className="agenda-list">
            {undated.map((ev) => (
              <EventLine key={ev.id} event={ev} data={data} today={today} year={year} showProject={!scope} />
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
      <Empty icon="box" action={canEdit ? { label: t('secciones.panel.builds.add'), onClick: () => create('builds') } : undefined}>
        {t('secciones.panel.builds.empty')}
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
              <a href={b.url} target="_blank" rel="noreferrer noopener" className="icon-btn" aria-label={t('secciones.panel.builds.open', { name: b.name })}>
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
      <Empty icon="rocket" action={canEdit ? { label: t('secciones.panel.publish.add'), onClick: () => create('checklists') } : undefined}>
        {t('secciones.panel.publish.empty')}
      </Empty>
    )
  return (
    <ul className="checklist-summary">
      {lists.map(({ checklist, done, total, ratio }) => {
        const next = checklist.items.find((i) => !i.done)
        return (
          <li key={checklist.id}>
            <div className="checklist-summary-head">
              <Link to={href('/publicacion?vista=lanzamiento')}>{checklist.title}</Link>
              <span className="muted small num">
                {done}/{total}
              </span>
            </div>
            <Progress ratio={ratio} label={checklist.title} tone={ratio === 1 ? 'success' : 'info'} />
            {next && <p className="muted small">{t('secciones.panel.publish.next', { label: next.label })}</p>}
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
      <h3 className="subhead">{t('secciones.panel.launch.steam', { n: steam.length })}</h3>
      <ItemList items={steam} data={data} showProject={!scope} limit={5} year={year} empty={t('secciones.panel.launch.steamNone')} />
      <h3 className="subhead">{t('secciones.panel.launch.events', { n: events.length })}</h3>
      <ItemList items={events} data={data} showProject={!scope} limit={4} year={year} empty={t('secciones.panel.launch.eventsNone')} />
      <h3 className="subhead">{t('secciones.panel.launch.release', { n: release.length })}</h3>
      <ItemList items={release} data={data} showProject={!scope} limit={4} year={year} empty={t('secciones.panel.launch.releaseNone')} />
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
        <Empty icon="message" action={canEdit ? { label: t('secciones.panel.feedback.add'), onClick: () => create('feedback') } : undefined}>
          {all.length === 0
            ? t('secciones.panel.feedback.empty')
            : t(addressed === 1 ? 'secciones.panel.feedback.allDoneOne' : 'secciones.panel.feedback.allDoneOther', { n: addressed })}
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
                  {!scope && <ProjectChip project={data.projects.find((p) => p.id === f.projectId)} />}
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
      {open.length > 0 && addressed > 0 && (
        <p className="muted small">
          {t(addressed === 1 ? 'secciones.panel.feedback.addressedOne' : 'secciones.panel.feedback.addressedOther', { n: addressed })}
        </p>
      )}
    </>
  )
}

function EvolutionBody({ data, scope, today, year }: WidgetProps) {
  const { weekStart } = usePreferences()
  const buckets = weeklyEvolution(data, today, 8, scope, weekStart)
  const commits = activityOf(data, scope).filter((a) => a.type === 'commit')
  const last7 = commits.filter((a) => a.at.slice(0, 10) > addDays(today, -7)).length
  const prev7 = commits.filter((a) => a.at.slice(0, 10) > addDays(today, -14) && a.at.slice(0, 10) <= addDays(today, -7)).length
  const doneTotal = itemsOf(data, scope).filter((i) => i.status === 'done').length
  return (
    <div className="evolution">
      <WeeklyChart buckets={buckets} year={year} />
      <dl className="evolution-stats">
        <div>
          <dt>{t('secciones.panel.evolution.last7')}</dt>
          <dd>
            {last7} <span className="muted small">{t('secciones.panel.evolution.previous', { n: prev7 })}</span>
          </dd>
        </div>
        <div>
          <dt>{t('secciones.panel.evolution.doneTotal')}</dt>
          <dd>{doneTotal}</dd>
        </div>
        <div>
          <dt>{t('secciones.panel.evolution.commits')}</dt>
          <dd>{commits.length}</dd>
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
          <h3 className="subhead">{t('secciones.panel.decisions.open', { n: open.length })}</h3>
          <ItemList items={open} data={data} showProject={!scope} detail="decision" limit={3} year={year} />
        </>
      )}
      <h3 className="subhead">{t('secciones.panel.decisions.taken')}</h3>
      <ItemList items={taken} data={data} showProject={!scope} limit={4} year={year} hideStatus empty={t('secciones.panel.decisions.none')} />
    </>
  )
}

const ACTIVITY_ICON: Record<Activity['type'], IconName> = { commit: 'git', merge: 'git', release: 'rocket', note: 'fileText' }

/** Los últimos registros del código (commits, fusiones, publicaciones y notas), con su enlace si lo tienen. */
function ActivityList({ activity, data, showProject, year }: { activity: Activity[]; data: StudioData; showProject: boolean; year: number }) {
  const fmt = useFormat()
  if (activity.length === 0) return <Empty icon="git">{t('secciones.panel.recent.codeNone')}</Empty>
  return (
    <ul className="panel-activity">
      {activity.map((a) => (
        <li key={a.id} className="panel-activity-row">
          <Icon name={ACTIVITY_ICON[a.type]} size={14} />
          <div className="panel-activity-main">
            <span className={a.type === 'merge' ? 'git-merge' : undefined}>{a.title}</span>
            <div className="item-meta">
              <span className="meta-date">{t(`secciones.panel.recent.activity.${a.type}`)}</span>
              {a.ref && (a.url ? <ExternalLink href={a.url}>{a.ref}</ExternalLink> : <span className="git-ref">{a.ref}</span>)}
              <span className="meta-date">{fmt.date(a.at.slice(0, 10), year)}</span>
              {showProject && <ProjectChip project={data.projects.find((p) => p.id === a.projectId)} />}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function RecentBody({ data, scope, year, focus }: WidgetProps) {
  const done = panelRecentDone(data, scope)
  const list = <ItemList items={done} data={data} showProject={!scope} limit={focus ? 20 : 7} hideStatus year={year} empty={t('secciones.panel.recent.none')} />
  if (!focus) return list
  return (
    <div className="grid grid-2">
      <div className="panel-column">
        <h3 className="subhead">{t('secciones.panel.recent.done')}</h3>
        {list}
      </div>
      <div className="panel-column">
        <h3 className="subhead">{t('secciones.panel.recent.code')}</h3>
        <ActivityList activity={activityOf(data, scope).slice(0, 15)} data={data} showProject={!scope} year={year} />
      </div>
    </div>
  )
}

function ResourcesBody({ data, scope }: WidgetProps) {
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
