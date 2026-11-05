import { describe, expect, it } from 'vitest'
import { CANCELLED_STATUS, defaultProjectStatuses, projectStatusesOf } from '../catalog'
import { emptyCollections } from '../collections'
import {
  isProjectStageGroup,
  PROJECT_GROUPS,
  projectGroupCounts,
  projectLastActivity,
  projectNextMilestone,
  projectProgress,
  projectGroupOf,
  projectsInGroup,
  projectStatusCounts,
} from '../selectors'
import { SCHEMA_VERSION, type Activity, type ChangeEntry, type Project, type StudioData, type WorkItem } from '../types'
import { validateStudioData } from '../validate'

const project = (id: string, status: string, name = id, tags: string[] = []) => ({
  id,
  slug: id,
  name,
  description: '',
  platforms: [],
  status,
  color: '#000',
  versions: [],
  tags,
  links: [],
})

function data(): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [
      project('zeta', 'desarrollo', 'Zeta', ['godot']),
      project('alfa', 'desarrollo', 'Alfa'),
      project('salida', 'preparacion_lanzamiento'),
      project('idea', 'idea'),
      project('publicado', 'lanzado', 'publicado', ['Godot']),
      project('parado', 'en_pausa'),
      project('viejo', 'archivado'),
    ],
  }
}

describe('proyectos por grupo de estados', () => {
  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })

  it('los 14 estados de serie, cada uno en un grupo de los de Proyectos', () => {
    const statuses = defaultProjectStatuses()
    expect(statuses).toHaveLength(14)
    for (const s of statuses) expect(PROJECT_GROUPS).toContain(s.group)
  })

  it('preparar el lanzamiento sigue activo; lanzados es lo publicado y en mantenimiento', () => {
    const studio = data().studio
    expect(projectGroupOf(studio, project('x', 'preparacion_lanzamiento'))).toBe('activos')
    expect(projectGroupOf(studio, project('x', 'mantenimiento'))).toBe('lanzados')
    expect(projectGroupOf(studio, project('x', 'investigacion'))).toBe('planificacion')
    expect(projectGroupOf(studio, project('x', CANCELLED_STATUS))).toBe('archivados')
  })

  it('los estados del estudio mandan, pero archivado y cancelado no se pueden quitar', () => {
    const studio = { ...data().studio, projectStatuses: [{ id: 'jam', label: 'Game jam', group: 'activos' as const, tone: 'info' as const }] }
    expect(projectStatusesOf(studio).map((s) => s.id)).toEqual(['jam', 'cancelado', 'archivado'])
    expect(projectGroupOf(studio, project('x', 'jam'))).toBe('activos')
  })

  it('filtra por grupo y ordena por estado y nombre', () => {
    expect(projectsInGroup(data(), 'activos').map((p) => p.id)).toEqual(['alfa', 'zeta', 'salida'])
    expect(projectsInGroup(data(), 'lanzados').map((p) => p.id)).toEqual(['publicado'])
    expect(projectsInGroup(data(), null).map((p) => p.id)).toEqual(['idea', 'alfa', 'zeta', 'salida', 'publicado', 'parado', 'viejo'])
  })

  it('cuenta los proyectos de cada grupo y de cada estado', () => {
    expect(projectGroupCounts(data())).toEqual({ activos: 3, planificacion: 1, pausa: 1, lanzados: 1, archivados: 1 })
    const statuses = projectStatusCounts(data())
    expect(statuses.desarrollo).toBe(2)
    expect(statuses.pruebas).toBeUndefined()
    expect(Object.values(statuses).reduce((a, b) => a + b, 0)).toBe(7)
  })

  it('con ?etiqueta=, solo los que la llevan (sin distinguir mayúsculas), en la lista y en las cifras', () => {
    expect(projectsInGroup(data(), null, 'godot').map((p) => p.id)).toEqual(['zeta', 'publicado'])
    expect(projectsInGroup(data(), 'activos', 'godot').map((p) => p.id)).toEqual(['zeta'])
    expect(projectGroupCounts(data(), 'godot')).toEqual({ activos: 1, planificacion: 0, pausa: 0, lanzados: 1, archivados: 0 })
  })

  it('sin proyectos, todo a cero y listas vacías', () => {
    const empty = { ...data(), projects: [] }
    expect(projectsInGroup(empty, 'pausa')).toEqual([])
    expect(Object.values(projectGroupCounts(empty))).toEqual([0, 0, 0, 0, 0])
  })

  it('solo acepta los grupos que existen en ?estado=', () => {
    expect(isProjectStageGroup('pausa')).toBe(true)
    expect(isProjectStageGroup('blocked')).toBe(false)
    expect(isProjectStageGroup(null)).toBe(false)
  })
})

