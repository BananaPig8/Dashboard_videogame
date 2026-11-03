// Lo que comparten los bloques del Dashboard: sus props, enlaces «ver más», avisos y eventos.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EVENT_TYPES } from '../../../../domain/catalog'
import { type NotificationKind, type Scope, type StudioNotification } from '../../../../domain/selectors'
import type { StudioData, StudioEvent } from '../../../../domain/types'
import { t } from '../../../../i18n'
import type { Formatter } from '../../../../i18n/format'
import { EventStatusPill, ProjectChip } from '../../../components/Badges'
import { Icon, type IconName } from '../../../components/Icon'
import { useScope, useUI } from '../../../context'
import { useFormat } from '../../../hooks'
import { notificationText } from '../../../Notifications'
import type { Period } from '../../../../domain/selectors'

/** Días que abarca «Próximas fechas» (el bloque y su cifra). */
export const UPCOMING_DAYS = 60

/** Fechas que enseña el bloque fuera del modo foco (el resto, en el calendario). */
export const AGENDA_LIMIT = 8

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
