import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Phase, type Release, type StudioData, type StudioEvent, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import {
  ROADMAP_LIFECYCLE,
  roadmapGoals,
  roadmapLine,
  roadmapMilestones,
  roadmapPhaseLate,
  roadmapPhases,
  roadmapProgress,
  roadmapProjectPhases,
  roadmapReleases,
} from '../selectors'

const TODAY = '2026-10-19'
const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string, stage: StudioData['projects'][number]['stage'] = 'production') => ({
  id,
  slug: id,
  name: id,
  description: '',
  platforms: [],
  stage,
  color: '#000',
  versions: [],
  tags: [],
  links: [],
})
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
const phase = (id: string, over: Partial<Phase> = {}): Phase => ({ id, projectId: 'p', stage: 'production', status: 'planned', ...over })
const release = (id: string, over: Partial<Release> = {}): Release => ({
  id,
  projectId: 'p',
  kind: 'update',
  name: id,
  status: 'planned',
  sources: src,
  confidence: 'to_confirm',
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

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('p'), project('q', 'paused')],
    ...over,
  }
}

describe('roadmap: hitos', () => {
  const d = data({
    items: [
      item('m-lejos', { kind: 'milestone', dueDate: '2026-12-01', status: 'planned' }),
      item('m-cerca', { kind: 'milestone', dueDate: '2026-10-25', status: 'planned' }),
      item('m-sin', { kind: 'milestone', status: 'planned' }),
      item('m-curso', { kind: 'milestone', status: 'in_progress', tags: ['steam'] }),
      item('m-hecho-viejo', { kind: 'milestone', status: 'done', completedAt: '2026-09-01' }),
      item('m-hecho', { kind: 'milestone', status: 'done', completedAt: '2026-10-01' }),
      item('m-descartado', { kind: 'milestone', status: 'cancelled' }),
      item('m-otro', { kind: 'milestone', projectId: 'q', dueDate: '2026-11-01', status: 'planned' }),
      item('tarea', { dueDate: '2026-10-20' }),
    ],
  })

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('abiertos con fecha por fecha, sin fecha con lo que está en marcha primero, y los cerrados del más reciente', () => {
    const r = roadmapMilestones(d, 'p')
    expect(r.dated.map((i) => i.id)).toEqual(['m-cerca', 'm-lejos'])
    expect(r.undated.map((i) => i.id)).toEqual(['m-curso', 'm-sin'])
    expect(r.closed.map((i) => i.id)).toEqual(['m-hecho', 'm-hecho-viejo', 'm-descartado'])
  })

  it('en todo el estudio salen los de todos los proyectos, y solo hitos', () => {
    const r = roadmapMilestones(d)
    expect(r.dated.map((i) => i.id)).toEqual(['m-cerca', 'm-otro', 'm-lejos'])
  })

  it('con etiqueta, solo los que la llevan', () => {
    const r = roadmapMilestones(d, null, 'Steam')
    expect([...r.dated, ...r.undated, ...r.closed].map((i) => i.id)).toEqual(['m-curso'])
  })
})

