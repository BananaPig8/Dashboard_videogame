// Finanzas: gastos, ingresos y presupuestos anotados a mano, en la moneda del estudio. Las
// subsecciones son la faceta ?vista= de la URL (navigation.ts): resumen (por defecto),
// gastos, ingresos, presupuestos, costes por proyecto, eventos e informes. Todas valen para
// todo el estudio, con ?p= y dentro de la ficha de un proyecto.
import { useSearchParams } from 'react-router-dom'
import { t } from '../../../i18n'
import { useCanEdit, useStoreStatus, useStudioData } from '../../../data/store'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice } from '../../components/TagFilter'
import { useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import { FinanzasEventos } from './FinanzasEventos'
import { FinanzasInformes } from './FinanzasInformes'
import { FinanzasMovimientos } from './FinanzasMovimientos'
import { FinanzasPresupuestos } from './FinanzasPresupuestos'
import { FinanzasProyectos } from './FinanzasProyectos'
import { FinanzasResumen } from './FinanzasResumen'
import './finanzas.css'

/**
 * En la página de claude.ai las finanzas son privadas en la base: quien solo puede ver no
 * recibe ni un movimiento. Sin datos y sin poder editar, se explica eso (no un vacío normal).
 */
function PrivateNotice() {
  const { remote } = useStoreStatus()
  return (
    <Card title={remote ? t('secciones.finanzas.common.privateTitle') : undefined} icon={remote ? 'lock' : undefined}>
      <Empty icon={remote ? 'lock' : 'info'}>{remote ? t('secciones.finanzas.common.private') : t('secciones.finanzas.common.readOnly')}</Empty>
    </Card>
  )
}

export default function FinanzasSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  const vista = params.get('vista')
  const data = useStudioData()
  const canEdit = useCanEdit()
  const { create } = useUI()
  const hidden = !canEdit && data.transactions.length === 0 && data.budgets.length === 0

  const button = (label: string, run: () => void, icon: 'plus' | 'target' = 'plus') => (
    <button type="button" className="btn btn-primary" onClick={run}>
      <Icon name={icon} size={16} /> {label}
    </button>
  )
  const newExpense = () => button(t('secciones.finanzas.actions.newExpense'), () => create('transactions', { kind: 'expense' }))
  const newIncome = () => button(t('secciones.finanzas.actions.newIncome'), () => create('transactions', { kind: 'income' }))
  // Lo que se crea desde cada vista (el informe no crea nada).
  const actions = !canEdit ? undefined : vista === 'gastos' || vista === 'proyectos' ? (
    newExpense()
  ) : vista === 'ingresos' ? (
    newIncome()
  ) : vista === 'presupuestos' ? (
    button(t('secciones.finanzas.actions.newBudget'), () => create('budgets'), 'target')
  ) : vista === 'eventos' ? (
    button(t('secciones.finanzas.actions.newEventCost'), () => create('transactions', { kind: 'expense', category: 'events' }))
  ) : vista === 'informes' ? undefined : (
    <span className="button-row">
      {newExpense()}
      {newIncome()}
    </span>
  )

  const view =
    vista === 'gastos' ? (
      <FinanzasMovimientos kind="expense" embedded={embedded} />
    ) : vista === 'ingresos' ? (
      <FinanzasMovimientos kind="income" embedded={embedded} />
    ) : vista === 'presupuestos' ? (
      <FinanzasPresupuestos />
    ) : vista === 'proyectos' ? (
      <FinanzasProyectos embedded={embedded} />
    ) : vista === 'eventos' ? (
      <FinanzasEventos />
    ) : vista === 'informes' ? (
      <FinanzasInformes />
    ) : (
      <FinanzasResumen />
    )

  return (
    <div className={embedded ? 'finanzas-page' : 'page finanzas-page'}>
      <SectionHeader id="finanzas" embedded={embedded} actions={hidden ? undefined : actions} />
      {hidden ? (
        <PrivateNotice />
      ) : (
        <>
          {/* Los presupuestos no llevan etiquetas: ahí el filtro no aplica. */}
          {vista !== 'presupuestos' && <TagFilterNotice />}
          {view}
        </>
      )}
    </div>
  )
}
