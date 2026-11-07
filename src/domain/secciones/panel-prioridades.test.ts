import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import {
  agendaByDay,
  agendaGrid,
  attentionAlerts,
  dashboardPriorities,
  milestoneRisk,
  panelAgenda,
  priorityDeadlinePoints,
  priorityHasData,
  priorityPoints,
  type PriorityFlagKind,
  type PriorityRow,
} from '../selectors'
import { SCHEMA_VERSION, type Checklist, type Release, type StoreListing, type StudioData, type StudioEvent, type WorkItem } from '../types'

const TODAY = '2026-11-02'
const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string) => ({
  id,
  slug: id,
  name: id,
  description: '',
  platforms: [],
  status: 'desarrollo',
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
const release = (id: string, over: Partial<Release> = {}): Release => ({
  id,
  projectId: 'a',
  kind: 'update',
  name: id,
  status: 'planned',
  sources: src,
  confidence: 'to_confirm',
  ...over,
})
const listing = (id: string, over: Partial<StoreListing> = {}): StoreListing => ({
  id,
  projectId: 'a',
  platform: 'steam',
  kind: 'game',
  status: 'draft',
  sources: src,
  confidence: 'to_confirm',
  ...over,
})
const checklist = (id: string, done: boolean[], over: Partial<Checklist> = {}): Checklist => ({
  id,
  projectId: 'a',
  title: id,
  target: 'event',
  items: done.map((d, n) => ({ id: `${id}-${n}`, label: `Paso ${n}`, done: d })),
  ...over,
})

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('a'), project('b')],
    ...over,
  }
}

const ids = (rows: PriorityRow[]) => rows.map((r) => r.target.id)
const flags = (row: PriorityRow | undefined): PriorityFlagKind[] => (row?.flags ?? []).map((f) => f.kind)
const row = (rows: PriorityRow[], id: string) => rows.find((r) => r.target.id === id)

