// Estadísticas › Tareas: creadas y hechas por semana (por su fecha de alta y de fin) y lo
// abierto por estado y por tipo. Lo que no tiene fecha no sale en ninguna semana: se dice.
import { yearOf } from '../../../domain/dates'
import { statsTasks } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { KindTag, StatusPill } from '../../components/Badges'
import { Card, Empty, Stat } from '../../components/Common'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { usePreferences } from '../../prefs'
import { BarList, ColumnChart } from './Graficas'

export function EstadisticasTareas() {
  const data = useStudioData()
  const { scope, href } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const fmt = useFormat()
  const year = yearOf(today)
  const { weekStart } = usePreferences()
  const tag = useTagFilter()
  const s = statsTasks(data, today, scope, weekStart, tag)

  if (s.open + s.done + s.cancelled === 0)
    return (
      <Card>
        <Empty icon="list" action={canEdit && !tag ? { label: t('secciones.estadisticas.actions.newTask'), onClick: () => create('items') } : undefined}>
          {tag ? t('secciones.estadisticas.tareas.noneTagged') : t('secciones.estadisticas.tareas.none')}
        </Empty>
      </Card>
    )

  const L = (k: 'created' | 'finished') => t(`secciones.estadisticas.tareas.${k}`)
  const tagged = (path: string) => href(tag ? `${path}${path.includes('?') ? '&' : '?'}etiqueta=${encodeURIComponent(tag)}` : path)

  return (
    <>
      <div className="stats">
        <Stat label={t('secciones.estadisticas.tareas.open')} value={s.open} icon="list" to={tagged('/tareas')} />
        <Stat label={t('secciones.estadisticas.tareas.done')} value={s.done} icon="checkCircle" to={tagged('/tareas?estado=done')} />
        <Stat label={t('secciones.estadisticas.tareas.doneRecent')} value={s.doneRecent} icon="check" />
        <Stat
          label={t('secciones.estadisticas.tareas.createdRecent')}
          value={s.createdRecent}
          icon="plus"
          hint={t('secciones.estadisticas.tareas.createdHint')}
        />
      </div>
      <Card title={t('secciones.estadisticas.tareas.weeksTitle')} icon="chart" subtitle={t('secciones.estadisticas.tareas.weeksSubtitle')}>
        <ColumnChart
          title={t('secciones.estadisticas.tareas.weeksTitle')}
          headLabel={t('secciones.estadisticas.chart.week')}
          labels={s.weeks.map((w) => fmt.date(w.start, year))}
          longLabels={s.weeks.map((w) => t('secciones.estadisticas.chart.weekOf', { date: fmt.date(w.start, year) }))}
          series={[
            { id: 'created', label: L('created'), values: s.weeks.map((w) => w.created) },
            { id: 'done', label: L('finished'), values: s.weeks.map((w) => w.done) },
          ]}
        />
        {(s.createdUndated > 0 || s.doneUndated > 0) && (
          <p className="muted small">
            {t('secciones.estadisticas.tareas.undated', {
              list: [
                s.createdUndated ? t('secciones.estadisticas.tareas.undatedCreated', { n: s.createdUndated }) : '',
                s.doneUndated ? t('secciones.estadisticas.tareas.undatedDone', { n: s.doneUndated }) : '',
              ]
                .filter(Boolean)
                .join(t('secciones.estadisticas.tareas.and')),
            })}
          </p>
        )}
      </Card>
      <div className="estadisticas-grid">
        <Card title={t('secciones.estadisticas.tareas.byStatusTitle')} icon="board" subtitle={t('secciones.estadisticas.tareas.byStatusSubtitle')}>
          <BarList
            label={t('secciones.estadisticas.tareas.byStatusTitle')}
            rows={s.byStatus.map((x) => ({
              key: x.status,
              label: <StatusPill status={x.status} />,
              value: x.count,
              display: fmt.number(x.count),
              to: x.count ? tagged(`/tareas?estado=${x.status}`) : undefined,
            }))}
          />
        </Card>
        <Card title={t('secciones.estadisticas.tareas.byKindTitle')} icon="layers">
          <BarList
            label={t('secciones.estadisticas.tareas.byKindTitle')}
            rows={s.byKind.map((x) => ({
              key: x.kind,
              label: <KindTag kind={x.kind} />,
              value: x.open,
              display: fmt.number(x.open),
              to: x.open ? tagged(`/tareas?tipo=${x.kind}`) : undefined,
            }))}
          />
        </Card>
      </div>
    </>
  )
}
