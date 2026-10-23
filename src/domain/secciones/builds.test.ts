import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Activity, type Build, type Feedback, type StudioData, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import {
  buildGroupDefaults,
  buildGroupOf,
  buildStretches,
  buildsInChannelGroup,
  changelogLines,
  compareBuilds,
  issuesByBuild,
  undatedBuilds,
} from '../selectors'

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
const build = (id: string, over: Partial<Build> = {}): Build => ({
  id,
  projectId: 'p',
  name: id,
  version: '1.0',
  channel: 'demo',
  platforms: [],
  status: 'ready',
  sources: src,
  confidence: 'verified',
  ...over,
})
const item = (id: string, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  projectId: 'p',
  kind: 'issue',
  title: id,
  status: 'backlog',
  priority: 'medium',
  tags: [],
  sources: src,
  confidence: 'verified',
  ...over,
})
const commit = (id: string, at: string, projectId = 'p'): Activity => ({ id, projectId, at, type: 'commit', title: id, ref: id })
const feedback = (id: string, over: Partial<Feedback> = {}): Feedback => ({
  id,
  projectId: 'p',
  title: id,
  origin: 'playtest',
  status: 'new',
  impact: 'medium',
  linkedItemIds: [],
  sources: src,
  confidence: 'verified',
  ...over,
})

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('p'), project('q')],
    ...over,
  }
}

