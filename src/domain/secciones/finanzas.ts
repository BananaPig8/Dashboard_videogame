// Finanzas: lo anotado a mano (gastos, ingresos y presupuestos), siempre en la moneda del
// estudio y sin convertir. Solo cuenta lo hecho («done»); lo previsto va aparte.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones.
import type { Budget, Cents, StudioData, Transaction } from '../types'

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
