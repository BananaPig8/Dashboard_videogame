// Finanzas › Costes por proyecto: gastos e ingresos hechos de cada proyecto (y los «sin
// proyecto», del estudio), desde el primer movimiento. Con un proyecto elegido, también su
// reparto por categoría.
import { Link } from 'react-router-dom'
import { TRANSACTION_CATEGORIES } from '../../../domain/catalog'
import { financeByCategory, financeByProject, type FinanceGroup } from '../../../domain/selectors'
import type { ID, TransactionCategory } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { RecordTable, type Column } from '../../components/RecordTable'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { BalanceCell, DoneCell, ManualNote, UpcomingCell } from './comunes'

type Row<K> = FinanceGroup<K> & { id: string }

/** Las columnas de cifras de una tabla de grupos (gastos, ingresos, saldo, previsto y cuántos). */
function useFigureColumns<K>(): Column<Row<K>>[] {
  const L = (k: 'expense' | 'income' | 'balance' | 'upcoming' | 'movements') => t(`secciones.finanzas.proyectos.${k}`)
  return [
    { key: 'expense', label: L('expense'), numeric: true, render: (g) => <DoneCell cents={g.expense.done} /> },
    { key: 'income', label: L('income'), numeric: true, render: (g) => <DoneCell cents={g.income.done} /> },
    { key: 'balance', label: L('balance'), numeric: true, render: (g) => <BalanceCell totals={g} /> },
    { key: 'upcoming', label: L('upcoming'), numeric: true, render: (g) => <UpcomingCell totals={g} /> },
    { key: 'movements', label: L('movements'), numeric: true, render: (g) => g.expense.count + g.income.count },
  ]
}

export function FinanzasProyectos({ embedded }: { embedded?: boolean }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const groups = financeByProject(data, { scope, tag })
  const categories = scope ? financeByCategory(data, { scope, tag }) : []
  const figures = useFigureColumns<ID | null>()
  const categoryFigures = useFigureColumns<TransactionCategory>()
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  const without = scope ? [] : data.projects.filter((p) => !groups.some((g) => g.key === p.id))

  if (!groups.length)
    return (
      <Card>
        <Empty
          icon="wallet"
          action={canEdit && !tag ? { label: t('secciones.finanzas.movimientos.createExpense'), onClick: () => create('transactions') } : undefined}
        >
          {tag ? t('secciones.finanzas.proyectos.noneTagged') : t('secciones.finanzas.proyectos.none')}
        </Empty>
        <ManualNote />
      </Card>
    )

  const rows: Row<ID | null>[] = groups.map((g) => ({ ...g, id: g.key ?? 'sin-proyecto' }))
  const projectTitle = (g: Row<ID | null>) => {
    const p = g.key ? projects.get(g.key) : undefined
    if (!g.key) return t('secciones.finanzas.common.noProject')
    if (!p) return g.key
    // Desde el estudio, cada proyecto enlaza con su pestaña de finanzas.
    return embedded || scope ? (
      <ProjectChip project={p} />
    ) : (
      <Link to={`/proyectos/${p.slug}/finanzas`} aria-label={t('secciones.finanzas.proyectos.openOf', { name: p.name })}>
        <ProjectChip project={p} />
      </Link>
    )
  }

  return (
    <>
      <Card title={t('secciones.finanzas.proyectos.title')} icon="folder" subtitle={t('secciones.finanzas.proyectos.subtitle')}>
        <RecordTable
          rows={rows}
          columns={figures}
          caption={t('secciones.finanzas.proyectos.caption')}
          nameLabel={t('secciones.finanzas.proyectos.project')}
          title={projectTitle}
        />
        {without.length > 0 && (
          <p className="muted small">{t('secciones.finanzas.proyectos.withoutMovements', { list: without.map((p) => p.name).join(', ') })}</p>
        )}
        <ManualNote />
      </Card>
      {scope && categories.length > 0 && (
        <Card title={t('secciones.finanzas.proyectos.byCategory')} icon="layers" subtitle={t('secciones.finanzas.proyectos.byCategorySubtitle')}>
          <RecordTable
            rows={categories.map((g) => ({ ...g, id: g.key }))}
            columns={categoryFigures}
            caption={t('secciones.finanzas.proyectos.captionCategory')}
            nameLabel={t('secciones.finanzas.proyectos.category')}
            title={(g) => TRANSACTION_CATEGORIES[g.key]}
          />
        </Card>
      )}
    </>
  )
}
