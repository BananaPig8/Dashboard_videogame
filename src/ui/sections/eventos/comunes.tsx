// Piezas comunes de Eventos: la fecha de un evento (con «sin confirmar»), su tipo, su
// inscripción, la fila de la agenda y la cabecera de la página con «Nuevo evento».
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EVENT_TYPES, REGISTRATION_STATUSES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { eventoDefaultType, eventoFeedbackCount, eventoIsStale, eventoTipoOf, type EventoQuery, type EventoTipo } from '../../../domain/selectors'
import type { EventType, ISODate, RegistrationStatus, StudioEvent } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, EventStatusPill, Pill, ProjectChip } from '../../components/Badges'
import { ExternalLink } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice, TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'

export const EVENT_TYPE_ICON: Record<EventType, IconName> = {
  fair: 'ticket',
  festival: 'star',
  award: 'trophy',
  showcase: 'video',
  presentation: 'message',
  meeting: 'users',
  deadline: 'clock',
  delivery: 'upload',
  release: 'rocket',
  steam: 'globe',
  other: 'calendar',
}

const REGISTRATION_ICON: Record<RegistrationStatus, IconName> = {
  not_open: 'circleDashed',
  open: 'edit',
  submitted: 'upload',
  accepted: 'checkCircle',
  rejected: 'xCircle',
  not_needed: 'minus',
}

/** La subsección y el ámbito, ya leídos de la URL. */
export function useEventosQuery(): { tipo: EventoTipo | null; vista: string | null; query: EventoQuery } {
  const [params] = useSearchParams()
  const { scope } = useScope()
  const tag = useTagFilter()
  const tipo = eventoTipoOf(params.get('tipo'))
  return { tipo, vista: params.get('vista'), query: { scope, tipo, tag } }
}

export function EventTypePill({ type }: { type: EventType }) {
  return (
    <Pill tone="neutral" icon={EVENT_TYPE_ICON[type]}>
      {EVENT_TYPES[type]}
    </Pill>
  )
}

export function RegistrationPill({ status }: { status: RegistrationStatus }) {
  return (
    <Pill tone={REGISTRATION_STATUSES[status].tone} icon={REGISTRATION_ICON[status]}>
      {t('secciones.eventos.registration.pill', { status: REGISTRATION_STATUSES[status].label })}
    </Pill>
  )
}

/** «Fecha sin confirmar» o «Plazo sin confirmar», con icono y texto. */
export function Unconfirmed({ what }: { what: 'date' | 'deadline' }) {
  return (
    <Pill tone="warning" icon="question">
      {what === 'date' ? t('secciones.eventos.unconfirmedDate') : t('secciones.eventos.unconfirmedDeadline')}
    </Pill>
  )
}

/** Del 3 al 5 de oct (o solo el día) y la hora, si la hay. */
export function useEventDate() {
  const fmt = useFormat()
  const year = yearOf(useToday())
  return (e: Pick<StudioEvent, 'date' | 'endDate' | 'time'>) => {
    if (!e.date) return t('secciones.eventos.noDate')
    const from = fmt.date(e.date, year)
    const day = e.endDate && e.endDate !== e.date ? t('secciones.eventos.range', { from, to: fmt.date(e.endDate, year) }) : from
    return e.time ? t('secciones.eventos.at', { day, time: e.time }) : day
  }
}

/** El proyecto del evento; sin proyecto, «Todo el estudio» (sale también en cada proyecto). */
export function EventProject({ event: e, showProject }: { event: StudioEvent; showProject: boolean }) {
  const data = useStudioData()
  if (!e.projectId)
    return (
      <Pill tone="muted" icon="home">
        {t('secciones.eventos.studioWide')}
      </Pill>
    )
  return showProject ? <ProjectChip project={data.projects.find((p) => p.id === e.projectId)} /> : null
}

/** Una fila de la agenda de eventos: fecha, nombre, tipo, lugar, inscripción y estado. */
export function EventRow({ event: e, showProject, today, children }: { event: StudioEvent; showProject: boolean; today: ISODate; children?: ReactNode }) {
  const data = useStudioData()
  const { href } = useScope()
  const { edit } = useUI()
  const fmt = useFormat()
  const when = useEventDate()
  const stale = eventoIsStale(e, today)
  const feedback = eventoFeedbackCount(data, e)
  return (
    <li className="agenda-row eventos-row">
      <div className="agenda-date">
        <strong>{when({ date: e.date, endDate: e.endDate })}</strong>
        {e.date && (
          <span className="muted small">
            {e.dateConfirmed ? fmt.relative(e.date, today) : t('secciones.eventos.unconfirmedShort')}
          </span>
        )}
      </div>
      <div className="agenda-main">
        <button type="button" className="item-title" onClick={() => edit({ collection: 'events', id: e.id })}>
          {e.title}
        </button>
        <div className="item-meta">
          <EventTypePill type={e.type} />
          {e.time && <span className="meta-date">{e.endTime ? `${e.time}–${e.endTime}` : e.time}</span>}
          {e.location && (
            <span className="meta-date">
              <Icon name="map" size={12} /> {e.location}
            </span>
          )}
          <EventProject event={e} showProject={showProject} />
          {e.registrationStatus && <RegistrationPill status={e.registrationStatus} />}
          {feedback > 0 && (
            <Link className="meta-date eventos-feedback-link" to={href(`/feedback?${new URLSearchParams({ evento: e.id })}`)}>
              <Icon name="message" size={12} /> {t('secciones.eventos.feedbackCount', { n: feedback })}
            </Link>
          )}
          <ConfidenceTag confidence={e.confidence} compact />
          {e.url && <ExternalLink href={e.url}>{t('secciones.eventos.web')}</ExternalLink>}
          <TagLinks tags={e.tags} />
        </div>
        {e.notes && <p className="item-detail">{e.notes}</p>}
        {children}
      </div>
      <div className="item-side">
        {stale && (
          <Pill tone="warning" icon="question">
            {t('secciones.eventos.stale')}
          </Pill>
        )}
        <EventStatusPill status={e.status} />
      </div>
    </li>
  )
}

/** Cabecera con «Nuevo evento» (del tipo de la subsección) y el aviso de etiqueta. */
export function EventosPage({ embedded, tipo, intro, children }: { embedded?: boolean; tipo: EventoTipo | null; intro?: ReactNode; children: ReactNode }) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  const { project } = useScope()
  const actions = canEdit ? (
    <button type="button" className="btn btn-primary" onClick={() => create('events', { type: eventoDefaultType(tipo) })}>
      <Icon name="plus" size={16} /> {t('secciones.eventos.actions.new')}
    </button>
  ) : undefined
  return (
    <div className={embedded ? 'eventos-page' : 'page eventos-page'}>
      <SectionHeader
        id="eventos"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.eventos.subtitleIn', { project: project.name }) : undefined}
      />
      <TagFilterNotice />
      {intro && <div className="eventos-intro">{intro}</div>}
      {children}
    </div>
  )
}

/** «Nuevo evento» para los estados vacíos (con el tipo de la subsección). */
export function useNewEvent(tipo: EventoTipo | null) {
  const { create } = useUI()
  return () => create('events', { type: eventoDefaultType(tipo) })
}
