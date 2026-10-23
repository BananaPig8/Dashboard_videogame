import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { PANEL_ALERT_KINDS, panelAlerts, panelEntriesByMonth, panelRecentDone, panelToConfirm, upcomingEntries } from '../selectors'
import { SCHEMA_VERSION, type StudioData, type WorkItem } from '../types'
import { validateStudioData } from '../validate'

const TODAY = '2026-10-19'
const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string) => ({
  id,
  slug: id,
  name: id,
  description: '',
  platforms: [],
  stage: 'production' as const,
  color: '#000',
  versions: [],
  tags: [],
  links: [],
})
const item = (id: string, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  projectId: 'a',
  kind: 'task',
  title: id,
  status: 'backlog',
  priority: 'medium',
  tags: [],
  sources: src,
  confidence: 'verified',
  ...over,
})

function data(): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('a'), project('b')],
    items: [
      item('vencida', { dueDate: '2026-10-10' }),
      item('hecha-1', { status: 'done', completedAt: '2026-10-12' }),
      item('hecha-2', { status: 'done', completedAt: '2026-10-15' }),
      item('hecha-b', { projectId: 'b', status: 'done', completedAt: '2026-10-18' }),
      item('limite', { dueDate: '2026-11-03' }),
    ],
    events: [
      // Del estudio: sale también en cada proyecto.
      {
        id: 'feria',
        title: 'Feria',
        type: 'fair',
        status: 'planned',
        date: '2026-10-28',
        dateConfirmed: false,
        registrationStatus: 'open',
        registrationDeadline: '2026-10-22',
        sources: src,
        confidence: 'to_confirm',
      },
    ],
    releases: [
      { id: 'demo', projectId: 'a', kind: 'demo', name: 'Demo', status: 'planned', targetDate: '2026-10-25', sources: src, confidence: 'to_confirm' },
      { id: 'parche', projectId: 'b', kind: 'patch', name: 'Parche', status: 'planned', targetDate: '2026-10-01', sources: src, confidence: 'to_confirm' },
    ],
    reminders: [
      { id: 'r-a', projectId: 'a', title: 'Revisar la build', date: TODAY, done: false },
      { id: 'r-hecho', title: 'Ya hecho', date: '2026-10-18', done: true },
    ],
    transactions: [
      {
        id: 't-estudio',
        kind: 'expense',
        category: 'events',
        description: 'Stand',
        amount: 50000,
        date: '2026-10-05',
        status: 'done',
        sources: src,
        confidence: 'verified',
      },
      {
        id: 't-b',
        kind: 'expense',
        projectId: 'b',
        category: 'assets',
        description: 'Música',
        amount: 30000,
        date: '2026-10-06',
        status: 'done',
        sources: src,
        confidence: 'verified',
      },
    ],
    budgets: [
      { id: 'p-estudio', name: 'Ferias', category: 'events', amount: 40000, from: '2026-01-01', to: '2026-12-31' },
      { id: 'p-b', name: 'Arte de B', projectId: 'b', amount: 20000, from: '2026-01-01', to: '2026-12-31' },
    ],
  }
}

describe('panel: avisos', () => {
  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })

  it('el bloque de atención solo añade los avisos que no salen en otro bloque', () => {
    const kinds = panelAlerts(data(), TODAY, null, PANEL_ALERT_KINDS).map((n) => n.kind)
    expect(kinds).not.toContain('overdue')
    expect(kinds).not.toContain('eventSoon')
    expect(new Set(kinds)).toEqual(new Set(['reminder', 'registrationSoon', 'releaseSoon', 'releaseLate', 'budgetOver']))
  })

  it('sin tipos, son todos los de la campana', () => {
    const kinds = panelAlerts(data(), TODAY).map((n) => n.kind)
    expect(kinds).toContain('overdue')
    expect(kinds).toContain('eventSoon')
  })

  it('en un proyecto: los suyos y los del estudio con fecha, pero no un presupuesto del estudio', () => {
    const ids = panelAlerts(data(), TODAY, 'a', PANEL_ALERT_KINDS).map((n) => n.target.id)
    expect(ids.sort()).toEqual(['demo', 'feria', 'r-a'])
    const b = panelAlerts(data(), TODAY, 'b', PANEL_ALERT_KINDS).map((n) => n.target.id)
    expect(b.sort()).toEqual(['feria', 'p-b', 'parche'])
  })
})

describe('panel: lo terminado', () => {
  it('de lo más reciente a lo más antiguo, y solo lo del ámbito', () => {
    expect(panelRecentDone(data()).map((i) => i.id)).toEqual(['hecha-b', 'hecha-2', 'hecha-1'])
    expect(panelRecentDone(data(), 'a').map((i) => i.id)).toEqual(['hecha-2', 'hecha-1'])
  })
})

describe('panel: por confirmar', () => {
  it('cuenta el estado como Tareas y aparte lo abierto con datos sin verificar', () => {
    const d = data()
    d.items.push(
      item('estado', { status: 'to_confirm' }),
      item('estado-dato', { status: 'to_confirm', confidence: 'to_confirm' }),
      item('dato', { status: 'in_progress', confidence: 'to_confirm' }),
      item('dato-hecho', { status: 'done', completedAt: '2026-10-01', confidence: 'to_confirm' }),
      item('dato-b', { projectId: 'b', confidence: 'to_confirm' }),
    )
    expect(panelToConfirm(d)).toEqual({ status: 2, unverified: 2 })
    expect(panelToConfirm(d, 'a')).toEqual({ status: 2, unverified: 1 })
    expect(panelToConfirm(data())).toEqual({ status: 0, unverified: 0 })
  })
})

describe('panel: próximas fechas', () => {
  it('salen del calendario unificado y se agrupan por mes', () => {
    const next = upcomingEntries(data(), TODAY, 60, 'a')
    expect(next.map((e) => e.id)).toEqual(['reminders:r-a:date', 'events:feria:registration', 'releases:demo:target', 'events:feria:date', 'items:limite:due'])
    const months = panelEntriesByMonth(next)
    expect(months.map((m) => [m.month, m.entries.length])).toEqual([
      ['2026-10', 4],
      ['2026-11', 1],
    ])
  })

  it('sin fechas, ningún mes', () => {
    expect(panelEntriesByMonth([])).toEqual([])
  })
})
