// Actividad reciente: lo que pasa en el estudio. Junta el registro de cambios (con hora y
// persona), las fechas de los datos (solo el día) y el historial del código, sin repetir
// (studioTimeline, en domain/secciones/panel-actividad.ts). En el bloque, lo último del periodo
// del Dashboard; en el modo foco (?ver=actividad), el historial completo agrupado por día, con
// sus filtros en la URL: ?cat= (categoría), ?persona=, ?cuando= (hoy, 7d, 30d o personalizado
// con ?desde= y ?hasta=) y el proyecto (el ámbito).
import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { isValidISODate } from '../../../../domain/dates'
import {
  DEFAULT_PERIOD,
  TIMELINE_CATEGORIES,
  periodRange,
  studioTimeline,
  timelineActionKey,
  timelineByDay,
  timelineCategoryCounts,
  timelineCategoryOf,
  timelinePeople,
  timelineStatusLabel,
  type Period,
  type PeriodId,
  type TimelineEntry,
  type TimelineVerb,
} from '../../../../domain/selectors'
import type { StudioData } from '../../../../domain/types'
import type { Tone } from '../../../../domain/catalog'
import type { CollectionKey } from '../../../../domain/collections'
import { t, tr, type MessageKey } from '../../../../i18n'
import type { Formatter } from '../../../../i18n/format'
import { ConfidenceTag, ProjectChip } from '../../../components/Badges'
import { Empty, ExternalLink } from '../../../components/Common'
import { Icon, type IconName } from '../../../components/Icon'
import { useScope, useUI } from '../../../context'
import { SPECS } from '../../../specs'
import { ScopedMore, type WidgetProps } from './comunes'
import './actividad.css'

/** Cuántas entradas enseña el bloque (a dos columnas, algunas más). */
const BLOCK_LIMIT = 8
const BLOCK_LIMIT_WIDE = 12
/** El historial completo se enseña de tanto en tanto («Ver más»). */
const HISTORY_PAGE = 60
/** Campos cambiados que se nombran en una entrada (el resto, «y N más»). */
const FIELDS_SHOWN = 3

const VERB_TONE: Record<TimelineVerb, Tone> = {
  created: 'info',
  updated: 'neutral',
  status: 'special',
  completed: 'success',
  deleted: 'muted',
  dated: 'neutral',
  commit: 'neutral',
  merge: 'neutral',
  release: 'success',
  note: 'neutral',
}

const VERB_ICON: Record<TimelineVerb, IconName> = {
  created: 'plus',
  updated: 'edit',
  status: 'activity',
  completed: 'checkCircle',
  deleted: 'trash',
  dated: 'fileText',
  commit: 'git',
  merge: 'git',
  release: 'rocket',
  note: 'sticky',
}

