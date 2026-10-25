// Estadísticas › Hitos: hechos frente a previstos y, de los hechos, cuáles llegaron a tiempo
// y cuáles tarde (fecha de fin frente a fecha límite). Sin fecha límite no se puede saber:
// se cuentan aparte, nunca como «a tiempo».
import type { ReactNode } from 'react'
import { parseISODate, yearOf } from '../../../domain/dates'
import { statsMilestones, type StatsDays } from '../../../domain/selectors'
import type { WorkItem } from '../../../domain/types'
import { intlLocale, t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Pill, ProjectChip } from '../../components/Badges'
import { Card, Empty, Stat } from '../../components/Common'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { BarList, ColumnChart } from './Graficas'

/** «oct» (o «oct 25» si no es de este año) de un «AAAA-MM». */
function shortMonth(month: string, year: number): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', timeZone: 'UTC', ...(Number(month.slice(0, 4)) !== year ? { year: '2-digit' } : {}) }
  return new Intl.DateTimeFormat(intlLocale(), opts).format(parseISODate(`${month}-01`))
}

function MilestoneRows({ rows, side }: { rows: { item: WorkItem; date?: string }[]; side: (item: WorkItem) => ReactNode }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { openItem } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  return (
    <ul className="estadisticas-list">
      {rows.map(({ item, date }) => (
        <li key={item.id}>
          <div className="estadisticas-list-main">
            <button type="button" className="item-title" onClick={() => openItem(item.id)}>
              {item.title}
            </button>
            <div className="item-meta">
              {!scope && <ProjectChip project={data.projects.find((p) => p.id === item.projectId)} />}
              {date && <span className="meta-date">{fmt.date(date, year)}</span>}
            </div>
          </div>
          <div className="item-side">{side(item)}</div>
        </li>
      ))}
    </ul>
  )
}

