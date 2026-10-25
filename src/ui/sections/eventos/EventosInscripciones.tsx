// Inscripciones de los eventos que están por delante: lo que cierra pronto primero, el plazo
// (con «sin confirmar» si no lo está), el enlace y cambios rápidos (enviada, aceptada…). Se
// llevan a mano: Studio Hub no se conecta con las webs de los eventos.
import { REGISTRATION_STATUSES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { REGISTRATION_GROUPS, eventoRegistrations, sectorEvents, type RegistrationGroup } from '../../../domain/selectors'
import type { RegistrationStatus, StudioEvent } from '../../../domain/types'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, EventStatusPill, Pill } from '../../components/Badges'
import { Card, Empty, ExternalLink } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { TagLinks } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useUndoable } from '../../feedback'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { EventProject, EventTypePill, EventosPage, RegistrationPill, Unconfirmed, useEventDate, useEventosQuery, useNewEvent } from './comunes'

/** Días que cuentan como «cierra pronto». */
const SOON_DAYS = 14

const GROUP_ICON: Record<RegistrationGroup, IconName> = {
  soon: 'alert',
  overdue: 'clock',
  open: 'edit',
  submitted: 'upload',
  decided: 'checkCircle',
  missing: 'question',
  notNeeded: 'minus',
}

/** Los cambios rápidos que se ofrecen desde cada estado de la inscripción. */
const QUICK: Partial<Record<RegistrationStatus, RegistrationStatus[]>> = {
  not_open: ['open', 'submitted'],
  open: ['submitted'],
  submitted: ['accepted', 'rejected'],
}

export function EventosInscripciones({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const today = useToday()
  const canEdit = useCanEdit()
  const { tipo, query } = useEventosQuery()
  const newEvent = useNewEvent(tipo)
  const groups = eventoRegistrations(data, today, query, SOON_DAYS)
  const total = REGISTRATION_GROUPS.reduce((n, g) => n + groups[g].length, 0)
  const any = sectorEvents(data, { ...query, tag: null }).length > 0
  const showProject = scope === null

  return (
    <EventosPage
      embedded={embedded}
      tipo={tipo}
      intro={
        <>
          <p>{t('secciones.eventos.inscripciones.intro', { days: SOON_DAYS })}</p>
          <p className="eventos-manual">
            <Icon name="info" size={14} /> {t('secciones.eventos.inscripciones.manual')}
          </p>
        </>
      }
    >
      {total === 0 ? (
        <Card>
          <Empty icon="ticket" action={canEdit && !query.tag && !any ? { label: t('secciones.eventos.actions.new'), onClick: newEvent } : undefined}>
            {any ? t('secciones.eventos.inscripciones.empty') : t(`secciones.eventos.tipos.${tipo ?? 'todos'}.empty`)}
          </Empty>
        </Card>
      ) : (
        REGISTRATION_GROUPS.filter((g) => groups[g].length > 0).map((g) => (
          <Card
            key={g}
            title={t(`secciones.eventos.inscripciones.groups.${g}.title`, { days: SOON_DAYS })}
            icon={GROUP_ICON[g]}
            subtitle={t(`secciones.eventos.inscripciones.groups.${g}.hint`)}
            className={g === 'soon' || g === 'overdue' ? 'eventos-urgent' : undefined}
          >
            <ul className="agenda-list">
              {groups[g].map((e) => (
                <RegistrationRow key={e.id} event={e} showProject={showProject} />
              ))}
            </ul>
          </Card>
        ))
      )}
    </EventosPage>
  )
}

function RegistrationRow({ event: e, showProject }: { event: StudioEvent; showProject: boolean }) {
  const { edit } = useUI()
  const canEdit = useCanEdit()
  const undoable = useUndoable()
  const today = useToday()
  const fmt = useFormat()
  const year = yearOf(today)
  const when = useEventDate()
  const deadline = e.registrationDeadline
  const needs = e.registrationStatus !== 'not_needed'
  const move = (status: RegistrationStatus) =>
    undoable(t('secciones.eventos.inscripciones.moved', { title: e.title, status: REGISTRATION_STATUSES[status].label }), () =>
      store.patch('events', e.id, { registrationStatus: status }),
    )
  return (
    <li className="agenda-row eventos-row">
      <div className="agenda-date">
        {deadline ? (
          <>
            <span className="muted small">{t('secciones.eventos.inscripciones.closes')}</span>
            <strong>{fmt.date(deadline, year)}</strong>
            <span className="muted small">{fmt.relative(deadline, today)}</span>
          </>
        ) : (
          <span className="muted small">{needs ? t('secciones.eventos.inscripciones.noDeadline') : t('secciones.eventos.inscripciones.notNeeded')}</span>
        )}
      </div>
      <div className="agenda-main">
        <button type="button" className="item-title" onClick={() => edit({ collection: 'events', id: e.id })}>
          {e.title}
        </button>
        <div className="item-meta">
          {e.registrationStatus ? (
            <RegistrationPill status={e.registrationStatus} />
          ) : (
            <Pill tone="muted" icon="question">
              {t('secciones.eventos.inscripciones.unknown')}
            </Pill>
          )}
          {deadline && !e.registrationDeadlineConfirmed && <Unconfirmed what="deadline" />}
          <EventTypePill type={e.type} />
          <span className="meta-date">
            {t('secciones.eventos.inscripciones.eventDate', { date: when(e) })}
            {e.date && !e.dateConfirmed ? ` (${t('secciones.eventos.unconfirmedShort')})` : ''}
          </span>
          <EventProject event={e} showProject={showProject} />
          <ConfidenceTag confidence={e.confidence} compact />
          <TagLinks tags={e.tags} />
        </div>
        <div className="eventos-links">
          {e.registrationUrl && <ExternalLink href={e.registrationUrl}>{t('secciones.eventos.inscripciones.link')}</ExternalLink>}
          {e.url && <ExternalLink href={e.url}>{t('secciones.eventos.web')}</ExternalLink>}
          {!e.registrationUrl && (e.registrationStatus === 'open' || e.registrationStatus === 'not_open') && (
            <span className="muted small">{t('secciones.eventos.inscripciones.noLink')}</span>
          )}
        </div>
        {canEdit && (
          <div className="button-row eventos-quick" role="group" aria-label={t('secciones.eventos.inscripciones.quick', { title: e.title })}>
            {(e.registrationStatus ? (QUICK[e.registrationStatus] ?? []) : []).map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => move(s)}
                aria-label={t('secciones.eventos.inscripciones.move', { title: e.title, status: REGISTRATION_STATUSES[s].label })}
              >
                <Icon name="check" size={14} /> {REGISTRATION_STATUSES[s].label}
              </button>
            ))}
            {!e.registrationStatus && (
              <button type="button" className="btn btn-small btn-ghost" onClick={() => edit({ collection: 'events', id: e.id })}>
                <Icon name="edit" size={14} /> {t('secciones.eventos.inscripciones.fill')}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="item-side">
        <EventStatusPill status={e.status} />
      </div>
    </li>
  )
}
