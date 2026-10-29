import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Activity, type Member, type Metric, type StudioData, type TimeEntry, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import {
  statsActivity,
  statsActivityMember,
  statsCount,
  statsMetricCounts,
  statsMetrics,
  statsMilestones,
  statsProgress,
  statsTasks,
  statsTime,
  statsWeekStarts,
} from '../selectors'

// Lunes 19 de octubre de 2026.
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
const done = (id: string, completedAt: string, over: Partial<WorkItem> = {}) => item(id, { status: 'done', completedAt, ...over })
const member = (id: string, over: Partial<Member> = {}): Member => ({ id, name: id, kind: 'core', areaIds: [], active: true, ...over })
const time = (id: string, over: Partial<TimeEntry> = {}): TimeEntry => ({ id, projectId: 'p', date: TODAY, minutes: 60, ...over })
const commit = (id: string, at: string, over: Partial<Activity> = {}): Activity => ({ id, projectId: 'p', at, type: 'commit', title: id, ...over })
const metric = (id: string, over: Partial<Metric> = {}): Metric => ({
  id,
  projectId: 'p',
  kind: 'wishlists',
  value: 100,
  date: '2026-10-01',
  sources: [{ type: 'doc', ref: 'Steamworks › Wishlists', date: '2026-10-01' }],
  confidence: 'verified',
  ...over,
})

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    areas: [
      { id: 'ux', name: 'UX', color: '#000' },
      { id: 'arte', name: 'Arte', color: '#111' },
    ],
    projects: [project('p'), project('q', 'idea')],
    ...over,
  }
}

