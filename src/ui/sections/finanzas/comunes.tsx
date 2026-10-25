// Piezas que comparten las vistas de Finanzas: importes en la moneda del estudio, estados,
// las cifras de un periodo, el uso de un presupuesto, la nota de «todo a mano» y la acción
// «Duplicar al mes siguiente».
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { TRANSACTION_CATEGORIES, TRANSACTION_STATUSES } from '../../../domain/catalog'
import { budgetRatio, financeIsLate, financeNextMonthCopy, type BudgetUsage, type FinanceTotals } from '../../../domain/selectors'
import type { Transaction, TransactionKind, TransactionStatus } from '../../../domain/types'
import { t } from '../../../i18n'
import { useStudioData } from '../../../data/store'
import { Pill, ProjectChip } from '../../components/Badges'
import { Progress, Stat } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { saveDraft, useUI } from '../../context'
import { useUndoable } from '../../feedback'
import { useFormat, useToday } from '../../hooks'

/** La moneda del estudio (todo se anota en ella, sin convertir). */
export function useCurrency(): string {
  return useStudioData().studio.currency ?? 'EUR'
}

/** Escribe céntimos en la moneda del estudio. */
export function useMoney(): (cents: number) => string {
  const fmt = useFormat()
  const currency = useCurrency()
  return (cents) => fmt.money(cents, currency)
}

/** Enlace a esta misma pantalla cambiando algunos parámetros (null = quitarlo). */
export function useParamLink(): (changes: Record<string, string | null>) => string {
  const location = useLocation()
  return (changes) => {
    const next = new URLSearchParams(location.search)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    const qs = next.toString()
    return `${location.pathname}${qs ? `?${qs}` : ''}`
  }
}

const STATUS_ICON: Record<TransactionStatus, IconName> = { planned: 'calendar', pending: 'clock', done: 'checkCircle', cancelled: 'xCircle' }

export const TransactionStatusPill = ({ status }: { status: TransactionStatus }) => (
  <Pill tone={TRANSACTION_STATUSES[status].tone} icon={STATUS_ICON[status]}>
    {TRANSACTION_STATUSES[status].label}
  </Pill>
)

const KIND_ICON: Record<TransactionKind, IconName> = { expense: 'arrowDown', income: 'arrowUp' }

export const TransactionKindPill = ({ kind }: { kind: TransactionKind }) => (
  <Pill tone={kind === 'income' ? 'success' : 'neutral'} icon={KIND_ICON[kind]}>
    {t(`secciones.finanzas.kind.${kind}`)}
  </Pill>
)

/** «Fecha pasada»: previsto o pendiente cuya fecha ya llegó. */
export function LatePill({ tx }: { tx: Transaction }) {
  const today = useToday()
  if (!financeIsLate(tx, today)) return null
  return (
    <Pill tone="danger" icon="clock" title={t('secciones.finanzas.common.lateHint')}>
      {t('secciones.finanzas.common.late')}
    </Pill>
  )
}

/** El importe de un movimiento con su signo («+1.200,00 €», «−300,00 €»); tachado si se canceló. */
export function SignedAmount({ tx }: { tx: Transaction }) {
  const money = useMoney()
  const cls = ['num', 'finanzas-amount', tx.kind === 'income' && 'finanzas-income', tx.status === 'cancelled' && 'finanzas-cancelled'].filter(Boolean).join(' ')
  return (
    <span className={cls}>
      {tx.kind === 'income' ? '+' : '−'}
      {money(tx.amount)}
    </span>
  )
}

/** El importe tal cual (y, si se pagó en otra moneda, lo que se pagó). */
export function AmountCell({ tx }: { tx: Transaction }) {
  const money = useMoney()
  const fmt = useFormat()
  return (
    <>
      <span className={tx.status === 'cancelled' ? 'num finanzas-cancelled' : 'num'}>{money(tx.amount)}</span>
      {tx.originalAmount !== undefined && tx.originalCurrency && (
        <span className="finanzas-original muted small">
          {t('secciones.finanzas.common.paidIn', { amount: fmt.money(tx.originalAmount, tx.originalCurrency) })}
        </span>
      )}
    </>
  )
}

