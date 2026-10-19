import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type StudioData, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import {
  DEFAULT_TASK_COLUMNS,
  TASK_NOBODY,
  compareTasks,
  filterTasks,
  myTasks,
  taskAssignee,
  taskBoard,
  taskBoardColumns,
  taskCalendarEntries,
  taskFilterOf,
  taskItems,
  taskMonth,
  taskOverdue,
  taskPeople,
  taskTodayPlan,
  undatedTasks,
} from '../selectors'

const TODAY = '2026-10-19'
const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string) => ({ id, slug: id, name: id, description: '', platforms: [], stage: 'production' as const, color: '#000', versions: [], tags: [], links: [] })
const item = (id: string, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  projectId: 'p',
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
    areas: [{ id: 'ux', name: 'UX', color: '#000' }],
    projects: [project('p'), project('q')],
    members: [
      { id: 'ana', name: 'Ana', kind: 'core', areaIds: [], active: true },
      { id: 'bea', name: 'Bea', kind: 'external', areaIds: [], active: false },
      { id: 'carlos', name: 'Carlos', kind: 'core', areaIds: [], active: true },
    ],
    items: [
      item('mia', { assigneeId: 'ana', status: 'in_progress', priority: 'high', areaId: 'ux', tags: ['demo'] }),
      item('bloqueada', { status: 'blocked', blockedReason: 'Falta la cuenta', assigneeId: 'carlos', priority: 'critical' }),
      item('vencida', { dueDate: '2026-10-10', assigneeId: 'ana' }),
      item('vence-hoy', { dueDate: TODAY, kind: 'issue' }),
      item('futura', { dueDate: '2026-10-28', kind: 'feature', confidence: 'to_confirm' }),
      item('hecha', { status: 'done', completedAt: '2026-10-01', dueDate: '2026-10-05', assigneeId: 'ana' }),
      item('cancelada', { status: 'cancelled', completedAt: '2026-09-01' }),
      item('objetivo', { kind: 'goal', dueDate: '2026-10-01' }),
      item('otra', { projectId: 'q', assigneeId: 'ana', status: 'planned', focusDate: TODAY }),
      item('idea', { status: 'idea', kind: 'decision' }),
    ],
  }
}

const ids = (list: { id: string }[]) => list.map((i) => i.id).sort()

