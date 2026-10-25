// Finanzas › Resumen: este mes y este año (ingresos, gastos y saldo hechos; lo previsto
// aparte), los presupuestos en curso con su uso, lo que está por pagar o cobrar y los
// últimos movimientos.
import { Link } from 'react-router-dom'
import { yearOf } from '../../../domain/dates'
import { financeBudgets, financeMovements, financePeriodRange, financeTotals, financeUpcoming } from '../../../domain/selectors'
import type { Transaction } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useSectionNav } from '../../components/SectionHeader'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { BudgetMeter, categoryName, LatePill, ManualNote, PeriodFigures, SignedAmount, TransactionStatusPill } from './comunes'

/** Cuántas filas se enseñan en las listas del resumen. */
const LIMIT = 6

function MovementList({ list, showProject }: { list: Transaction[]; showProject: boolean }) {
  const data = useStudioData()
  const { edit } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  return (
    <ul className="finanzas-list">
      {list.map((x) => (
        <li key={x.id} className="finanzas-row">
          <span className="finanzas-row-date meta-date">{fmt.date(x.date, year)}</span>
          <div className="finanzas-row-main">
            <button type="button" className="item-title" onClick={() => edit({ collection: 'transactions', id: x.id })}>
              {x.description}
            </button>
            <div className="item-meta">
              <span className="meta-date">{categoryName(x)}</span>
              {showProject && x.projectId && <ProjectChip project={data.projects.find((p) => p.id === x.projectId)} />}
              <TransactionStatusPill status={x.status} />
              <LatePill tx={x} />
            </div>
          </div>
          <SignedAmount tx={x} />
        </li>
      ))}
    </ul>
  )
}

export function FinanzasResumen() {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const today = useToday()
  const tag = useTagFilter()
  const nav = useSectionNav('finanzas')
  const child = (id: string) => nav.section.children.find((c) => c.id === id)!

  const month = financePeriodRange('mes', today, today)
  const year = financePeriodRange('año', today, today)
  const monthTotals = financeTotals(data, { scope, tag, from: month.from, to: month.to })
  const yearTotals = financeTotals(data, { scope, tag, from: year.from, to: year.to })
  const budgets = financeBudgets(data, today, scope)
  const all = financeMovements(data, { scope, tag })
  // Los últimos: lo que ya tiene fecha (lo de más adelante está en «Previsto y pendiente»).
  const latest = all.filter((x) => x.date <= today)
  const upcoming = financeUpcoming(data, { scope, tag })
  const showProject = scope === null
  const nothing = all.length === 0 && budgets.active.length + budgets.upcoming.length + budgets.past.length === 0

  if (nothing)
    return (
      <Card>
        <Empty
          icon="wallet"
          action={canEdit && !tag ? { label: t('secciones.finanzas.movimientos.createExpense'), onClick: () => create('transactions') } : undefined}
        >
          {tag ? t('secciones.finanzas.resumen.emptyTagged') : t('secciones.finanzas.resumen.empty')}
        </Empty>
        <ManualNote />
      </Card>
    )

  return (
    <>
      <div className="grid grid-2">
        <Card title={t('secciones.finanzas.resumen.month')} icon="calendar" subtitle={fmt.monthYear(month.key)}>
          <PeriodFigures totals={monthTotals} period={fmt.monthYear(month.key)} />
        </Card>
        <Card title={t('secciones.finanzas.resumen.year')} icon="chart" subtitle={year.key}>
          <PeriodFigures totals={yearTotals} period={year.key} />
        </Card>
      </div>
      <div className="grid grid-2">
        <Card
          title={t('secciones.finanzas.resumen.budgets')}
          icon="target"
          action={
            <Link className="btn btn-small btn-ghost" to={nav.href(child('presupuestos'))}>
              {t('secciones.finanzas.resumen.budgetsAll')}
            </Link>
          }
        >
          {budgets.active.length ? (
            <ul className="finanzas-budgets">
              {budgets.active.map((u) => (
                <BudgetMeter key={u.budget.id} usage={u} showProject={showProject} />
              ))}
            </ul>
          ) : (
            <Empty icon="target" action={canEdit ? { label: t('secciones.finanzas.presupuestos.create'), onClick: () => create('budgets') } : undefined}>
              {t('secciones.finanzas.resumen.budgetsNone')}
            </Empty>
          )}
          {budgets.over.some((u) => u.budget.to < today) && (
            <p className="finanzas-alert">
              <Icon name="alert" size={14} />
              <span>
                {t('secciones.finanzas.resumen.budgetsOver', {
                  list: budgets.over
                    .filter((u) => u.budget.to < today)
                    .map((u) => u.budget.name)
                    .join(', '),
                })}
              </span>
            </p>
          )}
        </Card>
        <Card title={t('secciones.finanzas.resumen.upcoming')} icon="clock" subtitle={t('secciones.finanzas.resumen.upcomingSubtitle')}>
          {upcoming.length ? (
            <>
              <MovementList list={upcoming.slice(0, LIMIT)} showProject={showProject} />
              {upcoming.length > LIMIT && <p className="muted small">{t('secciones.finanzas.resumen.upcomingMore', { n: upcoming.length - LIMIT })}</p>}
            </>
          ) : (
            <p className="muted small">{t('secciones.finanzas.common.upcomingNone')}</p>
          )}
        </Card>
      </div>
      <Card
        title={t('secciones.finanzas.resumen.latest')}
        icon="list"
        action={
          <span className="button-row">
            <Link className="btn btn-small btn-ghost" to={nav.href(child('gastos'))}>
              {t('secciones.finanzas.resumen.seeExpenses')}
            </Link>
            <Link className="btn btn-small btn-ghost" to={nav.href(child('ingresos'))}>
              {t('secciones.finanzas.resumen.seeIncome')}
            </Link>
          </span>
        }
      >
        {latest.length ? (
          <MovementList list={latest.slice(0, LIMIT)} showProject={showProject} />
        ) : (
          <p className="muted small">{tag ? t('secciones.finanzas.resumen.emptyTagged') : t('secciones.finanzas.resumen.latestNone')}</p>
        )}
        <ManualNote />
      </Card>
    </>
  )
}
