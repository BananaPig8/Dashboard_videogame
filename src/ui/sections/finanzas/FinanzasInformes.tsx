// Finanzas › Informes económicos: el informe de un periodo (?periodo=mes|trimestre|año y
// ?desde=AAAA-MM-DD): ingresos y gastos por categoría y por proyecto, presupuesto previsto
// frente a real, coste de eventos y «Exportar CSV» con los movimientos del periodo.
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TRANSACTION_CATEGORIES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import {
  FINANCE_PERIODS,
  financeBudgetsInPeriod,
  financeByCategory,
  financeByProject,
  financeCSVName,
  financeEventCosts,
  financeMovements,
  financePeriodRange,
  financeToCSV,
  financeTotals,
  type BudgetUsage,
  type FinanceEventCost,
  type FinanceGroup,
  type FinanceRange,
} from '../../../domain/selectors'
import type { ID, TransactionCategory } from '../../../domain/types'
import { t, tr } from '../../../i18n'
import type { finanzas } from '../../../i18n/secciones-es/finanzas'
import { useStudioData } from '../../../data/store'
import { ProjectChip } from '../../components/Badges'
import { Card } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { RecordTable } from '../../components/RecordTable'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useNotify } from '../../feedback'
import { saveFile } from '../../files'
import { useFormat, useToday } from '../../hooks'
import { BalanceCell, BudgetStatePill, Dash, DoneCell, FinanceNote, UpcomingCell, PeriodFigures, useCurrency, useMoney, useParamLink } from './comunes'

type InformeKey = Exclude<keyof typeof finanzas.informes, 'periods'>
const I = (k: InformeKey, vars?: Record<string, string | number>) => tr(`secciones.finanzas.informes.${k}`, vars)

/** El nombre de un periodo: «octubre de 2026», «4.º trimestre de 2026» o «2026». */
function usePeriodName(): (r: FinanceRange) => string {
  const fmt = useFormat()
  return (r) =>
    r.period === 'mes' ? fmt.monthYear(r.from.slice(0, 7)) : r.period === 'trimestre' ? t('secciones.finanzas.common.quarter', { n: r.index, year: r.year }) : String(r.year)
}

