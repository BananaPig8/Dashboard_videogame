import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Member, type StudioData, type TimeEntry, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import { TEAM_WEEKS, teamAssignments, teamResponsibilities, teamRoster, teamWindow, teamWorkload } from '../selectors'

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
const member = (id: string, over: Partial<Member> = {}): Member => ({ id, name: id, kind: 'core', areaIds: [], active: true, ...over })
const time = (id: string, over: Partial<TimeEntry> = {}): TimeEntry => ({ id, projectId: 'p', date: TODAY, minutes: 60, ...over })

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    areas: [
      { id: 'ux', name: 'UX', color: '#000' },
      { id: 'arte', name: 'Arte', color: '#111' },
      { id: 'steam', name: 'Steam', color: '#222' },
    ],
    projects: [project('p'), project('q')],
    ...over,
  }
}

describe('equipo: personas', () => {
  it('del estudio antes que externos, por nombre, y las antiguas aparte', () => {
    const d = data({
      members: [
        member('zoe'),
        member('luis', { kind: 'external' }),
        member('ana'),
        member('bea', { active: false }),
        member('carla', { kind: 'external', active: false }),
      ],
    })
    const r = teamRoster(d)
    expect(r.active.map((m) => m.id)).toEqual(['ana', 'zoe', 'luis'])
    expect(r.former.map((m) => m.id)).toEqual(['bea', 'carla'])
    expect(teamRoster(d, 'external').active.map((m) => m.id)).toEqual(['luis'])
    expect(teamRoster(d, 'external').former.map((m) => m.id)).toEqual(['carla'])
  })

  it('sin personas no se inventa a nadie', () => {
    expect(teamRoster(data())).toEqual({ active: [], former: [] })
    const w = teamWorkload(data({ items: [item('i1')] }), TODAY)
    expect(w.people).toEqual([])
    expect(w.nobody.open).toBe(1)
  })
})

describe('equipo: carga de trabajo', () => {
  const d = data({
    members: [member('ana', { weeklyHours: 10, areaIds: ['ux', 'borrada'] }), member('luis'), member('bea', { active: false })],
    items: [
      item('critica', { assigneeId: 'ana', priority: 'critical' }),
      item('baja-vencida', { assigneeId: 'ana', priority: 'low', dueDate: '2026-10-01' }),
      item('bloqueada', { assigneeId: 'luis', status: 'blocked', priority: 'high' }),
      item('hecha', { assigneeId: 'luis', status: 'done', completedAt: '2026-10-10' }),
      item('objetivo', { assigneeId: 'luis', kind: 'goal' }),
      item('otro-proyecto', { assigneeId: 'luis', projectId: 'q' }),
      item('de-bea', { assigneeId: 'bea' }),
      item('de-nadie', { priority: 'high', dueDate: '2026-10-18' }),
      item('de-alguien-borrado', { assigneeId: 'fantasma' }),
    ],
    timeEntries: [
      time('t1', { memberId: 'ana', minutes: 120 }),
      time('t2', { memberId: 'ana', minutes: 30, date: '2026-09-22' }),
      time('vieja', { memberId: 'ana', minutes: 600, date: '2026-09-21' }),
      time('futura', { memberId: 'ana', minutes: 600, date: '2026-10-20' }),
      time('sin-persona', { minutes: 45 }),
      time('otro', { memberId: 'luis', projectId: 'q', minutes: 90 }),
    ],
  })

  it('el periodo son las últimas cuatro semanas, hoy incluido', () => {
    expect(teamWindow(TODAY)).toEqual({ from: '2026-09-22', to: TODAY })
    expect(TEAM_WEEKS).toBe(4)
  })

  it('abiertos ponderados por prioridad, vencidos, bloqueados y horas del periodo', () => {
    const w = teamWorkload(d, TODAY)
    const ana = w.people.find((p) => p.member.id === 'ana')!
    expect(ana).toMatchObject({ open: 2, load: 4 + 1, overdue: 1, blocked: 0, minutes: 150 })
    expect(ana.areas.map((a) => a.id)).toEqual(['ux'])
    expect(ana.capacity).toBe(10 * TEAM_WEEKS * 60)
    expect(ana.ratio).toBeCloseTo(150 / 2400)
    const luis = w.people.find((p) => p.member.id === 'luis')!
    // La hecha y el objetivo no cuentan; el otro proyecto sí (todo el estudio).
    expect(luis).toMatchObject({ open: 2, load: 3 + 2, blocked: 1, minutes: 90 })
  })

  it('sin horas semanales no hay capacidad ni porcentaje', () => {
    const luis = teamWorkload(d, TODAY).people.find((p) => p.member.id === 'luis')!
    expect(luis.capacity).toBeNull()
    expect(luis.ratio).toBeNull()
  })

  it('sin horas apuntadas no hay porcentaje: no se inventa un 0 %', () => {
    const ana = teamWorkload({ ...d, timeEntries: [] }, TODAY).people.find((p) => p.member.id === 'ana')!
    expect(ana.capacity).toBe(10 * TEAM_WEEKS * 60)
    expect(ana.minutes).toBe(0)
    expect(ana.ratio).toBeNull()
  })

  it('lo de nadie (o de alguien que ya no existe) va aparte', () => {
    const w = teamWorkload(d, TODAY)
    expect(w.nobody).toMatchObject({ open: 2, load: 3 + 2, overdue: 1, minutes: 45 })
    expect(w.anyTime).toBe(true)
    expect(w.people.find((p) => p.member.id === 'bea')!.open).toBe(1)
  })

  it('con un proyecto elegido solo cuenta lo suyo', () => {
    const w = teamWorkload(d, TODAY, 'q')
    expect(w.people.find((p) => p.member.id === 'luis')).toMatchObject({ open: 1, minutes: 90 })
    expect(w.people.find((p) => p.member.id === 'ana')).toMatchObject({ open: 0, minutes: 0, ratio: null })
    expect(w.nobody.open).toBe(0)
    expect(teamWorkload(data(), TODAY).anyTime).toBe(false)
  })

  it('los datos de prueba son válidos (salvo las referencias rotas a propósito)', () => {
    const ok = {
      ...d,
      items: d.items.filter((i) => i.assigneeId !== 'fantasma'),
      members: d.members.map((m) => ({ ...m, areaIds: m.areaIds.filter((a) => a !== 'borrada') })),
    }
    expect(validateStudioData(ok)).toEqual([])
  })
})