describe('Prioridades: qué junta', () => {
  it('lo crítico, lo vencido, lo que vence en 3 días, lo de hoy y lo bloqueado; lo demás, no', () => {
    const d = data({
      items: [
        item('critica', { priority: 'critical' }),
        item('vencida', { dueDate: '2026-10-30' }),
        item('hoy', { dueDate: TODAY }),
        item('en-3', { dueDate: '2026-11-05' }),
        item('en-4', { dueDate: '2026-11-06' }),
        item('foco', { focusDate: TODAY }),
        item('foco-ayer', { focusDate: '2026-11-01' }),
        item('bloqueada', { status: 'blocked', blockedReason: 'Falta el arte' }),
        item('normal'),
      ],
    })
    const rows = dashboardPriorities(d, TODAY)
    expect(ids(rows).sort()).toEqual(['bloqueada', 'critica', 'en-3', 'foco', 'hoy', 'vencida'])
    expect(flags(row(rows, 'vencida'))).toEqual(['overdue'])
    expect(row(rows, 'vencida')!.flags[0]).toMatchObject({ kind: 'overdue', days: 3 })
    expect(flags(row(rows, 'hoy'))).toEqual(['dueToday'])
    expect(row(rows, 'en-3')!.flags[0]).toMatchObject({ kind: 'dueSoon', days: 3 })
    expect(flags(row(rows, 'foco'))).toEqual(['focus'])
    expect(flags(row(rows, 'bloqueada'))).toEqual(['blocked'])
    expect(row(rows, 'bloqueada')!.item?.blockedReason).toBe('Falta el arte')
  })

  it('nunca lo terminado ni lo cancelado, aunque esté vencido, sea crítico o esté marcado para hoy', () => {
    const d = data({
      items: [
        item('hecha', { status: 'done', completedAt: '2026-10-20', dueDate: '2026-10-10', priority: 'critical', focusDate: TODAY }),
        item('cancelada', { status: 'cancelled', dueDate: '2026-10-10', priority: 'critical' }),
        item('hito-hecho', { kind: 'milestone', status: 'done', dueDate: '2026-10-01' }),
      ],
    })
    expect(dashboardPriorities(d, TODAY)).toEqual([])
  })

  it('los objetivos no cuentan (no vencen como una tarea)', () => {
    const d = data({ items: [item('objetivo', { kind: 'goal', priority: 'critical', dueDate: '2026-10-01' })] })
    expect(dashboardPriorities(d, TODAY)).toEqual([])
  })

  it('una sola fila por cosa, con todas sus etiquetas', () => {
    const d = data({
      items: [
        item('fallo', { kind: 'issue', priority: 'critical', status: 'blocked', dueDate: '2026-10-31', focusDate: TODAY }),
        item('espera', { dependsOnIds: ['fallo'] }),
      ],
    })
    const rows = dashboardPriorities(d, TODAY)
    expect(rows.filter((r) => r.target.id === 'fallo')).toHaveLength(1)
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    expect(flags(row(rows, 'fallo'))).toEqual(['overdue', 'critical', 'blocked', 'issue', 'blocking', 'focus'])
  })

  it('un evento con la inscripción por cerrar y pasos sin hacer sale una vez, con las dos cosas', () => {
    const d = data({
      events: [event('feria', { date: '2026-11-10', registrationStatus: 'open', registrationDeadline: '2026-11-06', registrationDeadlineConfirmed: false })],
      checklists: [checklist('material', [true, false, false], { eventId: 'feria' })],
    })
    const rows = dashboardPriorities(d, TODAY)
    expect(rows).toHaveLength(1)
    expect(flags(rows[0])).toEqual(['registration', 'eventSteps'])
    expect(rows[0].flags[1]).toMatchObject({ missing: 2, total: 3 })
    // Manda la fecha más próxima (el cierre), y se dice que no está confirmada.
    expect(rows[0].date).toBe('2026-11-06')
    expect(rows[0].confirmed).toBe(false)
  })

  it('incidencias bloqueantes: las incidencias bloqueadas o críticas; una incidencia normal, no', () => {
    const d = data({
      items: [
        item('fallo-critico', { kind: 'issue', priority: 'critical' }),
        item('fallo-bloqueado', { kind: 'issue', status: 'blocked' }),
        item('fallo-normal', { kind: 'issue' }),
        item('tarea-critica', { priority: 'critical' }),
      ],
    })
    const rows = dashboardPriorities(d, TODAY)
    expect(flags(row(rows, 'fallo-critico'))).toContain('issue')
    expect(flags(row(rows, 'fallo-bloqueado'))).toContain('issue')
    expect(row(rows, 'fallo-normal')).toBeUndefined()
    expect(flags(row(rows, 'tarea-critica'))).not.toContain('issue')
  })
})

describe('Prioridades: dependencias', () => {
  const d = () =>
    data({
      items: [
        item('motor', { status: 'in_progress' }),
        item('menu', { dependsOnIds: ['motor'] }),
        item('tienda', { dependsOnIds: ['motor', 'hecha'] }),
        item('pruebas', { dependsOnIds: ['motor'], status: 'done', completedAt: '2026-10-30' }),
        item('hecha', { status: 'done', completedAt: '2026-10-20' }),
        item('suelta', { dependsOnIds: ['hecha'] }),
      ],
    })

  it('lo que impide seguir a otras cosas abiertas: «Bloquea a N» (lo terminado que dependía no cuenta)', () => {
    const r = row(dashboardPriorities(d(), TODAY), 'motor')!
    expect(r.flags).toEqual([{ kind: 'blocking', n: 2 }])
    expect(r.blocking.map((i) => i.id).sort()).toEqual(['menu', 'tienda'])
  })

  it('lo que espera a otras abiertas lo dice, y a qué espera; si lo que esperaba ya está hecho, no espera', () => {
    const rows = dashboardPriorities(d(), TODAY)
    expect(row(rows, 'menu')!.flags).toEqual([{ kind: 'waiting', n: 1 }])
    expect(row(rows, 'tienda')!.waitingOn.map((i) => i.id)).toEqual(['motor'])
    expect(row(rows, 'suelta')).toBeUndefined()
    expect(row(rows, 'hecha')).toBeUndefined()
  })

  it('lo que bloquea va antes que lo que espera', () => {
    const rows = dashboardPriorities(d(), TODAY)
    expect(ids(rows)).toEqual(['motor', 'menu', 'tienda'])
  })
})

