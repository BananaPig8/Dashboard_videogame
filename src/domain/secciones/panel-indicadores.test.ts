import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import {
  KPI_AHEAD_DAYS,
  PANEL_KPI_IDS,
  panelGreeting,
  panelKpis,
  periodRange,
  type PanelKpi,
  type PanelKpiId,
} from '../selectors'
import { SCHEMA_VERSION, type Build, type StudioData, type StudioEvent, type WorkItem } from '../types'
import { validateStudioData } from '../validate'

const TODAY = '2026-10-19'
// Últimos 7 días: del 13 al 19 de octubre; el anterior, del 6 al 12.
const WEEK = periodRange('7d', TODAY)
const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string, status = 'desarrollo') => ({
  id,
  slug: id,
  name: id,
  description: '',
  platforms: [],
  status,
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
const event = (id: string, over: Partial<StudioEvent> = {}): StudioEvent => ({
  id,
  title: id,
  type: 'fair',
  status: 'planned',
  dateConfirmed: true,
  sources: src,
  confidence: 'verified',
  ...over,
})
const build = (id: string, over: Partial<Build> = {}): Build => ({
  id,
  projectId: 'a',
  name: id,
  version: '1.0',
  channel: 'demo',
  platforms: [],
  status: 'ready',
  sources: src,
  confidence: 'verified',
  ...over,
})

function base(): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
  }
}

function data(): StudioData {
  return {
    ...base(),
    projects: [project('a'), project('b'), project('idea', 'idea'), project('fuera', 'lanzado')],
    items: [
      item('abierta', { createdAt: '2026-09-01' }),
      item('vencida', { dueDate: '2026-10-10' }),
      item('con-fecha', { dueDate: '2026-11-30' }),
      item('bloqueada', { status: 'blocked', projectId: 'b' }),
      // Terminada con la fecha límite pasada: no es una vencida.
      item('hecha-tarde', { status: 'done', dueDate: '2026-10-01', completedAt: '2026-10-13' }),
      item('hecha-hoy', { status: 'done', completedAt: TODAY }),
      item('hecha-antes', { status: 'done', completedAt: '2026-10-12' }),
      item('hecha-mucho-antes', { status: 'done', completedAt: '2026-10-05' }),
      item('cancelada', { status: 'cancelled', completedAt: '2026-10-15' }),
      // Los objetivos no son tareas.
      item('objetivo', { kind: 'goal', dueDate: '2026-10-01' }),
      item('hito-pronto', { kind: 'milestone', dueDate: '2026-10-25', createdAt: '2026-09-15' }),
      item('hito-hoy', { kind: 'milestone', dueDate: TODAY }),
      item('hito-lejos', { kind: 'milestone', dueDate: '2027-01-15' }),
      item('hito-vencido', { kind: 'milestone', dueDate: '2026-10-01' }),
      item('hito-sin-fecha', { kind: 'milestone' }),
      item('hito-hecho', { kind: 'milestone', status: 'done', completedAt: '2026-10-14', dueDate: '2026-10-30' }),
      item('hito-otro', { kind: 'milestone', projectId: 'b', dueDate: '2026-10-20' }),
    ],
    events: [
      // Del estudio: cuenta también en cada proyecto.
      event('feria', { date: '2026-10-28', dateConfirmed: false }),
      event('festival', { projectId: 'a', date: '2026-11-10' }),
      event('en-curso', { projectId: 'b', date: '2026-10-17', endDate: '2026-10-21' }),
      event('lejos', { date: '2026-12-31' }),
      event('cancelada', { date: '2026-10-22', status: 'cancelled' }),
      event('hecha', { date: '2026-10-20', status: 'done' }),
      event('sin-fecha', { status: 'idea', dateConfirmed: false }),
      event('pasada', { date: '2026-10-01', status: 'confirmed' }),
      // Una reunión no es un evento del sector (Eventos no la enseña: está en el Calendario).
      event('reunion', { type: 'meeting', date: '2026-10-21' }),
    ],
    builds: [
      build('hoy', { date: TODAY }),
      build('semana', { date: '2026-10-13', status: 'superseded' }),
      build('anterior', { date: '2026-10-06' }),
      build('vieja', { date: '2026-09-01', projectId: 'b' }),
      build('sin-fecha'),
    ],
    feedback: [
      { id: 'f1', projectId: 'a', title: 'Nuevo', origin: 'playtest', status: 'new', impact: 'high', linkedItemIds: [], sources: src, confidence: 'verified' },
      { id: 'f2', projectId: 'b', title: 'Nuevo', origin: 'playtest', status: 'new', impact: 'low', linkedItemIds: [], sources: src, confidence: 'verified' },
      { id: 'f3', projectId: 'a', title: 'Visto', origin: 'event', status: 'triaged', impact: 'low', linkedItemIds: [], sources: src, confidence: 'verified' },
    ],
  }
}

