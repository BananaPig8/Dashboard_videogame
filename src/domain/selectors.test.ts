import { describe, expect, it } from 'vitest'
import { emptyCollections } from './collections'
import { addDays, daysBetween, startOfWeek, zonedParts } from './dates'
import {
  notificationsFor,
  blockedItems,
  currentBuilds,
  decisions,
  matchesQuery,
  projectSummary,
  staleEvents,
  todayItems,
  undatedEvents,
  weeklyEvolution,
} from './selectors'
import type { StudioData, WorkItem } from './types'
import { SCHEMA_VERSION } from './types'
import { validateStudioData } from './validate'

const TODAY = '2026-10-18'

const item = (over: Partial<WorkItem>): WorkItem => ({
  id: over.id ?? 'x',
  projectId: 'a',
  kind: 'task',
  title: 'Algo',
  status: 'backlog',
  priority: 'medium',
  tags: [],
  sources: [{ type: 'manual', ref: 'prueba' }],
  confidence: 'verified',
  ...over,
})

function fixture(): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    areas: [{ id: 'steam', name: 'Steam', color: '#000' }],
    projects: [
      { id: 'a', slug: 'a', name: 'Juego A', description: '', platforms: [], stage: 'production', color: '#f00', versions: [], tags: [], links: [] },
      { id: 'b', slug: 'b', name: 'Juego B', description: '', platforms: [], stage: 'paused', color: '#0f0', versions: [], tags: [], links: [] },
    ],
    items: [
      item({ id: 'vencida', dueDate: '2026-10-10', priority: 'high' }),
      item({ id: 'hoy', dueDate: TODAY }),
      item({ id: 'marcada', focusDate: TODAY }),
      item({ id: 'curso', status: 'in_progress' }),
      item({ id: 'revision', status: 'review', priority: 'high' }),
      item({ id: 'bloqueada', status: 'blocked', blockedReason: 'Falta el App ID', priority: 'critical', areaId: 'steam' }),
      item({ id: 'pausa', status: 'paused' }),
      item({ id: 'confirmar', status: 'to_confirm', priority: 'high' }),
      item({ id: 'hecha', status: 'done', completedAt: '2026-10-14' }),
      item({ id: 'decidida', kind: 'decision', status: 'done', completedAt: '2026-10-12', decisionOutcome: 'Sí' }),
      item({ id: 'abierta', kind: 'decision', status: 'to_confirm' }),
      item({ id: 'otro', projectId: 'b', status: 'in_progress' }),
    ],
    builds: [
      { id: 'b1', projectId: 'a', name: 'Demo', version: '1.0', channel: 'demo', platforms: [], status: 'superseded', date: '2026-10-01', sources: [], confidence: 'verified' },
      { id: 'b2', projectId: 'a', name: 'Demo', version: '1.1', channel: 'demo', platforms: [], status: 'published', date: '2026-10-10', sources: [], confidence: 'verified' },
      { id: 'b3', projectId: 'a', name: 'Juego', version: '0.1', channel: 'full', platforms: [], status: 'published', date: '2026-10-09', sources: [], confidence: 'verified' },
    ],
    events: [
      { id: 'e1', projectId: 'a', title: 'Feria', type: 'fair', status: 'confirmed', date: '2026-10-25', dateConfirmed: true, sources: [], confidence: 'verified' },
      { id: 'e2', projectId: 'a', title: 'Sin fecha', type: 'fair', status: 'planned', dateConfirmed: false, sources: [], confidence: 'to_confirm' },
      { id: 'e3', projectId: 'a', title: 'Pasada', type: 'fair', status: 'planned', date: '2026-10-01', dateConfirmed: true, sources: [], confidence: 'verified' },
      { id: 'e4', projectId: 'a', title: 'Lejana', type: 'fair', status: 'planned', date: '2027-03-01', dateConfirmed: true, sources: [], confidence: 'verified' },
    ],
    feedback: [],
    resources: [],
    checklists: [],
    activity: [
      { id: 'c1', projectId: 'a', at: '2026-10-14T10:00', type: 'commit', title: 'Uno', ref: 'aaaaaaa' },
      { id: 'c2', projectId: 'a', at: '2026-10-06T10:00', type: 'commit', title: 'Dos', ref: 'bbbbbbb' },
      { id: 'm1', projectId: 'a', at: '2026-10-06T11:00', type: 'merge', title: 'PR', ref: '#1' },
    ],
  }
}

