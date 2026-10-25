// Finanzas: lo anotado a mano (gastos, ingresos y presupuestos), siempre en la moneda del
// estudio y sin convertir. Solo cuenta lo hecho («done»); lo previsto va aparte.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones.
import { tr } from '../../i18n'
import { CONFIDENCES, SECTOR_EVENT_TYPES, TRANSACTION_CATEGORIES, TRANSACTION_KINDS, TRANSACTION_STATUSES } from '../catalog'
import { daysBetween, isValidISODate, toISODate } from '../dates'
import type { Scope } from '../selectors'
import type {
  Budget,
  Cents,
  ID,
  ISODate,
  SourceRef,
  StudioData,
  StudioEvent,
  Transaction,
  TransactionCategory,
  TransactionKind,
  TransactionStatus,
} from '../types'
import { hasTag } from './etiquetas'

/** Los gastos que caen dentro de un presupuesto (su periodo, su proyecto y su categoría). */
export function budgetExpenses(data: StudioData, b: Budget): Transaction[] {
  return data.transactions.filter(
    (t) =>
      t.kind === 'expense' &&
      t.date >= b.from &&
      t.date <= b.to &&
      (!b.projectId || t.projectId === b.projectId) &&
      (!b.category || t.category === b.category),
  )
}

export interface BudgetUsage {
  budget: Budget
  /** Gastado (hecho). */
  spent: Cents
  /** Previsto o pendiente de pagar. */
  planned: Cents
  /** Lo que queda (negativo si se ha pasado). */
  left: Cents
  over: boolean
}

export function budgetUsage(data: StudioData, b: Budget): BudgetUsage {
  let spent = 0
  let planned = 0
  for (const t of budgetExpenses(data, b)) {
    if (t.status === 'done') spent += t.amount
    else if (t.status === 'planned' || t.status === 'pending') planned += t.amount
  }
  return { budget: b, spent, planned, left: b.amount - spent, over: spent > b.amount }
}

// ——— Movimientos ——————————————————————————————————————————————————————————

/** Qué movimientos se miran: periodo (incluido), ámbito, tipo, categoría, estado, evento y etiqueta. */
export interface FinanceFilter {
  from?: ISODate
  to?: ISODate
  /** null o sin poner = todo el estudio. */
  scope?: Scope
  kind?: TransactionKind
  category?: TransactionCategory
  status?: TransactionStatus
  eventId?: ID
  tag?: string | null
}

const matches = (f: FinanceFilter) => (t: Transaction) =>
  (!f.from || t.date >= f.from) &&
  (!f.to || t.date <= f.to) &&
  (f.scope == null || t.projectId === f.scope) &&
  (!f.kind || t.kind === f.kind) &&
  (!f.category || t.category === f.category) &&
  (!f.status || t.status === f.status) &&
  (!f.eventId || t.eventId === f.eventId) &&
  hasTag(t, f.tag ?? null)

/** Del más reciente al más antiguo (el mismo día, por concepto). */
const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description, 'es')

/** Los movimientos que cumplen el filtro, del más reciente al más antiguo. */
export function financeMovements(data: StudioData, f: FinanceFilter = {}): Transaction[] {
  return data.transactions.filter(matches(f)).sort(byDateDesc)
}

/** Lo previsto y lo pendiente que aún no se ha hecho, del más cercano al más lejano. */
export function financeUpcoming(data: StudioData, f: FinanceFilter = {}): Transaction[] {
  return data.transactions
    .filter((t) => (t.status === 'planned' || t.status === 'pending') && matches(f)(t))
    .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description, 'es'))
}

/** Los meses («AAAA-MM») en que hay movimientos que cumplen el filtro, del más reciente al más antiguo. */
export function financeMonths(data: StudioData, f: FinanceFilter = {}): string[] {
  return [...new Set(data.transactions.filter(matches(f)).map((t) => t.date.slice(0, 7)))].sort().reverse()
}

// ——— Totales ———————————————————————————————————————————————————————————————

/** Lo de un tipo (ingresos o gastos): hecho, previsto y pendiente, siempre por separado. */
export interface FinanceAmounts {
  /** Lo único que cuenta. */
  done: Cents
  planned: Cents
  pending: Cents
  /** Cuántos movimientos (sin los cancelados). */
  count: number
}

