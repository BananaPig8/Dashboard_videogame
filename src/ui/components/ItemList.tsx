import type { ReactNode } from 'react'
import { formatDate } from '../../domain/dates'
import { itemDate } from '../../domain/selectors'
import type { StudioData, WorkItem } from '../../domain/types'
import { useUI } from '../context'
import { AreaTag, ConfidenceTag, KindIcon, PriorityTag, ProjectChip, StatusPill } from './Badges'
import { Empty } from './Common'

export interface ItemListProps {
  items: WorkItem[]
  data: StudioData
  /** Enseñar el proyecto de cada fila (en las vistas de todo el estudio). */
  showProject?: boolean
  empty?: ReactNode
  /** Texto extra a la derecha de cada fila (p. ej. «vencida hace 2 días»). */
  aside?: (item: WorkItem) => ReactNode
  /** Enseñar el motivo del bloqueo o la decisión debajo del título. */
  detail?: 'blocked' | 'decision' | 'description'
  limit?: number
  hideStatus?: boolean
  year?: number
}

export function ItemList({ items, data, showProject, empty, aside, detail, limit, hideStatus, year }: ItemListProps) {
  const { openItem } = useUI()
  if (items.length === 0) return <Empty>{empty ?? 'Nada por aquí.'}</Empty>
  const shown = limit ? items.slice(0, limit) : items
  const areas = new Map(data.areas.map((a) => [a.id, a]))
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  return (
    <>
      <ul className="item-list">
        {shown.map((item) => {
          const extra =
            detail === 'blocked'
              ? item.blockedReason
              : detail === 'decision'
                ? item.decisionOutcome
                : detail === 'description'
                  ? item.description
                  : undefined
          const date = itemDate(item)
          return (
            <li key={item.id} className="item-row">
              <KindIcon kind={item.kind} />
              <div className="item-main">
                <button type="button" className="item-title" onClick={() => openItem(item.id)}>
                  {item.title}
                </button>
                {extra && <p className="item-detail">{extra}</p>}
                <div className="item-meta">
                  {showProject && <ProjectChip project={projects.get(item.projectId)} />}
                  <AreaTag area={item.areaId ? areas.get(item.areaId) : undefined} />
                  <ConfidenceTag confidence={item.confidence} compact />
                  {item.dueDate && <span className="meta-date">Límite: {formatDate(item.dueDate, year)}</span>}
                  {!item.dueDate && date && <span className="meta-date">{formatDate(date, year)}</span>}
                </div>
              </div>
              <div className="item-side">
                {aside?.(item)}
                <PriorityTag priority={item.priority} hideMedium />
                {!hideStatus && <StatusPill status={item.status} />}
              </div>
            </li>
          )
        })}
      </ul>
      {limit && items.length > limit && <p className="list-more">y {items.length - limit} más</p>}
    </>
  )
}
