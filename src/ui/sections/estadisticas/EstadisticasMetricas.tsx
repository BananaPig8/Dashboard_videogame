// Estadísticas › Métricas de lanzamiento y comerciales: los datos de plataformas apuntados a
// mano, cada uno con su fecha, su fiabilidad y su fuente. Lanzamiento: lo deducido cuenta
// (marcado) y lo que está por comprobar va aparte. Comerciales: solo cuenta lo verificado;
// sin nada verificado no sale ninguna cifra (nunca un cero).
import { METRIC_KINDS, SOURCE_TYPES, STORE_PLATFORMS, type MetricGroup } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { statsMetrics, type StatsMetricSeries } from '../../../domain/selectors'
import type { Metric, SourceRef } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { ConfidenceTag, ProjectChip } from '../../components/Badges'
import { Card, Empty, ExternalLink } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { sourceHref } from '../../util'
import { LineChart } from './Graficas'

/** «Wishlists · Steam» (en «otra métrica», su nombre). */
function metricName(m: Pick<Metric, 'kind' | 'label' | 'platform'>): string {
  const name = m.kind === 'other' && m.label?.trim() ? m.label.trim() : METRIC_KINDS[m.kind].label
  return m.platform ? `${name} · ${STORE_PLATFORMS[m.platform]}` : name
}

function Sources({ sources, projectId }: { sources: SourceRef[]; projectId: string }) {
  const data = useStudioData()
  const project = data.projects.find((p) => p.id === projectId)
  if (!sources.length)
    return (
      <span className="estadisticas-sources">
        <Icon name="alert" size={12} /> {t('secciones.estadisticas.metricas.noSources')}
      </span>
    )
  return (
    <span className="estadisticas-sources">
      <span className="muted">{t('secciones.estadisticas.metricas.sources')}</span>
      {sources.map((s, k) => {
        const href = sourceHref(s, project)
        return (
          <span key={k} title={s.note}>
            <span className="source-type">{SOURCE_TYPES[s.type]}</span> {href ? <ExternalLink href={href}>{s.ref}</ExternalLink> : s.ref}
          </span>
        )
      })}
    </span>
  )
}

function MetricCard({ series }: { series: StatsMetricSeries }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const { latest, previous } = series
  const name = metricName(latest)
  const diff = previous ? latest.value - previous.value : 0
  return (
    <Card
      title={name}
      icon="chart"
      subtitle={!scope ? <ProjectChip project={data.projects.find((p) => p.id === series.projectId)} /> : undefined}
      action={
        canEdit ? (
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => create('metrics', { projectId: series.projectId, kind: series.kind, platform: series.platform, label: series.label })}
            aria-label={t('secciones.estadisticas.actions.newMetricOf', { name })}
            title={t('secciones.estadisticas.actions.newMetricOf', { name })}
          >
            <Icon name="plus" size={14} /> {t('secciones.estadisticas.actions.newMetric')}
          </button>
        ) : undefined
      }
    >
      <div className="estadisticas-latest">
        <span className="estadisticas-value num">{fmt.number(latest.value)}</span>
        <span className="muted small">{t('secciones.estadisticas.metricas.on', { date: fmt.date(latest.date, year) })}</span>
        <ConfidenceTag confidence={latest.confidence} />
        {previous && (
          <span className="small">
            {diff === 0
              ? t('secciones.estadisticas.metricas.noChange', { date: fmt.date(previous.date, year) })
              : t('secciones.estadisticas.metricas.change', { sign: diff > 0 ? '+' : '−', n: fmt.number(Math.abs(diff)), date: fmt.date(previous.date, year) })}
          </span>
        )}
      </div>
      <p className="small estadisticas-source-line">
        <Sources sources={latest.sources} projectId={latest.projectId} />
        {canEdit && (
          <button type="button" className="link-btn muted" onClick={() => edit({ collection: 'metrics', id: latest.id })}>
            {t('secciones.estadisticas.metricas.editLatest')}
          </button>
        )}
      </p>
      {series.points.length > 1 ? (
        <LineChart
          points={series.points}
          title={t('secciones.estadisticas.metricas.evolution', { name })}
          format={fmt.number}
          formatDate={(d) => fmt.date(d, year)}
        />
      ) : (
        <p className="muted small">{t('secciones.estadisticas.metricas.single')}</p>
      )}
    </Card>
  )
}

/** Los datos que no cuentan: se ven y se pueden arreglar, pero no entran en ninguna cifra. */
function Excluded({ metrics, title, subtitle }: { metrics: Metric[]; title: string; subtitle: string }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { edit } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const L = (k: 'value' | 'date' | 'confidence' | 'source') => t(`secciones.estadisticas.metricas.table.${k}`)
  return (
    <Card title={title} icon="question" subtitle={subtitle}>
      <div className="table-wrap">
        <table className="table estadisticas-table">
          <caption className="visually-hidden">{t('secciones.estadisticas.metricas.table.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('secciones.estadisticas.metricas.table.what')}</th>
              <th scope="col">{L('value')}</th>
              <th scope="col">{L('date')}</th>
              <th scope="col">{L('confidence')}</th>
              <th scope="col">{L('source')}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.id}>
                <th scope="row">
                  <button type="button" className="link-btn" onClick={() => edit({ collection: 'metrics', id: m.id })}>
                    {metricName(m)}
                  </button>
                  {!scope && (
                    <span className="estadisticas-row-meta">
                      <ProjectChip project={data.projects.find((p) => p.id === m.projectId)} />
                    </span>
                  )}
                </th>
                <td data-label={L('value')} className="num">
                  {fmt.number(m.value)}
                </td>
                <td data-label={L('date')} className="nowrap">
                  {fmt.date(m.date, year)}
                </td>
                <td data-label={L('confidence')}>
                  <ConfidenceTag confidence={m.confidence} />
                </td>
                <td data-label={L('source')} className="small">
                  <Sources sources={m.sources} projectId={m.projectId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function EstadisticasMetricas({ group }: { group: MetricGroup }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const { series, excluded } = statsMetrics(data, group, scope)
  const k = group === 'launch' ? 'launch' : 'commercial'
  const newMetric = canEdit
    ? { label: t('secciones.estadisticas.actions.newMetric'), onClick: () => create('metrics', { kind: group === 'launch' ? 'wishlists' : 'units' }) }
    : undefined

  return (
    <>
      <p className="estadisticas-manual" role="note">
        <Icon name="info" size={16} />
        <span>{t('secciones.estadisticas.metricas.manual')}</span>
      </p>
      <p className="estadisticas-intro">{t(`secciones.estadisticas.metricas.${k}.intro`)}</p>
      {series.length ? (
        <div className="estadisticas-metrics">
          {series.map((s) => (
            <MetricCard key={s.key} series={s} />
          ))}
        </div>
      ) : group === 'commercial' ? (
        <Card title={t('secciones.estadisticas.metricas.commercial.emptyTitle')} icon="shield">
          <Empty icon="shield" action={newMetric}>
            {t('secciones.estadisticas.metricas.commercial.empty')}
          </Empty>
        </Card>
      ) : (
        <Card>
          <Empty icon="chart" action={newMetric}>
            {t('secciones.estadisticas.metricas.launch.none')}
          </Empty>
        </Card>
      )}
      {excluded.length > 0 && (
        <Excluded metrics={excluded} title={t(`secciones.estadisticas.metricas.${k}.excludedTitle`)} subtitle={t(`secciones.estadisticas.metricas.${k}.excludedSubtitle`)} />
      )}
    </>
  )
}