describe('Prioridades: hitos en riesgo', () => {
  it('un hito abierto cuya fecha ya pasó está en riesgo (y vencido)', () => {
    const d = data({ items: [item('hito', { kind: 'milestone', dueDate: '2026-10-25' })] })
    const r = row(dashboardPriorities(d, TODAY), 'hito')!
    expect(flags(r)).toEqual(['overdue', 'milestoneRisk'])
    expect(r.flags[1]).toMatchObject({ late: true })
  })

  it('en 14 días o menos, con algo bloqueado o vencido colgando (a cualquier profundidad)', () => {
    const d = data({
      items: [
        item('hito', { kind: 'milestone', dueDate: '2026-11-12' }),
        item('func', { kind: 'feature', parentId: 'hito', status: 'done', completedAt: '2026-10-01' }),
        item('func-2', { kind: 'feature', parentId: 'hito', status: 'done', completedAt: '2026-10-01' }),
        item('nieta', { parentId: 'func', status: 'blocked' }),
      ],
    })
    const risk = milestoneRisk(d, d.items[0], TODAY)
    expect(risk).toMatchObject({ late: false, stuck: 1, open: 1, total: 3 })
  })

  it('en 14 días o menos, con más de la mitad sin hacer', () => {
    const base = (doneCount: number) =>
      data({
        items: [
          item('hito', { kind: 'milestone', dueDate: '2026-11-10' }),
          ...[0, 1, 2, 3].map((n) => item(`t${n}`, { parentId: 'hito', ...(n < doneCount ? { status: 'done' as const, completedAt: '2026-10-01' } : {}) })),
          // Lo cancelado no cuenta ni como hecho ni como pendiente.
          item('cancelada', { parentId: 'hito', status: 'cancelled' }),
        ],
      })
    expect(milestoneRisk(base(1), base(1).items[0], TODAY)).toMatchObject({ open: 3, total: 4 })
    // La mitad justa no es «más de la mitad».
    expect(milestoneRisk(base(2), base(2).items[0], TODAY)).toBeNull()
  })

  it('no está en riesgo: a más de 14 días, sin fecha, o sin nada que cuelgue y con fecha por llegar', () => {
    const d = data({
      items: [
        item('lejano', { kind: 'milestone', dueDate: '2026-11-20' }),
        item('l1', { parentId: 'lejano', status: 'blocked' }),
        item('sin-fecha', { kind: 'milestone' }),
        item('s1', { parentId: 'sin-fecha', status: 'blocked' }),
        item('vacio', { kind: 'milestone', dueDate: '2026-11-08' }),
      ],
    })
    for (const m of d.items.filter((i) => i.kind === 'milestone')) expect(milestoneRisk(d, m, TODAY)).toBeNull()
    expect(ids(dashboardPriorities(d, TODAY))).toEqual(['l1', 's1'])
  })
})

