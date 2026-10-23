// Tablero Kanban: una columna por grupo de estados (o por estado, si el estudio ha elegido
// sus columnas en Ajustes). El estado se cambia con un desplegable (accesible con teclado);
// quien solo puede ver, ve el estado como etiqueta.
import { Link } from 'react-router-dom'
import { STATUSES, STATUS_ORDER } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { taskBoard, taskBoardColumns, type TaskColumn, type TaskFilter } from '../../../domain/selectors'
import type { ItemStatus, StudioData, WorkItem } from '../../../domain/types'
import { t, tr } from '../../../i18n'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { AreaTag, ConfidenceTag, KindIcon, PriorityTag, ProjectChip, StatusPill } from '../../components/Badges'
import { AssigneeTag, DueTag } from '../../components/ItemList'
import { TagLinks } from '../../components/TagFilter'
import { useSectionNav } from '../../components/SectionHeader'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { EmptyTasks } from './TareasLista'

const columnLabel = (c: TaskColumn) =>
  c.statuses.length === 1 && c.id === c.statuses[0] ? STATUSES[c.statuses[0]].label : tr(`secciones.tareas.board.columns.${c.id}`)

export function TareasTablero({ items, filtro, filtered, embedded }: { items: WorkItem[]; filtro: TaskFilter | null; filtered: boolean; embedded?: boolean }) {
  const data = useStudioData()
  const { scope } = useScope()
  const nav = useSectionNav('tareas')
  const board = taskBoard(items, taskBoardColumns(data.studio))
  if (items.length === 0) return <EmptyTasks filtro={filtro} filtered={filtered} />
  // En «Bloqueadas» y «Vencidas» las columnas vacías no dicen nada.
  const columns = filtro === 'bloqueadas' || filtro === 'vencidas' ? board.columns.filter((c) => c.total > 0) : board.columns
  const hiddenStatuses = [...new Set(board.hidden.map((i) => i.status))]
  const listHref = () => {
    const href = nav.href(nav.section.children.find((c) => c.id === 'lista')!)
    const [path, qs = ''] = href.split('?')
    const next = new URLSearchParams(qs)
    next.set('estado', hiddenStatuses.length === 1 ? hiddenStatuses[0] : 'todos')
    return `${path}?${next}`
  }
  return (
    <>
      <div className="board tareas-board" role="region" aria-label={t('secciones.tareas.board.label')} style={{ ['--tareas-cols' as string]: columns.length }}>
        {columns.map(({ column, items: list, total }) => {
          const headingId = `tareas-col-${column.id}`
          return (
            <section key={column.id} className="board-col" aria-labelledby={headingId}>
              <h2 id={headingId}>
                {columnLabel(column)}{' '}
                <span className="tab-count" title={t('secciones.tareas.board.count', { n: total })}>
                  {total}
                </span>
              </h2>
              {list.length === 0 && <p className="muted small">{t('secciones.tareas.board.emptyColumn')}</p>}
              {list.map((i) => (
                <TaskCard key={i.id} item={i} data={data} showProject={!scope && !embedded} />
              ))}
              {total > list.length && <p className="list-more">{t('secciones.tareas.board.more', { n: total - list.length })}</p>}
            </section>
          )
        })}
      </div>
      {board.hidden.length > 0 && (
        <p className="muted small">
          {t('secciones.tareas.board.hidden', {
            n: board.hidden.length,
            statuses: STATUS_ORDER.filter((s) => hiddenStatuses.includes(s))
              .map((s) => STATUSES[s].label)
              .join(', '),
          })}{' '}
          <Link to={listHref()}>{t('secciones.tareas.board.hiddenLink')}</Link>
        </p>
      )}
    </>
  )
}

function TaskCard({ item, data, showProject }: { item: WorkItem; data: StudioData; showProject: boolean }) {
  const canEdit = useCanEdit()
  const { openItem } = useUI()
  const today = useToday()
  const area = item.areaId ? data.areas.find((a) => a.id === item.areaId) : undefined
  const setStatus = (status: ItemStatus) =>
    store.patch('items', item.id, {
      status,
      completedAt: status === 'done' ? (item.completedAt ?? today) : status === 'cancelled' ? item.completedAt : undefined,
    })
  return (
    <article className="board-card tareas-card">
      <div className="board-card-head">
        <KindIcon kind={item.kind} />
        <button type="button" className="item-title" onClick={() => openItem(item.id)}>
          {item.title}
        </button>
      </div>
      <div className="item-meta">
        {showProject && <ProjectChip project={data.projects.find((p) => p.id === item.projectId)} />}
        <AreaTag area={area} />
        <AssigneeTag item={item} data={data} />
        <DueTag item={item} today={today} year={yearOf(today)} />
        <PriorityTag priority={item.priority} hideMedium />
        <ConfidenceTag confidence={item.confidence} compact />
        <TagLinks tags={item.tags} />
      </div>
      {canEdit ? (
        <select
          className="board-status"
          value={item.status}
          aria-label={t('secciones.tareas.board.statusOf', { title: item.title })}
          onChange={(e) => setStatus(e.target.value as ItemStatus)}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUSES[s].label}
            </option>
          ))}
        </select>
      ) : (
        <StatusPill status={item.status} />
      )}
    </article>
  )
}
