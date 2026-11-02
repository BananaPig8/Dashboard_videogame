// Lo que comparten los bloques del Dashboard: sus props, enlaces «ver más», avisos, filas de
// fechas y de actividad.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CALENDAR_KINDS, EVENT_TYPES } from '../../../../domain/catalog'
import { type CalendarEntry, type NotificationKind, type Scope, type StudioNotification, type TodayReason } from '../../../../domain/selectors'
import type { Activity, StudioData, StudioEvent } from '../../../../domain/types'
import { t } from '../../../../i18n'
import type { Formatter } from '../../../../i18n/format'
import { ConfidenceTag, EventStatusPill, Pill, ProjectChip } from '../../../components/Badges'
import { Empty, ExternalLink } from '../../../components/Common'
import { Icon, type IconName } from '../../../components/Icon'
import { CALENDAR_ICON } from '../../../components/MonthCalendar'
import { useScope, useUI } from '../../../context'
import { useFormat } from '../../../hooks'
import { notificationText } from '../../../Notifications'
import type { Period } from '../../../../domain/selectors'

/** Días que abarca «Próximas fechas» (el bloque y su cifra). */
export const UPCOMING_DAYS = 60

/** Fechas que enseña el bloque fuera del modo foco (el resto, en el calendario). */
export const AGENDA_LIMIT = 8

export const REASON: Record<TodayReason, { tone: 'danger' | 'warning' | 'info' | 'special'; icon: IconName }> = {
  overdue: { tone: 'danger', icon: 'clock' },
  due: { tone: 'warning', icon: 'clock' },
  focus: { tone: 'info', icon: 'sun' },
  in_progress: { tone: 'info', icon: 'play' },
  review: { tone: 'special', icon: 'eye' },
}

export function ReasonPill({ reason }: { reason: TodayReason }) {
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
  /** El periodo elegido en la cabecera (cifras, actividad y comparaciones). */
  period: Period
  /** El bloque está a todo el ancho (puede enseñar más). */
  wide?: boolean
  /** Modo foco (?ver=): el bloque solo, a todo el ancho y sin recortar las listas. */
  focus?: boolean
}

export interface WidgetDef {
  icon: IconName
  /** No se puede cambiar de ancho (siempre ocupa las dos columnas). */
  fixedWide?: boolean
  /** Solo tiene sentido en la vista de todo el estudio (en un proyecto, solo en el modo foco). */
  studioOnly?: boolean
  Body: (p: WidgetProps) => ReactNode
  Action?: (p: WidgetProps) => ReactNode
}

export const MoreLink = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="btn btn-small btn-link">
    {label} <Icon name="chevronRight" size={14} />
  </Link>
)

/** Enlace a otra sección en el ámbito de aquí (en la ficha, a su pestaña). */
export function ScopedMore({ to, label }: { to: string; label: string }) {
  const { href } = useScope()
  return <MoreLink to={href(to)} label={label} />
}

export const ALERT_ICON: Record<NotificationKind, IconName> = {
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
export function AlertList({
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
              {notificationText(n, n.date ? fmt.relative(n.date, today) : '')}
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

export function EventLine({ event, data, today, year, showProject }: { event: StudioEvent; data: StudioData; today: string; year: number; showProject: boolean }) {
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
export function UpcomingRow({ entry, data, today, year, showProject }: { entry: CalendarEntry; data: StudioData; today: string; year: number; showProject: boolean }) {
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
          {entry.confidence && (entry.confirmed || entry.confidence !== 'to_confirm') && <ConfidenceTag confidence={entry.confidence} compact />}
          {entry.time && <span className="meta-date">{entry.time}</span>}
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === entry.projectId)} />}
        </div>
      </div>
    </li>
  )
}

export const ACTIVITY_ICON: Record<Activity['type'], IconName> = { commit: 'git', merge: 'git', release: 'rocket', note: 'fileText' }

/** Los últimos registros del código (commits, fusiones, publicaciones y notas), con su enlace si lo tienen. */
export function ActivityList({ activity, data, showProject, year }: { activity: Activity[]; data: StudioData; showProject: boolean; year: number }) {
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
