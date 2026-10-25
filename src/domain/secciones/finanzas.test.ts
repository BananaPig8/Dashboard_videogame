import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Budget, type StudioData, type StudioEvent, type Transaction } from '../types'
import { validateStudioData } from '../validate'
import {
  budgetRatio,
  budgetUsage,
  csvAmount,
  csvField,
  csvLines,
  financeAddMonths,
  financeBudgets,
  financeBudgetsInPeriod,
  financeByCategory,
  financeByProject,
  financeCSVName,
  financeEventCosts,
  financeEventsWithoutCosts,
  financeIsLate,
  financeMonthRange,
  financeMonths,
  financeMovements,
  financeNextMonthCopy,
  financePeriodRange,
  financeToCSV,
  financeTotals,
  financeUnlinkedEventCosts,
  financeUpcoming,
} from '../selectors'

const TODAY = '2026-10-19'
const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string) => ({ id, slug: id, name: id.toUpperCase(), description: '', platforms: [], stage: 'production' as const, color: '#000', versions: [], tags: [], links: [] })
const tx = (id: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  kind: 'expense',
  projectId: 'p',
  category: 'software',
  description: id,
  amount: 1000,
  date: '2026-10-05',
  status: 'done',
  sources: src,
  confidence: 'verified',
  ...over,
})
const event = (id: string, over: Partial<StudioEvent> = {}): StudioEvent => ({
  id,
  projectId: 'p',
  title: id,
  type: 'fair',
  status: 'planned',
  dateConfirmed: false,
  sources: src,
  confidence: 'verified',
  ...over,
})
const budget = (id: string, over: Partial<Budget> = {}): Budget => ({ id, name: id, amount: 5000, from: '2026-10-01', to: '2026-12-31', ...over })

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01', currency: 'EUR' },
    projects: [project('p'), project('q')],
    events: [event('feria', { date: '2026-11-20' }), event('premio', { type: 'award', projectId: undefined }), event('reunion', { type: 'meeting' })],
    transactions: [
      tx('licencia', { amount: 1200, tags: ['godot'] }),
      tx('stand', { category: 'events', eventId: 'feria', amount: 30000, date: '2026-10-10' }),
      tx('tasa', { category: 'fees', eventId: 'feria', amount: 5000, date: '2026-09-15' }),
      tx('viaje', { category: 'events', eventId: 'feria', amount: 8000, status: 'planned', date: '2026-11-19' }),
      tx('venta', { kind: 'income', category: 'sales', amount: 25000, date: '2026-10-12' }),
      tx('cobro', { kind: 'income', category: 'sales', amount: 4000, status: 'pending', date: '2026-10-15' }),
      tx('hosting', { projectId: undefined, category: 'services', amount: 900, date: '2026-10-01' }),
      tx('cancelado', { amount: 99999, status: 'cancelled' }),
      tx('otro', { projectId: 'q', category: 'assets', amount: 2000, date: '2025-12-20' }),
      tx('tasa-suelta', { category: 'fees', amount: 300, date: '2026-08-01' }),
    ],
    budgets: [budget('octubre', { amount: 2000, projectId: 'p' }), budget('eventos', { category: 'events', amount: 20000 }), budget('viejo', { from: '2025-01-01', to: '2025-12-31' }), budget('futuro', { from: '2027-01-01', to: '2027-03-31' })],
    ...over,
  }
}

