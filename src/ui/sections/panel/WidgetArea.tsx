// La cuadrícula de bloques del Dashboard, el modo foco (?ver=) y la personalización. La
// disposición es de cada persona («Quién soy»): qué bloques, en qué orden, de qué ancho,
// cuáles plegados y qué indicadores (prefs.ts).
import { useState } from 'react'
import { yearOf } from '../../../domain/dates'
import { PANEL_KPI_STUDIO_ONLY } from '../../../domain/selectors'
import { t, tr } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Card, Empty, Modal } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { MePicker, useMe } from '../../components/MePicker'
import { useScope, useUI } from '../../context'
import { useNotify } from '../../feedback'
import { useFormat, useToday } from '../../hooks'
import {
  resetDashboardLayout,
  updateDashboardLayout,
  useDashboardLayout,
  type DashboardLayout,
  type KpiId,
  type WidgetId,
} from '../../prefs'
import { usePanelPeriod } from './periodo'
import type { WidgetProps } from './widgets/comunes'
import { WIDGETS, widgetTitle } from './widgets'
import { KPI_ICON, kpiLabel } from './widgets/Kpis'

/** El ancho de un bloque en esta disposición (las cifras, siempre a todo el ancho). */
export const widgetSize = (layout: DashboardLayout, id: WidgetId) => (WIDGETS[id].fixedWide ? 'wide' : (layout.sizes[id] ?? 'normal'))

/** El resumen de un proyecto: la pestaña «Resumen» de su ficha (sin ?ver=). */
export function ProjectSummaryTab() {
  const data = useStudioData()
  const { project } = useScope()
  const { edit } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const fmt = useFormat()
  const period = usePanelPeriod().period
  if (!project) return null
  return (
    <>
      <Card title={t('secciones.panel.about.title')} icon="book">
        {project.description ? (
          <p>{project.description}</p>
        ) : (
          <Empty
            icon="edit"
            action={
              canEdit ? { label: t('secciones.panel.about.write'), icon: 'edit', onClick: () => edit({ collection: 'projects', id: project.id }) } : undefined
            }
          >
            {t('secciones.panel.about.empty')}
          </Empty>
        )}
      </Card>
      <WidgetArea data={data} scope={project.id} today={today} year={yearOf(today)} fmt={fmt} period={period} />
    </>
  )
}

