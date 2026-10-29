// Estadísticas › Actividad: commits y fusiones del historial de git por semana, por área y,
// si el historial trae autor, por persona (reconocida por sus «Nombres en git»).
import { yearOf } from '../../../domain/dates'
import { statsActivity } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { useStudioData } from '../../../data/store'
import { AreaTag } from '../../components/Badges'
import { Card, Empty, Stat } from '../../components/Common'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { usePreferences } from '../../prefs'
import { BarList, ColumnChart } from './Graficas'

export function EstadisticasActividad() {
  const data = useStudioData()
  const { scope } = useScope()
  const { edit } = useUI()
  const today = useToday()
  const fmt = useFormat()
  const year = yearOf(today)
  const { weekStart } = usePreferences()
  const s = statsActivity(data, today, scope, weekStart)

  if (s.commits + s.merges === 0)
    return (
      <Card>
        <Empty icon="git">{t('secciones.estadisticas.actividad.none')}</Empty>
      </Card>
    )

  const A = (k: 'commits' | 'merges') => t(`secciones.estadisticas.actividad.${k}`)
  return (
    <>
      <div className="stats">
        <Stat label={A('commits')} value={s.commits} icon="git" />
        <Stat label={A('merges')} value={s.merges} icon="git" />
        <Stat label={t('secciones.estadisticas.actividad.recent')} value={s.recent} icon="calendar" />
        <Stat label={t('secciones.estadisticas.actividad.areas')} value={s.byArea.filter((r) => r.area).length} icon="layers" />
      </div>
      <Card title={t('secciones.estadisticas.actividad.weeksTitle')} icon="chart" subtitle={t('secciones.estadisticas.actividad.weeksSubtitle')}>
        <ColumnChart
          title={t('secciones.estadisticas.actividad.weeksTitle')}
          headLabel={t('secciones.estadisticas.chart.week')}
          labels={s.weeks.map((w) => fmt.date(w.start, year))}
          longLabels={s.weeks.map((w) => t('secciones.estadisticas.chart.weekOf', { date: fmt.date(w.start, year) }))}
          series={[
            { id: 'commits', label: A('commits'), values: s.weeks.map((w) => w.commits) },
            { id: 'merges', label: A('merges'), values: s.weeks.map((w) => w.merges) },
          ]}
        />
      </Card>
      <div className="estadisticas-grid">
        <Card title={t('secciones.estadisticas.actividad.byAreaTitle')} icon="layers" subtitle={t('secciones.estadisticas.actividad.byAreaSubtitle')}>
          <BarList
            label={t('secciones.estadisticas.actividad.byAreaTitle')}
            rows={s.byArea.map((r) => ({
              key: r.area?.id ?? '',
              label: r.area ? <AreaTag area={r.area} /> : <span className="muted">{t('secciones.estadisticas.common.noArea')}</span>,
              value: r.count,
              display: fmt.number(r.count),
            }))}
          />
        </Card>
        <Card title={t('secciones.estadisticas.actividad.byPersonTitle')} icon="users" subtitle={t('secciones.estadisticas.actividad.byPersonSubtitle')}>
          {s.byPerson.length ? (
            <>
              <BarList
                label={t('secciones.estadisticas.actividad.byPersonTitle')}
                rows={s.byPerson.map((r) => ({
                  key: r.member ? `m:${r.member.id}` : `a:${r.author}`,
                  label: r.member ? (
                    <button type="button" className="link-btn" onClick={() => edit({ collection: 'members', id: r.member!.id })}>
                      {r.member.name}
                    </button>
                  ) : (
                    <span>{t('secciones.estadisticas.actividad.unknownAuthor', { name: r.author ?? '' })}</span>
                  ),
                  value: r.count,
                  display: fmt.number(r.count),
                }))}
              />
              {s.withoutAuthor > 0 && <p className="muted small">{t('secciones.estadisticas.actividad.withoutAuthor', { n: s.withoutAuthor })}</p>}
            </>
          ) : (
            <Empty icon="users">{t('secciones.estadisticas.actividad.noAuthors')}</Empty>
          )}
        </Card>
      </div>
    </>
  )
}
