// Necesita atención: qué proyecto mirar primero y por qué, y los avisos de hoy.
import { Link } from 'react-router-dom'
import { PANEL_ALERT_KINDS, panelAlerts, projectSummaries, projectSummary } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { HealthPill } from '../../../components/Badges'
import { Empty } from '../../../components/Common'
import { Icon } from '../../../components/Icon'
import { type WidgetProps, AlertList } from './comunes'

export function AttentionBody({ data, scope, today, year, focus }: WidgetProps) {
  const project = scope ? data.projects.find((p) => p.id === scope) : undefined
  const summaries = scope ? (project ? [projectSummary(data, project, today)] : []) : projectSummaries(data, today)
  // En todo el estudio, un proyecto en pausa o archivado no pide atención (está parado a propósito).
  const flagged = summaries.filter((s) => s.health.reasons.length > 0 && (scope || s.health.level !== 'idle'))
  // «Al día» solo lo que va bien con datos: lo parado y lo que no tiene nada apuntado, no.
  const upToDate = summaries.filter((s) => s.health.reasons.length === 0 && s.health.level === 'on_track')
  // Fuera del modo foco, solo los avisos que no salen ya en otro bloque.
  const alerts = panelAlerts(data, today, scope, focus ? undefined : PANEL_ALERT_KINDS)
  return (
    <>
      {flagged.length === 0 ? (
        <Empty>{t('secciones.panel.attention.none')}</Empty>
      ) : (
        <ul className="attention-list">
          {flagged.map((s) => (
            <li key={s.project.id}>
              <div className="attention-head">
                <Link to={`/proyectos/${s.project.slug}`} className="strong-link">
                  <span className="dot" style={{ background: s.project.color }} aria-hidden="true" />
                  {s.project.name}
                </Link>
                <HealthPill level={s.health.level} />
              </div>
              <ul className="reasons">
                {s.health.reasons.map((r) => (
                  <li key={r}>
                    <Icon name="chevronRight" size={12} />
                    {r}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {!scope && flagged.length > 0 && upToDate.length > 0 && (
        <p className="muted small">{t('secciones.panel.attention.upToDate', { names: upToDate.map((s) => s.project.name).join(', ') })}</p>
      )}
      {(alerts.length > 0 || focus) && (
        <div className="subsection">
          <h3 className="subhead">{focus ? t('secciones.panel.attention.alertsAll', { n: alerts.length }) : t('secciones.panel.attention.alerts')}</h3>
          {alerts.length === 0 ? (
            <Empty>{t('secciones.panel.attention.alertsNone')}</Empty>
          ) : (
            <AlertList alerts={alerts} data={data} showProject={!scope} today={today} year={year} />
          )}
        </div>
      )}
    </>
  )
}
