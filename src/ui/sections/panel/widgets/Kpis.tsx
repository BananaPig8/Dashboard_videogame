// Indicadores: las cifras del estudio o del proyecto, las que elige cada persona (Personalizar)
// y en su orden. Cada tarjeta lleva a su sección con los filtros puestos y el ámbito.
// Los cálculos están en domain/secciones/panel-indicadores.ts.
import { Link } from 'react-router-dom'
import {
  CLOSED_PARAM,
  CLOSED_PARAM_OFF,
  KPI_AHEAD_DAYS,
  closedProjectIds,
  panelKpis,
  previousPeriod,
  type PanelKpi,
  type PanelKpiId,
  type Period,
} from '../../../../domain/selectors'
import { t, tr } from '../../../../i18n'
import type { Formatter } from '../../../../i18n/format'
import { Empty } from '../../../components/Common'
import { Icon, type IconName } from '../../../components/Icon'
import { useScope } from '../../../context'
import { useDashboardLayout, usePreferences } from '../../../prefs'
import { periodText } from '../PanelHeader'
import type { WidgetProps } from './comunes'
import './kpis.css'

export const KPI_ICON: Record<PanelKpiId, IconName> = {
  activeProjects: 'folder',
  pending: 'list',
  completed: 'checkCircle',
  overdue: 'clock',
  blocked: 'lock',
  milestonesSoon: 'flag',
  milestonesDone: 'trophy',
  eventsSoon: 'ticket',
  recentBuilds: 'box',
  feedbackNew: 'message',
}

/** El nombre de una tarjeta (también en Personalizar). */
export const kpiLabel = (id: PanelKpiId) => tr(`secciones.panel.cabecera.kpis.label.${id}`)

/**
 * Adónde lleva cada tarjeta (sin ámbito: lo pone `href`): una lista que da esa misma cifra, con
 * sus filtros puestos. `noClosed`: en todo el estudio hay proyectos archivados, que las cifras
 * no cuentan, y la lista tampoco (?archivados=no). Si su sección está oculta en Ajustes, a la que
 * da la misma cifra o a ninguna.
 */
function kpiPath(id: PanelKpiId, period: Period, hidden: readonly string[], noClosed: boolean): string | undefined {
  const dates = `desde=${period.from}&hasta=${period.to}`
  const off = (s: string) => hidden.includes(s)
  const closed = noClosed ? `${CLOSED_PARAM}=${CLOSED_PARAM_OFF}` : ''
  const path = (base: string, ...q: string[]) => {
    const query = [...q, closed].filter(Boolean).join('&')
    return query ? `${base}?${query}` : base
  }
  switch (id) {
    case 'activeProjects':
      return '/proyectos?estado=activos'
    case 'pending':
      return path('/tareas')
    case 'completed':
      return path('/tareas', 'estado=done', dates)
    case 'overdue':
      return path('/tareas', 'filtro=vencidas')
    case 'blocked':
      return path('/tareas', 'filtro=bloqueadas')
    case 'milestonesSoon':
      // Los hitos abiertos que vencen de hoy a dentro de 30 días (el Roadmap los enseña todos).
      return path('/tareas', 'tipo=milestone', `vence=${KPI_AHEAD_DAYS}`)
    case 'milestonesDone':
      return path('/tareas', 'tipo=milestone', 'estado=done', dates)
    case 'eventsSoon':
      // Eventos › Próximos (el Calendario junta también reuniones y entregas: no da la cifra).
      return off('eventos') ? undefined : path('/eventos')
    case 'recentBuilds':
      return off('builds') ? undefined : path('/builds', dates)
    case 'feedbackNew':
      return off('feedback') ? undefined : path('/feedback', 'estado=new')
  }
}

/** Qué cuenta la cifra (con «de cuántos», si lo hay). */
function kpiHint(k: PanelKpi): string {
  const key = 'secciones.panel.cabecera.kpis.hint'
  const of = (base: string) => tr(`${key}.${base}${k.of === 1 ? 'One' : 'Other'}`, { of: k.of ?? 0 })
  switch (k.id) {
    case 'activeProjects':
    case 'overdue':
    case 'blocked':
    case 'feedbackNew':
      return of(k.id)
    case 'milestonesSoon':
      return tr(`${key}.${k.id}`, { days: KPI_AHEAD_DAYS })
    default:
      return tr(`${key}.${k.id}`)
  }
}