describe('estadísticas: semanas', () => {
  it('las semanas acaban en la de hoy (de lunes o de domingo)', () => {
    expect(statsWeekStarts(TODAY, 3)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
    expect(statsWeekStarts(TODAY, 2, 0)).toEqual(['2026-10-11', '2026-10-18'])
  })
})

describe('estadísticas: progreso', () => {
  it('hechos sobre el total sin contar los descartados; sin nada, null (no un 0 %)', () => {
    expect(statsCount([item('a', { status: 'done', completedAt: TODAY }), item('b'), item('c', { status: 'cancelled' })])).toEqual({
      done: 1,
      total: 2,
      cancelled: 1,
      ratio: 0.5,
    })
    expect(statsCount([]).ratio).toBeNull()
  })

  it('por proyecto y por etapa, con hitos y tipos aparte; los objetivos no cuentan', () => {
    const d = data({
      items: [
        done('t1', '2026-10-10'),
        item('t2'),
        item('m1', { kind: 'milestone' }),
        done('m2', '2026-10-01', { kind: 'milestone' }),
        item('g', { kind: 'goal' }),
        item('q1', { projectId: 'q', tags: ['demo'] }),
      ],
    })
    const rows = statsProgress(d, TODAY)
    expect(rows.map((r) => r.project.id)).toEqual(['q', 'p'])
    const p = rows.find((r) => r.project.id === 'p')!
    expect(p.tasks).toMatchObject({ done: 2, total: 4 })
    expect(p.milestones).toMatchObject({ done: 1, total: 2 })
    expect(p.byKind.find((k) => k.kind === 'task')!.count).toMatchObject({ done: 1, total: 2 })
    // t2 y m1: el objetivo tampoco cuenta en el resumen (como en Tareas).
    expect(p.summary.open).toBe(2)
    expect(statsProgress(d, TODAY, 'q').map((r) => r.project.id)).toEqual(['q'])
    expect(statsProgress(d, TODAY, null, 'demo').find((r) => r.project.id === 'p')!.tasks.ratio).toBeNull()
  })
})

describe('estadísticas: tareas', () => {
  const d = data({
    items: [
      item('creada-hoy', { createdAt: TODAY }),
      done('hecha-la-pasada', '2026-10-14', { createdAt: '2026-10-12' }),
      done('hecha-sin-fecha', '', { createdAt: '2026-09-01' }),
      done('hecha-antigua', '2026-06-01'),
      item('bloqueada', { status: 'blocked' }),
      item('cancelada', { status: 'cancelled' }),
      item('objetivo', { kind: 'goal', createdAt: TODAY }),
      item('otro', { projectId: 'q', createdAt: TODAY }),
    ].map((i) => (i.completedAt === '' ? { ...i, completedAt: undefined } : i)),
  })

  it('creadas y hechas por semana; lo que no tiene fecha se cuenta aparte', () => {
    const s = statsTasks(d, TODAY, 'p', 1, null, 4)
    expect(s.weeks).toEqual([
      { start: '2026-09-28', created: 0, done: 0 },
      { start: '2026-10-05', created: 0, done: 0 },
      { start: '2026-10-12', created: 1, done: 1 },
      { start: '2026-10-19', created: 1, done: 0 },
    ])
    expect(s).toMatchObject({ open: 2, done: 3, cancelled: 1, doneRecent: 1, createdRecent: 2, doneUndated: 1, createdUndated: 3 })
  })

  it('quita las semanas vacías del principio, dejando al menos cuatro', () => {
    const s = statsTasks(d, TODAY, 'p', 1, null, 12)
    expect(s.weeks[0].start).toBe('2026-08-31')
    expect(s.weeks).toHaveLength(8)
    expect(statsTasks(data(), TODAY).weeks).toHaveLength(4)
  })

  it('las abiertas por estado, en el orden del tablero (también los estados sin ninguna)', () => {
    const s = statsTasks(d, TODAY, 'p')
    expect(s.byStatus.map((x) => x.status)).toEqual(['in_progress', 'review', 'blocked', 'to_confirm', 'planned', 'backlog', 'paused', 'idea'])
    expect(s.byStatus.find((x) => x.status === 'blocked')!.count).toBe(1)
    expect(s.byStatus.find((x) => x.status === 'backlog')!.count).toBe(1)
    expect(s.byKind.find((x) => x.kind === 'task')!.open).toBe(2)
  })
})

describe('estadísticas: hitos', () => {
  const m = (id: string, over: Partial<WorkItem>) => item(id, { kind: 'milestone', ...over })
  const d = data({
    items: [
      m('a-tiempo', { status: 'done', dueDate: '2026-10-10', completedAt: '2026-10-10' }),
      m('tarde', { status: 'done', dueDate: '2026-09-01', completedAt: '2026-09-04' }),
      m('sin-limite', { status: 'done', completedAt: '2026-08-15' }),
      m('vencido', { status: 'planned', dueDate: '2026-10-09' }),
      m('proximo', { status: 'planned', dueDate: '2026-10-29' }),
      m('sin-fecha', { status: 'in_progress' }),
      m('descartado', { status: 'cancelled' }),
      m('otro', { projectId: 'q', status: 'planned', tags: ['feria'] }),
    ],
  })

  it('hechos frente a previstos y, de los hechos, a tiempo o tarde', () => {
    const s = statsMilestones(d, TODAY, 'p')
    expect(s.done.map((i) => i.id)).toEqual(['a-tiempo', 'tarde', 'sin-limite'])
    expect(s.planned.map((i) => i.id)).toEqual(['vencido', 'proximo', 'sin-fecha'])
    expect(s.cancelled).toBe(1)
    expect(s.onTime.map((i) => i.id)).toEqual(['a-tiempo'])
    expect(s.late.map((l) => [l.item.id, l.days])).toEqual([['tarde', 3]])
    expect(s.noDue.map((i) => i.id)).toEqual(['sin-limite'])
    expect(s.overdue.map((l) => [l.item.id, l.days])).toEqual([['vencido', 10]])
    expect(s.upcoming.map((l) => [l.item.id, l.days])).toEqual([['proximo', 10]])
    expect(s.undated.map((i) => i.id)).toEqual(['sin-fecha'])
  })

  it('hechos por mes, del primero hasta este, y por proyecto', () => {
    const s = statsMilestones(d, TODAY)
    expect(s.byMonth).toEqual([
      { month: '2026-08', done: 1 },
      { month: '2026-09', done: 1 },
      { month: '2026-10', done: 1 },
    ])
    expect(s.byProject.map((r) => [r.project.id, r.done, r.planned, r.onTime, r.late, r.noDue, r.measured])).toEqual([
      ['q', 0, 1, 0, 0, 0, 0],
      ['p', 3, 3, 1, 1, 1, 2],
    ])
    expect(statsMilestones(d, TODAY, null, 'feria').planned.map((i) => i.id)).toEqual(['otro'])
    expect(statsMilestones(data(), TODAY).byMonth).toEqual([])
  })

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })
})