export function EstadisticasHitos() {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const fmt = useFormat()
  const year = yearOf(today)
  const tag = useTagFilter()
  const m = statsMilestones(data, today, scope, tag)

  if (m.done.length + m.planned.length + m.cancelled === 0)
    return (
      <Card>
        <Empty
          icon="flag"
          action={canEdit && !tag ? { label: t('secciones.estadisticas.actions.newMilestone'), onClick: () => create('items', { kind: 'milestone', status: 'planned' }) } : undefined}
        >
          {tag ? t('secciones.estadisticas.hitos.noneTagged') : t('secciones.estadisticas.hitos.none')}
        </Empty>
      </Card>
    )

  const H = (k: 'done' | 'planned' | 'onTime' | 'late' | 'noDue' | 'noCompleted') => t(`secciones.estadisticas.hitos.${k}`)
  const days = (d: StatsDays, one: string, many: string) => (d.days === 1 ? one : many)
  const lateBy = new Map(m.late.map((l) => [l.item.id, l]))
  const overdueBy = new Map(m.overdue.map((l) => [l.item.id, l]))
  const upcomingBy = new Map(m.upcoming.map((l) => [l.item.id, l]))
  const timing = [
    { key: 'onTime', label: <Pill tone="success" icon="checkCircle">{H('onTime')}</Pill>, value: m.onTime.length },
    { key: 'late', label: <Pill tone="danger" icon="clock">{H('late')}</Pill>, value: m.late.length },
    { key: 'noDue', label: <Pill tone="muted" icon="question">{H('noDue')}</Pill>, value: m.noDue.length },
    ...(m.noCompleted.length ? [{ key: 'noCompleted', label: <Pill tone="warning" icon="question">{H('noCompleted')}</Pill>, value: m.noCompleted.length }] : []),
  ]

  return (
    <>
      <div className="stats">
        <Stat label={H('done')} value={m.done.length} icon="checkCircle" />
        <Stat label={H('planned')} value={m.planned.length} icon="flag" tone={m.overdue.length ? 'danger' : 'neutral'} />
        <Stat label={H('onTime')} value={m.onTime.length} icon="check" />
        <Stat label={H('late')} value={m.late.length} icon="clock" tone={m.late.length ? 'danger' : 'neutral'} />
        <Stat label={H('noDue')} value={m.noDue.length} icon="question" hint={t('secciones.estadisticas.hitos.noDueHint')} />
      </div>
      <div className="estadisticas-grid">
        <Card title={t('secciones.estadisticas.hitos.timingTitle')} icon="scale" subtitle={t('secciones.estadisticas.hitos.timingSubtitle')}>
          <BarList label={t('secciones.estadisticas.hitos.timingTitle')} rows={timing.map((r) => ({ ...r, display: fmt.number(r.value) }))} />
          {m.onTime.length + m.late.length === 0 && m.done.length > 0 && <p className="muted small">{t('secciones.estadisticas.hitos.timingNone')}</p>}
        </Card>
        <Card title={t('secciones.estadisticas.hitos.byMonthTitle')} icon="chart" subtitle={t('secciones.estadisticas.hitos.byMonthSubtitle')}>
          {m.byMonth.length ? (
            <ColumnChart
              title={t('secciones.estadisticas.hitos.byMonthTitle')}
              headLabel={t('secciones.estadisticas.chart.month')}
              labels={m.byMonth.map((x) => shortMonth(x.month, year))}
              longLabels={m.byMonth.map((x) => fmt.monthYear(x.month))}
              series={[{ id: 'done', label: H('done'), values: m.byMonth.map((x) => x.done) }]}
            />
          ) : (
            <Empty icon="chart">{t('secciones.estadisticas.hitos.byMonthNone')}</Empty>
          )}
        </Card>
      </div>
      <div className="estadisticas-grid">
        <Card title={t('secciones.estadisticas.hitos.plannedTitle')} icon="flag" subtitle={t('secciones.estadisticas.hitos.plannedSubtitle')}>
          {m.planned.length ? (
            <MilestoneRows
              rows={[...m.overdue, ...m.upcoming].map((d) => ({ item: d.item, date: d.item.dueDate })).concat(m.undated.map((item) => ({ item, date: undefined })))}
              side={(item) => {
                const o = overdueBy.get(item.id)
                const u = upcomingBy.get(item.id)
                if (o)
                  return (
                    <Pill tone="danger" icon="clock">
                      {days(o, t('secciones.estadisticas.hitos.overdueOne'), t('secciones.estadisticas.hitos.overdueMany', { n: o.days }))}
                    </Pill>
                  )
                if (u)
                  return (
                    <Pill tone={u.days <= 7 ? 'warning' : 'info'} icon="calendar">
                      {u.days === 0
                        ? t('secciones.estadisticas.hitos.today')
                        : days(u, t('secciones.estadisticas.hitos.inOne'), t('secciones.estadisticas.hitos.inMany', { n: u.days }))}
                    </Pill>
                  )
                return (
                  <Pill tone="muted" icon="question">
                    {t('secciones.estadisticas.hitos.undated')}
                  </Pill>
                )
              }}
            />
          ) : (
            <Empty>{t('secciones.estadisticas.hitos.plannedNone')}</Empty>
          )}
        </Card>
        {m.late.length > 0 && (
          <Card title={t('secciones.estadisticas.hitos.lateTitle')} icon="clock">
            <MilestoneRows
              rows={m.late.map((l) => ({ item: l.item, date: l.item.completedAt }))}
              side={(item) => {
                const l = lateBy.get(item.id)!
                return (
                  <Pill tone="danger" icon="clock">
                    {days(l, t('secciones.estadisticas.hitos.daysLateOne'), t('secciones.estadisticas.hitos.daysLateMany', { n: l.days }))}
                  </Pill>
                )
              }}
            />
          </Card>
        )}
      </div>
      {!scope && m.byProject.length > 0 && <ByProject rows={m.byProject} />}
    </>
  )
}

function ByProject({ rows }: { rows: ReturnType<typeof statsMilestones>['byProject'] }) {
  const H = (k: 'done' | 'planned' | 'onTime' | 'late') => t(`secciones.estadisticas.hitos.${k}`)
  const cols = ['done', 'planned', 'onTime', 'late'] as const
  return (
    <Card title={t('secciones.estadisticas.hitos.byProjectTitle')} icon="folder">
      <div className="table-wrap">
        <table className="table estadisticas-table">
          <caption className="visually-hidden">{t('secciones.estadisticas.hitos.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('secciones.estadisticas.progreso.project')}</th>
              {cols.map((c) => (
                <th key={c} scope="col" className="num">
                  {H(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.project.id}>
                <th scope="row">
                  <ProjectChip project={r.project} />
                </th>
                {cols.map((c) => (
                  <td key={c} data-label={H(c)} className="num">
                    {r[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