describe('Prioridades: entregas, eventos y fichas', () => {
  it('versiones de los próximos 14 días que no han salido, diciendo si la fecha está sin confirmar', () => {
    const d = data({
      releases: [
        release('pronto', { targetDate: '2026-11-09', version: '1.2' }),
        release('confirmada', { targetDate: '2026-11-04', targetConfirmed: true }),
        release('lejos', { targetDate: '2026-11-17' }),
        release('pasada', { targetDate: '2026-10-30' }),
        release('salida', { targetDate: '2026-11-05', status: 'released', releasedAt: '2026-11-01' }),
        release('cancelada', { targetDate: '2026-11-05', status: 'cancelled' }),
      ],
    })
    const rows = dashboardPriorities(d, TODAY)
    expect(ids(rows).sort()).toEqual(['confirmada', 'pronto'])
    expect(row(rows, 'pronto')!.title).toBe('pronto (1.2)')
    expect(row(rows, 'pronto')!.confirmed).toBe(false)
    expect(row(rows, 'confirmada')!.confirmed).toBe(true)
  })

  it('eventos de los próximos 14 días con pasos sin hacer: «Faltan N pasos»; sin lista o con todo hecho, no', () => {
    const d = data({
      events: [
        event('feria', { date: '2026-11-08' }),
        event('lista-hecha', { date: '2026-11-08' }),
        event('sin-lista', { date: '2026-11-08' }),
        event('lejana', { date: '2026-12-01' }),
        event('celebrada', { date: '2026-11-08', status: 'done' }),
      ],
      checklists: [
        checklist('c1', [false, false, true], { eventId: 'feria' }),
        checklist('c2', [false], { eventId: 'feria' }),
        checklist('c3', [true, true], { eventId: 'lista-hecha' }),
        checklist('c4', [false], { eventId: 'lejana' }),
        checklist('c5', [false], { eventId: 'celebrada' }),
      ],
    })
    const rows = dashboardPriorities(d, TODAY)
    expect(ids(rows)).toEqual(['feria'])
    expect(rows[0].flags[0]).toMatchObject({ kind: 'eventSteps', missing: 3, total: 4, days: 6 })
  })

  it('fichas de tienda con cambios pedidos', () => {
    const d = data({ storeListings: [listing('steam', { status: 'changes_requested' }), listing('otra', { status: 'in_review' })] })
    const rows = dashboardPriorities(d, TODAY)
    expect(ids(rows)).toEqual(['steam'])
    expect(rows[0].target.collection).toBe('storeListings')
    expect(rows[0].title).toBe('Steam · Juego')
  })

  it('en un proyecto: lo suyo y los eventos de todo el estudio; lo de otro proyecto, no', () => {
    const d = data({
      items: [item('mia', { priority: 'critical' }), item('ajena', { projectId: 'b', priority: 'critical' })],
      events: [
        event('estudio', { registrationStatus: 'open', registrationDeadline: '2026-11-05' }),
        event('de-b', { projectId: 'b', registrationStatus: 'open', registrationDeadline: '2026-11-05' }),
      ],
      releases: [release('demo-b', { projectId: 'b', targetDate: '2026-11-04' })],
    })
    expect(ids(dashboardPriorities(d, TODAY, 'a')).sort()).toEqual(['estudio', 'mia'])
    expect(ids(dashboardPriorities(d, TODAY)).sort()).toEqual(['ajena', 'de-b', 'demo-b', 'estudio', 'mia'])
  })
})

