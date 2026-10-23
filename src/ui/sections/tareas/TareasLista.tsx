// Vista de lista: las tareas de la subsección y los filtros, en el orden de trabajo
// (en curso primero, luego por prioridad y fecha límite). Cada vacío dice por qué lo está.
import { useSearchParams } from 'react-router-dom'
import { yearOf } from '../../../domain/dates'
import { isOpen, taskItems, type TaskFilter } from '../../../domain/selectors'
import type { WorkItem } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Card, Empty } from '../../components/Common'
import type { IconName } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { FINE_FILTERS } from './comunes'

export function TareasLista({ items, filtro, filtered, embedded }: { items: WorkItem[]; filtro: TaskFilter | null; filtered: boolean; embedded?: boolean }) {
  const data = useStudioData()
  const { scope } = useScope()
  const today = useToday()
  if (items.length === 0)
    return (
      <Card className="tareas-list">
        <EmptyTasks filtro={filtro} filtered={filtered} />
      </Card>
    )
  return (
    <Card className="tareas-list">
      <ItemList
        items={items}
        data={data}
        showProject={!scope && !embedded}
        showAssignee
        showTags
        today={today}
        year={yearOf(today)}
        detail={filtro === 'bloqueadas' ? 'blocked' : 'description'}
      />
    </Card>
  )
}

/** Por qué no sale nada y, si se puede, cómo arreglarlo (sin inventar: si no hay fechas límite, se dice). */
export function EmptyTasks({ filtro, filtered }: { filtro: TaskFilter | null; filtered: boolean }) {
  const data = useStudioData()
  const { scope } = useScope()
  const canEdit = useCanEdit()
  const { create } = useUI()
  const [params, setParams] = useSearchParams()
  const all = taskItems(data, scope)
  const clear = () => {
    const next = new URLSearchParams(params)
    for (const k of FINE_FILTERS) next.delete(k)
    setParams(next, { replace: true })
  }
  const newTask = canEdit ? { label: t('secciones.tareas.actions.new'), onClick: () => create('items', { kind: 'task' }) } : undefined
  let text: string
  let icon: IconName = 'check'
  let action: { label: string; onClick: () => void; icon?: IconName } | undefined
  if (filtered) {
    text = t('secciones.tareas.list.emptyFiltered')
    icon = 'search'
    action = { label: t('secciones.tareas.filters.clear'), onClick: clear, icon: 'close' }
  } else if (filtro === 'mias') {
    text = t('secciones.tareas.list.emptyMine')
    icon = 'user'
  } else if (filtro === 'bloqueadas') {
    text = t('secciones.tareas.list.emptyBlocked')
  } else if (filtro === 'vencidas') {
    const dated = all.some((i) => isOpen(i) && i.dueDate)
    text = dated ? t('secciones.tareas.list.emptyOverdue') : t('secciones.tareas.list.noDueDates')
    icon = dated ? 'check' : 'info'
  } else if (all.length === 0) {
    text = t('secciones.tareas.list.emptyStudio')
    icon = 'info'
    action = newTask
  } else {
    text = t('secciones.tareas.list.emptyOpen')
  }
  return (
    <Empty icon={icon} action={action}>
      {text}
    </Empty>
  )
}