export const categoryName = (tx: Pick<Transaction, 'category'>) => TRANSACTION_CATEGORIES[tx.category]

/** «Nada» en una celda: se ve una raya y se lee el texto. */
export function Dash({ label }: { label: string }) {
  return (
    <>
      <span className="muted" aria-hidden="true">
        —
      </span>
      <span className="visually-hidden">{label}</span>
    </>
  )
}

/** Una nota con icono (lo que hay que saber de una vista). */
export function FinanceNote({ children, icon = 'info' }: { children: ReactNode; icon?: IconName }) {
  return (
    <p className="finanzas-note">
      <Icon name={icon} size={14} />
      <span>{children}</span>
    </p>
  )
}

/** «Todo se anota a mano…», con la moneda del estudio. */
export function ManualNote() {
  return <FinanceNote>{t('secciones.finanzas.common.manual', { currency: useCurrency() })}</FinanceNote>
}

/** Lo previsto y lo pendiente, aparte (y los cancelados, que no cuentan). */
export function UpcomingLine({ totals }: { totals: FinanceTotals }) {
  const money = useMoney()
  const income = totals.income.planned + totals.income.pending
  const expense = totals.expense.planned + totals.expense.pending
  const cancelled = totals.cancelled === 0 ? '' : totals.cancelled === 1 ? t('secciones.finanzas.common.cancelledOne') : t('secciones.finanzas.common.cancelled', { n: totals.cancelled })
  return (
    <p className="muted small finanzas-upcoming-line">
      {income || expense ? t('secciones.finanzas.common.upcoming', { income: money(income), expense: money(expense) }) : t('secciones.finanzas.common.upcomingNone')}
      {cancelled && ` ${cancelled}`}
    </p>
  )
}

/**
 * Ingresos, gastos y saldo hechos de un periodo. Sin nada hecho no hay cifras (no se
 * enseña un 0 que parezca un dato): se dice que no hay nada.
 */
export function PeriodFigures({ totals, period }: { totals: FinanceTotals; period: string }) {
  const money = useMoney()
  return (
    <>
      {totals.doneCount === 0 ? (
        <p className="finanzas-nothing">{t('secciones.finanzas.common.noDone', { period })}</p>
      ) : (
        <div className="stats">
          <Stat
            label={t('secciones.finanzas.common.income')}
            value={money(totals.income.done)}
            icon="arrowUp"
            hint={totals.income.done ? t('secciones.finanzas.common.doneHint') : t('secciones.finanzas.common.noneOfKind')}
          />
          <Stat
            label={t('secciones.finanzas.common.expense')}
            value={money(totals.expense.done)}
            icon="arrowDown"
            hint={totals.expense.done ? t('secciones.finanzas.common.doneHint') : t('secciones.finanzas.common.noneOfKind')}
          />
          <Stat label={t('secciones.finanzas.common.balance')} value={money(totals.balance)} icon="wallet" hint={t('secciones.finanzas.common.balanceHint')} />
        </div>
      )}
      <UpcomingLine totals={totals} />
    </>
  )
}

/** «Superado» o «Dentro». */
export function BudgetStatePill({ over }: { over: boolean }) {
  return over ? (
    <Pill tone="danger" icon="alert">
      {t('secciones.finanzas.presupuestos.over')}
    </Pill>
  ) : (
    <Pill tone="success" icon="checkCircle">
      {t('secciones.finanzas.presupuestos.within')}
    </Pill>
  )
}

/**
 * Un presupuesto con su uso: barra, gastado de previsto, pendiente y lo que queda. Con
 * `detailed`, también el ámbito, la categoría, el periodo y las notas.
 */