describe('equipo: asignaciones', () => {
  const d = data({
    members: [member('ana'), member('luis'), member('bea', { active: false }), member('carla', { active: false })],
    items: [
      item('a-baja', { assigneeId: 'ana', priority: 'low' }),
      item('a-curso', { assigneeId: 'ana', status: 'in_progress' }),
      item('b1', { assigneeId: 'bea', tags: ['demo'] }),
      item('c-hecha', { assigneeId: 'carla', status: 'done', completedAt: '2026-10-01' }),
      item('nadie', { tags: ['demo'] }),
      item('fantasma', { assigneeId: 'fantasma' }),
    ],
  })

  it('por persona en el orden de Tareas; antiguas solo con trabajo; activas sin nada aparte', () => {
    const a = teamAssignments(d)
    expect(a.people.map((p) => p.member.id)).toEqual(['ana', 'bea'])
    expect(a.people[0].items.map((i) => i.id)).toEqual(['a-curso', 'a-baja'])
    expect(a.idle.map((m) => m.id)).toEqual(['luis'])
    expect(a.nobody.map((i) => i.id)).toEqual(['nadie', 'fantasma'])
  })

  it('con ?etiqueta= solo lo que la lleva', () => {
    const a = teamAssignments(d, null, 'demo')
    expect(a.people.map((p) => p.member.id)).toEqual(['bea'])
    expect(a.nobody.map((i) => i.id)).toEqual(['nadie'])
    expect(a.idle.map((m) => m.id)).toEqual(['ana', 'luis'])
  })
})

describe('equipo: responsabilidades', () => {
  it('quién responde de cada área y cuáles no tienen a nadie (las de más trabajo primero)', () => {
    const d = data({
      members: [member('ana', { areaIds: ['ux'] }), member('bea', { areaIds: ['arte'], active: false })],
      items: [
        item('i1', { areaId: 'steam' }),
        item('i2', { areaId: 'steam' }),
        item('i3', { areaId: 'arte' }),
        item('i4', { areaId: 'ux', status: 'done', completedAt: '2026-10-01' }),
      ],
    })
    const r = teamResponsibilities(d)
    expect(r.areas.map((a) => [a.area.id, a.owners.map((m) => m.id), a.former.map((m) => m.id), a.open])).toEqual([
      ['ux', ['ana'], [], 0],
      ['arte', [], ['bea'], 1],
      ['steam', [], [], 2],
    ])
    expect(r.unowned.map((a) => a.area.id)).toEqual(['steam', 'arte'])
    expect(teamResponsibilities(d, 'q').unowned.map((a) => a.open)).toEqual([0, 0])
  })
})
