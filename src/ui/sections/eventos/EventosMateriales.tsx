// Materiales de cada evento que está por delante: sus listas de pasos (se marcan aquí mismo),
// las builds que se llevan, el material apuntado y lo que falta. Los pasados están en
// Seguimiento.
import { CHECKLIST_TARGETS, RESOURCE_TYPES } from '../../../domain/catalog'
import { sectorEvents, upcomingEventoMaterials, type ChecklistProgress, type EventoMaterials, type EventoMissing } from '../../../domain/selectors'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { BuildChannelPill, BuildStatusPill, ConfidenceTag, EventStatusPill } from '../../components/Badges'
import { Card, Empty, ExternalLink, Progress } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { EVENT_TYPE_ICON, EventProject, EventTypePill, EventosPage, Unconfirmed, useEventDate, useEventosQuery, useNewEvent } from './comunes'

export function EventosMateriales({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const today = useToday()
  const canEdit = useCanEdit()
  const { tipo, query } = useEventosQuery()
  const newEvent = useNewEvent(tipo)
  const list = upcomingEventoMaterials(data, today, query)
  const any = sectorEvents(data, { ...query, tag: null }).length > 0

  return (
    <EventosPage embedded={embedded} tipo={tipo} intro={<p>{t('secciones.eventos.materiales.intro')}</p>}>
      {list.length === 0 ? (
        <Card>
          <Empty icon="box" action={canEdit && !query.tag ? { label: t('secciones.eventos.actions.new'), onClick: newEvent } : undefined}>
            {any ? t('secciones.eventos.materiales.empty') : t(`secciones.eventos.tipos.${tipo ?? 'todos'}.empty`)}
          </Empty>
        </Card>
      ) : (
        list.map((m) => <EventMaterials key={m.event.id} materials={m} showProject={scope === null} />)
      )}
    </EventosPage>
  )
}

function EventMaterials({ materials: m, showProject }: { materials: EventoMaterials; showProject: boolean }) {
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const when = useEventDate()
  const e = m.event
  // Lo que se crea desde aquí va con el evento (y con su proyecto, si lo tiene).
  const own = { eventId: e.id, ...(e.projectId ? { projectId: e.projectId } : {}) }
  const subtitle = [when(e), e.location].filter(Boolean).join(' · ')
  return (
    <Card
      title={e.title}
      icon={EVENT_TYPE_ICON[e.type]}
      subtitle={subtitle}
      action={
        canEdit ? (
          <button
            type="button"
            className="icon-btn small"
            onClick={() => edit({ collection: 'events', id: e.id })}
            aria-label={t('secciones.eventos.actions.edit', { title: e.title })}
            title={t('secciones.eventos.actions.edit', { title: e.title })}
          >
            <Icon name="edit" size={14} />
          </button>
        ) : undefined
      }
    >
      <div className="item-meta">
        <EventTypePill type={e.type} />
        <EventStatusPill status={e.status} />
        {e.date && !e.dateConfirmed && <Unconfirmed what="date" />}
        <EventProject event={e} showProject={showProject} />
      </div>
      <Missing materials={m} />
      <div className="eventos-materials">
        <section className="eventos-block">
          <h3 className="subhead">{t('secciones.eventos.materiales.checklists', { n: m.checklists.length })}</h3>
          {m.checklists.length ? (
            m.checklists.map((c) => <ChecklistMini key={c.checklist.id} progress={c} />)
          ) : (
            <p className="muted small">{t('secciones.eventos.materiales.noChecklists')}</p>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => create('checklists', { ...own, target: 'event', title: t('secciones.eventos.materiales.checklistTitle', { title: e.title }) })}
            >
              <Icon name="plus" size={14} /> {t('secciones.eventos.materiales.newChecklist')}
            </button>
          )}
        </section>
        <section className="eventos-block">
          <h3 className="subhead">{t('secciones.eventos.materiales.builds', { n: m.builds.length })}</h3>
          {m.builds.length ? (
            <ul className="eventos-mini-list">
              {m.builds.map((b) => (
                <li key={b.id}>
                  <button type="button" className="link-btn" onClick={() => edit({ collection: 'builds', id: b.id })}>
                    {b.name}
                  </button>{' '}
                  <span className="version-tag">v{b.version}</span>
                  <div className="item-meta">
                    <BuildChannelPill channel={b.channel} />
                    <BuildStatusPill status={b.status} />
                    <ConfidenceTag confidence={b.confidence} compact />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('secciones.eventos.materiales.noBuilds')}</p>
          )}
          {canEdit && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => create('builds', { ...own, channel: 'event' })}>
              <Icon name="plus" size={14} /> {t('secciones.eventos.materiales.newBuild')}
            </button>
          )}
        </section>
        <section className="eventos-block">
          <h3 className="subhead">{t('secciones.eventos.materiales.resources', { n: m.resources.length })}</h3>
          {m.resources.length ? (
            <ul className="eventos-mini-list">
              {m.resources.map((r) => (
                <li key={r.id}>
                  {r.url ? (
                    <ExternalLink href={r.url}>{r.title}</ExternalLink>
                  ) : (
                    <button type="button" className="link-btn" onClick={() => edit({ collection: 'resources', id: r.id })}>
                      {r.title}
                    </button>
                  )}
                  <span className="meta-date"> · {RESOURCE_TYPES[r.type]}</span>
                  {r.url && canEdit && (
                    <button
                      type="button"
                      className="icon-btn small"
                      onClick={() => edit({ collection: 'resources', id: r.id })}
                      aria-label={t('secciones.eventos.actions.edit', { title: r.title })}
                      title={t('secciones.eventos.actions.edit', { title: r.title })}
                    >
                      <Icon name="edit" size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('secciones.eventos.materiales.noResources')}</p>
          )}
          {canEdit && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => create('resources', { ...own, type: 'marketing' })}>
              <Icon name="plus" size={14} /> {t('secciones.eventos.materiales.newResource')}
            </button>
          )}
        </section>
      </div>
    </Card>
  )
}

/** Lo que falta (lo que no está apuntado), o que no falta nada. */
function Missing({ materials: m }: { materials: EventoMaterials }) {
  if (!m.missing.length)
    return (
      <p className="eventos-ready">
        <Icon name="checkCircle" size={14} /> {t('secciones.eventos.materiales.ready')}
      </p>
    )
  const text = (k: EventoMissing) =>
    k === 'steps'
      ? t(m.pendingSteps === 1 ? 'secciones.eventos.materiales.missing.stepsOne' : 'secciones.eventos.materiales.missing.stepsMany', { n: m.pendingSteps })
      : t(`secciones.eventos.materiales.missing.${k}`)
  return (
    <div className="eventos-missing">
      <h3 className="subhead">{t('secciones.eventos.materiales.missingTitle')}</h3>
      <ul>
        {m.missing.map((k) => (
          <li key={k}>
            <Icon name="alert" size={14} /> {text(k)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Una lista de pasos en pequeño: su avance y los pasos que quedan, que se marcan aquí mismo. */
function ChecklistMini({ progress: p }: { progress: ChecklistProgress }) {
  const { edit } = useUI()
  const canEdit = useCanEdit()
  const c = p.checklist
  const pending = c.items.filter((i) => !i.done)
  const toggle = (id: string) => store.upsert('checklists', { ...c, items: c.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) })
  return (
    <div className="eventos-checklist">
      <div className="eventos-checklist-head">
        <button type="button" className="link-btn" onClick={() => edit({ collection: 'checklists', id: c.id })}>
          {c.title}
        </button>
        <span className="muted small">
          {CHECKLIST_TARGETS[c.target]} · {t('secciones.eventos.materiales.steps', { done: p.done, total: p.total })}
        </span>
      </div>
      <Progress
        ratio={p.ratio}
        tone={p.total && p.done === p.total ? 'success' : 'info'}
        label={t('secciones.eventos.materiales.stepsOf', { title: c.title, done: p.done, total: p.total })}
      />
      {pending.length > 0 && (
        <details className="eventos-steps">
          <summary>{t('secciones.eventos.materiales.pending', { n: pending.length })}</summary>
          <ul className="checklist">
            {pending.map((i) => (
              <li key={i.id}>
                <label>
                  <input type="checkbox" checked={false} disabled={!canEdit} onChange={() => toggle(i.id)} />
                  <span>{i.label}</span>
                </label>
                {i.note && <div className="checklist-note">{i.note}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