export function BudgetMeter({ usage, showProject, detailed }: { usage: BudgetUsage; showProject: boolean; detailed?: boolean }) {
  const data = useStudioData()
  const { edit } = useUI()
  const money = useMoney()
  const fmt = useFormat()
  const year = Number(useToday().slice(0, 4))
  const { budget, spent, planned, left, over } = usage
  const ratio = budgetRatio(usage)
  const afterPending = left - planned
  const P = (k: 'planned' | 'spent' | 'pending' | 'left' | 'overBy') => t(`secciones.finanzas.presupuestos.${k}`)
  return (
    <li className="finanzas-budget">
      <div className="finanzas-budget-head">
        <h3>
          <button type="button" className="item-title" onClick={() => edit({ collection: 'budgets', id: budget.id })}>
            {budget.name}
          </button>
        </h3>
        <BudgetStatePill over={over} />
      </div>
      {detailed && (
        <div className="item-meta">
          {budget.projectId ? (
            showProject && <ProjectChip project={data.projects.find((p) => p.id === budget.projectId)} />
          ) : (
            <span className="meta-date">{t('secciones.finanzas.presupuestos.studioWide')}</span>
          )}
          <span className="meta-date">{budget.category ? TRANSACTION_CATEGORIES[budget.category] : t('secciones.finanzas.presupuestos.allCategories')}</span>
          <span className="meta-date">
            <Icon name="calendar" size={12} /> {t('secciones.finanzas.presupuestos.range', { from: fmt.date(budget.from, year), to: fmt.date(budget.to, year) })}
          </span>
        </div>
      )}
      <Progress ratio={ratio} label={t('secciones.finanzas.presupuestos.usage', { name: budget.name })} tone={over || ratio >= 0.9 ? 'warning' : 'info'} />
      {detailed ? (
        <dl className="finanzas-figures">
          <div>
            <dt>{P('planned')}</dt>
            <dd className="num">{money(budget.amount)}</dd>
          </div>
          <div>
            <dt>{P('spent')}</dt>
            <dd className="num">{money(spent)}</dd>
          </div>
          <div>
            <dt>{P('pending')}</dt>
            <dd className="num">{money(planned)}</dd>
          </div>
          <div>
            <dt>{over ? P('overBy') : P('left')}</dt>
            <dd className={over ? 'num finanzas-over' : 'num'}>{money(Math.abs(left))}</dd>
          </div>
        </dl>
      ) : (
        <p className="meta-date">
          {t('secciones.finanzas.presupuestos.spentOf', { spent: money(spent), amount: money(budget.amount) })} ·{' '}
          {over ? `${P('overBy')} ${money(-left)}` : `${P('left')} ${money(left)}`}
        </p>
      )}
      {detailed && planned > 0 && (
        <p className="muted small">
          {afterPending >= 0
            ? t('secciones.finanzas.presupuestos.ifPaidLeft', { amount: money(afterPending) })
            : t('secciones.finanzas.presupuestos.ifPaidOver', { amount: money(-afterPending) })}
        </p>
      )}
      {detailed && budget.notes && <p className="item-detail">{budget.notes}</p>}
    </li>
  )
}

/** Botón «Duplicar al mes siguiente»: crea uno igual con la fecha +1 mes, previsto y por confirmar. */
export function DuplicateButton({ tx }: { tx: Transaction }) {
  const data = useStudioData()
  const undoable = useUndoable()
  const fmt = useFormat()
  const today = useToday()
  const label = t('secciones.finanzas.common.duplicateOf', { name: tx.description })
  const run = () => {
    const note = t('secciones.finanzas.common.duplicateNote', { name: tx.description, date: fmt.date(tx.date) })
    const copy = financeNextMonthCopy(tx, [{ type: 'manual', ref: t('secciones.finanzas.common.duplicateSource'), date: today, note }])
    undoable(t('secciones.finanzas.common.duplicated', { date: fmt.date(copy.date) }), () => {
      saveDraft('transactions', copy as unknown as Record<string, unknown>, data)
    })
  }
  return (
    <button type="button" className="icon-btn small" aria-label={label} title={label} onClick={run}>
      <Icon name="copy" size={14} />
    </button>
  )
}