export interface FinanceTotals {
  income: FinanceAmounts
  expense: FinanceAmounts
  /** Ingresos menos gastos, solo lo hecho. */
  balance: Cents
  /** Lo previsto y lo pendiente: ingresos menos gastos (no está en el saldo). */
  upcomingBalance: Cents
  /** Cuántos hechos hay (de los dos tipos): sin ninguno, no hay cifras que enseñar. */
  doneCount: number
  /** Los cancelados no suman nada; solo se cuentan para decirlo. */
  cancelled: number
}

const noAmounts = (): FinanceAmounts => ({ done: 0, planned: 0, pending: 0, count: 0 })

function addTo(a: FinanceAmounts, t: Transaction) {
  if (t.status === 'cancelled') return
  a[t.status] += t.amount
  a.count++
}

function totalsOf(list: Transaction[]): FinanceTotals {
  const income = noAmounts()
  const expense = noAmounts()
  let cancelled = 0
  let doneCount = 0
  for (const t of list) {
    if (t.status === 'cancelled') cancelled++
    if (t.status === 'done') doneCount++
    addTo(t.kind === 'income' ? income : expense, t)
  }
  return {
    income,
    expense,
    balance: income.done - expense.done,
    upcomingBalance: income.planned + income.pending - expense.planned - expense.pending,
    doneCount,
    cancelled,
  }
}

/** Ingresos y gastos del filtro, por estado; el saldo solo con lo hecho. */
export function financeTotals(data: StudioData, f: FinanceFilter = {}): FinanceTotals {
  return totalsOf(data.transactions.filter(matches(f)))
}

// ——— Agrupados ——————————————————————————————————————————————————————————————

export interface FinanceGroup<K> extends FinanceTotals {
  key: K
}

function groupBy<K>(list: Transaction[], keyOf: (t: Transaction) => K): Map<K, Transaction[]> {
  const out = new Map<K, Transaction[]>()
  for (const t of list) {
    const k = keyOf(t)
    out.set(k, [...(out.get(k) ?? []), t])
  }
  return out
}

const CATEGORY_ORDER = Object.keys(TRANSACTION_CATEGORIES) as TransactionCategory[]
const weight = (g: FinanceTotals) => g.income.done + g.expense.done

/**
 * Por categoría, de la que más mueve (hecho) a la que menos. Solo las que tienen algún
 * movimiento no cancelado.
 */
export function financeByCategory(data: StudioData, f: FinanceFilter = {}): FinanceGroup<TransactionCategory>[] {
  const groups = groupBy(data.transactions.filter(matches(f)), (t) => t.category)
  return [...groups]
    .map(([key, list]) => ({ key, ...totalsOf(list) }))
    .filter((g) => g.income.count + g.expense.count > 0)
    .sort((a, b) => weight(b) - weight(a) || CATEGORY_ORDER.indexOf(a.key) - CATEGORY_ORDER.indexOf(b.key))
}

/**
 * Por proyecto, en el orden de los proyectos; null = «sin proyecto» (del estudio), al final.
 * Solo los que tienen algún movimiento no cancelado.
 */
export function financeByProject(data: StudioData, f: FinanceFilter = {}): FinanceGroup<ID | null>[] {
  const groups = groupBy(data.transactions.filter(matches(f)), (t) => t.projectId ?? null)
  const order = (k: ID | null) => (k === null ? Number.MAX_SAFE_INTEGER : data.projects.findIndex((p) => p.id === k))
  return [...groups]
    .map(([key, list]) => ({ key, ...totalsOf(list) }))
    .filter((g) => g.income.count + g.expense.count > 0)
    .sort((a, b) => order(a.key) - order(b.key))
}

// ——— Eventos ————————————————————————————————————————————————————————————————