describe('Prioridades: el orden', () => {
  it('los puntos por el plazo', () => {
    expect(priorityDeadlinePoints(undefined)).toBe(0)
    expect(priorityDeadlinePoints(-1)).toBe(31)
    expect(priorityDeadlinePoints(-25)).toBe(40)
    expect(priorityDeadlinePoints(0)).toBe(24)
    expect(priorityDeadlinePoints(1)).toBe(20)
    expect(priorityDeadlinePoints(3)).toBe(12)
    expect(priorityDeadlinePoints(4)).toBe(10)
    expect(priorityDeadlinePoints(14)).toBe(0)
    expect(priorityDeadlinePoints(30)).toBe(0)
  })

  it('la fórmula: impacto + plazo + urgencia + dependencias', () => {
    // Crítica (40), vencida hace 2 días (32), bloqueada (+15), incidencia (+10), bloquea a 6 (+30, el máximo).
    expect(
      priorityPoints(40, [{ kind: 'overdue', date: '2026-10-31', days: 2 }, { kind: 'blocked' }, { kind: 'issue' }, { kind: 'blocking', n: 6 }], -2),
    ).toEqual({ impact: 40, deadline: 32, urgency: 25, dependencies: 30 })
    // Media (20) que espera a otra (−10), marcada para hoy (+10), sin fecha.
    expect(priorityPoints(20, [{ kind: 'waiting', n: 1 }, { kind: 'focus' }], undefined)).toEqual({ impact: 20, deadline: 0, urgency: 10, dependencies: -10 })
    // Pasos sin hacer: uno por paso, como mucho 10.
    expect(priorityPoints(30, [{ kind: 'eventSteps', date: TODAY, days: 0, missing: 25, total: 30, confirmed: true }], 0).urgency).toBe(10)
  })

  it('por puntos; a igualdad, la fecha más próxima y después el título', () => {
    const d = data({
      items: [
        item('b-alta', { priority: 'high', focusDate: TODAY }), // 30 + 10 = 40
        item('a-alta', { priority: 'high', focusDate: TODAY }), // 40: mismo título no, va antes por orden alfabético
        item('critica-sin-fecha', { priority: 'critical' }), // 40, sin fecha: después de las que tienen
        item('critica-vence-hoy', { priority: 'critical', dueDate: TODAY }), // 40 + 24 = 64
        item('media-vencida', { dueDate: '2026-10-31' }), // 20 + 32 = 52
        item('baja-vence-manana', { priority: 'low', dueDate: '2026-11-03' }), // 10 + 20 = 30
        item('alta-con-fecha', { priority: 'high', focusDate: TODAY, dueDate: '2026-11-20' }), // 30 + 0 + 10 = 40, con fecha
      ],
    })
    const rows = dashboardPriorities(d, TODAY)
    expect(rows.map((r) => [r.target.id, r.score])).toEqual([
      ['critica-vence-hoy', 64],
      ['media-vencida', 52],
      ['alta-con-fecha', 40],
      ['a-alta', 40],
      ['b-alta', 40],
      ['critica-sin-fecha', 40],
      ['baja-vence-manana', 30],
    ])
  })

  it('la importancia de lo que no es trabajo: un lanzamiento pesa más que un parche', () => {
    const d = data({
      releases: [release('parche', { kind: 'patch', targetDate: '2026-11-05' }), release('lanzamiento', { kind: 'launch', targetDate: '2026-11-05' })],
      storeListings: [listing('ficha', { status: 'changes_requested', kind: 'playtest' })],
    })
    const rows = dashboardPriorities(d, TODAY)
    // Lanzamiento 40 + 12; ficha de prueba 20 + 15; parche 20 + 12.
    expect(rows.map((r) => [r.target.id, r.score])).toEqual([
      ['lanzamiento', 52],
      ['ficha', 35],
      ['parche', 32],
    ])
  })
})

describe('Prioridades: ¿hay datos?', () => {
  it('sin nada abierto no hay de qué avisar (el bloque lo dice en vez de «Nada urgente»)', () => {
    expect(priorityHasData(data(), null)).toBe(false)
    expect(priorityHasData(data({ items: [item('hecha', { status: 'done' })] }), null)).toBe(false)
    expect(priorityHasData(data({ items: [item('abierta')] }), null)).toBe(true)
    expect(priorityHasData(data({ items: [item('abierta')] }), 'b')).toBe(false)
  })

  it('mira el trabajo del ámbito: una reunión del estudio o una versión no bastan', () => {
    const d = data({
      events: [event('reunion', { type: 'meeting', date: '2026-11-06' })],
      releases: [release('parche', { projectId: 'b', targetDate: '2026-12-20' })],
      storeListings: [listing('ficha', { projectId: 'b' })],
    })
    expect(priorityHasData(d, 'b')).toBe(false)
    expect(priorityHasData(d, null)).toBe(false)
  })

  it('en todo el estudio, el trabajo de un proyecto archivado no cuenta', () => {
    const d = data({ projects: [project('a'), { ...project('viejo'), status: 'archivado' }], items: [item('abierta', { projectId: 'viejo' })] })
    expect(priorityHasData(d, null)).toBe(false)
    expect(priorityHasData(d, 'viejo')).toBe(true)
  })
})