describe('estadísticas: tiempo', () => {
  const d = data({
    members: [member('ana'), member('luis')],
    items: [item('i1')],
    timeEntries: [
      time('t1', { memberId: 'ana', minutes: 90, itemId: 'i1' }),
      time('t2', { memberId: 'luis', minutes: 30, date: '2026-10-13' }),
      time('vieja', { memberId: 'ana', minutes: 120, date: '2026-08-03' }),
      time('sin-persona', { minutes: 15, projectId: 'q' }),
    ],
  })

  it('total, últimas cuatro semanas, por semana, proyecto, persona y elemento', () => {
    const s = statsTime(d, TODAY)
    expect(s).toMatchObject({ entries: 4, total: 255, recent: 135 })
    expect(s.weeks[0]).toEqual({ start: '2026-08-03', minutes: 120 })
    expect(s.weeks[s.weeks.length - 1]).toEqual({ start: '2026-10-19', minutes: 105 })
    expect(s.byProject.map((r) => [r.who?.id, r.minutes, r.recent])).toEqual([
      ['p', 240, 120],
      ['q', 15, 15],
    ])
    expect(s.byPerson.map((r) => [r.who?.id, r.minutes, r.recent])).toEqual([
      ['ana', 210, 90],
      ['luis', 30, 30],
      [undefined, 15, 15],
    ])
    expect(s.byItem.map((r) => [r.who?.id, r.minutes])).toEqual([
      ['i1', 90],
      [undefined, 165],
    ])
  })

  it('con un proyecto elegido, solo lo suyo; sin horas, nada', () => {
    expect(statsTime(d, TODAY, 'q')).toMatchObject({ entries: 1, total: 15 })
    expect(statsTime(data(), TODAY)).toMatchObject({ entries: 0, total: 0, byPerson: [] })
  })
})

describe('estadísticas: actividad', () => {
  const d = data({
    members: [member('ana', { name: 'Ana Pérez', aliases: ['anap'] })],
    activity: [
      commit('c1', '2026-10-19T10:00', { areaId: 'ux', memberId: 'ana' }),
      commit('c2', '2026-10-13T10:00', { areaId: 'ux', author: 'ANAP' }),
      commit('c3', '2026-10-12T10:00', { author: 'Otra Persona' }),
      commit('c4', '2026-07-01T10:00', { areaId: 'arte' }),
      { ...commit('m1', '2026-10-14T10:00'), type: 'merge' },
      { ...commit('r1', '2026-10-14T10:00'), type: 'release' },
      commit('q1', '2026-10-14T10:00', { projectId: 'q' }),
    ],
  })

  it('reconoce a la persona por memberId, por sus nombres en git o por su nombre', () => {
    expect(statsActivityMember(d, { memberId: 'ana' })?.id).toBe('ana')
    expect(statsActivityMember(d, { author: ' anap ' })?.id).toBe('ana')
    expect(statsActivityMember(d, { author: 'ana pérez' })?.id).toBe('ana')
    expect(statsActivityMember(d, { author: 'Nadie' })).toBeUndefined()
    expect(statsActivityMember(d, {})).toBeUndefined()
  })

  it('commits y fusiones por semana, por área y por persona (solo lo que trae autor)', () => {
    const s = statsActivity(d, TODAY, 'p')
    expect(s).toMatchObject({ commits: 4, merges: 1, recent: 4, withoutAuthor: 2 })
    expect(s.weeks.slice(-2)).toEqual([
      { start: '2026-10-12', commits: 2, merges: 1 },
      { start: '2026-10-19', commits: 1, merges: 0 },
    ])
    expect(s.byArea.map((r) => [r.area?.id, r.count])).toEqual([
      ['ux', 2],
      ['arte', 1],
      [undefined, 2],
    ])
    expect(s.byPerson.map((r) => [r.member?.id ?? r.author, r.count])).toEqual([
      ['ana', 2],
      ['Otra Persona', 1],
    ])
  })

  it('sin autores, nadie por persona', () => {
    const s = statsActivity(data({ activity: [commit('c', '2026-10-19T10:00')] }), TODAY)
    expect(s.byPerson).toEqual([])
    expect(s.withoutAuthor).toBe(1)
  })
})