// ——— Progreso, próximo hito y última actividad ————————————————————————————————

const HOY = '2026-11-02'
const fuente = [{ type: 'manual' as const, ref: 'prueba' }]
const elemento = (id: string, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  projectId: 'alfa',
  kind: 'task',
  title: id,
  status: 'backlog',
  priority: 'medium',
  tags: [],
  sources: fuente,
  confidence: 'verified',
  ...over,
})
const conElementos = (items: WorkItem[], over: Partial<StudioData> = {}): StudioData => ({ ...data(), items, ...over })
const alfa = (d: StudioData, method?: Project['progressMethod']) => ({ ...d.projects.find((p) => p.id === 'alfa')!, progressMethod: method })

describe('progreso de un proyecto', () => {
  it('por tareas (lo de siempre): tareas, funcionalidades e incidencias, ponderadas por prioridad', () => {
    const d = conElementos([
      elemento('critica-hecha', { status: 'done', priority: 'critical' }), // 4
      elemento('baja-abierta', { priority: 'low' }), // 1
      elemento('funcionalidad-alta', { kind: 'feature', priority: 'high' }), // 3
      elemento('incidencia-media-hecha', { kind: 'issue', status: 'done' }), // 2
      // No cuentan: hitos, decisiones, objetivos ni lo de otro proyecto.
      elemento('hito', { kind: 'milestone', status: 'done' }),
      elemento('decision', { kind: 'decision' }),
      elemento('objetivo', { kind: 'goal' }),
      elemento('de-otro', { projectId: 'zeta', status: 'done' }),
    ])
    const p = projectProgress(d, alfa(d))
    expect(p).toMatchObject({ method: 'tasks', done: 2, total: 4, doneWeight: 6, totalWeight: 10, excluded: 0 })
    expect(p.ratio).toBeCloseTo(0.6)
    // Sin ponderar sería 2 de 4 (50 %): la prioridad cambia el resultado.
    expect(projectProgress(d, alfa(d, 'tasks')).ratio).toBe(p.ratio)
  })

  it('las descartadas y las ideas no cuentan (ni arriba ni abajo)', () => {
    const d = conElementos([
      elemento('a', { status: 'done' }),
      elemento('b', { status: 'done' }),
      elemento('c'),
      elemento('descartada', { status: 'cancelled', priority: 'critical' }),
      elemento('idea', { status: 'idea', priority: 'critical' }),
    ])
    const p = projectProgress(d, alfa(d))
    expect(p).toMatchObject({ done: 2, total: 3, excluded: 2 })
    expect(p.ratio).toBeCloseTo(4 / 6)
  })

  it('por hitos: hitos hechos entre hitos, sin los descartados', () => {
    const d = conElementos([
      elemento('h1', { kind: 'milestone', status: 'done' }),
      elemento('h2', { kind: 'milestone', priority: 'critical' }),
      elemento('h3', { kind: 'milestone', status: 'cancelled' }),
      elemento('tarea-hecha', { status: 'done' }),
    ])
    const p = projectProgress(d, alfa(d, 'milestones'))
    expect(p).toMatchObject({ method: 'milestones', done: 1, total: 2, doneWeight: 1, totalWeight: 2, excluded: 1, ratio: 0.5 })
  })

  it('sin datos suficientes, null (nunca 0 %): menos de 3 elementos por tareas o ningún hito', () => {
    const pocas = conElementos([elemento('a'), elemento('b', { status: 'done' }), elemento('c', { status: 'cancelled' })])
    expect(projectProgress(pocas, alfa(pocas))).toMatchObject({ ratio: null, total: 2, minimum: 3 })
    const sinHitos = conElementos([elemento('a'), elemento('b'), elemento('c')])
    expect(projectProgress(sinHitos, alfa(sinHitos, 'milestones'))).toMatchObject({ ratio: null, total: 0, minimum: 1 })
    expect(projectProgress(sinHitos, alfa(sinHitos)).ratio).toBe(0)
    const vacio = conElementos([])
    expect(projectProgress(vacio, alfa(vacio)).ratio).toBeNull()
  })

  it('con etiqueta, solo lo que la lleva', () => {
    const d = conElementos([elemento('a', { tags: ['demo'], status: 'done' }), elemento('b', { tags: ['Demo'] }), elemento('c', { tags: ['demo'] }), elemento('d')])
    expect(projectProgress(d, alfa(d), 'demo')).toMatchObject({ done: 1, total: 3 })
  })
})