describe('subsecciones de Builds', () => {
  const d = data({
    builds: [
      build('interna', { channel: 'internal', status: 'ready', date: '2026-10-01' }),
      build('demo-curso', { channel: 'demo', status: 'in_progress', date: '2026-10-05' }),
      build('beta', { channel: 'beta', status: 'published', date: '2026-10-03' }),
      build('prueba', { channel: 'playtest', status: 'superseded', date: '2026-09-01' }),
      build('feria', { channel: 'event', status: 'candidate', date: '2026-10-02' }),
      build('juego', { channel: 'full', status: 'published', date: '2026-10-04' }),
      build('otro', { projectId: 'q', channel: 'full', status: 'candidate' }),
    ],
  })
  const ids = (group: Parameters<typeof buildsInChannelGroup>[1], scope: string | null = null) => buildsInChannelGroup(d, group, scope).map((b) => b.id)

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('todas, de la más reciente a la más antigua y las sin fecha al final', () => {
    expect(ids(null)).toEqual(['demo-curso', 'juego', 'beta', 'feria', 'interna', 'prueba', 'otro'])
  })

  it('desarrollo: el canal interno y cualquier build a medias', () => {
    expect(ids('desarrollo')).toEqual(['demo-curso', 'interna'])
  })

  it('pruebas, demos, públicas y candidatas', () => {
    expect(ids('pruebas')).toEqual(['beta', 'prueba'])
    expect(ids('demos')).toEqual(['demo-curso', 'feria'])
    expect(ids('publicas')).toEqual(['juego', 'beta'])
    expect(ids('candidatas')).toEqual(['feria', 'otro'])
  })

  it('respeta el ámbito', () => {
    expect(ids('candidatas', 'p')).toEqual(['feria'])
    expect(ids(null, 'q')).toEqual(['otro'])
  })

  it('solo acepta subsecciones conocidas en la URL', () => {
    expect(buildGroupOf('demos')).toBe('demos')
    expect(buildGroupOf('otra')).toBeNull()
    expect(buildGroupOf(null)).toBeNull()
  })

  it('lo nuevo hereda la subsección', () => {
    expect(buildGroupDefaults('pruebas')).toEqual({ channel: 'playtest' })
    expect(buildGroupDefaults('candidatas')).toEqual({ status: 'candidate' })
    expect(buildGroupDefaults(null)).toEqual({})
  })

  it('ordena por fecha y, a igual fecha, por nombre', () => {
    const list = [build('b', { date: '2026-10-01' }), build('a', { date: '2026-10-01' }), build('c')]
    expect(list.sort(compareBuilds).map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('changelog de una build', () => {
  it('una línea por cambio, sin viñetas ni líneas vacías', () => {
    expect(changelogLines({ changelog: '- Arreglo A\n\n* Arreglo B\r\n  2. Mejora C  \n• Otra\nSin viñeta' })).toEqual([
      'Arreglo A',
      'Arreglo B',
      'Mejora C',
      'Otra',
      'Sin viñeta',
    ])
    expect(changelogLines({})).toEqual([])
  })

  it('no confunde un guion dentro del texto con una viñeta', () => {
    expect(changelogLines({ changelog: '-Arreglo pegado\nModo 2-3 jugadores' })).toEqual(['-Arreglo pegado', 'Modo 2-3 jugadores'])
  })
})

describe('historial de cambios entre builds', () => {
  const builds = [
    build('demo-1', { date: '2026-10-06' }),
    build('juego-1', { channel: 'full', date: '2026-10-06' }),
    build('demo-2', { date: '2026-10-11' }),
    build('sin-fecha'),
  ]
  const activity = [
    commit('c1', '2026-10-01T10:00'),
    commit('c2', '2026-10-06T23:00'),
    commit('c3', '2026-10-07T09:00'),
    commit('c4', '2026-10-11T08:00'),
    commit('c5', '2026-10-15T12:00'),
  ]
  const done = [item('t1', { status: 'done', completedAt: '2026-10-08' }), item('t2', { status: 'done', completedAt: '2026-10-20' })]

  it('reparte commits y terminados entre las builds, de lo más nuevo a lo más antiguo', () => {
    const s = buildStretches(builds, activity, done)
    expect(
      s.map((x) => [x.date ?? 'abierto', x.since ?? 'principio', x.builds.map((b) => b.id), x.activity.map((a) => a.id), x.done.map((i) => i.id)]),
    ).toEqual([
      ['abierto', '2026-10-11', [], ['c5'], ['t2']],
      ['2026-10-11', '2026-10-06', ['demo-2'], ['c4', 'c3'], ['t1']],
      ['2026-10-06', 'principio', ['demo-1', 'juego-1'], ['c2', 'c1'], []],
    ])
  })

  it('el tramo abierto solo sale si tiene algo', () => {
    const s = buildStretches(builds, activity.slice(0, 3), [])
    expect(s.map((x) => x.date)).toEqual(['2026-10-11', '2026-10-06'])
    expect(s[0].activity.map((a) => a.id)).toEqual(['c3'])
  })

  it('sin builds con fecha, todo va al tramo abierto', () => {
    const s = buildStretches([build('x')], activity, [])
    expect(s).toHaveLength(1)
    expect(s[0].builds).toEqual([])
    expect(s[0].since).toBeUndefined()
    expect(s[0].activity).toHaveLength(5)
    expect(buildStretches([], [], [])).toEqual([])
  })

  it('las builds sin fecha se apartan', () => {
    expect(undatedBuilds(builds).map((b) => b.id)).toEqual(['sin-fecha'])
  })
})

describe('incidencias por versión', () => {
  const d = data({
    builds: [build('vieja', { date: '2026-09-01' }), build('nueva', { date: '2026-10-01' }), build('ajena', { projectId: 'q', date: '2026-10-05' })],
    items: [
      item('i1', { buildId: 'vieja', priority: 'low' }),
      item('i2', { buildId: 'vieja', priority: 'critical' }),
      item('i3', { buildId: 'nueva', status: 'done', completedAt: '2026-10-02' }),
      item('i4'),
      item('i5', { buildId: 'borrada' }),
      item('i6', { projectId: 'q', buildId: 'ajena', tags: ['steam'] }),
      item('tarea', { kind: 'task', buildId: 'nueva' }),
    ],
    feedback: [feedback('f1', { buildId: 'nueva', receivedAt: '2026-10-03' }), feedback('f2', { buildId: 'nueva', receivedAt: '2026-10-04' }), feedback('f3')],
  })

  it('agrupa por build (la más reciente primero) y deja al final las que no dicen build', () => {
    const g = issuesByBuild(d)
    expect(g.map((x) => x.build?.id ?? 'sin build')).toEqual(['ajena', 'nueva', 'vieja', 'sin build'])
    const vieja = g.find((x) => x.build?.id === 'vieja')!
    expect(vieja.open.map((i) => i.id)).toEqual(['i2', 'i1'])
    const nueva = g.find((x) => x.build?.id === 'nueva')!
    expect(nueva.open).toEqual([])
    expect(nueva.closed.map((i) => i.id)).toEqual(['i3'])
    expect(nueva.feedback.map((f) => f.id)).toEqual(['f2', 'f1'])
    expect(g[g.length - 1].open.map((i) => i.id)).toEqual(['i4', 'i5'])
  })

  it('solo cuenta incidencias, respeta el ámbito y el filtro', () => {
    expect(issuesByBuild(d, 'q').map((x) => x.build?.id)).toEqual(['ajena'])
    const tagged = issuesByBuild(d, null, (x) => !!x.tags?.includes('steam'))
    expect(tagged.map((x) => x.build?.id)).toEqual(['ajena'])
    expect(issuesByBuild(data()).length).toBe(0)
  })
})