/** Lo gastado (y cobrado) por un evento: sus movimientos con eventId. */
export interface FinanceEventCost {
  eventId: ID
  /** Sin él, el evento se ha borrado y el movimiento aún lo cita. */
  event?: StudioEvent
  /** Gastos hechos de la categoría «Tasas» (inscripciones). */
  fees: Cents
  /** Gastos hechos de «Eventos y ferias» (stand, viaje, material…). */
  costs: Cents
  /** Gastos hechos de otras categorías. */
  other: Cents
  /** Todo lo gastado (hecho). */
  spent: Cents
  /** Gastos previstos o pendientes (no cuentan). */
  upcoming: Cents
  /** Ingresos hechos (un premio, ventas en la feria…). */
  income: Cents
  transactions: Transaction[]
}

/** ¿El movimiento es de este ámbito? Por su proyecto o por el del evento al que va. */
const eventScope = (data: StudioData, scope: Scope | undefined) => (t: Transaction) => {
  if (scope == null || t.projectId === scope) return true
  return !t.projectId && data.events.some((e) => e.id === t.eventId && e.projectId === scope)
}

/**
 * Los movimientos de cada evento (con eventId), por evento: del más reciente al más antiguo
 * (los que no tienen fecha, al final).
 */
export function financeEventCosts(data: StudioData, f: FinanceFilter = {}): FinanceEventCost[] {
  const inScope = eventScope(data, f.scope)
  const list = data.transactions.filter((t) => t.eventId && inScope(t) && matches({ ...f, scope: null })(t))
  const out: FinanceEventCost[] = []
  for (const [eventId, txs] of groupBy(list, (t) => t.eventId!)) {
    const c: FinanceEventCost = { eventId, event: data.events.find((e) => e.id === eventId), fees: 0, costs: 0, other: 0, spent: 0, upcoming: 0, income: 0, transactions: txs.sort(byDateDesc) }
    for (const t of txs) {
      if (t.kind === 'income') {
        if (t.status === 'done') c.income += t.amount
      } else if (t.status === 'done') {
        c.spent += t.amount
        if (t.category === 'fees') c.fees += t.amount
        else if (t.category === 'events') c.costs += t.amount
        else c.other += t.amount
      } else if (t.status === 'planned' || t.status === 'pending') c.upcoming += t.amount
    }
    out.push(c)
  }
  const dateOf = (c: FinanceEventCost) => c.event?.date ?? c.transactions[0]?.date ?? ''
  return out.sort((a, b) => (a.event?.date ? 0 : 1) - (b.event?.date ? 0 : 1) || dateOf(b).localeCompare(dateOf(a)))
}

/**
 * Gastos de «Eventos y ferias» sin evento enlazado (para enlazarlos y que cuenten en su
 * evento). Las tasas sueltas no: una tasa puede no ser de un evento (Steam Direct, un registro…).
 */
export function financeUnlinkedEventCosts(data: StudioData, f: FinanceFilter = {}): Transaction[] {
  return financeMovements(data, f).filter((t) => !t.eventId && t.kind === 'expense' && t.category === 'events')
}

/**
 * Ferias, festivales, premios y presentaciones (no cancelados) sin ningún movimiento: quizá
 * falta anotar su tasa o sus gastos. Primero los que tienen fecha, del más cercano al más lejano.
 */
export function financeEventsWithoutCosts(data: StudioData, scope: Scope = null): StudioEvent[] {
  const linked = new Set(data.transactions.map((t) => t.eventId).filter(Boolean))
  return data.events
    .filter((e) => SECTOR_EVENT_TYPES.includes(e.type) && e.status !== 'cancelled' && !linked.has(e.id) && (scope === null || e.projectId === scope))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.title.localeCompare(b.title, 'es'))
}

// ——— Presupuestos ———————————————————————————————————————————————————————————

export interface FinanceBudgets {
  /** En curso hoy, del que acaba antes al que acaba después. */
  active: BudgetUsage[]
  /** Aún no han empezado. */
  upcoming: BudgetUsage[]
  /** Ya terminados, del más reciente al más antiguo. */
  past: BudgetUsage[]
  /** Los superados (en curso o terminados). */
  over: BudgetUsage[]
}