describe('Prioridades: proyectos archivados y lo que está por confirmar', () => {
  it('en todo el estudio, nada de un proyecto archivado; en su ficha, sí', () => {
    const d = data({
      projects: [project('a'), { ...project('viejo'), status: 'archivado' }],
      items: [item('critica-vieja', { projectId: 'viejo', priority: 'critical', dueDate: '2026-10-20' }), item('critica', { priority: 'critical' })],
      releases: [release('parche-viejo', { projectId: 'viejo', targetDate: '2026-11-05' })],
      events: [event('feria-vieja', { projectId: 'viejo', date: '2026-11-08', registrationStatus: 'open', registrationDeadline: '2026-11-04' })],
      storeListings: [listing('ficha-vieja', { projectId: 'viejo', status: 'changes_requested' })],
    })
    expect(ids(dashboardPriorities(d, TODAY, null))).toEqual(['critica'])
    expect(ids(dashboardPriorities(d, TODAY, 'viejo')).sort()).toEqual(['critica-vieja', 'feria-vieja', 'ficha-vieja', 'parche-viejo'])
  })

  it('un hito o una tarea por confirmar dice «sin confirmar» (como la tarjeta del proyecto)', () => {
    const d = data({
      items: [
        item('hito', { kind: 'milestone', status: 'to_confirm', confidence: 'to_confirm', dueDate: '2026-11-01' }),
        item('tarea', { confidence: 'to_confirm', priority: 'critical' }),
        item('segura', { priority: 'critical' }),
      ],
    })
    const rows = dashboardPriorities(d, TODAY)
    expect(row(rows, 'hito')).toMatchObject({ confirmed: false })
    expect(flags(row(rows, 'hito'))).toEqual(['overdue', 'milestoneRisk'])
    expect(row(rows, 'tarea')?.confirmed).toBe(false)
    expect(row(rows, 'segura')?.confirmed).toBe(true)
  })
})

