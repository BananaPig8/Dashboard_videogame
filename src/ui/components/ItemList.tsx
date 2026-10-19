import type { ReactNode } from 'react'
import { useFormat } from '../hooks'
import { isOpen, itemDate, taskAssignee } from '../../domain/selectors'
import type { ISODate, StudioData, WorkItem } from '../../domain/types'
import { t } from '../../i18n'
import { useUI } from '../context'
import { AreaTag, ConfidenceTag, KindIcon, Pill, PriorityTag, ProjectChip, StatusPill } from './Badges'
import { Empty } from './Common'
import { Icon } from './Icon'
import { TagLinks } from './TagFilter'

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
  /** Enseñar quién lleva cada elemento («Sin asignar» si nadie). */
  showAssignee?: boolean
  /** Enseñar las etiquetas (enlazan a su página). */
  showTags?: boolean
  /** Con la fecha de hoy, las fechas límite vencidas o de hoy se marcan (icono y texto). */
  today?: ISODate
}

/** Quién lleva un elemento; sin nadie, «Sin asignar» (nunca se inventa). */
export function AssigneeTag({ item, data }: { item: WorkItem; data: StudioData }) {
  const member = taskAssignee(data, item)
  const name = member ? (member.active ? member.name : t('secciones.tareas.assignee.gone', { name: member.name })) : t('secciones.tareas.assignee.nobody')
  return (
    <span className={member ? 'meta-date assignee-tag' : 'meta-date assignee-tag nobody'} title={member ? t('secciones.tareas.assignee.label', { name: member.name }) : undefined}>
      <Icon name="user" size={12} /> {name}
    </span>
  )
}

/** La fecha límite: vencida (rojo) o de hoy (ámbar) con icono y texto; si no, tal cual. */
export function DueTag({ item, today, year }: { item: WorkItem; today?: ISODate; year?: number }) {
  const fmt = useFormat()
  if (!item.dueDate) return null
  const date = fmt.date(item.dueDate, year)
  if (today && isOpen(item) && item.dueDate < today)
    return (
      <Pill tone="danger" icon="clock">
        {t('secciones.tareas.due.overdue', { date })}
      </Pill>
    )
  if (today && isOpen(item) && item.dueDate === today)
    return (
      <Pill tone="warning" icon="clock">
        {t('secciones.tareas.due.today')}
      </Pill>
    )
  return <span className="meta-date">{t('secciones.tareas.due.date', { date })}</span>
}

export function ItemList({ items, data, showProject, empty, aside, detail, limit, hideStatus, year, showAssignee, showTags, today }: ItemListProps) {
  const { openItem } = useUI()
  const fmt = useFormat()
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
                  {showAssignee && <AssigneeTag item={item} data={data} />}
                  <ConfidenceTag confidence={item.confidence} compact />
                  {item.dueDate && <DueTag item={item} today={today} year={year} />}
                  {!item.dueDate && date && <span className="meta-date">{fmt.date(date, year)}</span>}
                  {showTags && <TagLinks tags={item.tags} />}
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