function PeriodNav({ range }: { range: FinanceRange }) {
  const link = useParamLink()
  const today = useToday()
  const name = usePeriodName()
  const current = financePeriodRange(range.period, today, today)
  const prev = financePeriodRange(range.period, range.prev, today)
  const next = financePeriodRange(range.period, range.next, today)
  // El periodo de hoy va sin ?desde= (así una vista guardada sigue al día).
  const desde = (from: string) => (from === current.from ? null : from)
  return (
    <nav className="finanzas-period" aria-label={I('periodNav')}>
      <ul className="finanzas-segments">
        {FINANCE_PERIODS.map((p) => {
          const on = p === range.period
          const target = financePeriodRange(p, range.from, today)
          const targetCurrent = financePeriodRange(p, today, today)
          return (
            <li key={p}>
              <Link
                className={on ? 'active' : undefined}
                aria-current={on ? 'true' : undefined}
                to={link({ periodo: p === 'mes' ? null : p, desde: target.from === targetCurrent.from ? null : target.from })}
              >
                {tr(`secciones.finanzas.informes.periods.${p}`)}
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="finanzas-period-steps">
        <Link className="btn btn-small btn-ghost" to={link({ desde: desde(prev.from) })} aria-label={I('prevTo', { period: name(prev) })}>
          <Icon name="chevronLeft" size={14} /> {I('prev')}
        </Link>
        <strong className="finanzas-period-name">{name(range)}</strong>
        <Link className="btn btn-small btn-ghost" to={link({ desde: desde(next.from) })} aria-label={I('nextTo', { period: name(next) })}>
          {I('next')} <Icon name="chevronRight" size={14} />
        </Link>
        {range.from !== current.from && (
          <Link className="btn btn-small btn-ghost" to={link({ desde: null })}>
            {I('current')}
          </Link>
        )}
      </div>
    </nav>
  )
}

type GroupRow<K> = FinanceGroup<K> & { id: string }

function GroupTable<K>({ rows, title, caption, label }: { rows: GroupRow<K>[]; title: (g: GroupRow<K>) => ReactNode; caption: string; label: string }) {
  if (!rows.length) return <p className="muted small">{I('noMovements')}</p>
  return (
    <RecordTable
      rows={rows}
      caption={caption}
      title={title}
      columns={[
        { key: 'income', label: I('income'), numeric: true, render: (g) => <DoneCell cents={g.income.done} /> },
        { key: 'expense', label: I('expense'), numeric: true, render: (g) => <DoneCell cents={g.expense.done} /> },
        { key: 'balance', label: I('balance'), numeric: true, render: (g) => <BalanceCell totals={g} /> },
        { key: 'upcoming', label: I('upcoming'), numeric: true, render: (g) => <UpcomingCell totals={g} /> },
      ]}
      empty={label}
    />
  )
}

function BudgetTable({ list, caption }: { list: BudgetUsage[]; caption: string }) {
  const money = useMoney()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const { edit } = useUI()
  if (!list.length) return <p className="muted small">{I('budgetsNone')}</p>
  return (
    <RecordTable
      rows={list.map((u) => ({ ...u, id: u.budget.id }))}
      caption={caption}
      title={(u) => u.budget.name}
      onOpen={(u) => edit({ collection: 'budgets', id: u.budget.id })}
      columns={[
        {
          key: 'range',
          label: I('budgetRange'),
          render: (u) => t('secciones.finanzas.presupuestos.range', { from: fmt.date(u.budget.from, year), to: fmt.date(u.budget.to, year) }),
        },
        { key: 'planned', label: I('planned'), numeric: true, render: (u) => money(u.budget.amount) },
        { key: 'spent', label: I('spent'), numeric: true, render: (u) => money(u.spent) },
        { key: 'difference', label: I('difference'), numeric: true, render: (u) => <strong>{money(u.left)}</strong> },
        { key: 'state', label: I('state'), render: (u) => <BudgetStatePill over={u.over} /> },
      ]}
    />
  )
}

function EventTable({ list, caption }: { list: FinanceEventCost[]; caption: string }) {
  const money = useMoney()
  const { edit } = useUI()
  const shown = list.filter((c) => c.spent > 0 || c.upcoming > 0)
  if (!shown.length) return <p className="muted small">{I('eventsNone')}</p>
  return (
    <RecordTable
      rows={shown.map((c) => ({ ...c, id: c.eventId }))}
      caption={caption}
      title={(c) => c.event?.title ?? t('secciones.finanzas.common.eventGone')}
      onOpen={(c) => c.event && edit({ collection: 'events', id: c.eventId })}
      columns={[
        { key: 'fees', label: I('fees'), numeric: true, render: (c) => <DoneCell cents={c.fees} /> },
        { key: 'other', label: I('otherCosts'), numeric: true, render: (c) => <DoneCell cents={c.costs + c.other} /> },
        { key: 'total', label: I('total'), numeric: true, render: (c) => <DoneCell cents={c.spent} strong /> },
        { key: 'upcoming', label: I('upcoming'), numeric: true, render: (c) => (c.upcoming ? money(c.upcoming) : <Dash label={t('secciones.finanzas.common.upcomingNone')} />) },
      ]}
    />
  )
}

export function FinanzasInformes() {
  const data = useStudioData()
  const { scope, project } = useScope()
  const [params] = useSearchParams()
  const today = useToday()
  const tag = useTagFilter()
  const currency = useCurrency()
  const { toast } = useNotify()
  const periodName = usePeriodName()
  const range = financePeriodRange(params.get('periodo'), params.get('desde'), today)
  const name = periodName(range)
  const f = { scope, tag, from: range.from, to: range.to }
  const totals = financeTotals(data, f)
  const categories = financeByCategory(data, f)
  const projects = scope ? [] : financeByProject(data, f)
  // Los presupuestos no llevan etiquetas: con una elegida no se comparan.
  const budgets = tag ? [] : financeBudgetsInPeriod(data, range.from, range.to, scope)
  const events = financeEventCosts(data, f)
  const rows = financeMovements(data, f)
  const byId = new Map(data.projects.map((p) => [p.id, p]))

  const exportCSV = async () => {
    // En el fichero, del más antiguo al más reciente (como se lee en una hoja de cálculo).
    const filename = financeCSVName(range, project?.slug)
    const result = await saveFile(filename, financeToCSV(data, [...rows].reverse(), currency), 'text/csv')
    if (result === 'saved') toast(I('saved', { name: filename }))
    else if (result === 'unavailable') toast({ message: I('unavailable'), tone: 'danger' })
  }

  return (
    <>
      <PeriodNav range={range} />
      <Card title={I('summary', { period: name })} icon="chart">
        <PeriodFigures totals={totals} period={name} />
      </Card>
      <div className="stack">
        <Card title={I('byCategory')} icon="layers">
          <GroupTable<TransactionCategory>
            rows={categories.map((g) => ({ ...g, id: g.key }))}
            title={(g) => TRANSACTION_CATEGORIES[g.key]}
            caption={I('captionCategory', { period: name })}
            label={I('noMovements')}
          />
        </Card>
        {!scope && (
          <Card title={I('byProject')} icon="folder">
            <GroupTable<ID | null>
              rows={projects.map((g) => ({ ...g, id: g.key ?? 'sin-proyecto' }))}
              title={(g) => (g.key ? <ProjectChip project={byId.get(g.key)} /> : t('secciones.finanzas.common.noProject'))}
              caption={I('captionProject', { period: name })}
              label={I('noMovements')}
            />
          </Card>
        )}
      </div>
      {!tag && (
        <Card title={I('budgets')} icon="target" subtitle={I('budgetsSubtitle')}>
          <BudgetTable list={budgets} caption={I('captionBudgets', { period: name })} />
        </Card>
      )}
      <Card title={I('events')} icon="ticket" subtitle={I('eventsSubtitle')}>
        <EventTable list={events} caption={I('captionEvents', { period: name })} />
      </Card>
      <Card title={I('export')} icon="download">
        <FinanceNote>{I('exportHint', { currency })}</FinanceNote>
        <p className="muted small">{rows.length === 0 ? I('exportNone') : rows.length === 1 ? I('exportCountOne') : I('exportCount', { n: rows.length })}</p>
        <div>
          <button type="button" className="btn btn-small" onClick={exportCSV} disabled={rows.length === 0}>
            <Icon name="download" size={14} /> {I('exportButton')}
          </button>
        </div>
      </Card>
    </>
  )
}