describe('Calendario resumido', () => {
  const d = () =>
    data({
      items: [
        item('tarea', { dueDate: '2026-11-04' }),
        item('hito', { kind: 'milestone', dueDate: '2026-11-04' }),
        item('hecha', { status: 'done', dueDate: '2026-11-04' }),
      ],
      events: [
        event('feria', { date: '2026-10-31', endDate: '2026-11-03', dateConfirmed: false }),
        event('reunion', { type: 'meeting', date: '2026-11-09', time: '10:00' }),
      ],
      reminders: [{ id: 'r', title: 'Llamar', date: TODAY, done: false }],
      releases: [release('demo', { targetDate: '2026-11-15' })],
    })

  it('junta tareas, hitos (marcados como hitos), eventos, recordatorios y versiones; lo hecho, no', () => {
    const list = panelAgenda(d(), TODAY, 60)
    expect(list.map((e) => e.target.id)).toEqual(['feria', 'r', 'hito', 'tarea', 'reunion', 'demo'])
    expect(list.find((e) => e.target.id === 'hito')!.milestone).toBe(true)
    expect(list.find((e) => e.target.id === 'tarea')!.milestone).toBeUndefined()
    expect(list.find((e) => e.target.id === 'feria')!.confirmed).toBe(false)
  })

  it('agrupa por día; lo que empezó antes y sigue va en hoy', () => {
    const days = agendaByDay(panelAgenda(d(), TODAY, 60), TODAY)
    expect(days.map((g) => [g.date, g.entries.map((e) => e.target.id)])).toEqual([
      [TODAY, ['feria', 'r']],
      ['2026-11-04', ['hito', 'tarea']],
      ['2026-11-09', ['reunion']],
      ['2026-11-15', ['demo']],
    ])
  })

  it('la cuadrícula: semanas completas que cubren 14 días desde hoy; un evento de varios días sale en cada uno', () => {
    // 2026-11-02 es lunes: con la semana en lunes, dos semanas justas.
    const weeks = agendaGrid(panelAgenda(d(), TODAY, 13), TODAY, 1)
    expect(weeks).toHaveLength(2)
    expect(weeks[0][0]).toMatchObject({ date: TODAY, inRange: true })
    expect(weeks[1][6]).toMatchObject({ date: '2026-11-15', inRange: true })
    expect(weeks[0][0].entries.map((e) => e.target.id)).toEqual(['feria', 'r'])
    expect(weeks[0][1].entries.map((e) => e.target.id)).toEqual(['feria'])
    expect(weeks[0][2].entries.map((e) => e.target.id)).toEqual(['hito', 'tarea'])
    // Con la semana en domingo, empieza el domingo de antes (fuera de rango) y hacen falta tres.
    const sunday = agendaGrid(panelAgenda(d(), TODAY, 13), TODAY, 0)
    expect(sunday).toHaveLength(3)
    expect(sunday[0][0]).toMatchObject({ date: '2026-11-01', inRange: false, entries: [] })
    expect(sunday[2].filter((c) => c.inRange)).toHaveLength(1)
  })
})

describe('Necesita atención: sin repetir lo de otros bloques', () => {
  const d = () =>
    data({
      items: [item('vencida', { dueDate: '2026-10-30' }), item('bloqueada', { status: 'blocked', priority: 'high' })],
      events: [event('feria', { date: '2026-11-08', registrationStatus: 'open', registrationDeadline: '2026-11-05' })],
      releases: [release('pronto', { targetDate: '2026-11-06' }), release('tarde', { targetDate: '2026-10-20' })],
      reminders: [
        { id: 'hoy', title: 'Hoy', date: TODAY, done: false },
        { id: 'atrasado', title: 'Atrasado', date: '2026-10-28', done: false },
      ],
      feedback: [
        { id: 'f', projectId: 'a', title: 'Opinión', origin: 'playtest', status: 'new', impact: 'medium', linkedItemIds: [], sources: src, confidence: 'verified' },
      ],
    })

  it('con todos los bloques a la vista, solo lo que no sale en otro: recordatorios atrasados, versiones pasadas y presupuestos', () => {
    expect(attentionAlerts(d(), TODAY).map((n) => `${n.kind}:${n.target.id}`).sort()).toEqual(['releaseLate:tarde', 'reminder:atrasado'])
  })

  it('si el estudio oculta un bloque, sus avisos vuelven aquí', () => {
    const kinds = (hidden: string[]) => attentionAlerts(d(), TODAY, null, hidden).map((n) => `${n.kind}:${n.target.id}`).sort()
    expect(kinds(['priorities'])).toEqual(
      ['blocked:bloqueada', 'overdue:vencida', 'registrationSoon:feria', 'releaseLate:tarde', 'releaseSoon:pronto', 'reminder:atrasado'].sort(),
    )
    expect(kinds(['agenda'])).toEqual(['eventSoon:feria', 'releaseLate:tarde', 'reminder:atrasado', 'reminder:hoy'].sort())
    expect(kinds(['feedback'])).toContain('newFeedback:f')
  })

  it('lo que sale en Prioridades como aviso de la campana sale también como fila (nada se pierde)', () => {
    const rows = dashboardPriorities(d(), TODAY)
    expect(ids(rows).sort()).toEqual(['bloqueada', 'feria', 'pronto', 'vencida'])
  })
})