/** «3 más que los 7 días anteriores» (o «ayer», o «el día anterior»). */
function Comparison({ k, period, fmt, today }: { k: PanelKpi; period: Period; fmt: Formatter; today: string }) {
  if (k.value === null || k.previous === undefined) return null
  const prev =
    period.id === 'hoy'
      ? t('secciones.panel.cabecera.kpis.compare.yesterday')
      : period.days === 1
        ? t('secciones.panel.cabecera.kpis.compare.previousDay')
        : t('secciones.panel.cabecera.kpis.compare.previousDays', { n: period.days })
  const delta = k.value - k.previous
  const text =
    delta > 0
      ? t('secciones.panel.cabecera.kpis.compare.more', { n: delta, prev })
      : delta < 0
        ? t('secciones.panel.cabecera.kpis.compare.less', { n: -delta, prev })
        : t('secciones.panel.cabecera.kpis.compare.same', { prev })
  return (
    <span className="kpi-compare" title={t('secciones.panel.cabecera.kpis.compare.dates', { range: periodText(previousPeriod(period), fmt, today) })}>
      <Icon name={delta > 0 ? 'arrowUp' : delta < 0 ? 'arrowDown' : 'minus'} size={12} />
      {text}
    </span>
  )
}

function KpiTile({ k, to, period, fmt, today }: { k: PanelKpi; to?: string; period: Period; fmt: Formatter; today: string }) {
  const none = k.value === null
  const notes = k.notes.map((n) => tr(`secciones.panel.cabecera.kpis.note.${n.kind}${n.n === 1 ? 'One' : 'Other'}`, { n: n.n }))
  const body = (
    <>
      <span className="stat-value">
        <Icon name={KPI_ICON[k.id]} size={16} />
        {none ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="visually-hidden">{t('secciones.panel.cabecera.kpis.empty.noData')}</span>
          </>
        ) : (
          fmt.number(k.value!)
        )}
      </span>
      <span className="stat-label">{kpiLabel(k.id)}</span>
      <span className="stat-hint">{none ? tr(`secciones.panel.cabecera.kpis.empty.${k.empty}`) : kpiHint(k)}</span>
      {notes.length > 0 && <span className="stat-hint kpi-notes">{notes.join(' · ')}</span>}
      <Comparison k={k} period={period} fmt={fmt} today={today} />
    </>
  )
  const className = `stat stat-${k.tone} kpi${none ? ' kpi-empty' : ''}`
  return (
    <li data-kpi={k.id}>
      {to ? (
        <Link className={className} to={to}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}

export function KpisBody({ data, scope, today, period, fmt }: WidgetProps) {
  const { href } = useScope()
  const { kpis: chosen } = useDashboardLayout()
  const { hiddenSections } = usePreferences()
  // Las ocultas no se calculan.
  const hidden = new Set(chosen.hidden)
  const list = panelKpis(data, { scope, today, period, ids: chosen.order.filter((id) => !hidden.has(id)) })
  if (list.length === 0) return <Empty icon="layout">{t('secciones.panel.cabecera.kpis.none')}</Empty>
  // En todo el estudio, lo de los proyectos archivados no cuenta (y se dice).
  const closed = scope ? 0 : closedProjectIds(data).size
  return (
    <>
      <ul className="panel-kpis">
        {list.map((k) => {
          const path = kpiPath(k.id, period, hiddenSections, closed > 0)
          return <KpiTile key={k.id} k={k} to={path ? href(path) : undefined} period={period} fmt={fmt} today={today} />
        })}
      </ul>
      {closed > 0 && (
        <p className="muted small kpi-closed">
          {closed === 1 ? t('secciones.panel.cabecera.kpis.noArchivedOne') : t('secciones.panel.cabecera.kpis.noArchivedOther', { n: closed })}
        </p>
      )}
    </>
  )
}