/** Los presupuestos del ámbito (con un proyecto, solo los suyos), con su uso. */
export function financeBudgets(data: StudioData, today: ISODate, scope: Scope = null): FinanceBudgets {
  const all = data.budgets.filter((b) => scope === null || b.projectId === scope).map((b) => budgetUsage(data, b))
  const active = all.filter((u) => u.budget.from <= today && u.budget.to >= today).sort((a, b) => a.budget.to.localeCompare(b.budget.to))
  const upcoming = all.filter((u) => u.budget.from > today).sort((a, b) => a.budget.from.localeCompare(b.budget.from))
  const past = all.filter((u) => u.budget.to < today).sort((a, b) => b.budget.to.localeCompare(a.budget.to))
  return { active, upcoming, past, over: [...active, ...past].filter((u) => u.over) }
}

/** Los presupuestos que se solapan con un periodo (cada uno se mide en su propio periodo). */
export function financeBudgetsInPeriod(data: StudioData, from: ISODate, to: ISODate, scope: Scope = null): BudgetUsage[] {
  return data.budgets
    .filter((b) => b.from <= to && b.to >= from && (scope === null || b.projectId === scope))
    .sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name, 'es'))
    .map((b) => budgetUsage(data, b))
}

/** Lo usado de un presupuesto, de 0 a 1 (o más, si se ha pasado). Sin importe: 0 o 1. */
export function budgetRatio(u: BudgetUsage): number {
  if (u.budget.amount <= 0) return u.spent > 0 ? 1 : 0
  return u.spent / u.budget.amount
}

// ——— Periodos ———————————————————————————————————————————————————————————————

export type FinancePeriod = 'mes' | 'trimestre' | 'año'

export const FINANCE_PERIODS: FinancePeriod[] = ['mes', 'trimestre', 'año']

