// Las filas de las listas del Calendario: una fecha (cuándo, tipo con icono y texto, si
// está sin confirmar y de qué proyecto) y algo que aún no tiene fecha. Cada una abre su
// elemento en el editor común.
import { useState, type ReactNode } from 'react'
import { CALENDAR_KINDS } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import type { CalendarEntry, CalendarUndated } from '../../../domain/selectors'
import type { StudioData } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit } from '../../../data/store'
import { ConfidenceTag, Pill, ProjectChip } from '../../components/Badges'
import { Icon } from '../../components/Icon'
import { CALENDAR_ICON } from '../../components/MonthCalendar'
import { useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'

export function KindPill({ kind }: { kind: CalendarEntry['kind'] }) {
  return (
    <Pill tone={CALENDAR_KINDS[kind].tone} icon={CALENDAR_ICON[kind]}>
      {CALENDAR_KINDS[kind].label}
    </Pill>
  )
}

export function EntryRow({ entry, data, showProject }: { entry: CalendarEntry; data: StudioData; showProject: boolean }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const today = useToday()
  const year = yearOf(today)
  // Un evento de varios días que ya empezó sigue en la lista hasta que acaba.
  const ongoing = entry.date < today && !!entry.endDate && entry.endDate >= today
  return (
    <li className="agenda-row calendario-row">
      <div className="agenda-date">
        <strong>{fmt.date(entry.date, year)}</strong>
        <span className="muted small">
          {ongoing ? t('secciones.calendario.row.until', { date: fmt.date(entry.endDate!, year) }) : fmt.relative(entry.date, today)}
        </span>
      </div>
      <div className="agenda-main">
        <button type="button" className="item-title" onClick={() => edit(entry.target)}>
          {entry.title}
        </button>
        <div className="item-meta">
          <KindPill kind={entry.kind} />
          {entry.time && (
            <span className="meta-date">
              <Icon name="clock" size={12} /> {entry.time}
            </span>
          )}
          {!entry.confirmed && (
            <Pill tone="warning" icon="question">
              {t('secciones.calendario.row.unconfirmed')}
            </Pill>
          )}
          {/* Cuánto fiarse del dato (lo verificado no se marca; si la fecha ya sale sin confirmar, no se repite). */}
          {entry.confidence && (entry.confirmed || entry.confidence !== 'to_confirm') && <ConfidenceTag confidence={entry.confidence} compact />}
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === entry.projectId)} />}
        </div>
      </div>
    </li>
  )
}

/** Qué le falta, en palabras («Hito sin fecha límite»). */
const undatedWhat = (u: CalendarUndated) =>
  u.kind === 'registration'
    ? t('secciones.calendario.unconfirmed.what.registration')
    : u.target.collection === 'releases'
      ? t('secciones.calendario.unconfirmed.what.releases')
      : u.target.collection === 'items'
        ? t('secciones.calendario.unconfirmed.what.items')
        : t('secciones.calendario.unconfirmed.what.events')

export function UndatedRow({ item, data, showProject }: { item: CalendarUndated; data: StudioData; showProject: boolean }) {
  const { edit } = useUI()
  const canEdit = useCanEdit()
  return (
    <li className="agenda-row calendario-row">
      <div className="agenda-main">
        <button type="button" className="item-title" onClick={() => edit(item.target)}>
          {item.title}
        </button>
        <div className="item-meta">
          <KindPill kind={item.kind} />
          <span className="meta-date">{undatedWhat(item)}</span>
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === item.projectId)} />}
        </div>
      </div>
      {canEdit && (
        <div className="item-side">
          <button
            type="button"
            className="btn btn-small btn-ghost"
            aria-label={t('secciones.calendario.row.setDateFor', { title: item.title })}
            onClick={() => edit(item.target)}
          >
            <Icon name="calendar" size={14} /> {t('secciones.calendario.row.setDate')}
          </button>
        </div>
      )}
    </li>
  )
}

/** Una lista con los primeros `limit` y un botón para ver el resto (y volver). */
export function ShortList<T>({ list, limit, render }: { list: T[]; limit: number; render: (x: T) => ReactNode }) {
  const [all, setAll] = useState(false)
  const shown = all || list.length <= limit ? list : list.slice(0, limit)
  return (
    <>
      <ul className="agenda-list">{shown.map(render)}</ul>
      {list.length > limit && (
        <button type="button" className="btn btn-small btn-ghost calendario-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t('secciones.calendario.row.showLess') : t('secciones.calendario.row.showAll', { n: list.length - limit })}
        </button>
      )}
    </>
  )
}