describe('fechas', () => {
  it('suma días y cuenta la diferencia', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(daysBetween('2026-10-14', TODAY)).toBe(4)
    expect(startOfWeek(TODAY)).toBe('2026-10-12') // el 18 es domingo
    expect(startOfWeek(TODAY, 0)).toBe('2026-10-18') // si la semana empieza en domingo
  })

  it('calcula «hoy» en la zona horaria del estudio, no en la del navegador', () => {
    // 22:30 UTC del 17 de octubre: en Madrid (UTC+2) ya es día 18; en Nueva York, aún 17.
    const instant = new Date(Date.UTC(2026, 9, 17, 22, 30))
    expect(zonedParts(instant, 'Europe/Madrid')).toEqual({ date: '2026-10-18', time: '00:30' })
    expect(zonedParts(instant, 'America/New_York')).toEqual({ date: '2026-10-17', time: '18:30' })
  })
})

describe('qué toca hoy', () => {
  it('junta lo vencido, lo que vence hoy, lo marcado y lo que está en marcha, en ese orden', () => {
    const ids = todayItems(fixture(), TODAY, 'a').map((e) => [e.item.id, e.reason])
    expect(ids).toEqual([
      ['vencida', 'overdue'],
      ['hoy', 'due'],
      ['marcada', 'focus'],
      ['curso', 'in_progress'],
      ['revision', 'review'],
    ])
  })

  it('respeta el ámbito: todo el estudio incluye otros proyectos', () => {
    expect(todayItems(fixture(), TODAY, null).some((e) => e.item.id === 'otro')).toBe(true)
    expect(todayItems(fixture(), TODAY, 'a').some((e) => e.item.id === 'otro')).toBe(false)
  })
})

describe('bloqueos y confirmaciones', () => {
  it('separa lo bloqueado de lo que está en pausa', () => {
    expect(blockedItems(fixture()).map((i) => i.id)).toEqual(['bloqueada'])
  })
  it('separa decisiones tomadas y abiertas', () => {
    const d = decisions(fixture())
    expect(d.open.map((i) => i.id)).toEqual(['abierta'])
    expect(d.taken.map((i) => i.id)).toEqual(['decidida'])
  })
})

describe('agenda', () => {
  it('detecta lo que no tiene fecha y lo que ya pasó sin actualizar', () => {
    expect(undatedEvents(fixture()).map((e) => e.id)).toEqual(['e2'])
    expect(staleEvents(fixture(), TODAY).map((e) => e.id)).toEqual(['e3'])
  })
})

describe('builds', () => {
  it('se queda con la última de cada canal y deja fuera las sustituidas', () => {
    expect(currentBuilds(fixture()).map((b) => b.id)).toEqual(['b3', 'b2'])
  })
})

describe('estado del proyecto', () => {
  it('explica por qué pide atención', () => {
    const s = projectSummary(fixture(), fixture().projects[0], TODAY)
    expect(s.blocked).toBe(1)
    expect(s.overdue).toBe(1)
    expect(s.health.level).toBe('urgent')
    expect(s.health.reasons).toContain('1 elemento bloqueado')
    expect(s.health.reasons).toContain('1 fecha límite vencida')
    expect(s.lastActivity).toBe('2026-10-14')
  })
  it('un proyecto en pausa sale como parado, no como urgente', () => {
    const data = fixture()
    expect(projectSummary(data, data.projects[1], TODAY).health.level).toBe('idle')
  })
  it('avisa cuando un proyecto activo lleva tiempo sin moverse', () => {
    const data = fixture()
    data.items = []
    const s = projectSummary(data, data.projects[0], '2026-11-30')
    expect(s.health.reasons.some((r) => r.startsWith('sin actividad desde hace'))).toBe(true)
  })
})

