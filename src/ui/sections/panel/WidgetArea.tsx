// La cuadrícula de bloques del Dashboard, el modo foco (?ver=) y la personalización. La
// disposición es de cada persona («Quién soy»): qué bloques, en qué orden, de qué ancho y
// cuáles plegados (prefs.ts).
import { yearOf } from '../../../domain/dates'
import { t, tr } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Card, Empty, Modal } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import {
  resetDashboardLayout,
  updateDashboardLayout,
  useDashboardLayout,
  type DashboardLayout,
  type WidgetId,
} from '../../prefs'
import { usePanelPeriod } from './periodo'
import type { WidgetProps } from './widgets/comunes'
import { WIDGETS, widgetTitle } from './widgets'

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

export function CustomizePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      side
      title={t('customize.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={resetDashboardLayout}>
            {t('actions.reset')}
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('actions.close')}
          </button>
        </>
      }
    >
      <p className="muted">{t('customize.intro')}</p>
      <WidgetOrderList />
    </Modal>
  )
}

/** Qué bloques se ven, en qué orden y de qué ancho (en Personalizar y en Ajustes › Preferencias). */
export function WidgetOrderList() {
  const layout = useDashboardLayout()
  const order = layout.order
  const hidden = new Set(layout.hidden)
  const move = (id: WidgetId, delta: number) => {
    const n = order.indexOf(id)
    const m = n + delta
    if (m < 0 || m >= order.length) return
    const next = [...order]
    ;[next[n], next[m]] = [next[m], next[n]]
    updateDashboardLayout(() => ({ order: next }))
  }
  const toggle = (id: WidgetId) => updateDashboardLayout((l) => ({ hidden: l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id] }))
  const resize = (id: WidgetId) =>
    updateDashboardLayout((l) => ({ sizes: { ...l.sizes, [id]: widgetSize(l, id) === 'wide' ? 'normal' : 'wide' } }))
  return (
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
            {!WIDGETS[id].fixedWide && (
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => resize(id)}
                aria-pressed={wide}
                aria-label={t(wide ? 'customize.narrowLabel' : 'customize.wideLabel', { name })}
                title={t(wide ? 'customize.narrowLabel' : 'customize.wideLabel', { name })}
              >
                <Icon name={wide ? 'minimize' : 'maximize'} size={14} /> {wide ? t('customize.wide') : t('customize.normal')}
              </button>
            )}
            <button type="button" className="icon-btn small" onClick={() => move(id, -1)} disabled={n === 0} aria-label={`${t('actions.moveUp')}: ${name}`}>
              <Icon name="arrowUp" size={14} />
            </button>
            <button
              type="button"
              className="icon-btn small"
              onClick={() => move(id, 1)}
              disabled={n === order.length - 1}
              aria-label={`${t('actions.moveDown')}: ${name}`}
            >
              <Icon name="arrowDown" size={14} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