describe('roadmap: progreso y objetivos', () => {
  const d = data({
    items: [
      item('g1', { kind: 'goal', status: 'in_progress', dueDate: '2026-12-01' }),
      item('a', { parentId: 'g1', status: 'done' }),
      item('b', { parentId: 'g1', status: 'in_progress' }),
      item('c', { parentId: 'g1', status: 'cancelled' }),
      item('g2', { kind: 'goal', status: 'planned' }),
      item('g3', { kind: 'goal', status: 'done', completedAt: '2026-10-01' }),
      item('g4', { kind: 'goal', status: 'planned', dueDate: '2026-11-01', projectId: 'q' }),
    ],
  })

  it('el progreso sale solo de lo que cuelga del objetivo y los descartados no cuentan', () => {
    const p = roadmapProgress(d, 'g1')
    expect(p).toMatchObject({ done: 1, total: 2, cancelled: 1, ratio: 0.5 })
    expect(p.steps.map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('sin pasos no hay progreso (no se inventa un 0 %)', () => {
    expect(roadmapProgress(d, 'g2')).toMatchObject({ done: 0, total: 0, ratio: null, steps: [] })
  })

  it('objetivos abiertos (con fecha antes) y cerrados, del ámbito', () => {
    const r = roadmapGoals(d, 'p')
    expect(r.open.map((g) => g.goal.id)).toEqual(['g1', 'g2'])
    expect(r.closed.map((g) => g.goal.id)).toEqual(['g3'])
    expect(roadmapGoals(d).open.map((g) => g.goal.id)).toEqual(['g4', 'g1', 'g2'])
  })
})

describe('roadmap: fases', () => {
  it('el ciclo de vida va de la idea a publicado, sin pausa ni archivado', () => {
    expect(ROADMAP_LIFECYCLE).toEqual(['idea', 'concept', 'prototype', 'preproduction', 'production', 'polish', 'release', 'live'])
  })

  it('cada etapa dice si es la actual, está hecha, prevista, quedó atrás o está por delante', () => {
    const d = data({
      phases: [
        phase('f-proto', { stage: 'prototype', status: 'done', startDate: '2026-09-01', endDate: '2026-09-20' }),
        phase('f-prod-2', { stage: 'production', startDate: '2026-11-01' }),
        phase('f-prod-1', { stage: 'production', status: 'done', startDate: '2026-10-01' }),
        phase('f-pulido', { stage: 'polish', startDate: '2027-01-01' }),
      ],
    })
    const r = roadmapProjectPhases(d, d.projects[0])
    const state = Object.fromEntries(r.stages.map((s) => [s.stage, s.state]))
    expect(state).toEqual({
      idea: 'past',
      concept: 'past',
      prototype: 'done',
      preproduction: 'past',
      production: 'current',
      polish: 'planned',
      release: 'ahead',
      live: 'ahead',
    })
    expect(r.stages.find((s) => s.stage === 'production')!.phases.map((p) => p.id)).toEqual(['f-prod-1', 'f-prod-2'])
    expect(r.count).toBe(4)
  })

  it('un proyecto en pausa no tiene etapa del ciclo actual: la pausa sale al final', () => {
    const d = data({ phases: [phase('f', { projectId: 'q', stage: 'concept', status: 'done' })] })
    const r = roadmapProjectPhases(d, d.projects[1])
    expect(r.stages.at(-1)).toMatchObject({ stage: 'paused', state: 'current' })
    expect(r.stages.find((s) => s.stage === 'concept')!.state).toBe('done')
    expect(r.stages.find((s) => s.stage === 'idea')!.state).toBe('unknown')
  })

  it('todo el estudio: un bloque por proyecto; con ámbito, solo el suyo', () => {
    expect(roadmapPhases(data()).map((r) => r.project.id)).toEqual(['p', 'q'])
    expect(roadmapPhases(data(), 'q').map((r) => r.project.id)).toEqual(['q'])
  })

  it('una fase prevista cuyo fin ya pasó se marca', () => {
    expect(roadmapPhaseLate(phase('x', { endDate: '2026-10-01' }), TODAY)).toBe(true)
    expect(roadmapPhaseLate(phase('x', { endDate: '2026-10-01', status: 'done' }), TODAY)).toBe(false)
    expect(roadmapPhaseLate(phase('x'), TODAY)).toBe(false)
  })
})

describe('roadmap: versiones previstas', () => {
  const d = data({
    releases: [
      release('r-sin-fecha', { status: 'idea' }),
      release('r-tarde', { targetDate: '2026-10-01', targetConfirmed: true }),
      release('r-lejos', { targetDate: '2027-02-01' }),
      release('r-publicada', { status: 'released', releasedAt: '2026-09-01' }),
      release('r-cancelada', { status: 'cancelled' }),
    ],
    builds: [
      {
        id: 'b1',
        projectId: 'p',
        name: 'Demo',
        version: '1',
        channel: 'demo',
        platforms: [],
        status: 'ready',
        date: '2026-10-01',
        releaseId: 'r-tarde',
        sources: src,
        confidence: 'verified',
      },
      {
        id: 'b2',
        projectId: 'p',
        name: 'Demo',
        version: '2',
        channel: 'demo',
        platforms: [],
        status: 'in_progress',
        date: '2026-10-10',
        releaseId: 'r-tarde',
        sources: src,
        confidence: 'verified',
      },
    ],
    items: [
      item('i1', { releaseId: 'r-tarde', status: 'done' }),
      item('i2', { releaseId: 'r-tarde', status: 'in_progress' }),
      item('i3', { releaseId: 'r-tarde', status: 'cancelled' }),
    ],
  })

  it('solo las que no han salido, por fecha prevista (sin fecha al final), con sus builds y elementos', () => {
    const r = roadmapReleases(d, TODAY, 'p')
    expect(r.upcoming.map((x) => x.release.id)).toEqual(['r-tarde', 'r-lejos', 'r-sin-fecha'])
    expect(r.released).toBe(1)
    expect(r.cancelled).toBe(1)
    const tarde = r.upcoming[0]
    expect(tarde.builds.map((b) => b.id)).toEqual(['b2', 'b1'])
    expect(tarde.items.map((i) => i.id)).toEqual(['i2', 'i1', 'i3'])
    expect(tarde).toMatchObject({ itemsDone: 1, itemsTotal: 2, confirmed: true, late: true })
    expect(r.upcoming[1]).toMatchObject({ confirmed: false, late: false })
  })
})

describe('roadmap: línea temporal', () => {
  const d = data({
    phases: [
      phase('f1', { stage: 'prototype', status: 'done', startDate: '2026-09-01', endDate: '2026-09-30' }),
      phase('f2', { startDate: '2026-10-01', endDate: '2027-01-31' }),
    ],
    items: [
      item('h-hecho', { kind: 'milestone', status: 'done', completedAt: '2026-10-19', dueDate: '2026-10-25', tags: ['demo'] }),
      item('h-futuro', { kind: 'milestone', status: 'planned', dueDate: '2026-11-15' }),
      item('h-sin', { kind: 'milestone', status: 'planned' }),
      item('h-descartado', { kind: 'milestone', status: 'cancelled', dueDate: '2026-11-01' }),
    ],
    releases: [release('r1', { targetDate: '2026-12-01', version: '1.0' })],
    events: [
      event('feria', { date: '2026-11-20', endDate: '2026-11-22', dateConfirmed: true }),
      event('reunion', { type: 'meeting', date: '2026-10-21' }),
      event('estudio', { projectId: undefined, date: '2026-09-15', status: 'done', dateConfirmed: true }),
    ],
  })

  it('de un proyecto: pasado, futuro y sin fecha, en orden; sin reuniones ni descartados', () => {
    const [line] = roadmapLine(d, TODAY, 'p')
    expect(line.projectId).toBe('p')
    expect(line.past.map((e) => e.id)).toEqual(['phases:f1', 'items:h-hecho'])
    // La fase que dura hasta enero sigue en curso: va con lo que viene.
    expect(line.future.map((e) => e.id)).toEqual(['phases:f2', 'items:h-futuro', 'events:feria', 'releases:r1'])
    expect(line.undated.map((e) => e.id)).toEqual(['items:h-sin'])
    expect(line.future.find((e) => e.id === 'releases:r1')).toMatchObject({ title: 'r1 (1.0)', confirmed: false, kind: 'release' })
    expect(line.future.find((e) => e.id === 'events:feria')).toMatchObject({ endDate: '2026-11-22', confirmed: true })
  })

  it('en todo el estudio, un grupo por proyecto y otro con lo del estudio', () => {
    const lines = roadmapLine(d, TODAY)
    expect(lines.map((l) => l.projectId)).toEqual(['p', 'q', null])
    expect(lines[1]).toEqual({ projectId: 'q', past: [], future: [], undated: [] })
    expect(lines[2].past.map((e) => e.id)).toEqual(['events:estudio'])
  })

  it('con etiqueta, solo lo que la lleva (las fases no tienen etiquetas)', () => {
    const [line] = roadmapLine(d, TODAY, 'p', 'demo')
    expect([...line.past, ...line.future, ...line.undated].map((e) => e.id)).toEqual(['items:h-hecho'])
  })
})