describe('evolución', () => {
  it('cuenta commits y terminados por semana', () => {
    const w = weeklyEvolution(fixture(), TODAY, 5, 'a')
    expect(w.map((b) => b.start)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'])
    expect(w.map((b) => b.commits)).toEqual([0, 0, 1, 1])
    // «hecha» (14-10) y «decidida» (12-10, lunes) caen en la misma semana.
    expect(w.map((b) => b.completed)).toEqual([0, 0, 0, 2])
  })

  it('quita las semanas vacías del principio, pero deja al menos cuatro', () => {
    const w = weeklyEvolution(fixture(), TODAY, 10, 'a')
    expect(w.map((b) => b.start)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'])
    const data = fixture()
    data.activity.push({ id: 'c0', projectId: 'a', at: '2026-08-20T10:00', type: 'commit', title: 'Viejo' })
    expect(weeklyEvolution(data, TODAY, 10, 'a')[0].start).toBe('2026-08-17')
  })
})

describe('búsqueda', () => {
  it('no distingue mayúsculas ni tildes y busca en el motivo del bloqueo', () => {
    const i = fixture().items.find((x) => x.id === 'bloqueada')!
    expect(matchesQuery(i, 'app id')).toBe(true)
    expect(matchesQuery(i, 'ALGO')).toBe(true)
    expect(matchesQuery(i, 'feria')).toBe(false)
  })
})

describe('validación', () => {
  it('acepta datos correctos', () => {
    expect(validateStudioData(fixture())).toEqual([])
  })
  it('caza ids repetidos, fechas mal escritas y referencias rotas', () => {
    const data = fixture()
    data.items.push(item({ id: 'hecha', status: 'done', completedAt: '14/10/2026' }))
    data.feedback.push({
      id: 'f',
      projectId: 'zzz',
      title: 't',
      origin: 'event',
      status: 'new',
      impact: 'low',
      linkedItemIds: ['no-existe'],
      sources: [],
      confidence: 'inferred',
    })
    const errors = validateStudioData(data)
    expect(errors.some((e) => e.includes('id repetido «hecha»'))).toBe(true)
    expect(errors.some((e) => e.includes('no es una fecha'))).toBe(true)
    expect(errors.some((e) => e.includes('projectId desconocido'))).toBe(true)
    expect(errors.some((e) => e.includes('no-existe'))).toBe(true)
  })
  it('no deja algo hecho sin fecha ni algo abierto con fecha de fin', () => {
    const data = fixture()
    data.items.push(item({ id: 'y', status: 'done' }), item({ id: 'z', status: 'planned', completedAt: TODAY }))
    const errors = validateStudioData(data)
    expect(errors).toContain('Elemento y: está hecho pero no tiene completedAt')
    expect(errors).toContain('Elemento z: tiene completedAt pero no está hecho')
  })
})

describe('notificaciones', () => {
  it('avisa de lo vencido, lo que vence hoy, ferias cercanas, bloqueos importantes y lo que no se actualizó', () => {
    const kinds = notificationsFor(fixture(), TODAY).map((n) => `${n.kind}:${n.target.id}`)
    expect(kinds).toContain('overdue:vencida')
    expect(kinds).toContain('dueToday:hoy')
    expect(kinds).toContain('blocked:bloqueada')
    expect(kinds).toContain('eventSoon:e1')
    expect(kinds).toContain('eventStale:e3')
    expect(kinds).not.toContain('eventSoon:e4') // a meses vista
  })
  it('lo urgente va primero', () => {
    const tones = notificationsFor(fixture(), TODAY).map((n) => n.tone)
    expect(tones).toEqual([...tones].sort((a, b) => ['danger', 'warning', 'info'].indexOf(a) - ['danger', 'warning', 'info'].indexOf(b)))
  })
})
