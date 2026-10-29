// Estadísticas › Tiempo: las horas apuntadas a mano, por semana, proyecto, persona y en qué
// se fueron. Sin horas apuntadas no hay nada que enseñar (y no se inventa).
import type { ReactNode } from 'react'
import { yearOf } from '../../../domain/dates'
import { statsTime, type StatsTimeRow } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { ProjectChip } from '../../components/Badges'
import { Card, Empty, Stat } from '../../components/Common'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { usePreferences } from '../../prefs'
import { BarList, ColumnChart, type BarRow } from './Graficas'

const ITEMS = 8

export function EstadisticasTiempo() {
  const data = useStudioData()
  const { scope, project } = useScope()
  const { create, openItem, edit } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const fmt = useFormat()
  const year = yearOf(today)
  const { weekStart } = usePreferences()
  const s = statsTime(data, today, scope, weekStart)

  if (!s.entries)
    return (
      <Card>
        <Empty
          icon="clock"
          action={canEdit ? { label: t('secciones.estadisticas.actions.logTime'), onClick: () => create('timeEntries'), icon: 'clock' } : undefined}
        >
          {project ? t('secciones.estadisticas.tiempo.noneIn', { project: project.name }) : t('secciones.estadisticas.tiempo.none')}
        </Empty>
      </Card>
    )

  // Lo de las últimas cuatro semanas, solo si no es todo.
  const recentHint = (r: StatsTimeRow<unknown>) =>
    r.recent && r.recent !== r.minutes ? t('secciones.estadisticas.tiempo.recentValue', { value: fmt.duration(r.recent) }) : undefined
  const row = <T,>(r: StatsTimeRow<T>, key: string, label: ReactNode): BarRow => ({
    key,
    label,
    value: r.minutes,
    display: fmt.duration(r.minutes),
    hint: recentHint(r),
  })
  const nobody = <span className="muted">{t('secciones.estadisticas.common.nobody')}</span>

  return (
    <>
      <div className="stats">
        <Stat label={t('secciones.estadisticas.tiempo.total')} value={fmt.duration(s.total)} icon="clock" />
        <Stat label={t('secciones.estadisticas.tiempo.recent')} value={fmt.duration(s.recent)} icon="calendar" />
        <Stat label={t('secciones.estadisticas.tiempo.entries')} value={s.entries} icon="list" />
        <Stat label={t('secciones.estadisticas.tiempo.people')} value={s.byPerson.filter((r) => r.who).length} icon="users" />
      </div>
      <Card title={t('secciones.estadisticas.tiempo.weeksTitle')} icon="chart">
        <ColumnChart
          title={t('secciones.estadisticas.tiempo.weeksTitle')}
          headLabel={t('secciones.estadisticas.chart.week')}
          labels={s.weeks.map((w) => fmt.date(w.start, year))}
          longLabels={s.weeks.map((w) => t('secciones.estadisticas.chart.weekOf', { date: fmt.date(w.start, year) }))}
          series={[{ id: 'minutes', label: t('secciones.estadisticas.tiempo.hours'), values: s.weeks.map((w) => w.minutes) }]}
          format={fmt.duration}
          unit={60}
        />
      </Card>
      <div className="estadisticas-grid">
        {!scope && (
          <Card title={t('secciones.estadisticas.tiempo.byProjectTitle')} icon="folder">
            <BarList
              label={t('secciones.estadisticas.tiempo.byProjectTitle')}
              rows={s.byProject.map((r, k) => row(r, r.who?.id ?? `sin-${k}`, r.who ? <ProjectChip project={r.who} /> : nobody))}
            />
          </Card>
        )}
        <Card title={t('secciones.estadisticas.tiempo.byPersonTitle')} icon="users">
          <BarList
            label={t('secciones.estadisticas.tiempo.byPersonTitle')}
            rows={s.byPerson.map((r, k) =>
              row(
                r,
                r.who?.id ?? `sin-${k}`,
                r.who ? (
                  <button type="button" className="link-btn" onClick={() => edit({ collection: 'members', id: r.who!.id })}>
                    {r.who.name}
                  </button>
                ) : (
                  nobody
                ),
              ),
            )}
          />
        </Card>
        <Card title={t('secciones.estadisticas.tiempo.byItemTitle')} icon="list" subtitle={t('secciones.estadisticas.tiempo.byItemSubtitle')}>
          <BarList
            label={t('secciones.estadisticas.tiempo.byItemTitle')}
            rows={s.byItem.slice(0, ITEMS).map((r, k) =>
              row(
                r,
                r.who?.id ?? `sin-${k}`,
                r.who ? (
                  <button type="button" className="link-btn" onClick={() => openItem(r.who!.id)}>
                    {r.who.title}
                  </button>
                ) : (
                  <span className="muted">{t('secciones.estadisticas.common.general')}</span>
                ),
              ),
            )}
          />
        </Card>
      </div>
    </>
  )
}
