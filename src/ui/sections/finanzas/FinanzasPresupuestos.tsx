// Finanzas › Presupuestos: cada presupuesto con su uso (previsto, gastado, pendiente y lo
// que queda), en curso, próximos y terminados. Con un proyecto elegido, solo los suyos.
import { financeBudgets, type BudgetUsage } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Card, Empty } from '../../components/Common'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { BudgetMeter, FinanceNote } from './comunes'

function BudgetList({ list, showProject }: { list: BudgetUsage[]; showProject: boolean }) {
  return (
    <ul className="finanzas-budgets">
      {list.map((u) => (
        <BudgetMeter key={u.budget.id} usage={u} showProject={showProject} detailed />
      ))}
    </ul>
  )
}

export function FinanzasPresupuestos() {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const { active, upcoming, past } = financeBudgets(data, today, scope)
  const showProject = scope === null
  const P = (k: 'active' | 'activeSubtitle' | 'upcoming' | 'upcomingSubtitle' | 'past' | 'pastSubtitle') => t(`secciones.finanzas.presupuestos.${k}`)
  const createAction = canEdit ? { label: t('secciones.finanzas.presupuestos.create'), onClick: () => create('budgets') } : undefined

  if (!active.length && !upcoming.length && !past.length)
    return (
      <Card>
        <Empty icon="target" action={createAction}>
          {scope ? t('secciones.finanzas.presupuestos.noneInProject') : t('secciones.finanzas.presupuestos.none')}
        </Empty>
      </Card>
    )

  return (
    <>
      <Card title={P('active')} icon="target" subtitle={P('activeSubtitle')}>
        {active.length ? <BudgetList list={active} showProject={showProject} /> : <p className="muted small">{t('secciones.finanzas.presupuestos.noneActive')}</p>}
        <FinanceNote>{t('secciones.finanzas.presupuestos.note')}</FinanceNote>
      </Card>
      {upcoming.length > 0 && (
        <Card title={P('upcoming')} icon="calendar" subtitle={P('upcomingSubtitle')}>
          <BudgetList list={upcoming} showProject={showProject} />
        </Card>
      )}
      {past.length > 0 && (
        <Card title={P('past')} icon="history" subtitle={P('pastSubtitle')}>
          <BudgetList list={past} showProject={showProject} />
        </Card>
      )}
    </>
  )
}
