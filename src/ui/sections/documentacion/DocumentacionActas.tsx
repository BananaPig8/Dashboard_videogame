// Actas (?tipo=actas): las actas por fecha, cada una con su reunión y las decisiones que salen
// de ella, y las reuniones del calendario que todavía no tienen acta («Escribir el acta»).
import { hasTag, meetingsWithoutMinutes, minutesDefaults, minutesOf, type MeetingWithoutMinutes, type MinutesEntry } from '../../../domain/selectors'
import { yearOf } from '../../../domain/dates'
import type { StudioEvent } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { EventStatusPill, Pill, ProjectChip, StatusPill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { BodyText, EditResourceButton, ResourceMeta, ResourceTitle, ResourceWhere } from '../recursos/comunes'
import { DocumentacionPage, EventRef, NewButton } from './comunes'
import { useNewDocDefaults } from './DocumentacionLista'
import { NEW_DECISION } from './DocumentacionDecisiones'

const NEW_MEETING = { type: 'meeting', status: 'planned' }

const plural = (key: 'count' | 'meetingsCount' | 'decisionsCount', n: number) => t(`secciones.documentacion.minutes.${key}.${n === 1 ? 'one' : 'many'}`, { n })

/** Abre el editor de una decisión nueva que sale de esta reunión. */
function useNewDecisionFrom() {
  const { create } = useUI()
  return (event: StudioEvent) => create('items', { ...NEW_DECISION, eventId: event.id, ...(event.projectId ? { projectId: event.projectId } : {}) })
}

export function DocumentacionActas({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const today = useToday()
  const defaults = useNewDocDefaults('actas')
  const label = t('secciones.documentacion.actions.new.actas')
  const all = minutesOf(data, scope)
  const minutes = all.filter((m) => hasTag(m.minutes, tag))
  const allMeetings = meetingsWithoutMinutes(data, today, scope)
  const meetings = allMeetings.filter((m) => hasTag(m.event, tag))
  const anyMeeting = data.events.some((e) => e.type === 'meeting' && (scope === null || !e.projectId || e.projectId === scope))

  return (
    <DocumentacionPage embedded={embedded} intro={t('secciones.documentacion.intro.actas')} actions={<NewButton collection="resources" defaults={defaults} label={label} primary />}>
      <div className="grid grid-2-1">
        <Card title={t('secciones.documentacion.minutes.title')} icon="users" subtitle={minutes.length ? plural('count', minutes.length) : undefined}>
          {minutes.length === 0 ? (
            <Empty icon="users" action={canEdit && !tag ? { label, onClick: () => create('resources', defaults) } : undefined}>
              {tag && all.length ? t('secciones.documentacion.emptyTag') : t('secciones.documentacion.empty.actas')}
            </Empty>
          ) : (
            <ul className="documentacion-minutes-list">
              {minutes.map((m) => (
                <MinutesRow key={m.minutes.id} entry={m} showProject={scope === null} />
              ))}
            </ul>
          )}
        </Card>
        <Card
          title={t('secciones.documentacion.minutes.without')}
          icon="calendar"
          subtitle={meetings.length ? plural('meetingsCount', meetings.length) : t('secciones.documentacion.minutes.withoutSub')}
          action={canEdit && anyMeeting ? <NewButton collection="events" defaults={NEW_MEETING} label={t('secciones.documentacion.actions.newMeeting')} small /> : undefined}
        >
          {meetings.length === 0 ? (
            <Empty
              icon={anyMeeting ? 'check' : 'calendar'}
              action={
                canEdit && !anyMeeting ? { label: t('secciones.documentacion.actions.newMeeting'), onClick: () => create('events', NEW_MEETING) } : undefined
              }
            >
              {tag && allMeetings.length
                ? t('secciones.documentacion.emptyTag')
                : anyMeeting
                  ? t('secciones.documentacion.minutes.withoutEmpty')
                  : t('secciones.documentacion.minutes.noMeetings')}
            </Empty>
          ) : (
            <ul className="documentacion-meetings">
              {meetings.map((m) => (
                <MeetingRow key={m.event.id} meeting={m} showProject={scope === null} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DocumentacionPage>
  )
}

/** Un acta: título, fecha y reunión, su texto (o adónde lleva) y las decisiones de la reunión. */
function MinutesRow({ entry: { minutes: r, event, decisions }, showProject }: { entry: MinutesEntry; showProject: boolean }) {
  const data = useStudioData()
  const { openItem } = useUI()
  const canEdit = useCanEdit()
  const newDecision = useNewDecisionFrom()
  const project = r.projectId ? data.projects.find((p) => p.id === r.projectId) : undefined
  return (
    <li className="documentacion-minutes">
      <div className="recursos-row-head">
        <h3 className="recursos-title">
          <ResourceTitle resource={r} project={project} />
        </h3>
        <EditResourceButton resource={r} />
      </div>
      <div className="item-meta">
        {event ? (
          <EventRef event={event} />
        ) : (
          <span className="meta-date">
            <Icon name={r.eventId ? 'alert' : 'users'} size={12} />{' '}
            {r.eventId ? t('secciones.documentacion.minutes.missingMeeting') : t('secciones.documentacion.minutes.noMeeting')}
          </span>
        )}
      </div>
      <ResourceMeta resource={{ ...r, eventId: undefined }} showProject={showProject} />
      {r.description && <p className="item-detail">{r.description}</p>}
      {r.body ? (
        <BodyText text={r.body} />
      ) : (
        <p className="small">
          <span className="muted">{t('secciones.documentacion.minutes.noText')}</span> <ResourceWhere resource={r} project={project} />
        </p>
      )}
      {event && (
        <div className="documentacion-minutes-decisions">
          <h4 className="subhead">{t('secciones.documentacion.minutes.decisions')}</h4>
          {decisions.length ? (
            <ul className="documentacion-minutes-decision-list">
              {decisions.map((d) => (
                <li key={d.id}>
                  <div className="documentacion-decision-head">
                    <button type="button" className="item-title" onClick={() => openItem(d.id)}>
                      {d.title}
                    </button>
                    <StatusPill status={d.status} />
                  </div>
                  {d.decisionOutcome && <p className="item-detail">{d.decisionOutcome}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('secciones.documentacion.minutes.noDecisions')}</p>
          )}
          {canEdit && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => newDecision(event)} aria-label={t('secciones.documentacion.actions.newDecisionOf', { name: event.title })}>
              <Icon name="plus" size={14} /> {t('secciones.documentacion.actions.newDecision')}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/** Una reunión sin acta: cuándo es, su estado y «Escribir el acta». */
function MeetingRow({ meeting: { event: e, upcoming, decisions }, showProject }: { meeting: MeetingWithoutMinutes; showProject: boolean }) {
  const data = useStudioData()
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const today = useToday()
  const year = yearOf(today)
  const title = t('secciones.documentacion.minutes.titleOf', { name: e.title })
  return (
    <li className="documentacion-meeting">
      <div className="documentacion-meeting-main">
        <button type="button" className="item-title" onClick={() => edit({ collection: 'events', id: e.id })}>
          {e.title}
        </button>
        <div className="item-meta">
          <span className="meta-date">
            {e.date ? `${fmt.date(e.date, year)}${e.time ? ` · ${e.time}` : ''} · ${fmt.relative(e.date, today)}` : t('secciones.documentacion.minutes.undated')}
          </span>
          {upcoming && (
            <Pill tone="info" icon="clock">
              {t('secciones.documentacion.minutes.upcoming')}
            </Pill>
          )}
          <EventStatusPill status={e.status} />
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === e.projectId)} />}
          {decisions.length > 0 && <span className="meta-date">{plural('decisionsCount', decisions.length)}</span>}
        </div>
      </div>
      {canEdit && (
        <button
          type="button"
          className="btn btn-small"
          onClick={() => create('resources', minutesDefaults(e, title))}
          aria-label={t('secciones.documentacion.actions.writeMinutesOf', { name: e.title })}
        >
          <Icon name="edit" size={14} /> {t('secciones.documentacion.actions.writeMinutes')}
        </button>
      )}
    </li>
  )
}
