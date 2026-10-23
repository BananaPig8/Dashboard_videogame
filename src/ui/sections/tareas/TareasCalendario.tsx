// Calendario de las tareas: sus fechas límite en un mes (?mes=AAAA-MM), con los mismos
// filtros que la lista. Al lado, lo abierto que no tiene fecha (no sale en el calendario y
// conviene saberlo) y, si hay algo vencido, el enlace a «Vencidas».
import { Link, useSearchParams } from 'react-router-dom'
import { yearOf } from '../../../domain/dates'
import { taskCalendarEntries, taskMonth, taskOverdue, undatedTasks, type TaskFilter } from '../../../domain/selectors'
import type { WorkItem } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { MonthCalendar, monthGrid, monthStart } from '../../components/MonthCalendar'
import { useSectionNav } from '../../components/SectionHeader'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { usePreferences } from '../../prefs'

const UNDATED_LIMIT = 12

export function TareasCalendario({ items, filtro, embedded }: { items: WorkItem[]; filtro: TaskFilter | null; embedded?: boolean }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { edit } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const { weekStart } = usePreferences()
  const nav = useSectionNav('tareas')
  const [params, setParams] = useSearchParams()
  const month = taskMonth(params.get('mes'), today)
  const days = monthGrid(month, weekStart)
  const entries = taskCalendarEntries(data, items, days[0], days[days.length - 1])
  const undated = undatedTasks(items)
  const overdue = items.filter((i) => taskOverdue(i, today)).length
  const anyDate = items.some((i) => i.dueDate)
  const setMonth = (m: string) => {
    const next = new URLSearchParams(params)
    if (m === monthStart(today)) next.delete('mes')
    else next.set('mes', m.slice(0, 7))
    setParams(next)
  }
  const vencidas = nav.section.children.find((c) => c.id === 'vencidas')!

  return (
    <div className="grid grid-2-1 tareas-calendar">
      <Card title={t('secciones.tareas.calendar.caption')} icon="calendar">
        {!anyDate && (
          <p className="tareas-note">
            <Icon name="info" size={14} /> {t('secciones.tareas.calendar.noDates')}
          </p>
        )}
        {overdue > 0 && filtro !== 'vencidas' && (
          <p className="tareas-note tareas-note-danger">
            <Icon name="clock" size={14} /> {overdue === 1 ? t('secciones.tareas.calendar.overdueOne') : t('secciones.tareas.calendar.overdue', { n: overdue })}{' '}
            <Link to={nav.href(vencidas)}>{t('secciones.tareas.calendar.overdueLink')}</Link>
          </p>
        )}
        <MonthCalendar
          month={month}
          entries={entries}
          today={today}
          onOpen={(e) => edit(e.target)}
          onMonth={setMonth}
          caption={t('secciones.tareas.calendar.caption')}
        />
      </Card>
      <Card
        className="tareas-narrow"
        title={t('secciones.tareas.calendar.undatedTitle')}
        icon="clock"
        subtitle={t('secciones.tareas.calendar.undatedSubtitle')}
      >
        {undated.length === 0 ? (
          <Empty>{t('secciones.tareas.calendar.undatedNone')}</Empty>
        ) : (
          <ItemList
            items={undated}
            data={data}
            showProject={!scope && !embedded}
            showAssignee
            hideStatus
            year={yearOf(today)}
            limit={UNDATED_LIMIT}
            aside={(item) =>
              canEdit && (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  aria-label={t('secciones.tareas.calendar.setDateFor', { title: item.title })}
                  onClick={() => edit({ collection: 'items', id: item.id })}
                >
                  <Icon name="calendar" size={14} /> {t('secciones.tareas.calendar.setDate')}
                </button>
              )
            }
          />
        )}
      </Card>
    </div>
  )
}