describe('estadísticas: métricas de plataformas', () => {
  const d = data({
    metrics: [
      metric('w2', { value: 180, date: '2026-10-15' }),
      metric('w1', { value: 120, date: '2026-10-01' }),
      metric('w-itch', { value: 40, platform: 'itch' }),
      metric('w-por-comprobar', { value: 999, date: '2026-10-18', confidence: 'to_confirm', sources: [{ type: 'manual', ref: 'de memoria' }] }),
      metric('seguidores', { kind: 'followers', value: 50, confidence: 'inferred' }),
      metric('otra-a', { kind: 'other', label: 'Visitas', value: 10 }),
      metric('otra-b', { kind: 'other', label: 'visitas ', value: 12, date: '2026-10-02' }),
      metric('ventas', { kind: 'units', value: 30 }),
      metric('ventas-deducidas', { kind: 'units', value: 35, confidence: 'inferred', date: '2026-10-10' }),
      metric('q', { projectId: 'q', value: 5 }),
    ],
  })

  it('lanzamiento: lo que no está por comprobar, en series por tipo y plataforma; lo dudoso aparte', () => {
    const s = statsMetrics(d, 'launch', 'p')
    expect(s.series.map((x) => [x.kind, x.platform ?? '', x.points.map((m) => m.id)])).toEqual([
      ['wishlists', '', ['w1', 'w2']],
      ['wishlists', 'itch', ['w-itch']],
      ['followers', '', ['seguidores']],
      ['other', '', ['otra-a', 'otra-b']],
    ])
    expect(s.series[0].latest.id).toBe('w2')
    expect(s.series[0].previous?.id).toBe('w1')
    expect(s.series[1].previous).toBeUndefined()
    expect(s.excluded.map((m) => m.id)).toEqual(['w-por-comprobar'])
  })

  it('comerciales: solo lo verificado cuenta', () => {
    expect(statsMetricCounts(d.metrics.find((m) => m.id === 'ventas-deducidas')!)).toBe(false)
    expect(statsMetricCounts(d.metrics.find((m) => m.id === 'seguidores')!)).toBe(true)
    const s = statsMetrics(d, 'commercial')
    expect(s.series.map((x) => x.points.map((m) => m.id))).toEqual([['ventas']])
    expect(s.excluded.map((m) => m.id)).toEqual(['ventas-deducidas'])
    expect(statsMetrics(data(), 'commercial')).toEqual({ series: [], excluded: [] })
  })

  it('comerciales: lo anotado a mano solo cuenta con el enlace de dónde sale, no con una nota', () => {
    const conNota = metric('nota', { kind: 'units', sources: [{ type: 'manual', ref: 'Informe', note: 'captura' }] })
    const conEnlace = metric('enlace', { kind: 'units', sources: [{ type: 'manual', ref: 'Informe', url: 'https://partner.steamgames.com/informe' }] })
    expect(statsMetricCounts(conNota)).toBe(false)
    expect(statsMetricCounts(conEnlace)).toBe(true)
    const s = statsMetrics(data({ metrics: [conNota, conEnlace] }), 'commercial')
    expect(s.series.map((x) => x.latest.id)).toEqual(['enlace'])
    expect(s.excluded.map((m) => m.id)).toEqual(['nota'])
  })

  it('con un proyecto elegido, solo lo suyo', () => {
    expect(statsMetrics(d, 'launch', 'q').series.map((x) => x.latest.id)).toEqual(['q'])
  })
})
