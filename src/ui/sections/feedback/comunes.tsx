// Piezas comunes de Feedback y pruebas: la fila de un feedback (con de dónde viene y qué lo
// resuelve), su clase y su impacto, los filtros finos de la URL y la cabecera de la página.
// Eventos usa también la fila compacta.
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FEEDBACK_KINDS, FEEDBACK_ORIGINS, FEEDBACK_STATUSES, PRIORITIES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import {
  FEEDBACK_STATUS_ORDER,
  FEEDBACK_UNCLASSIFIED,
  IMPACT_ORDER,
  feedbackFiltered,
  feedbackKindCounts,
  feedbackQueryOf,
  feedbackTipoDefaults,
  feedbackTipoOf,
  type FeedbackQuery,
  type FeedbackTipo,
} from '../../../domain/selectors'
import type { Feedback, FeedbackKind, FeedbackStatus, Priority, StudioData } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, FeedbackStatusPill, Pill, ProjectChip, StatusPill } from '../../components/Badges'
import { Icon, type IconName } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice, TagLinks } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'

export const FEEDBACK_KIND_ICON: Record<FeedbackKind, IconName> = { comment: 'message', bug: 'bug', request: 'star' }
export const FEEDBACK_STATUS_ICON: Record<FeedbackStatus, IconName> = { new: 'bell', triaged: 'eye', planned: 'calendar', addressed: 'checkCircle', wont_do: 'xCircle' }
const IMPACT_ICON: Record<Priority, IconName> = { critical: 'alert', high: 'arrowUp', medium: 'minus', low: 'arrowDown' }

/** Qué es: comentario, bug o mejora; sin poner, «Sin clasificar» (nunca se adivina). */
export function FeedbackKindPill({ kind }: { kind?: FeedbackKind }) {
  if (!kind)
    return (
      <Pill tone="muted" icon="question">
        {t('secciones.feedback.unclassified')}
      </Pill>
    )
  return (
    <Pill tone={FEEDBACK_KINDS[kind].tone} icon={FEEDBACK_KIND_ICON[kind]}>
      {FEEDBACK_KINDS[kind].label}
    </Pill>
  )
}

/** El impacto (o la prioridad de una incidencia), con icono y texto («Impacto: alta»). */
export function ImpactTag({ impact, priority }: { impact: Priority; priority?: boolean }) {
  const level = PRIORITIES[impact].label.toLowerCase()
  return (
    <span className={`priority priority-${impact}`}>
      <Icon name={IMPACT_ICON[impact]} size={12} />
      {priority ? t('secciones.feedback.priority', { level }) : t('secciones.feedback.impact', { level })}
    </span>
  )
}

/** De qué evento o prueba viene y con qué build se vio (botones que abren cada uno). */
export function FeedbackSource({ feedback: f, data }: { feedback: Feedback; data: StudioData }) {
  const { edit } = useUI()
  const event = f.eventId ? data.events.find((e) => e.id === f.eventId) : undefined
  const test = f.playtestId ? data.playtests.find((p) => p.id === f.playtestId) : undefined
  const build = f.buildId ? data.builds.find((b) => b.id === f.buildId) : undefined
  if (!event && !test && !build) return null
  return (
    <div className="linked feedback-source">
      {(event || test) && <span className="muted small">{t('secciones.feedback.row.from')}</span>}
      {event && (
        <button type="button" className="chip-btn" onClick={() => edit({ collection: 'events', id: event.id })}>
          <Icon name="ticket" size={12} /> {event.title}
        </button>
      )}
      {test && (
        <button type="button" className="chip-btn" onClick={() => edit({ collection: 'playtests', id: test.id })}>
          <Icon name="users" size={12} /> {test.title}
        </button>
      )}
      {build && (
        <>
          <span className="muted small">{t('secciones.feedback.row.build')}</span>
          <button type="button" className="chip-btn" onClick={() => edit({ collection: 'builds', id: build.id })}>
            <Icon name="box" size={12} /> {build.name} <span className="version-tag">v{build.version}</span>
          </button>
        </>
      )}
    </div>
  )
}