export interface FinanceRange {
  period: FinancePeriod
  /** Primer y último día del periodo (incluidos). */
  from: ISODate
  to: ISODate
  /** Dónde empiezan el periodo anterior y el siguiente (para ?desde=). */
  prev: ISODate
  next: ISODate
  /** Para el nombre del fichero: «2026-10», «2026-T4» o «2026». */
  key: string
  year: number
  /** Mes (1–12) o trimestre (1–4); en un año, 0. */
  index: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (y: number, m: number) => toISODate(new Date(Date.UTC(y, m, 0, 12)))

/**
 * El mismo día n meses después (o antes). Si ese mes no tiene ese día, el último del mes:
 * 31 de enero + 1 mes = 28 (o 29) de febrero.
 */
export function financeAddMonths(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const end = Number(lastDay(ny, nm).slice(8))
  return `${ny}-${pad(nm)}-${pad(Math.min(d, end))}`
}

/**
 * El periodo de un informe (?periodo=mes|trimestre|año y ?desde=AAAA-MM-DD): el mes, el
 * trimestre o el año naturales que contienen «desde» (sin «desde», o si no es una fecha, el
 * de hoy). Un periodo que no se reconoce es un mes.
 */
export function financePeriodRange(periodo: string | null | undefined, desde: string | null | undefined, today: ISODate): FinanceRange {
  const period: FinancePeriod = periodo === 'trimestre' || periodo === 'año' ? periodo : 'mes'
  const ref = desde && isValidISODate(desde) ? desde : today
  const year = Number(ref.slice(0, 4))
  const month = Number(ref.slice(5, 7))
  if (period === 'año') {
    return { period, from: `${year}-01-01`, to: `${year}-12-31`, prev: `${year - 1}-01-01`, next: `${year + 1}-01-01`, key: String(year), year, index: 0 }
  }
  const size = period === 'trimestre' ? 3 : 1
  const first = Math.floor((month - 1) / size) * size + 1
  const from = `${year}-${pad(first)}-01`
  const index = period === 'trimestre' ? (first + 2) / 3 : first
  return {
    period,
    from,
    to: lastDay(year, first + size - 1),
    prev: financeAddMonths(from, -size),
    next: financeAddMonths(from, size),
    key: period === 'trimestre' ? `${year}-T${index}` : `${year}-${pad(first)}`,
    year,
    index,
  }
}

/** El primer y el último día de un mes «AAAA-MM» (null si no lo es). */
export function financeMonthRange(month: string | null | undefined): { from: ISODate; to: ISODate } | null {
  if (!month || !/^\d{4}-\d{2}$/.test(month) || !isValidISODate(`${month}-01`)) return null
  return { from: `${month}-01`, to: lastDay(Number(month.slice(0, 4)), Number(month.slice(5, 7))) }
}

// ——— Duplicar ———————————————————————————————————————————————————————————————

/**
 * Un movimiento igual un mes después, como previsto (aún no ha pasado): es una previsión,
 * así que su importe queda «por confirmar» y lleva la fuente que se le dé.
 */
export function financeNextMonthCopy(t: Transaction, sources: SourceRef[]): Omit<Transaction, 'id'> {
  const copy: Partial<Transaction> = { ...t, date: financeAddMonths(t.date, 1), status: 'planned', confidence: 'to_confirm', sources }
  delete copy.id
  return copy as Omit<Transaction, 'id'>
}

/** Los días que faltan para la fecha de un movimiento previsto (negativo: ya pasó). */
export function financeDaysTo(t: Transaction, today: ISODate): number {
  return daysBetween(today, t.date)
}

/** ¿Previsto o pendiente con la fecha ya pasada? (hay que marcarlo hecho o cancelarlo). */
export const financeIsLate = (t: Transaction, today: ISODate) => (t.status === 'planned' || t.status === 'pending') && t.date < today

// ——— CSV ————————————————————————————————————————————————————————————————————
// Formato decidido para abrirlo tal cual en Excel o LibreOffice en castellano:
// - separador «;» y coma decimal («1234,50»), sin separador de miles;
// - importes en unidades de la moneda con 2 decimales, siempre en positivo (el tipo dice
//   si es gasto o ingreso);
// - fechas AAAA-MM-DD; líneas con CRLF (RFC 4180) y BOM UTF-8 para que se lean las tildes;
// - un campo con «;», comillas, saltos de línea o espacios a los lados va entre comillas, y
//   sus comillas se doblan; uno que empieza por = + - @ lleva delante un apóstrofo para que
//   la hoja de cálculo no lo tome por una fórmula.

export const CSV_SEPARATOR = ';'
const BOM = '\uFEFF'

/** Un importe en céntimos como «1234,50» (sin miles, coma decimal). */
export function csvAmount(cents: Cents): string {
  const abs = Math.abs(Math.round(cents))
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)},${pad(abs % 100)}`
}

/** Un campo de texto listo para el CSV (comillas y fórmulas). */
export function csvField(value: string): string {
  const number = /^-?\d+(,\d+)?$/.test(value)
  const safe = !number && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[";\r\n]|^\s|\s$/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Filas de celdas como CSV (sin BOM). Los importes ya vienen escritos con csvAmount. */
export function csvLines(rows: string[][]): string {
  return rows.map((r) => r.map(csvField).join(CSV_SEPARATOR)).join('\r\n') + '\r\n'
}

const CSV_COLUMNS = ['date', 'kind', 'description', 'category', 'project', 'event', 'status', 'amount', 'currency', 'confidence', 'tags'] as const

/** Los movimientos como CSV, con cabecera, en la moneda del estudio. */
export function financeToCSV(data: StudioData, rows: Transaction[], currency: string): string {
  const projects = new Map(data.projects.map((p) => [p.id, p.name]))
  const events = new Map(data.events.map((e) => [e.id, e.title]))
  const header = CSV_COLUMNS.map((c) => tr(`secciones.finanzas.csv.${c}`))
  const body = rows.map((t) => [
    t.date,
    TRANSACTION_KINDS[t.kind].label,
    t.description,
    TRANSACTION_CATEGORIES[t.category],
    t.projectId ? (projects.get(t.projectId) ?? t.projectId) : tr('secciones.finanzas.csv.noProject'),
    t.eventId ? (events.get(t.eventId) ?? t.eventId) : '',
    TRANSACTION_STATUSES[t.status].label,
    csvAmount(t.amount),
    currency,
    CONFIDENCES[t.confidence].label,
    (t.tags ?? []).join(', '),
  ])
  return BOM + csvLines([header, ...body])
}

/** El nombre del fichero: «finanzas-2026-10.csv» (con el proyecto, si lo hay). */
export function financeCSVName(range: FinanceRange, projectSlug?: string): string {
  return `finanzas-${projectSlug ? `${projectSlug}-` : ''}${range.key}.csv`
}