describe('finanzas: los datos de prueba', () => {
  it('son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })
})

describe('financeMovements y financeTotals', () => {
  it('filtra por periodo, ámbito, tipo, categoría, estado y etiqueta, del más reciente al más antiguo', () => {
    const d = data()
    expect(financeMovements(d, { from: '2026-10-01', to: '2026-10-31', kind: 'income' }).map((t) => t.id)).toEqual(['cobro', 'venta'])
    expect(financeMovements(d, { scope: 'q' }).map((t) => t.id)).toEqual(['otro'])
    expect(financeMovements(d, { category: 'fees', status: 'done' }).map((t) => t.id)).toEqual(['tasa', 'tasa-suelta'])
    expect(financeMovements(d, { tag: 'Godot' }).map((t) => t.id)).toEqual(['licencia'])
  })

  it('solo cuenta lo hecho; lo previsto y lo pendiente van aparte y lo cancelado no suma', () => {
    const r = financeTotals(data(), { from: '2026-10-01', to: '2026-10-31' })
    // Gastos hechos de octubre: licencia 1200 + stand 30000 + hosting 900 (el cancelado no).
    expect(r.expense).toEqual({ done: 32100, planned: 0, pending: 0, count: 3 })
    expect(r.income).toEqual({ done: 25000, planned: 0, pending: 4000, count: 2 })
    expect(r.balance).toBe(25000 - 32100)
    expect(r.upcomingBalance).toBe(4000)
    expect(r.doneCount).toBe(4)
    expect(r.cancelled).toBe(1)
  })

  it('sin movimientos, no hay nada hecho (doneCount 0) en vez de cifras', () => {
    const r = financeTotals(data(), { from: '2030-01-01', to: '2030-01-31' })
    expect(r.doneCount).toBe(0)
    expect(r.expense.count + r.income.count).toBe(0)
  })

  it('con un proyecto, los «sin proyecto» no entran', () => {
    expect(financeTotals(data(), { scope: 'p', from: '2026-10-01', to: '2026-10-31' }).expense.done).toBe(31200)
  })
})

describe('financeUpcoming, financeMonths y financeIsLate', () => {
  it('lo previsto y lo pendiente, del más cercano al más lejano', () => {
    expect(financeUpcoming(data()).map((t) => t.id)).toEqual(['cobro', 'viaje'])
  })

  it('los meses con movimientos, del más reciente al más antiguo', () => {
    expect(financeMonths(data(), { kind: 'income' })).toEqual(['2026-10'])
    expect(financeMonths(data(), { scope: 'q' })).toEqual(['2025-12'])
  })

  it('un pendiente con la fecha pasada está atrasado; uno hecho, no', () => {
    expect(financeIsLate(tx('a', { status: 'pending', date: '2026-10-01' }), TODAY)).toBe(true)
    expect(financeIsLate(tx('a', { status: 'planned', date: TODAY }), TODAY)).toBe(false)
    expect(financeIsLate(tx('a', { status: 'done', date: '2026-10-01' }), TODAY)).toBe(false)
  })
})

describe('financeByCategory y financeByProject', () => {
  it('por categoría, de la que más mueve a la que menos (sin las que solo tienen cancelados)', () => {
    const d = data({ transactions: [...data().transactions, tx('solo-cancelado', { category: 'taxes', status: 'cancelled' })] })
    const r = financeByCategory(d, { from: '2026-10-01', to: '2026-10-31' })
    expect(r.map((g) => g.key)).toEqual(['events', 'sales', 'software', 'services'])
    expect(r.find((g) => g.key === 'sales')!.income).toEqual({ done: 25000, planned: 0, pending: 4000, count: 2 })
  })

  it('por proyecto, en el orden de los proyectos y los «sin proyecto» al final', () => {
    const r = financeByProject(data())
    expect(r.map((g) => g.key)).toEqual(['p', 'q', null])
    expect(r[0].expense.done).toBe(1200 + 30000 + 5000 + 300)
    expect(r[0].income.done).toBe(25000)
    expect(r[2].expense.done).toBe(900)
  })

  it('con un proyecto, solo el suyo', () => {
    expect(financeByProject(data(), { scope: 'q' }).map((g) => g.key)).toEqual(['q'])
  })
})

describe('financeEventCosts y compañía', () => {
  it('agrupa por evento y separa tasas, gastos del evento, otros y lo previsto', () => {
    const [feria] = financeEventCosts(data())
    expect(feria.eventId).toBe('feria')
    expect(feria.event?.title).toBe('feria')
    expect(feria).toMatchObject({ fees: 5000, costs: 30000, other: 0, spent: 35000, upcoming: 8000, income: 0 })
    expect(feria.transactions.map((t) => t.id)).toEqual(['viaje', 'stand', 'tasa'])
  })

  it('con un periodo, solo los movimientos de ese periodo', () => {
    const [feria] = financeEventCosts(data(), { from: '2026-10-01', to: '2026-10-31' })
    expect(feria).toMatchObject({ fees: 0, costs: 30000, spent: 30000, upcoming: 0 })
  })

  it('un gasto sin proyecto cuenta en el proyecto de su evento', () => {
    const d = data({ transactions: [tx('suelto', { projectId: undefined, eventId: 'feria', category: 'fees' })] })
    expect(financeEventCosts(d, { scope: 'p' }).map((c) => c.eventId)).toEqual(['feria'])
    expect(financeEventCosts(d, { scope: 'q' })).toEqual([])
  })

  it('un evento borrado se sigue viendo (sin evento)', () => {
    const d = data({ events: [] })
    expect(financeEventCosts(d)[0].event).toBeUndefined()
  })

  it('los gastos de eventos sin evento enlazado (las tasas sueltas no: pueden no ser de un evento)', () => {
    const d = data({ transactions: [...data().transactions, tx('cartel', { category: 'events', date: '2026-07-01' })] })
    expect(financeUnlinkedEventCosts(d).map((t) => t.id)).toEqual(['cartel'])
  })

  it('los eventos del sector sin ningún movimiento (sin reuniones ni cancelados)', () => {
    const d = data({ events: [...data().events, event('cancelada', { status: 'cancelled' })] })
    expect(financeEventsWithoutCosts(d).map((e) => e.id)).toEqual(['premio'])
    expect(financeEventsWithoutCosts(d, 'p')).toEqual([])
  })
})

describe('presupuestos', () => {
  it('budgetUsage sigue igual: gastado hecho y previsto aparte', () => {
    const u = budgetUsage(data(), budget('octubre', { amount: 2000, projectId: 'p' }))
    // licencia 1200 + stand 30000 (de p, del periodo); el viaje (previsto) va aparte.
    expect(u).toMatchObject({ spent: 31200, planned: 8000, left: 2000 - 31200, over: true })
  })

  it('en curso, próximos, terminados y superados', () => {
    const r = financeBudgets(data(), TODAY)
    expect(r.active.map((u) => u.budget.id)).toEqual(['octubre', 'eventos'])
    expect(r.upcoming.map((u) => u.budget.id)).toEqual(['futuro'])
    expect(r.past.map((u) => u.budget.id)).toEqual(['viejo'])
    expect(r.over.map((u) => u.budget.id)).toEqual(['octubre', 'eventos'])
  })

  it('con un proyecto, solo sus presupuestos', () => {
    expect(financeBudgets(data(), TODAY, 'p').active.map((u) => u.budget.id)).toEqual(['octubre'])
  })

  it('los que se solapan con un periodo', () => {
    expect(financeBudgetsInPeriod(data(), '2025-12-01', '2025-12-31').map((u) => u.budget.id)).toEqual(['viejo'])
    expect(financeBudgetsInPeriod(data(), '2026-10-01', '2026-10-31').map((u) => u.budget.id)).toEqual(['eventos', 'octubre'])
  })

  it('budgetRatio no divide entre cero', () => {
    expect(budgetRatio({ budget: budget('b', { amount: 0 }), spent: 0, planned: 0, left: 0, over: false })).toBe(0)
    expect(budgetRatio({ budget: budget('b', { amount: 0 }), spent: 5, planned: 0, left: -5, over: true })).toBe(1)
    expect(budgetRatio({ budget: budget('b', { amount: 200 }), spent: 50, planned: 0, left: 150, over: false })).toBe(0.25)
  })
})

describe('periodos', () => {
  it('financeAddMonths lleva al último día si el mes es más corto', () => {
    expect(financeAddMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(financeAddMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(financeAddMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(financeAddMonths('2026-01-15', -1)).toBe('2025-12-15')
    expect(financeAddMonths('2026-05-31', -3)).toBe('2026-02-28')
  })

  it('un mes natural (por defecto, el de hoy)', () => {
    expect(financePeriodRange(null, null, TODAY)).toMatchObject({ period: 'mes', from: '2026-10-01', to: '2026-10-31', prev: '2026-09-01', next: '2026-11-01', key: '2026-10' })
    expect(financePeriodRange('mes', '2024-02-10', TODAY)).toMatchObject({ from: '2024-02-01', to: '2024-02-29', key: '2024-02' })
  })

  it('un trimestre natural', () => {
    expect(financePeriodRange('trimestre', '2026-11-30', TODAY)).toMatchObject({
      from: '2026-10-01',
      to: '2026-12-31',
      prev: '2026-07-01',
      next: '2027-01-01',
      key: '2026-T4',
      index: 4,
    })
    expect(financePeriodRange('trimestre', '2026-01-01', TODAY)).toMatchObject({ from: '2026-01-01', to: '2026-03-31', prev: '2025-10-01', key: '2026-T1' })
  })

  it('un año natural', () => {
    expect(financePeriodRange('año', '2025-06-01', TODAY)).toMatchObject({ from: '2025-01-01', to: '2025-12-31', prev: '2024-01-01', next: '2026-01-01', key: '2025' })
  })

  it('un periodo o una fecha que no valen: el mes de hoy', () => {
    expect(financePeriodRange('semana', '2026-13-45', TODAY)).toMatchObject({ period: 'mes', from: '2026-10-01', to: '2026-10-31' })
  })

  it('financeMonthRange', () => {
    expect(financeMonthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(financeMonthRange('2026-13')).toBeNull()
    expect(financeMonthRange('octubre')).toBeNull()
    expect(financeMonthRange(null)).toBeNull()
  })
})

describe('financeNextMonthCopy', () => {
  it('igual, un mes después, previsto, por confirmar, sin id y con la fuente dada', () => {
    const original = tx('a', { date: '2026-01-31', tags: ['x'], eventId: 'feria', originalAmount: 1100, originalCurrency: 'USD' })
    const sources = [{ type: 'manual' as const, ref: 'Duplicado' }]
    const copy = financeNextMonthCopy(original, sources)
    expect(copy).not.toHaveProperty('id')
    expect(copy).toMatchObject({ date: '2026-02-28', status: 'planned', confidence: 'to_confirm', sources, amount: 1000, tags: ['x'], eventId: 'feria', originalAmount: 1100 })
    expect(original.status).toBe('done')
  })
})

describe('CSV', () => {
  it('importes en unidades con coma decimal y 2 decimales, sin miles', () => {
    expect(csvAmount(123450)).toBe('1234,50')
    expect(csvAmount(5)).toBe('0,05')
    expect(csvAmount(0)).toBe('0,00')
    expect(csvAmount(-1999)).toBe('-19,99')
  })

  it('comillas, separadores, saltos de línea y fórmulas', () => {
    expect(csvField('Licencia')).toBe('Licencia')
    expect(csvField('Stand; Valladolid')).toBe('"Stand; Valladolid"')
    expect(csvField('El «pack» "deluxe"')).toBe('"El «pack» ""deluxe"""')
    expect(csvField('dos\nlíneas')).toBe('"dos\nlíneas"')
    expect(csvField(' espacio')).toBe('" espacio"')
    expect(csvField('=SUMA(A1)')).toBe("'=SUMA(A1)")
    expect(csvField('-12,00')).toBe('-12,00')
  })

  it('csvLines separa con «;» y termina cada línea con CRLF', () => {
    expect(csvLines([['a', 'b'], ['c;d', 'e']])).toBe('a;b\r\n"c;d";e\r\n')
  })

  it('financeToCSV: BOM, cabecera y una fila por movimiento con sus nombres', () => {
    const d = data()
    const rows = [d.transactions.find((t) => t.id === 'stand')!, d.transactions.find((t) => t.id === 'hosting')!]
    const csv = financeToCSV(d, rows, 'EUR')
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Fecha;Tipo;Concepto;Categoría;Proyecto;Evento;Estado;Importe;Moneda;Fiabilidad;Etiquetas')
    expect(lines[1]).toBe('2026-10-10;Gasto;stand;Eventos y ferias;P;feria;Hecho;300,00;EUR;Verificado;')
    expect(lines[2]).toBe('2026-10-01;Gasto;hosting;Servicios;Sin proyecto;;Hecho;9,00;EUR;Verificado;')
    expect(lines[3]).toBe('')
  })

  it('el nombre del fichero lleva el periodo (y el proyecto, si lo hay)', () => {
    expect(financeCSVName(financePeriodRange('mes', '2026-10-05', TODAY))).toBe('finanzas-2026-10.csv')
    expect(financeCSVName(financePeriodRange('trimestre', '2026-10-05', TODAY), 'indie-dev-tycoon')).toBe('finanzas-indie-dev-tycoon-2026-T4.csv')
    expect(financeCSVName(financePeriodRange('año', '2026-10-05', TODAY))).toBe('finanzas-2026.csv')
  })
})
