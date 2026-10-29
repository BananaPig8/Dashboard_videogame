import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Feedback, type Playtest, type StudioData, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import {
  feedbackBugs,
  feedbackByStatus,
  feedbackChanges,
  feedbackFiltered,
  feedbackKindCounts,
  feedbackList,
  feedbackMatrix,
  feedbackQueryOf,
  feedbackQueue,
  feedbackQuickStatuses,
  feedbackTipoDefaults,
  feedbackTipoOf,
  playtestFeedbackWithoutTest,
  playtestReports,
  unlinkedIssues,
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
const fb = (id: string, over: Partial<Feedback> = {}): Feedback => ({
  id,
  projectId: 'p',
  title: id,
  origin: 'community',
  status: 'new',
  impact: 'medium',
  linkedItemIds: [],
  sources: src,
  confidence: 'verified',
  ...over,
})
const test = (id: string, over: Partial<Playtest> = {}): Playtest => ({
  id,
  projectId: 'p',
  title: id,
  method: 'friends',
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

const params = (s: string) => new URLSearchParams(s)

describe('subsecciones y filtros de Feedback', () => {
  const d = data({
    feedback: [
      fb('comentario', { kind: 'comment', receivedAt: '2026-10-01', tags: ['ui'] }),
      fb('bug-critico', { kind: 'bug', impact: 'critical', status: 'triaged', origin: 'event' }),
      fb('mejora', { kind: 'request', status: 'planned', impact: 'high', detail: 'Más idiomas' }),
      fb('suelto', { receivedAt: '2026-10-03' }),
      fb('resuelto', { kind: 'bug', status: 'addressed', impact: 'high' }),
      fb('otro-proyecto', { projectId: 'q', kind: 'comment' }),
    ],
  })
  const ids = (s: string, scope: string | null = null) => feedbackList(d, feedbackQueryOf(params(s), scope)).map((f) => f.id)

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('el tipo de la URL solo vale si es una subsección', () => {
    expect(feedbackTipoOf('bugs')).toBe('bugs')
    expect(feedbackTipoOf('otra')).toBeNull()
    expect(feedbackTipoOf(null)).toBeNull()
    expect(feedbackTipoDefaults('mejoras')).toEqual({ kind: 'request' })
    expect(feedbackTipoDefaults(null)).toEqual({})
  })

  it('todo, ordenado por estado, impacto y fecha', () => {
    expect(ids('')).toEqual(['suelto', 'comentario', 'otro-proyecto', 'bug-critico', 'mejora', 'resuelto'])
  })

  it('cada tipo solo enseña su clase', () => {
    expect(ids('tipo=comentarios')).toEqual(['comentario', 'otro-proyecto'])
    expect(ids('tipo=bugs')).toEqual(['bug-critico', 'resuelto'])
    expect(ids('tipo=mejoras')).toEqual(['mejora'])
  })

  it('«Sin clasificar» es un filtro propio de Todo', () => {
    expect(ids('clase=sin-clasificar')).toEqual(['suelto'])
    // En otra subsección no tiene sentido: se ignora.
    expect(ids('tipo=bugs&clase=sin-clasificar')).toEqual(['bug-critico', 'resuelto'])
  })

  it('filtros finos: estado, impacto, origen, búsqueda, etiqueta y ámbito', () => {
    expect(ids('estado=abierto')).toEqual(['suelto', 'comentario', 'otro-proyecto', 'bug-critico', 'mejora'])
    expect(ids('estado=cerrado')).toEqual(['resuelto'])
    expect(ids('estado=triaged')).toEqual(['bug-critico'])
    expect(ids('impacto=high')).toEqual(['mejora', 'resuelto'])
    expect(ids('origen=event')).toEqual(['bug-critico'])
    expect(ids('q=idiomas')).toEqual(['mejora'])
    expect(ids('etiqueta=UI')).toEqual(['comentario'])
    expect(ids('', 'q')).toEqual(['otro-proyecto'])
    // Lo que no se entiende se ignora.
    expect(ids('estado=raro&impacto=enorme&origen=marte')).toHaveLength(6)
  })

  it('sabe si hay filtros finos puestos', () => {
    expect(feedbackFiltered(feedbackQueryOf(params('tipo=bugs')))).toBe(false)
    expect(feedbackFiltered(feedbackQueryOf(params('impacto=low')))).toBe(true)
    expect(feedbackFiltered(feedbackQueryOf(params('q=%20')))).toBe(false)
  })

  it('agrupa por estado, en orden y sin grupos vacíos', () => {
    const groups = feedbackByStatus(feedbackList(d, feedbackQueryOf(params(''))))
    expect(groups.map((g) => [g.status, g.list.length])).toEqual([
      ['new', 3],
      ['triaged', 1],
      ['planned', 1],
      ['addressed', 1],
    ])
  })

  it('cuenta cuántos hay de cada clase', () => {
    expect(feedbackKindCounts(d)).toEqual({ comment: 2, bug: 2, request: 1, none: 1 })
    expect(feedbackKindCounts(d, 'q')).toEqual({ comment: 1, bug: 0, request: 0, none: 0 })
  })
})

describe('Bugs: feedback que es un bug ∪ incidencias, sin repetir', () => {
  const d = data({
    items: [
      item('enlazada', { priority: 'high' }),
      item('suelta', { priority: 'critical' }),
      item('cerrada', { status: 'done', completedAt: '2026-10-02' }),
      item('tarea', { kind: 'task' }),
      item('de-un-comentario'),
      item('de-otro', { projectId: 'q' }),
    ],
    feedback: [
      fb('bug', { kind: 'bug', impact: 'medium', linkedItemIds: ['enlazada'] }),
      fb('comentario', { kind: 'comment', linkedItemIds: ['de-un-comentario'] }),
      fb('bug-resuelto', { kind: 'bug', status: 'addressed', impact: 'low' }),
    ],
  })
  const keys = (s: string, scope: string | null = null) =>
    feedbackBugs(d, feedbackQueryOf(params(`tipo=bugs&${s}`), scope)).map((e) => (e.type === 'feedback' ? `f:${e.feedback.id}` : `i:${e.item.id}`))

  it('una incidencia enlazada por un bug sale una sola vez (dentro del bug)', () => {
    expect(unlinkedIssues(d, 'p').map((i) => i.id)).toEqual(['suelta', 'cerrada', 'de-un-comentario'])
    expect(keys('', 'p')).toEqual(['i:suelta', 'f:bug', 'i:de-un-comentario', 'i:cerrada', 'f:bug-resuelto'])
  })

  it('el estado abierto o cerrado vale para las dos; un estado concreto, solo para el feedback', () => {
    expect(keys('estado=cerrado', 'p')).toEqual(['i:cerrada', 'f:bug-resuelto'])
    expect(keys('estado=new', 'p')).toEqual(['f:bug'])
  })

  it('el impacto se compara con la prioridad; el origen deja fuera las incidencias', () => {
    expect(keys('impacto=critical', 'p')).toEqual(['i:suelta'])
    expect(keys('origen=community', 'p')).toEqual(['f:bug', 'f:bug-resuelto'])
  })

  it('aunque un filtro esconda el bug, su incidencia no sale suelta', () => {
    expect(keys('estado=addressed', 'p')).toEqual(['f:bug-resuelto'])
  })

  it('en todo el estudio salen también las del otro proyecto', () => {
    expect(keys('')).toContain('i:de-otro')
  })
})

describe('Priorización', () => {
  const d = data({
    feedback: [
      fb('planificado-critico', { status: 'planned', impact: 'critical' }),
      fb('nuevo-medio', { status: 'new', impact: 'medium', receivedAt: '2026-10-01' }),
      fb('revisado-alto', { status: 'triaged', impact: 'high' }),
      fb('nuevo-medio-reciente', { status: 'new', impact: 'medium', receivedAt: '2026-10-05' }),
      fb('resuelto', { status: 'addressed', impact: 'critical' }),
      fb('bug', { kind: 'bug', status: 'new', impact: 'low' }),
    ],
  })

  it('lo nuevo y lo revisado primero, por impacto; lo planificado después', () => {
    expect(feedbackQueue(d, feedbackQueryOf(params(''))).map((f) => f.id)).toEqual([
      'revisado-alto',
      'nuevo-medio-reciente',
      'nuevo-medio',
      'bug',
      'planificado-critico',
    ])
  })

  it('se combina con el tipo (Bugs en Priorización)', () => {
    expect(feedbackQueue(d, feedbackQueryOf(params('tipo=bugs'))).map((f) => f.id)).toEqual(['bug'])
  })

  it('impacto × estado', () => {
    const m = feedbackMatrix(feedbackQueue(d, feedbackQueryOf(params(''))))
    expect(m.critical.planned.map((f) => f.id)).toEqual(['planificado-critico'])
    expect(m.medium.new).toHaveLength(2)
    expect(m.critical.addressed).toEqual([])
  })

  it('acciones rápidas de estado', () => {
    expect(feedbackQuickStatuses('new')).toEqual(['triaged', 'planned', 'wont_do'])
    expect(feedbackQuickStatuses('planned')).toEqual(['addressed', 'wont_do'])
    expect(feedbackQuickStatuses('addressed')).toEqual(['triaged'])
  })
})

describe('Cambios por el feedback', () => {
  const d = data({
    items: [
      item('hecho-1', { kind: 'task', status: 'done', completedAt: '2026-10-02' }),
      item('hecho-2', { kind: 'feature', status: 'done', completedAt: '2026-10-09' }),
      item('en-curso', { kind: 'task', status: 'in_progress', priority: 'high' }),
      item('descartado', { kind: 'task', status: 'cancelled' }),
    ],
    feedback: [
      fb('cambiado', { status: 'addressed', linkedItemIds: ['hecho-1'] }),
      fb('cambiado-sin-cerrar', { status: 'planned', linkedItemIds: ['hecho-2', 'descartado'] }),
      fb('en-marcha', { status: 'planned', linkedItemIds: ['hecho-1', 'en-curso'] }),
      fb('solo-descartado', { status: 'wont_do', linkedItemIds: ['descartado'] }),
      fb('sin-enlaces', { status: 'new' }),
      fb('sin-enlaces-cerrado', { status: 'wont_do' }),
    ],
  })
  const c = feedbackChanges(d, feedbackQueryOf(params('')))

  it('lo que ya cambió, del cambio más reciente al más antiguo', () => {
    expect(c.changed.map((x) => [x.feedback.id, x.changedAt])).toEqual([
      ['cambiado-sin-cerrar', '2026-10-09'],
      ['cambiado', '2026-10-02'],
    ])
  })

  it('avisa si todo está hecho pero el feedback sigue abierto', () => {
    expect(c.changed.map((x) => x.canClose)).toEqual([true, false])
  })

  it('lo que está en marcha, con lo hecho y lo pendiente', () => {
    expect(c.inProgress.map((x) => x.feedback.id)).toEqual(['en-marcha'])
    expect(c.inProgress[0].done.map((i) => i.id)).toEqual(['hecho-1'])
    expect(c.inProgress[0].open.map((i) => i.id)).toEqual(['en-curso'])
  })

  it('lo enlazado sin nada hecho, y el feedback abierto sin enlaces', () => {
    expect(c.none.map((x) => x.feedback.id)).toEqual(['solo-descartado'])
    expect(c.unlinkedOpen.map((f) => f.id)).toEqual(['sin-enlaces'])
  })

  it('los enlaces a elementos que ya no existen no cuentan como hechos', () => {
    const roto = feedbackChanges(data({ feedback: [fb('roto', { linkedItemIds: ['no-existe'] })] }), feedbackQueryOf(params('')))
    expect(roto.none[0].missing).toEqual(['no-existe'])
  })
})

describe('Informes de pruebas', () => {
  const d = data({
    builds: [
      { id: 'demo', projectId: 'p', name: 'Demo', version: '0.9', channel: 'demo', platforms: [], status: 'ready', sources: src, confidence: 'verified' },
    ],
    events: [
      {
        id: 'feria',
        projectId: 'p',
        title: 'Feria',
        type: 'fair',
        status: 'done',
        date: '2026-09-20',
        dateConfirmed: true,
        sources: src,
        confidence: 'verified',
      },
    ],
    playtests: [
      test('sin-fecha'),
      test('antigua', { date: '2026-08-01' }),
      test('reciente', { date: '2026-09-20', method: 'event', buildId: 'demo', eventId: 'feria', participants: 12, tags: ['feria'] }),
      test('de-otro', { projectId: 'q', date: '2026-10-01' }),
    ],
    feedback: [
      fb('de-la-reciente', { origin: 'playtest', playtestId: 'reciente', impact: 'high' }),
      fb('de-la-reciente-2', { origin: 'playtest', playtestId: 'reciente', status: 'addressed' }),
      fb('de-prueba-sin-decir', { origin: 'playtest' }),
      fb('de-la-feria', { origin: 'event', eventId: 'feria' }),
    ],
  })

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('de la más reciente a la más antigua, con su build, su evento y su feedback', () => {
    const r = playtestReports(d, 'p')
    expect(r.map((x) => x.playtest.id)).toEqual(['reciente', 'antigua', 'sin-fecha'])
    expect(r[0].build?.id).toBe('demo')
    expect(r[0].event?.id).toBe('feria')
    expect(r[0].feedback.map((f) => f.id)).toEqual(['de-la-reciente', 'de-la-reciente-2'])
    expect(r[1].feedback).toEqual([])
  })

  it('respeta el ámbito y la etiqueta', () => {
    expect(playtestReports(d).map((x) => x.playtest.id)).toContain('de-otro')
    expect(playtestReports(d, null, 'feria').map((x) => x.playtest.id)).toEqual(['reciente'])
  })

  it('el feedback de pruebas que no dice de cuál', () => {
    expect(playtestFeedbackWithoutTest(d, 'p').map((f) => f.id)).toEqual(['de-prueba-sin-decir'])
  })
})

describe('feedback de un evento (?evento=)', () => {
  const d = data({
    events: [
      {
        id: 'feria',
        projectId: 'p',
        title: 'Feria',
        type: 'fair',
        status: 'done',
        date: '2026-09-20',
        dateConfirmed: true,
        sources: src,
        confidence: 'verified',
      },
    ],
    playtests: [test('stand', { method: 'event', eventId: 'feria' })],
    items: [item('incidencia')],
    feedback: [
      fb('del-evento', { origin: 'event', eventId: 'feria' }),
      fb('de-su-prueba', { origin: 'playtest', playtestId: 'stand' }),
      fb('de-otra-cosa', { kind: 'bug' }),
    ],
  })

  it('el que dice venir del evento y el de sus pruebas', () => {
    const q = feedbackQueryOf(params('evento=feria'), null, d)
    expect(q.eventoTests).toEqual(['stand'])
    expect(feedbackFiltered(q)).toBe(true)
    expect(feedbackList(d, q).map((f) => f.id)).toEqual(['de-su-prueba', 'del-evento'])
  })

  it('las incidencias no son de ningún evento', () => {
    expect(feedbackBugs(d, feedbackQueryOf(params('tipo=bugs&evento=feria'), null, d))).toEqual([])
  })
})
