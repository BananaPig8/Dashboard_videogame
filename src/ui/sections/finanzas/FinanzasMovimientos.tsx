// Finanzas › Gastos e Ingresos: los movimientos de un tipo en una tabla, con filtros propios
// en la URL (?categoria=, ?estado=, ?mes=; el proyecto es el ámbito) y el total del filtro.
// Solo cuenta lo hecho; lo previsto y lo pendiente se suman aparte.
import { useSearchParams } from 'react-router-dom'
import { TRANSACTION_CATEGORIES, TRANSACTION_STATUSES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { financeMonthRange, financeMonths, financeMovements, financeTotals, type FinanceFilter } from '../../../domain/selectors'
import type { Transaction, TransactionCategory, TransactionKind, TransactionStatus } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { ConfidenceTag, ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { RecordTable, type Column } from '../../components/RecordTable'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { AmountCell, categoryName, Dash, DuplicateButton, FinanceNote, LatePill, ManualNote, TransactionStatusPill, useMoney } from './comunes'

const CATEGORIES = Object.keys(TRANSACTION_CATEGORIES) as TransactionCategory[]
const STATUSES = Object.keys(TRANSACTION_STATUSES) as TransactionStatus[]
/** Los filtros finos de esta vista (el ámbito ?p= y la etiqueta van aparte). */
const FILTERS = ['categoria', 'estado', 'mes']

const oneOf = <T extends string>(value: string | null, list: readonly T[]): T | undefined => (list.includes(value as T) ? (value as T) : undefined)

export function FinanzasMovimientos({ kind, embedded }: { kind: TransactionKind; embedded?: boolean }) {
  const data = useStudioData()
  const { scope, setScope } = useScope()
  const [params, setParams] = useSearchParams()
  const { edit, create } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const money = useMoney()
  const year = yearOf(useToday())
  const tag = useTagFilter()

  const category = oneOf(params.get('categoria'), CATEGORIES)
  const status = oneOf(params.get('estado'), STATUSES)
  const monthParam = params.get('mes')
  const month = financeMonthRange(monthParam)
  const base: FinanceFilter = { scope, kind, tag }
  const all = financeMovements(data, base)
  const filter: FinanceFilter = { ...base, category, status, from: month?.from, to: month?.to }
  const rows = financeMovements(data, filter)
  const totals = financeTotals(data, filter)
  const amounts = kind === 'income' ? totals.income : totals.expense
  // El mes elegido sale en la lista aunque no tenga movimientos (si no, el desplegable mentiría).
  const months = financeMonths(data, base)
  if (month && monthParam && !months.includes(monthParam)) months.unshift(monthParam)
  const filtered = FILTERS.some((k) => params.get(k))

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const clear = () => {
    const next = new URLSearchParams(params)
    for (const k of FILTERS) next.delete(k)
    setParams(next, { replace: true })
  }
  const createOne = () => create('transactions', { kind, ...(category ? { category } : {}) })

  const events = new Map(data.events.map((e) => [e.id, e]))
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  const C = (k: 'category' | 'project' | 'event' | 'date' | 'status' | 'amount' | 'confidence' | 'tags' | 'actions') =>
    t(`secciones.finanzas.movimientos.columns.${k}`)
  const columns: Column<Transaction>[] = [
    { key: 'category', label: C('category'), render: (x) => categoryName(x) },
    ...(scope === null
      ? [
          {
            key: 'project',
            label: C('project'),
            render: (x: Transaction) =>
              x.projectId ? <ProjectChip project={projects.get(x.projectId)} /> : <span className="muted">{t('secciones.finanzas.common.noProject')}</span>,
          },
        ]
      : []),
    {
      key: 'event',
      label: C('event'),
      render: (x) =>
        x.eventId ? (
          (events.get(x.eventId)?.title ?? <span className="muted">{t('secciones.finanzas.common.eventGone')}</span>)
        ) : (
          <Dash label={t('secciones.finanzas.common.noEvent')} />
        ),
    },
    {
      key: 'date',
      label: C('date'),
      render: (x) => (
        <span className="finanzas-date">
          <span className="nowrap">{fmt.date(x.date, year)}</span> <LatePill tx={x} />
        </span>
      ),
    },
    { key: 'status', label: C('status'), render: (x) => <TransactionStatusPill status={x.status} /> },
    { key: 'amount', label: C('amount'), numeric: true, render: (x) => <AmountCell tx={x} /> },
    { key: 'confidence', label: C('confidence'), render: (x) => <ConfidenceTag confidence={x.confidence} /> },
    ...(rows.some((x) => x.tags?.length) ? [{ key: 'tags', label: C('tags'), render: (x: Transaction) => <TagLinks tags={x.tags} /> }] : []),
    ...(canEdit ? [{ key: 'actions', label: C('actions'), render: (x: Transaction) => <DuplicateButton tx={x} /> }] : []),
  ]

  const F = (k: 'label' | 'project' | 'projectAll' | 'category' | 'categoryAll' | 'status' | 'statusAll' | 'month' | 'monthAll' | 'clear') =>
    t(`secciones.finanzas.movimientos.filters.${k}`)
  const noneText = tag
    ? t('secciones.finanzas.movimientos.noneTagged')
    : kind === 'income'
      ? t('secciones.finanzas.movimientos.noneIncome')
      : t('secciones.finanzas.movimientos.noneExpense')
  const createLabel = kind === 'income' ? t('secciones.finanzas.movimientos.createIncome') : t('secciones.finanzas.movimientos.createExpense')
  const countText = amounts.count === 1 ? t('secciones.finanzas.common.countOne') : t('secciones.finanzas.common.count', { n: amounts.count })

  return (
    <>
      <div className="filters finanzas-filters" role="group" aria-label={F('label')}>
        {!embedded && data.projects.length > 0 && (
          <select value={scope ?? ''} onChange={(e) => setScope(e.target.value || null)} aria-label={F('project')}>
            <option value="">{F('projectAll')}</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <select value={category ?? ''} onChange={(e) => set('categoria', e.target.value)} aria-label={F('category')}>
          <option value="">{F('categoryAll')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TRANSACTION_CATEGORIES[c]}
            </option>
          ))}
        </select>
        <select value={status ?? ''} onChange={(e) => set('estado', e.target.value)} aria-label={F('status')}>
          <option value="">{F('statusAll')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRANSACTION_STATUSES[s].label}
            </option>
          ))}
        </select>
        <select value={month ? (monthParam ?? '') : ''} onChange={(e) => set('mes', e.target.value)} aria-label={F('month')}>
          <option value="">{F('monthAll')}</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {fmt.monthYear(m)}
            </option>
          ))}
        </select>
        {filtered && (
          <button type="button" className="btn btn-small btn-ghost" onClick={clear}>
            <Icon name="close" size={14} /> {F('clear')}
          </button>
        )}
      </div>
      <Card>
        {all.length === 0 ? (
          <Empty icon="wallet" action={canEdit && !tag ? { label: createLabel, onClick: createOne } : undefined}>
            {noneText}
          </Empty>
        ) : rows.length === 0 ? (
          <Empty icon="search" action={{ label: F('clear'), onClick: clear, icon: 'close' }}>
            {t('secciones.finanzas.movimientos.noneFiltered')}
          </Empty>
        ) : (
          <>
            <p className="finanzas-total" aria-live="polite">
              <strong>{t('secciones.finanzas.movimientos.total')}:</strong> {t('secciones.finanzas.movimientos.totalDone', { amount: money(amounts.done) })}
              {amounts.planned + amounts.pending > 0 &&
                ` · ${t('secciones.finanzas.movimientos.totalUpcoming', { amount: money(amounts.planned + amounts.pending) })}`}
              {' · '}
              {countText}
              {totals.cancelled > 0 &&
                ` · ${totals.cancelled === 1 ? t('secciones.finanzas.common.cancelledOne') : t('secciones.finanzas.common.cancelled', { n: totals.cancelled })}`}
            </p>
            <RecordTable
              rows={rows}
              columns={columns}
              caption={kind === 'income' ? t('secciones.finanzas.movimientos.captionIncome') : t('secciones.finanzas.movimientos.captionExpense')}
              title={(x) => x.description}
              onOpen={(x) => edit({ collection: 'transactions', id: x.id })}
            />
          </>
        )}
        {kind === 'income' && <FinanceNote>{t('secciones.finanzas.movimientos.incomeManual')}</FinanceNote>}
        <ManualNote />
      </Card>
    </>
  )
}