/** Los bloques visibles, en el orden y con el ancho elegidos. */
export function WidgetArea(props: WidgetProps) {
  const layout = useDashboardLayout()
  const hidden = new Set(layout.hidden)
  const collapsed = new Set(layout.collapsed)
  const ids = layout.order.filter((id) => !hidden.has(id) && !(WIDGETS[id].studioOnly && props.scope))
  const toggle = (id: WidgetId) =>
    updateDashboardLayout((l) => ({ collapsed: l.collapsed.includes(id) ? l.collapsed.filter((x) => x !== id) : [...l.collapsed, id] }))
  return (
    <div className="widget-grid">
      {ids.map((id) => {
        const w = WIDGETS[id]
        const { title, subtitle } = widgetTitle(id, props.scope)
        const wide = widgetSize(layout, id) === 'wide'
        return (
          <div key={id} className={wide ? 'w-full' : undefined} data-widget={id}>
            <Card
              title={title}
              subtitle={subtitle}
              icon={w.icon}
              action={w.Action ? <w.Action {...props} wide={wide} /> : undefined}
              collapsed={collapsed.has(id)}
              onToggle={() => toggle(id)}
            >
              {!collapsed.has(id) && <w.Body {...props} wide={wide} />}
            </Card>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Modo foco (?ver=): solo los bloques de esa subsección, a todo el ancho y enteros. No
 * mira la disposición (un bloque oculto o plegado también sale) ni la cambia.
 */
export function FocusArea({ ids, ...props }: WidgetProps & { ids: WidgetId[] }) {
  return (
    <div className="panel-focus">
      {ids.map((id) => {
        const w = WIDGETS[id]
        const { title, subtitle } = widgetTitle(id, props.scope)
        return (
          <Card key={id} title={title} subtitle={subtitle} icon={w.icon} action={w.Action ? <w.Action {...props} focus wide /> : undefined}>
            <w.Body {...props} focus wide />
          </Card>
        )
      })}
    </div>
  )
}

/**
 * Personalizar: qué bloques y qué indicadores se ven, en qué orden y de qué ancho. Es la
 * disposición de quien dice ser en «Quién soy» (o la de cualquiera, si nadie lo ha dicho).
 * «Volver a la de serie» se puede deshacer desde el aviso (que sale encima del panel, no detrás).
 */
export function CustomizePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const layout = useDashboardLayout()
  const me = useMe()
  const { toast } = useNotify()
  const reset = () => {
    const before = layout
    resetDashboardLayout()
    toast({
      message: t('secciones.panel.cabecera.customize.resetDone'),
      action: { label: t('actions.undo'), onClick: () => updateDashboardLayout(() => before) },
      undo: true,
      // Tras deshacer, el foco vuelve a «Volver a la de serie» (si el panel sigue abierto).
      returnFocus: '.customize-panel [data-customize-reset]',
    })
  }
  return (
    <Modal
      open={open}
      side
      className="customize-panel"
      title={t('customize.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={reset} data-customize-reset>
            <Icon name="history" size={16} /> {t('secciones.panel.cabecera.customize.reset')}
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('actions.close')}
          </button>
        </>
      }
    >
      <section className="customize-section">
        <p className="muted">
          {me ? t('secciones.panel.cabecera.customize.forMe', { name: me.name }) : t('secciones.panel.cabecera.customize.forAnyone')}
        </p>
        <MePicker compact />
      </section>
      <section className="customize-section" aria-labelledby="personalizar-bloques">
        <h3 id="personalizar-bloques">{t('secciones.panel.cabecera.customize.blocks')}</h3>
        <p className="muted">{t('secciones.panel.cabecera.customize.blocksIntro')}</p>
        <p className="muted small customize-narrow">{t('secciones.panel.cabecera.customize.narrow')}</p>
        <WidgetOrderList />
      </section>
      <section className="customize-section" aria-labelledby="personalizar-indicadores">
        <h3 id="personalizar-indicadores">{t('secciones.panel.cabecera.customize.kpis')}</h3>
        <p className="muted">{t('secciones.panel.cabecera.customize.kpisIntro')}</p>
        {layout.hidden.includes('kpis') && <p className="muted small">{t('secciones.panel.cabecera.customize.kpisBlockHidden')}</p>}
        <KpiOrderList />
      </section>
    </Modal>
  )
}

/**
 * Subir y bajar en una lista de Personalizar. En el primer y el último puesto, el botón no se
 * desactiva del todo (aria-disabled): si se desactivara con el foco dentro, el foco caería a la
 * página. Cada movimiento se anuncia («Lanzamientos: puesto 1 de 12»).
 */
function useMover<T extends string>(order: readonly T[], save: (next: T[]) => void, name: (id: T) => string) {
  const [said, setSaid] = useState('')
  const move = (id: T, delta: number) => {
    const n = order.indexOf(id)
    const m = n + delta
    if (n < 0 || m < 0 || m >= order.length) return
    const next = [...order]
    ;[next[n], next[m]] = [next[m], next[n]]
    save(next)
    setSaid(t('secciones.panel.cabecera.customize.position', { name: name(id), n: m + 1, total: order.length }))
  }
  const live = (
    <p className="visually-hidden" aria-live="polite">
      {said}
    </p>
  )
  return { move, live }
}

function MoveButtons<T extends string>({ id, n, total, name, move }: { id: T; n: number; total: number; name: string; move: (id: T, delta: number) => void }) {
  return (
    <>
      <button
        type="button"
        className="icon-btn small"
        onClick={() => move(id, -1)}
        aria-disabled={n === 0 || undefined}
        aria-label={`${t('actions.moveUp')}: ${name}`}
      >
        <Icon name="arrowUp" size={14} />
      </button>
      <button
        type="button"
        className="icon-btn small"
        onClick={() => move(id, 1)}
        aria-disabled={n === total - 1 || undefined}
        aria-label={`${t('actions.moveDown')}: ${name}`}
      >
        <Icon name="arrowDown" size={14} />
      </button>
    </>
  )
}

/** Qué indicadores se ven y en qué orden (layout.kpis). */
export function KpiOrderList() {
  const { kpis } = useDashboardLayout()
  const order = kpis.order
  const hidden = new Set(kpis.hidden)
  const { move, live } = useMover(order, (next) => updateDashboardLayout((l) => ({ kpis: { ...l.kpis, order: next } })), kpiLabel)
  const toggle = (id: KpiId) =>
    updateDashboardLayout((l) => ({ kpis: { ...l.kpis, hidden: l.kpis.hidden.includes(id) ? l.kpis.hidden.filter((x) => x !== id) : [...l.kpis.hidden, id] } }))
  return (
    <>
      <ul className="widget-list">
        {order.map((id, n) => {
          const name = kpiLabel(id)
          return (
            <li key={id}>
              <Icon name={KPI_ICON[id]} size={16} />
              <label>
                <input type="checkbox" checked={!hidden.has(id)} onChange={() => toggle(id)} />
                <span>
                  {name}
                  {PANEL_KPI_STUDIO_ONLY.includes(id) && <span className="muted small"> · {t('customize.onlyStudio')}</span>}
                </span>
              </label>
              <MoveButtons id={id} n={n} total={order.length} name={name} move={move} />
            </li>
          )
        })}
      </ul>
      {live}
    </>
  )
}

/** Qué bloques se ven, en qué orden y de qué ancho (en Personalizar y en Ajustes › Preferencias). */
export function WidgetOrderList() {
  const layout = useDashboardLayout()
  const order = layout.order
  const hidden = new Set(layout.hidden)
  const { move, live } = useMover(order, (next) => updateDashboardLayout(() => ({ order: next })), (id) => tr(`widgets.${id}.title`))
  const toggle = (id: WidgetId) => updateDashboardLayout((l) => ({ hidden: l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id] }))
  const resize = (id: WidgetId) =>
    updateDashboardLayout((l) => ({ sizes: { ...l.sizes, [id]: widgetSize(l, id) === 'wide' ? 'normal' : 'wide' } }))
  return (
    <>
      <ul className="widget-list">
        {order.map((id, n) => {
          const name = tr(`widgets.${id}.title`)
          const wide = widgetSize(layout, id) === 'wide'
          return (
            <li key={id}>
              <Icon name={WIDGETS[id].icon} size={16} />
              <label>
                <input type="checkbox" checked={!hidden.has(id)} onChange={() => toggle(id)} />
                <span>
                  {name}
                  {WIDGETS[id].studioOnly && <span className="muted small"> · {t('customize.onlyStudio')}</span>}
                </span>
              </label>
              {/* Un conmutador: el nombre (que empieza por lo que se ve) no cambia; aria-pressed dice si está puesto. */}
              {!WIDGETS[id].fixedWide && (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => resize(id)}
                  aria-pressed={wide}
                  aria-label={t('secciones.panel.cabecera.customize.wideToggleLabel', { name })}
                  title={t('secciones.panel.cabecera.customize.wideToggleTitle', { name })}
                >
                  <Icon name={wide ? 'minimize' : 'maximize'} size={14} /> {t('secciones.panel.cabecera.customize.wideToggle')}
                </button>
              )}
              <MoveButtons id={id} n={n} total={order.length} name={name} move={move} />
            </li>
          )
        })}
      </ul>
      {live}
    </>
  )
}