/** Las terminaciones con un icono propio: hito alcanzado, bug resuelto, decisión registrada. */
function actionIcon(e: TimelineEntry): IconName {
  if (e.verb === 'completed') {
    if (e.noun === 'milestone') return 'flag'
    if (e.noun === 'issue') return 'bug'
    if (e.noun === 'decision') return 'scale'
  }
  return VERB_ICON[e.verb]
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** El nombre de lo afectado: su título o, si el registro no lo guardó, el de su colección. */
function entryTitle(e: TimelineEntry): string {
  if (e.collection === 'studio') return t('secciones.panel.actividad.fila.studioData')
  if (e.untitled) return capitalize(tr(`collectionNames.${e.collection}.one`))
  return e.title
}

/** Los campos cambiados, con el nombre que llevan en el formulario (los que no tienen, no se nombran). */
function fieldNames(e: TimelineEntry): string[] {
  const spec = e.collection in SPECS ? SPECS[e.collection as CollectionKey] : []
  return (e.fields ?? [])
    .map((f) => (f === 'sources' ? t('secciones.panel.actividad.fila.sources') : spec.find((s) => s.key === f)?.label))
    .filter((x): x is string => !!x)
}

const joinList = (parts: string[]) => new Intl.ListFormat('es', { type: 'conjunction' }).format(parts)

/** El periodo del Dashboard en una frase («los últimos 7 días», «del 3 oct al 9 oct»). */
export function periodPhrase(p: Period, fmt: Formatter, year: number): string {
  if (p.id !== 'personalizado') return t(`secciones.panel.actividad.periodo.${p.id}`)
  return p.from === p.to
    ? t('secciones.panel.actividad.periodo.personalizadoDia', { date: fmt.date(p.from, year) })
    : t('secciones.panel.actividad.periodo.personalizado', { from: fmt.date(p.from, year), to: fmt.date(p.to, year) })
}

/** El enlace al historial con el periodo del Dashboard (?cuando=; ?periodo= se conserva para volver al resumen). */
function historyHref(p: Period): string {
  const q = new URLSearchParams({ ver: 'actividad', cuando: p.id })
  if (p.id !== DEFAULT_PERIOD) q.set('periodo', p.id)
  if (p.id === 'personalizado') {
    q.set('desde', p.from)
    q.set('hasta', p.to)
  }
  return `/?${q.toString()}`
}

// ——— Una entrada ———————————————————————————————————————————————————————————

function TimelineRow({
  entry: e,
  data,
  showProject,
  showDay,
  year,
  fmt,
}: {
  entry: TimelineEntry
  data: StudioData
  showProject: boolean
  /** Fuera del historial (que agrupa por día), cada entrada dice su día. */
  showDay: boolean
  year: number
  fmt: Formatter
}) {
  const { edit } = useUI()
  const title = entryTitle(e)
  const who = e.memberId ? data.members.find((m) => m.id === e.memberId)?.name : e.author
  const project = showProject && e.projectId ? data.projects.find((p) => p.id === e.projectId) : undefined
  const fields = e.verb === 'updated' ? fieldNames(e) : []
  const when = [showDay ? fmt.date(e.date, year) : '', e.time ?? ''].filter(Boolean).join(', ')
  const from = timelineStatusLabel(e.collection, e.from)
  const to = timelineStatusLabel(e.collection, e.to)
  return (
    <li className="act-row">
      <span className={`act-icon tone-${VERB_TONE[e.verb]}`} aria-hidden="true">
        <Icon name={actionIcon(e)} size={14} />
      </span>
      <div className="act-main">
        <div className="act-line">
          <span className="act-action">{tr(timelineActionKey(e.noun, e.verb))}</span>
          {e.target && !e.deleted ? (
            <button type="button" className="item-title act-title" onClick={() => edit({ collection: e.target!.collection, id: e.target!.id })}>
              {title}
              {e.version && <span className="version-tag">v{e.version}</span>}
            </button>
          ) : (
            <span className="act-title act-title-text">
              {title}
              {e.deleted && <span className="act-gone"> {t('secciones.panel.actividad.fila.deleted')}</span>}
            </span>
          )}
        </div>
        <div className="item-meta">
          {when && (
            <time className="meta-date" dateTime={e.at}>
              {when}
            </time>
          )}
          {e.verb === 'status' && from && to && <span className="meta-date">{t('secciones.panel.actividad.fila.statusChange', { from, to })}</span>}
          {fields.length > 0 && (
            <span className="meta-date">
              {fields.length > FIELDS_SHOWN
                ? t('secciones.panel.actividad.fila.fieldsMore', { list: fields.slice(0, FIELDS_SHOWN).join(', '), n: fields.length - FIELDS_SHOWN })
                : t('secciones.panel.actividad.fila.fields', { list: joinList(fields) })}
            </span>
          )}
          {e.ref && (e.url ? <ExternalLink href={e.url}>{e.ref}</ExternalLink> : <span className="git-ref">{e.ref}</span>)}
          {who && (
            <span className="meta-date act-who" title={t('secciones.panel.actividad.fila.who', { name: who })}>
              <Icon name="user" size={12} />
              <span className="visually-hidden">{t('secciones.panel.actividad.fila.who', { name: '' })}</span>
              {who}
            </span>
          )}
          {project && <ProjectChip project={project} />}
          {e.confidence && <ConfidenceTag confidence={e.confidence} compact />}
        </div>
      </div>
    </li>
  )
}

function TimelineList({ entries, ...rest }: { entries: TimelineEntry[]; data: StudioData; showProject: boolean; showDay: boolean; year: number; fmt: Formatter }) {
  return (
    <ul className="act-list">
      {entries.map((e) => (
        <TimelineRow key={e.key} entry={e} {...rest} />
      ))}
    </ul>
  )
}

// ——— El bloque ————————————————————————————————————————————————————————————

export function RecentBody(props: WidgetProps) {
  return props.focus ? <ActivityHistory {...props} /> : <RecentBlock {...props} />
}

function RecentBlock({ data, scope, today, year, fmt, period, wide }: WidgetProps) {
  const { href } = useScope()
  const entries = useMemo(() => studioTimeline(data, { scope, today, period: { from: period.from, to: period.to } }), [data, scope, today, period.from, period.to])
  const limit = wide ? BLOCK_LIMIT_WIDE : BLOCK_LIMIT
  const phrase = periodPhrase(period, fmt, year)
  const list = { data, showProject: !scope, showDay: true, year, fmt }

  if (entries.length === 0) {
    // Nada en el periodo: se dice, con lo último que hubo (si hubo algo).
    const last = studioTimeline(data, { scope, today })[0]
    if (!last) return <Empty icon="history">{t('secciones.panel.actividad.bloque.none')}</Empty>
    return (
      <div className="act-block">
        <Empty icon="history">{t('secciones.panel.actividad.bloque.noneInPeriod', { period: phrase })}</Empty>
        <p className="muted small">
          {t('secciones.panel.actividad.bloque.last', { when: fmt.date(last.date, year), relative: fmt.relative(last.date, today) })}
        </p>
        <TimelineList entries={[last]} {...list} />
      </div>
    )
  }

  const shown = entries.slice(0, limit)
  return (
    <div className="act-block">
      <TimelineList entries={shown} {...list} />
      <p className="act-count muted small">
        {entries.length === 1
          ? t('secciones.panel.actividad.bloque.countOne', { period: phrase })
          : entries.length > limit
            ? t('secciones.panel.actividad.bloque.countOther', { n: entries.length, period: phrase, shown: shown.length })
            : t('secciones.panel.actividad.bloque.countAll', { n: entries.length, period: phrase })}
        {entries.length > limit && (
          <>
            {' '}
            <Link to={href(historyHref(period))}>{t('secciones.panel.actividad.bloque.seeAll', { n: entries.length })}</Link>
          </>
        )}
      </p>
    </div>
  )
}

export function ActivityAction({ focus }: WidgetProps) {
  // En el historial ya se está: el enlace sobra.
  if (focus) return null
  return <ScopedMore to="/?ver=actividad" label={t('secciones.panel.actividad.bloque.history')} />
}

// ——— El historial completo (?ver=actividad) ———————————————————————————————

type When = PeriodId
const WHENS: readonly When[] = ['hoy', '7d', '30d', 'personalizado']
const WHEN_LABEL: Record<When, MessageKey> = {
  hoy: 'secciones.panel.actividad.historial.whenHoy',
  '7d': 'secciones.panel.actividad.historial.when7d',
  '30d': 'secciones.panel.actividad.historial.when30d',
  personalizado: 'secciones.panel.actividad.historial.whenCustom',
}
const FILTER_KEYS = ['cat', 'persona', 'cuando', 'desde', 'hasta']

function ActivityHistory({ data, scope, today, year, fmt }: WidgetProps) {
  const [params, setParams] = useSearchParams()
  const { setScope } = useScope()
  const inProjectPage = useLocation().pathname.startsWith('/proyectos/')
  const category = timelineCategoryOf(params.get('cat'))
  const person = params.get('persona') || null
  const rawWhen = params.get('cuando')
  const when = WHENS.includes(rawWhen as When) ? (rawWhen as When) : null
  const date = (k: string) => {
    const v = params.get(k)
    return v && isValidISODate(v) ? v : undefined
  }
  const from = date('desde')
  const to = date('hasta')
  // «Entre dos fechas» sin ninguna fecha todavía: todo el historial.
  const range = when && (when !== 'personalizado' || from || to) ? periodRange(when, today, { from, to }) : null
  const period = range ? { from: range.from, to: range.to } : null
  const periodKey = period ? `${period.from}~${period.to}` : ''

  const all = useMemo(() => studioTimeline(data, { scope, today }), [data, scope, today])
  const forCategories = useMemo(() => studioTimeline(data, { scope, today, period, person }), [data, scope, today, periodKey, person])
  const forPeople = useMemo(() => studioTimeline(data, { scope, today, period, category }), [data, scope, today, periodKey, category])
  const list = useMemo(() => studioTimeline(data, { scope, today, period, category, person }), [data, scope, today, periodKey, category, person])

  const counts = timelineCategoryCounts(forCategories)
  const people = timelinePeople(data, forPeople)
  if (person && !people.some((p) => p.key === person)) {
    const member = data.members.find((m) => m.id === person)
    people.push({ key: person, name: member?.name ?? person.replace(/^autor:/, ''), count: 0 })
  }

  // «Ver más»: vuelve a empezar al cambiar de filtros.
  const filterKey = `${scope ?? ''}|${params.toString()}`
  const [page, setPage] = useState({ key: filterKey, n: HISTORY_PAGE })
  const shownCount = page.key === filterKey ? page.n : HISTORY_PAGE
  const shown = list.slice(0, shownCount)
  const days = timelineByDay(shown)

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const filtered = FILTER_KEYS.some((k) => params.has(k))
  const clear = () => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))

  return (
    <div className="act-history">
      <p className="muted small">{t('secciones.panel.actividad.historial.intro')}</p>
      <div className="filters act-filters" role="group" aria-label={t('secciones.panel.actividad.historial.filters')}>
        {!inProjectPage && data.projects.length > 0 && (
          <select value={scope ?? ''} onChange={(e) => setScope(e.target.value || null)} aria-label={t('secciones.panel.actividad.historial.project')}>
            <option value="">{t('secciones.panel.actividad.historial.projectAll')}</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <select value={category ?? ''} onChange={(e) => set({ cat: e.target.value || null })} aria-label={t('secciones.panel.actividad.historial.category')}>
          <option value="">{t('secciones.panel.actividad.historial.categoryAll')}</option>
          {TIMELINE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t('secciones.panel.actividad.historial.option', { name: t(`secciones.panel.actividad.categorias.${c}`), n: counts[c] })}
            </option>
          ))}
        </select>
        <select value={person ?? ''} onChange={(e) => set({ persona: e.target.value || null })} aria-label={t('secciones.panel.actividad.historial.person')}>
          <option value="">{t('secciones.panel.actividad.historial.personAll')}</option>
          {people.map((p) => (
            <option key={p.key} value={p.key}>
              {t('secciones.panel.actividad.historial.option', { name: p.name, n: p.count })}
            </option>
          ))}
        </select>
        <select
          value={when ?? ''}
          onChange={(e) => set({ cuando: e.target.value || null, ...(e.target.value === 'personalizado' ? {} : { desde: null, hasta: null }) })}
          aria-label={t('secciones.panel.actividad.historial.when')}
        >
          <option value="">{t('secciones.panel.actividad.historial.whenAll')}</option>
          {WHENS.map((w) => (
            <option key={w} value={w}>
              {t(WHEN_LABEL[w])}
            </option>
          ))}
        </select>
        {when === 'personalizado' && (
          <>
            <input
              type="date"
              value={from ?? ''}
              max={to ?? today}
              onChange={(e) => set({ desde: e.target.value || null })}
              aria-label={t('secciones.panel.actividad.historial.from')}
            />
            <input
              type="date"
              value={to ?? ''}
              min={from}
              max={today}
              onChange={(e) => set({ hasta: e.target.value || null })}
              aria-label={t('secciones.panel.actividad.historial.to')}
            />
          </>
        )}
        {filtered && (
          <button type="button" className="btn btn-small btn-ghost" onClick={clear}>
            <Icon name="close" size={14} /> {t('secciones.panel.actividad.historial.clear')}
          </button>
        )}
        <span className="spacer" />
        <span className="muted small" aria-live="polite">
          {list.length === 1 ? t('secciones.panel.actividad.historial.countOne') : t('secciones.panel.actividad.historial.countOther', { n: list.length })}
        </span>
      </div>

      {list.length === 0 ? (
        <Empty icon="history">{all.length === 0 ? t('secciones.panel.actividad.bloque.none') : t('secciones.panel.actividad.historial.emptyFiltered')}</Empty>
      ) : (
        <>
          {days.map((d) => (
            <section key={d.date} className="act-day" aria-label={fmt.longDate(d.date)}>
              <h3 className="act-day-head">
                {capitalize(fmt.longDate(d.date))} <span className="muted small">· {fmt.relative(d.date, today)}</span>
              </h3>
              <TimelineList entries={d.entries} data={data} showProject={!scope} showDay={false} year={year} fmt={fmt} />
            </section>
          ))}
          {list.length > shown.length && (
            <div className="act-more">
              <span className="muted small">{t('secciones.panel.actividad.historial.shown', { shown: shown.length, n: list.length })}</span>
              <button type="button" className="btn btn-small" onClick={() => setPage({ key: filterKey, n: shownCount + HISTORY_PAGE })}>
                {t('secciones.panel.actividad.historial.more', { n: Math.min(HISTORY_PAGE, list.length - shown.length) })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