const all = (d: StudioData, scope: string | null = null, period = WEEK) => panelKpis(d, { scope, today: TODAY, period, ids: PANEL_KPI_IDS })
const one = (list: PanelKpi[], id: PanelKpiId) => list.find((k) => k.id === id)!

describe('panel: indicadores', () => {
  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })

  it('cuenta cada cifra con los datos', () => {
    const k = all(data())
    expect(one(k, 'activeProjects')).toMatchObject({ value: 2, of: 4 })
    // Tareas, hitos, decisiones e incidencias abiertas (sin objetivos): 3 tareas, la bloqueada y 6 hitos.
    expect(one(k, 'pending')).toMatchObject({ value: 10, tone: 'neutral' })
    expect(one(k, 'overdue')).toMatchObject({ value: 2, tone: 'danger' })
    expect(one(k, 'blocked')).toMatchObject({ value: 1, tone: 'danger', of: 10 })
    expect(one(k, 'feedbackNew')).toMatchObject({ value: 2, tone: 'warning', of: 3 })
  })

  it('lo terminado no está vencido y lo cancelado no está completado', () => {
    const k = all(data())
    // Vencidas: la tarea y el hito vencidos; no la terminada tarde.
    expect(one(k, 'overdue').value).toBe(2)
    // Completadas en la semana: la de hoy, la del día 13 y el hito del 14 (no la cancelada del 15).
    expect(one(k, 'completed').value).toBe(3)
  })

  it('compara con el periodo anterior solo lo que pasa en un periodo', () => {
    const k = all(data())
    // El 12 está en el anterior (del 6 al 12); el 5, en ninguno de los dos.
    expect(one(k, 'completed')).toMatchObject({ value: 3, previous: 1 })
    expect(one(k, 'milestonesDone')).toMatchObject({ value: 1, previous: 0 })
    expect(one(k, 'recentBuilds')).toMatchObject({ value: 2, previous: 1 })
    for (const id of ['activeProjects', 'pending', 'overdue', 'blocked', 'milestonesSoon', 'eventsSoon', 'feedbackNew'] as const) {
      expect(one(k, id).previous).toBeUndefined()
    }
  })

  it('no compara si no hay datos de antes de que acabe el periodo anterior', () => {
    const d = { ...base(), projects: [project('a')], items: [item('nueva', { status: 'done', createdAt: '2026-10-15', completedAt: '2026-10-16' })], builds: [build('b', { date: '2026-10-14' })] }
    const k = all(d)
    expect(one(k, 'completed')).toMatchObject({ value: 1, previous: undefined })
    expect(one(k, 'recentBuilds')).toMatchObject({ value: 1, previous: undefined })
    // Con un registro del periodo anterior, ya se compara (y el anterior puede ser 0 de verdad).
    d.items.push(item('vieja', { createdAt: '2026-10-01' }))
    expect(one(all(d), 'completed')).toMatchObject({ value: 1, previous: 0 })
  })

  it('los bordes del periodo cuentan (los dos días incluidos)', () => {
    const d = { ...base(), projects: [project('a')], items: [
      item('primer-dia', { status: 'done', completedAt: WEEK.from }),
      item('ultimo-dia', { status: 'done', completedAt: WEEK.to }),
      item('dia-antes', { status: 'done', completedAt: '2026-10-12' }),
      item('con-hora', { status: 'done', completedAt: '2026-10-13T23:30' }),
    ] }
    expect(WEEK).toMatchObject({ from: '2026-10-13', to: TODAY, days: 7 })
    expect(one(all(d), 'completed')).toMatchObject({ value: 3, previous: 1 })
    // Hoy: solo el último día; el anterior es ayer.
    const hoy = periodRange('hoy', TODAY)
    expect(one(all(d, null, hoy), 'completed')).toMatchObject({ value: 1, previous: 0 })
    // Personalizado: sus fechas.
    const custom = periodRange('personalizado', TODAY, { from: '2026-10-12', to: '2026-10-13' })
    expect(one(all(d, null, custom), 'completed')).toMatchObject({ value: 3 })
  })

  it('el personalizado no acaba después de hoy (lo que no ha pasado no se cuenta)', () => {
    expect(periodRange('personalizado', TODAY, { from: '2026-10-15', to: '2026-11-30' })).toMatchObject({ from: '2026-10-15', to: TODAY, days: 5 })
    // Al revés y en el futuro: se ordenan y se recortan; las dos futuras, hoy.
    expect(periodRange('personalizado', TODAY, { from: '2026-11-30', to: '2026-11-10' })).toMatchObject({ from: TODAY, to: TODAY, days: 1 })
    expect(periodRange('personalizado', TODAY, { to: '2026-12-01' })).toMatchObject({ from: TODAY, to: TODAY, days: 1 })
    // Una build en preparación con fecha futura no cuenta como reciente.
    const d = { ...base(), projects: [project('a')], builds: [build('futura', { date: '2026-11-20', status: 'in_progress' }), build('pasada', { date: '2026-10-01' })] }
    expect(one(all(d, null, periodRange('personalizado', TODAY, { from: '2026-11-10', to: '2026-11-30' })), 'recentBuilds').value).toBe(0)
  })

  it('hitos próximos: abiertos con fecha límite entre hoy y dentro de 30 días', () => {
    const k = one(all(data()), 'milestonesSoon')
    // El de hoy, el del 25 y el del otro proyecto (20); ni el lejano, ni el vencido, ni el hecho.
    expect(k.value).toBe(3)
    expect(k.notes).toEqual([
      { kind: 'overdue', n: 1 },
      { kind: 'undated', n: 1 },
    ])
    const limit = { ...base(), projects: [project('a')], items: [item('borde', { kind: 'milestone', dueDate: '2026-11-17' }), item('fuera', { kind: 'milestone', dueDate: '2026-11-18' })] }
    expect(KPI_AHEAD_DAYS).toBe(30)
    expect(one(all(limit), 'milestonesSoon').value).toBe(1)
  })

  it('próximos eventos: los del sector por delante (los de Eventos › Próximos), y cuántos sin fecha confirmada', () => {
    const k = one(all(data()), 'eventsSoon')
    // La feria (sin confirmar), el festival, el que está en curso y el lejano; ni el pasado, ni el
    // cancelado, ni el hecho, ni la reunión.
    expect(k.value).toBe(4)
    expect(k.notes).toEqual([
      { kind: 'unconfirmed', n: 1 },
      { kind: 'undated', n: 1 },
    ])
    // En un proyecto: los suyos y los del estudio.
    expect(one(all(data(), 'b'), 'eventsSoon').value).toBe(3)
    // Solo con reuniones y entregas, no hay eventos que contar.
    const meetings = { ...base(), projects: [project('a')], events: [event('reunion', { type: 'meeting', date: '2026-10-21' }), event('entrega', { type: 'deadline', date: '2026-10-22' })] }
    expect(one(all(meetings), 'eventsSoon')).toMatchObject({ value: null, empty: 'noEvents' })
  })

  it('builds recientes: con fecha en el periodo, de cualquier estado; avisa de las que no tienen fecha', () => {
    expect(one(all(data()), 'recentBuilds').notes).toEqual([{ kind: 'undated', n: 1 }])
  })

  it('en un proyecto: sin «Proyectos activos» y con lo suyo', () => {
    const k = all(data(), 'b')
    expect(k.map((x) => x.id)).not.toContain('activeProjects')
    expect(one(k, 'pending').value).toBe(2)
    expect(one(k, 'blocked').value).toBe(1)
    // Tiene abiertas, pero ninguna con fecha límite… salvo su hito: la cifra es 0 de 1, y es cierta.
    expect(one(k, 'overdue')).toMatchObject({ value: 0, of: 1, tone: 'neutral' })
    expect(one(k, 'feedbackNew').value).toBe(1)
  })

  it('en todo el estudio no cuenta lo de los proyectos archivados; en su ficha, sí', () => {
    const d = data()
    d.projects.push(project('archivado', 'archivado'))
    d.items.push(
      item('vieja-critica', { projectId: 'archivado', priority: 'critical', dueDate: '2026-10-01' }),
      item('vieja-bloqueada', { projectId: 'archivado', status: 'blocked' }),
      item('vieja-hecha', { projectId: 'archivado', status: 'done', completedAt: TODAY }),
      item('viejo-hito', { projectId: 'archivado', kind: 'milestone', dueDate: '2026-10-22' }),
    )
    d.events.push(event('vieja-feria', { projectId: 'archivado', date: '2026-10-30' }))
    d.builds.push(build('vieja-build', { projectId: 'archivado', date: TODAY }))
    d.feedback.push({ id: 'f4', projectId: 'archivado', title: 'Nuevo', origin: 'playtest', status: 'new', impact: 'low', linkedItemIds: [], sources: src, confidence: 'verified' })
    const before = all(data())
    const k = all(d)
    for (const id of ['pending', 'completed', 'overdue', 'blocked', 'milestonesSoon', 'eventsSoon', 'recentBuilds', 'feedbackNew'] as const) {
      expect([id, one(k, id).value]).toEqual([id, one(before, id).value])
    }
    // «Proyectos activos» sigue contando solo los activos (y sobre todos los proyectos).
    expect(one(k, 'activeProjects')).toMatchObject({ value: 2, of: 5 })
    const own = all(d, 'archivado')
    expect(one(own, 'pending').value).toBe(3)
    expect(one(own, 'overdue').value).toBe(1)
    expect(one(own, 'feedbackNew').value).toBe(1)
  })

  it('solo calcula las pedidas, en su orden', () => {
    const k = panelKpis(data(), { today: TODAY, period: WEEK, ids: ['feedbackNew', 'overdue'] })
    expect(k.map((x) => x.id)).toEqual(['feedbackNew', 'overdue'])
    expect(panelKpis(data(), { today: TODAY, period: WEEK, ids: [] })).toEqual([])
  })

  describe('sin datos suficientes: «—» con el motivo, nunca un 0 que engañe', () => {
    it('sin nada', () => {
      const k = all(base())
      expect(k.every((x) => x.value === null)).toBe(true)
      expect(Object.fromEntries(k.map((x) => [x.id, x.empty]))).toEqual({
        activeProjects: 'noProjects',
        pending: 'noTasks',
        completed: 'noTasks',
        overdue: 'noTasks',
        blocked: 'noTasks',
        milestonesSoon: 'noMilestones',
        milestonesDone: 'noMilestones',
        eventsSoon: 'noEvents',
        recentBuilds: 'noBuilds',
        feedbackNew: 'noFeedback',
      })
    })

    it('sin tareas abiertas o sin fechas límite', () => {
      const closed = { ...base(), projects: [project('a')], items: [item('hecha', { status: 'done', completedAt: '2026-09-01' })] }
      expect(one(all(closed), 'overdue').empty).toBe('noOpenTasks')
      expect(one(all(closed), 'blocked').empty).toBe('noOpenTasks')
      // Hay tareas (todas cerradas): «0 pendientes» y «0 completadas esta semana» son ciertos.
      expect(one(all(closed), 'pending')).toMatchObject({ value: 0, of: 1 })
      expect(one(all(closed), 'completed')).toMatchObject({ value: 0, previous: 0 })
      const undated = { ...base(), projects: [project('a')], items: [item('sin-fecha')] }
      expect(one(all(undated), 'overdue').empty).toBe('noDueDates')
      // Abiertas y ninguna terminada: «0 completadas» sí es cierto.
      expect(one(all(undated), 'completed')).toMatchObject({ value: 0 })
      expect(one(all(undated), 'blocked')).toMatchObject({ value: 0, of: 1 })
    })

    it('hitos, eventos y builds sin fecha', () => {
      const d = {
        ...base(),
        projects: [project('a')],
        items: [item('hito', { kind: 'milestone' })],
        events: [event('sin-fecha', { status: 'planned', dateConfirmed: false })],
        builds: [build('sin-fecha')],
      }
      const k = all(d)
      expect(one(k, 'milestonesSoon')).toMatchObject({ value: null, empty: 'noMilestoneDates', notes: [{ kind: 'undated', n: 1 }] })
      expect(one(k, 'eventsSoon')).toMatchObject({ value: null, empty: 'noEventDates', notes: [{ kind: 'undated', n: 1 }] })
      expect(one(k, 'recentBuilds')).toMatchObject({ value: null, empty: 'noBuildDates', notes: [{ kind: 'undated', n: 1 }] })
      const closed = { ...d, items: [item('hito', { kind: 'milestone', status: 'done', completedAt: '2026-10-14' })] }
      expect(one(all(closed), 'milestonesSoon').empty).toBe('noOpenMilestones')
      expect(one(all(closed), 'milestonesDone').value).toBe(1)
    })
  })
})

describe('panel: saludo', () => {
  it('por la hora del estudio', () => {
    expect(panelGreeting('05:59')).toBe('night')
    expect(panelGreeting('06:00')).toBe('morning')
    expect(panelGreeting('13:59')).toBe('morning')
    expect(panelGreeting('14:00')).toBe('afternoon')
    expect(panelGreeting('20:59')).toBe('afternoon')
    expect(panelGreeting('21:00')).toBe('night')
    expect(panelGreeting('00:00')).toBe('night')
  })
})