/** Los elementos de trabajo que lo resuelven, con su estado. */
export function FeedbackLinked({ feedback: f, data }: { feedback: Feedback; data: StudioData }) {
  const { openItem } = useUI()
  if (!f.linkedItemIds.length) return null
  const items = new Map(data.items.map((i) => [i.id, i]))
  return (
    <div className="linked">
      <span className="muted small">{t('secciones.feedback.row.solvedBy')}</span>
      {f.linkedItemIds.map((id) => {
        const it = items.get(id)
        return it ? (
          <button key={id} type="button" className="chip-btn" onClick={() => openItem(id)}>
            {it.title} <StatusPill status={it.status} />
          </button>
        ) : (
          <span key={id} className="muted small">
            {t('secciones.feedback.row.missing')}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Una fila de feedback: qué se dijo, qué es, de dónde viene, cuándo, con qué build y qué lo
 * resuelve. `compact` deja solo lo esencial (para las listas dentro de un evento o una prueba).
 */
export function FeedbackRow({
  feedback: f,
  showProject,
  showStatus = true,
  compact,
  children,
}: {
  feedback: Feedback
  showProject?: boolean
  showStatus?: boolean
  compact?: boolean
  /** Acciones debajo de la fila (p. ej. los cambios rápidos de estado). */
  children?: ReactNode
}) {
  const data = useStudioData()
  const { edit } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const project = showProject ? data.projects.find((p) => p.id === f.projectId) : undefined
  return (
    <li className="item-row feedback-row">
      <div className="item-main">
        <button type="button" className="item-title" onClick={() => edit({ collection: 'feedback', id: f.id })}>
          {f.title}
        </button>
        {f.detail && !compact && <p className="item-detail">{f.detail}</p>}
        <div className="item-meta">
          <FeedbackKindPill kind={f.kind} />
          {!compact && (
            <span className="meta-date">
              {FEEDBACK_ORIGINS[f.origin]}
              {f.originDetail ? ` · ${f.originDetail}` : ''}
            </span>
          )}
          {f.receivedAt && <span className="meta-date">{t('secciones.feedback.row.received', { date: fmt.date(f.receivedAt, year) })}</span>}
          {project && <ProjectChip project={project} />}
          <ConfidenceTag confidence={f.confidence} compact />
          {!compact && <TagLinks tags={f.tags} />}
        </div>
        {!compact && <FeedbackSource feedback={f} data={data} />}
        {!compact && <FeedbackLinked feedback={f} data={data} />}
        {children}
      </div>
      <div className="item-side">
        <ImpactTag impact={f.impact} />
        {showStatus && <FeedbackStatusPill status={f.status} />}
      </div>
    </li>
  )
}

// ——— Filtros finos ——————————————————————————————————————————————————————————

/** Los filtros finos de la URL (sin la subsección), los que borra «Quitar filtros». */
export const FEEDBACK_FINE_FILTERS = ['estado', 'impacto', 'origen', 'clase', 'evento', 'q'] as const

/** La subsección y los filtros finos de la URL, ya leídos. */
export function useFeedbackQuery(): { tipo: FeedbackTipo | null; vista: string | null; query: FeedbackQuery } {
  const [params] = useSearchParams()
  const { scope } = useScope()
  const data = useStudioData()
  return { tipo: feedbackTipoOf(params.get('tipo')), vista: params.get('vista'), query: feedbackQueryOf(params, scope, data) }
}

/** Búsqueda, estado, impacto, origen y (en Todo) «Sin clasificar». Viven en la URL. */
export function FeedbackFiltros({ query, statuses = true }: { query: FeedbackQuery; statuses?: boolean }) {
  const data = useStudioData()
  const { scope } = useScope()
  const [params, setParams] = useSearchParams()
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const clear = () => {
    const next = new URLSearchParams(params)
    for (const k of FEEDBACK_FINE_FILTERS) next.delete(k)
    setParams(next, { replace: true })
  }
  const value = (k: string) => params.get(k) ?? ''
  const unclassified = query.tipo ? 0 : feedbackKindCounts(data, scope).none
  return (
    <div className="filters feedback-filters" role="group" aria-label={t('secciones.feedback.filters.label')}>
      <input
        type="search"
        placeholder={t('secciones.feedback.filters.search')}
        aria-label={t('secciones.feedback.filters.searchLabel')}
        value={value('q')}
        onChange={(e) => set('q', e.target.value)}
      />
      {statuses && (
        <select value={value('estado')} onChange={(e) => set('estado', e.target.value)} aria-label={t('secciones.feedback.filters.status')}>
          <option value="">{t('secciones.feedback.filters.statusAll')}</option>
          <option value="abierto">{t('secciones.feedback.filters.statusOpen')}</option>
          <option value="cerrado">{t('secciones.feedback.filters.statusClosed')}</option>
          {FEEDBACK_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {FEEDBACK_STATUSES[s].label}
            </option>
          ))}
        </select>
      )}
      <select value={value('impacto')} onChange={(e) => set('impacto', e.target.value)} aria-label={t('secciones.feedback.filters.impact')}>
        <option value="">{t('secciones.feedback.filters.impactAll')}</option>
        {IMPACT_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITIES[p].label}
          </option>
        ))}
      </select>
      <select value={value('origen')} onChange={(e) => set('origen', e.target.value)} aria-label={t('secciones.feedback.filters.origin')}>
        <option value="">{t('secciones.feedback.filters.originAll')}</option>
        {Object.entries(FEEDBACK_ORIGINS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {/* «Sin clasificar» solo tiene sentido en Todo: en las demás subsecciones ya se sabe qué es. */}
      {!query.tipo && (unclassified > 0 || query.unclassified) && (
        <button
          type="button"
          className={query.unclassified ? 'btn btn-small feedback-toggle active' : 'btn btn-small feedback-toggle'}
          aria-pressed={!!query.unclassified}
          onClick={() => set('clase', query.unclassified ? '' : FEEDBACK_UNCLASSIFIED)}
        >
          <Icon name="question" size={14} /> {t('secciones.feedback.filters.unclassified', { n: unclassified })}
        </button>
      )}
      {query.evento && (
        <button
          type="button"
          className="btn btn-small feedback-toggle active"
          aria-pressed="true"
          title={t('secciones.feedback.filters.eventClear')}
          onClick={() => set('evento', '')}
        >
          <Icon name="ticket" size={14} />{' '}
          {t('secciones.feedback.filters.event', { event: data.events.find((e) => e.id === query.evento)?.title ?? t('secciones.feedback.filters.eventGone') })}
          <Icon name="close" size={12} />
        </button>
      )}
      {feedbackFiltered(query) && (
        <button type="button" className="btn btn-small btn-ghost" onClick={clear}>
          <Icon name="close" size={14} /> {t('secciones.feedback.filters.clear')}
        </button>
      )}
    </div>
  )
}

// ——— Página ——————————————————————————————————————————————————————————————————

/** Cabecera de la sección con «Nuevo feedback» (del tipo de la subsección) y el aviso de etiqueta. */
export function FeedbackPage({
  embedded,
  tipo,
  action,
  intro,
  children,
}: {
  embedded?: boolean
  tipo?: FeedbackTipo | null
  /** Otra acción en lugar de «Nuevo feedback» (p. ej. «Nueva prueba»). */
  action?: { label: string; icon?: IconName; onClick: () => void }
  intro?: ReactNode
  children: ReactNode
}) {
  const { create } = useUI()
  const canEdit = useCanEdit()
  const { project } = useScope()
  const a = action ?? { label: t('secciones.feedback.actions.new'), onClick: () => create('feedback', feedbackTipoDefaults(tipo ?? null)) }
  const actions = canEdit ? (
    <button type="button" className="btn btn-primary" onClick={a.onClick}>
      <Icon name={a.icon ?? 'plus'} size={16} /> {a.label}
    </button>
  ) : undefined
  return (
    <div className={embedded ? 'feedback-page' : 'page feedback-page'}>
      <SectionHeader
        id="feedback"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.feedback.subtitleIn', { project: project.name }) : undefined}
      />
      <TagFilterNotice />
      {intro && <div className="feedback-intro">{intro}</div>}
      {children}
    </div>
  )
}