describe('tareas', () => {
  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })

  it('taskItems deja fuera los objetivos y respeta el ámbito', () => {
    expect(ids(taskItems(data()))).not.toContain('objetivo')
    expect(taskItems(data()).length).toBe(9)
    expect(ids(taskItems(data(), 'q'))).toEqual(['otra'])
  })

  it('taskFilterOf lee el filtro y traduce el antiguo ?estado=blocked', () => {
    expect(taskFilterOf('mias')).toBe('mias')
    expect(taskFilterOf('inventado')).toBeNull()
    expect(taskFilterOf(null, 'blocked')).toBe('bloqueadas')
    expect(taskFilterOf('vencidas', 'blocked')).toBe('vencidas')
    expect(taskFilterOf(null, 'done')).toBeNull()
  })

  it('taskOverdue: abierta y con la fecha límite pasada', () => {
    const d = data()
    const get = (id: string) => d.items.find((i) => i.id === id)!
    expect(taskOverdue(get('vencida'), TODAY)).toBe(true)
    expect(taskOverdue(get('vence-hoy'), TODAY)).toBe(false)
    expect(taskOverdue(get('hecha'), TODAY)).toBe(false)
  })

  describe('filterTasks', () => {
    it('por defecto, las abiertas (sin objetivos)', () => {
      expect(ids(filterTasks(data(), { today: TODAY }))).toEqual(['bloqueada', 'futura', 'idea', 'mia', 'otra', 'vence-hoy', 'vencida'])
    })

    it('«Mis tareas» con meId y nada sin él', () => {
      expect(ids(filterTasks(data(), { today: TODAY, filtro: 'mias', meId: 'ana' }))).toEqual(['mia', 'otra', 'vencida'])
      expect(filterTasks(data(), { today: TODAY, filtro: 'mias' })).toEqual([])
      expect(ids(filterTasks(data(), { today: TODAY, filtro: 'mias', meId: 'ana', estado: 'todos' }))).toEqual(['hecha', 'mia', 'otra', 'vencida'])
    })

    it('«Bloqueadas» y «Vencidas»', () => {
      expect(ids(filterTasks(data(), { today: TODAY, filtro: 'bloqueadas' }))).toEqual(['bloqueada'])
      expect(ids(filterTasks(data(), { today: TODAY, filtro: 'vencidas' }))).toEqual(['vencida'])
      // Un objetivo vencido no es una tarea vencida… salvo que se pidan los objetivos.
      expect(ids(filterTasks(data(), { today: TODAY, filtro: 'vencidas', tipo: 'goal' }))).toEqual(['objetivo'])
    })

    it('se combinan con el ámbito y los filtros finos', () => {
      const d = data()
      expect(ids(filterTasks(d, { today: TODAY, filtro: 'mias', meId: 'ana', scope: 'p' }))).toEqual(['mia', 'vencida'])
      expect(ids(filterTasks(d, { today: TODAY, tipo: 'feature' }))).toEqual(['futura'])
      expect(ids(filterTasks(d, { today: TODAY, area: 'ux' }))).toEqual(['mia'])
      expect(ids(filterTasks(d, { today: TODAY, prioridad: 'critical' }))).toEqual(['bloqueada'])
      expect(ids(filterTasks(d, { today: TODAY, fiabilidad: 'to_confirm' }))).toEqual(['futura'])
      expect(ids(filterTasks(d, { today: TODAY, estado: 'done' }))).toEqual(['hecha'])
      expect(ids(filterTasks(d, { today: TODAY, etiqueta: 'DEMO' }))).toEqual(['mia'])
      expect(ids(filterTasks(d, { today: TODAY, q: 'cuenta' }))).toEqual(['bloqueada'])
    })

    it('por persona: un miembro o nadie', () => {
      expect(ids(filterTasks(data(), { today: TODAY, persona: 'carlos' }))).toEqual(['bloqueada'])
      expect(ids(filterTasks(data(), { today: TODAY, persona: TASK_NOBODY }))).toEqual(['futura', 'idea', 'vence-hoy'])
    })
  })

  it('myTasks: lo abierto que lleva una persona, ordenado', () => {
    expect(myTasks(data(), 'ana').map((i) => i.id)).toEqual(['mia', 'otra', 'vencida'])
    expect(myTasks(data(), 'ana', 'q').map((i) => i.id)).toEqual(['otra'])
    expect(myTasks(data(), undefined)).toEqual([])
  })

  it('compareTasks: estado, prioridad y fecha límite', () => {
    const sorted = filterTasks(data(), { today: TODAY }).sort(compareTasks)
    expect(sorted[0].id).toBe('mia')
    expect(sorted[1].id).toBe('bloqueada')
    // Mismo estado y prioridad: antes la que tiene fecha límite más cercana.
    const backlog = sorted.filter((i) => i.status === 'backlog').map((i) => i.id)
    expect(backlog).toEqual(['vencida', 'vence-hoy', 'futura'])
  })

  it('taskAssignee y taskPeople', () => {
    const d = data()
    expect(taskAssignee(d, d.items[0])?.name).toBe('Ana')
    expect(taskAssignee(d, d.items[3])).toBeUndefined()
    expect(taskPeople(d).map((m) => m.id)).toEqual(['ana', 'carlos', 'bea'])
  })

  describe('tablero', () => {
    it('columnas por defecto o las del estudio, sin repetir ni inventar estados', () => {
      expect(taskBoardColumns({}).map((c) => c.id)).toEqual(DEFAULT_TASK_COLUMNS.map((c) => c.id))
      const own = taskBoardColumns({ statusOrder: ['in_progress', 'done', 'in_progress', 'nada' as never] })
      expect(own).toEqual([
        { id: 'in_progress', statuses: ['in_progress'] },
        { id: 'done', statuses: ['done'] },
      ])
    })

    it('reparte por estado, limita las cerradas y dice qué se queda sin columna', () => {
      const d = data()
      const board = taskBoard(filterTasks(d, { today: TODAY, estado: 'todos' }), taskBoardColumns(d.studio), 1)
      const col = (id: string) => board.columns.find((c) => c.column.id === id)!
      expect(ids(col('ideas').items)).toEqual(['idea'])
      expect(ids(col('stopped').items)).toEqual(['bloqueada'])
      expect(col('done').total).toBe(1)
      expect(ids(board.hidden)).toEqual(['cancelada'])
    })
  })

  describe('calendario', () => {
    it('taskMonth: ?mes= válido o el de hoy', () => {
      expect(taskMonth('2026-12', TODAY)).toBe('2026-12-01')
      expect(taskMonth('2026-13', TODAY)).toBe('2026-10-01')
      expect(taskMonth(null, TODAY)).toBe('2026-10-01')
    })

    it('las fechas límite de las tareas dadas, sin las de otras colecciones', () => {
      const d = data()
      d.events = [{ id: 'e', title: 'Entrega', type: 'deadline', status: 'planned', date: '2026-10-15', dateConfirmed: true, sources: src, confidence: 'verified' }]
      const tasks = filterTasks(d, { today: TODAY, estado: 'todos' })
      const entries = taskCalendarEntries(d, tasks, '2026-10-01', '2026-10-31')
      expect(entries.map((e) => e.target.id)).toEqual(['hecha', 'vencida', 'vence-hoy', 'futura'])
      expect(entries.find((e) => e.target.id === 'hecha')?.done).toBe(true)
    })

    it('undatedTasks: lo abierto sin fecha límite', () => {
      expect(ids(undatedTasks(filterTasks(data(), { today: TODAY, estado: 'todos' })))).toEqual(['bloqueada', 'idea', 'mia', 'otra'])
    })
  })

  describe('plan de hoy', () => {
    it('lo que toca hoy, sin objetivos, y lo que se puede añadir', () => {
      const plan = taskTodayPlan(data(), TODAY)
      expect(plan.entries.map((e) => [e.item.id, e.reason])).toEqual([
        ['vencida', 'overdue'],
        ['vence-hoy', 'due'],
        ['otra', 'focus'],
        ['mia', 'in_progress'],
      ])
      expect(ids(plan.candidates)).toEqual(['futura'])
      expect(ids(plan.blocked)).toEqual(['bloqueada'])
    })

    it('«Solo lo mío» y el ámbito', () => {
      const mine = taskTodayPlan(data(), TODAY, null, 'ana')
      expect(ids(mine.entries.map((e) => e.item))).toEqual(['mia', 'otra', 'vencida'])
      expect(mine.blocked).toEqual([])
      expect(ids(taskTodayPlan(data(), TODAY, 'q').entries.map((e) => e.item))).toEqual(['otra'])
    })
  })
})