describe('próximo hito de un proyecto', () => {
  it('el primero abierto por fecha límite, aunque ya haya pasado; los cerrados no', () => {
    const d = conElementos([
      elemento('hecho', { kind: 'milestone', status: 'done', dueDate: '2026-10-01' }),
      elemento('descartado', { kind: 'milestone', status: 'cancelled', dueDate: '2026-10-02' }),
      elemento('lejano', { kind: 'milestone', dueDate: '2027-01-10' }),
      elemento('vencido', { kind: 'milestone', dueDate: '2026-10-20' }),
      elemento('sin-fecha', { kind: 'milestone', status: 'in_progress' }),
      elemento('tarea', { dueDate: '2026-09-01' }),
    ])
    expect(projectNextMilestone(d, 'alfa')).toMatchObject({ item: { id: 'vencido' }, date: '2026-10-20', confirmed: true })
  })

  it('si ninguno tiene fecha, el primero sin fecha (lo que está en marcha antes)', () => {
    const d = conElementos([elemento('previsto', { kind: 'milestone', status: 'planned' }), elemento('en-marcha', { kind: 'milestone', status: 'in_progress' })])
    const next = projectNextMilestone(d, 'alfa')!
    expect(next.item.id).toBe('en-marcha')
    expect(next.date).toBeUndefined()
  })

  it('dice si está sin confirmar (estado o fiabilidad «por confirmar»)', () => {
    const porEstado = conElementos([elemento('h', { kind: 'milestone', status: 'to_confirm', dueDate: '2026-12-01' })])
    expect(projectNextMilestone(porEstado, 'alfa')!.confirmed).toBe(false)
    const porFiabilidad = conElementos([elemento('h', { kind: 'milestone', dueDate: '2026-12-01', confidence: 'to_confirm' })])
    expect(projectNextMilestone(porFiabilidad, 'alfa')!.confirmed).toBe(false)
  })

  it('sin hitos abiertos, null', () => {
    expect(projectNextMilestone(conElementos([elemento('h', { kind: 'milestone', status: 'done' })]), 'alfa')).toBeNull()
  })
})

describe('última actividad de un proyecto', () => {
  const commit = (id: string, at: string, projectId = 'alfa'): Activity => ({ id, projectId, at, type: 'commit', title: id })
  const cambio = (id: string, at: string, projectId = 'alfa'): ChangeEntry => ({ id, at, action: 'updated', collection: 'items', entityId: 'x', title: id, projectId })

  it('la más reciente entre git, el registro de cambios y las fechas de los elementos', () => {
    const d = conElementos([elemento('alta', { createdAt: '2026-10-01' })], {
      activity: [commit('commit', '2026-10-20T10:00'), commit('de-otro', '2026-11-01T10:00', 'zeta')],
      changes: [cambio('cambio', '2026-10-25T09:00')],
    })
    expect(projectLastActivity(d, 'alfa', HOY)).toEqual({ date: '2026-10-25', at: '2026-10-25T09:00', source: 'change', title: 'cambio' })
    const conHecha = { ...d, items: [...d.items, elemento('hecha', { status: 'done', completedAt: '2026-10-30' })] }
    expect(projectLastActivity(conHecha, 'alfa', HOY)).toEqual({ date: '2026-10-30', source: 'item', title: 'hecha' })
  })

  it('lo fechado después de hoy no cuenta; a igual día gana lo que tiene hora', () => {
    const d = conElementos([elemento('futura', { createdAt: '2026-12-01' }), elemento('hoy', { createdAt: HOY })], {
      activity: [commit('commit-hoy', `${HOY}T08:00`), commit('commit-futuro', '2026-11-05T08:00')],
    })
    expect(projectLastActivity(d, 'alfa', HOY)).toMatchObject({ source: 'code', title: 'commit-hoy' })
  })

  it('sin nada registrado, undefined', () => {
    expect(projectLastActivity(conElementos([]), 'alfa', HOY)).toBeUndefined()
  })
})
