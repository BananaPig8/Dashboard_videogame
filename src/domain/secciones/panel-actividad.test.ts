import { describe, expect, it } from 'vitest'
import { tr } from '../../i18n'
import { emptyCollections } from '../collections'
import {
  NOUN_CATEGORY,
  PANEL_FEEDBACK_LINKS,
  TIMELINE_CATEGORIES,
  feedbackBugs,
  feedbackLinkedToTask,
  feedbackList,
  feedbackQueryOf,
  feedbackTaskDefaults,
  panelFeedback,
  studioTimeline,
  timelineActionKey,
  timelineByDay,
  timelineCategoryCounts,
  timelineCategoryOf,
  timelinePeople,
  timelineStatusLabel,
  timelineVerbsOf,
  type TimelineNoun,
} from '../selectors'
import { SCHEMA_VERSION, type Activity, type ChangeEntry, type Feedback, type StudioData, type WorkItem } from '../types'
import { validateStudioData } from '../validate'

const TODAY = '2026-11-02'
const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string) => ({ id, slug: id, name: id, description: '', platforms: [], stage: 'production' as const, color: '#000', versions: [], tags: [], links: [] })
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
const change = (id: string, over: Partial<ChangeEntry>): ChangeEntry => ({
  id,
  at: `${TODAY}T10:00`,
  action: 'updated',
  collection: 'items',
  entityId: 'x',
  title: 'x',
  projectId: 'a',
  ...over,
})
const commit = (id: string, at: string, over: Partial<Activity> = {}): Activity => ({ id, projectId: 'a', at, type: 'commit', title: id, ...over })
const fb = (id: string, over: Partial<Feedback> = {}): Feedback => ({
  id,
  projectId: 'a',
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
    projects: [project('a'), project('b')],
    members: [
      { id: 'ana', name: 'Ana', kind: 'core', areaIds: [], active: true, aliases: ['ana-git'] },
      { id: 'leo', name: 'Leo', kind: 'core', areaIds: [], active: true },
    ],
    ...over,
  }
}

/** Unos datos con un poco de todo: registro, fechas de los datos y código. */
function mixed(): StudioData {
  return data({
    items: [
      // Creada y terminada antes del registro: dos entradas sin hora.
      item('vieja', { createdAt: '2026-10-20', status: 'done', completedAt: '2026-10-25' }),
      // Completada en la aplicación hoy: el registro la cuenta; su completedAt de hoy, no.
      item('hoy', { status: 'done', completedAt: TODAY }),
      // Marcada como hecha hoy, pero dice que se terminó otro día: son dos cosas.
      item('atrasada', { status: 'done', completedAt: '2026-10-30' }),
      item('hito', { kind: 'milestone', status: 'done', completedAt: '2026-10-28' }),
      item('bug', { kind: 'issue', status: 'done', completedAt: '2026-10-27' }),
      item('decision', { kind: 'decision', status: 'done', completedAt: '2026-10-26' }),
      item('futura', { createdAt: '2026-11-10' }),
      item('de-b', { projectId: 'b', status: 'done', completedAt: '2026-10-29' }),
    ],
    builds: [
      { id: 'build-1', projectId: 'a', name: 'Demo', version: '0.1', channel: 'demo', platforms: [], status: 'published', date: '2026-10-22', sources: src, confidence: 'to_confirm' },
    ],
    feedback: [fb('opinion', { receivedAt: '2026-10-21' }), fb('nuevo-hoy', { receivedAt: TODAY })],
    resources: [
      { id: 'acta', projectId: 'a', title: 'Acta', type: 'minutes', date: '2026-10-23', body: 'Acta', tags: [] },
      { id: 'nota-estudio', title: 'Nota del estudio', type: 'note', date: '2026-10-23', body: 'Nota', tags: [] },
      { id: 'tocada-hoy', projectId: 'a', title: 'Diseño', type: 'design', date: TODAY, body: 'Diseño', tags: [] },
    ],
    activity: [
      commit('c-ana', `${TODAY}T09:00`, { author: 'ana-git' }),
      commit('c-anon', '2026-10-31T18:30', { author: 'BananaPig8' }),
      commit('c-sin', '2026-10-31T12:00'),
      { id: 'fusion', projectId: 'a', at: '2026-10-31T19:00', type: 'merge', title: 'PR', ref: '#3', url: 'https://example.com/3' },
    ],
    changes: [
      change('k1', { action: 'completed', entityId: 'hoy', title: 'hoy', entityKind: 'task', memberId: 'ana', at: `${TODAY}T11:15`, from: 'in_progress', to: 'done' }),
      change('k2', { action: 'completed', entityId: 'atrasada', title: 'atrasada', entityKind: 'task', memberId: 'leo', at: `${TODAY}T08:00` }),
      change('k3', { action: 'created', collection: 'feedback', entityId: 'nuevo-hoy', title: 'nuevo-hoy', at: `${TODAY}T12:00` }),
      change('k4', { action: 'updated', collection: 'resources', entityId: 'tocada-hoy', title: 'Diseño', entityKind: 'design', fields: ['body'], at: `${TODAY}T13:00` }),
      change('k5', { action: 'deleted', entityId: 'borrada', title: 'Tarea borrada', entityKind: 'task', memberId: 'ana', at: `${TODAY}T14:00` }),
      change('k6', { action: 'created', collection: 'transactions', entityId: 'gasto', title: 'gasto', projectId: undefined, at: `${TODAY}T15:00` }),
      change('k7', { action: 'status', entityId: 'hoy', title: 'hoy', entityKind: 'task', at: '2026-11-01T17:00', from: 'backlog', to: 'in_progress' }),
    ],
  })
}

const keys = (d: StudioData, f: Parameters<typeof studioTimeline>[1] = {}) => studioTimeline(d, { today: TODAY, ...f }).map((e) => e.key)

describe('studioTimeline: actividad del estudio', () => {
  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(mixed())).toEqual([])
  })

  it('junta las tres fuentes, de lo más reciente a lo más antiguo (lo que solo tiene día, al final de su día)', () => {
    expect(keys(mixed())).toEqual([
      'registro:k5', // 14:00
      'registro:k4', // 13:00
      'registro:k3', // 12:00
      'registro:k1', // 11:15
      'codigo:c-ana', // 09:00
      'registro:k2', // 08:00
      'registro:k7', // 1 nov, 17:00
      'codigo:fusion', // 31 oct, 19:00
      'codigo:c-anon',
      'codigo:c-sin',
      'fecha:items:atrasada:completed', // 30 oct (otro día que el registro: se queda)
      'fecha:items:de-b:completed',
      'fecha:items:hito:completed',
      'fecha:items:bug:completed',
      'fecha:items:decision:completed',
      'fecha:items:vieja:completed',
      'fecha:resources:acta:dated',
      'fecha:resources:nota-estudio:dated',
      'fecha:builds:build-1:created',
      'fecha:feedback:opinion:created',
      'fecha:items:vieja:created',
    ])
  })

  it('no repite lo que el registro ya cuenta ese mismo día', () => {
    const list = studioTimeline(mixed(), { today: TODAY })
    const all = list.map((e) => e.key)
    // Completada hoy en la aplicación: sale una vez, con hora y persona (y su cambio de estado de ayer).
    expect(list.filter((e) => e.entityId === 'hoy').map((e) => e.key)).toEqual(['registro:k1', 'registro:k7'])
    // El feedback creado hoy y el documento tocado hoy, igual.
    expect(all).not.toContain('fecha:feedback:nuevo-hoy:created')
    expect(all).not.toContain('fecha:resources:tocada-hoy:dated')
    const entry = studioTimeline(mixed(), { today: TODAY }).find((e) => e.key === 'registro:k1')!
    expect(entry).toMatchObject({ date: TODAY, time: '11:15', memberId: 'ana', verb: 'completed', noun: 'task', category: 'tareas', source: 'registro' })
  })

  it('sin registro, las fechas de los datos dicen el día sin hora ni persona', () => {
    const e = studioTimeline(mixed(), { today: TODAY }).find((x) => x.key === 'fecha:items:hito:completed')!
    expect(e).toMatchObject({ at: '2026-10-28', date: '2026-10-28', verb: 'completed', noun: 'milestone', category: 'hitos', target: { collection: 'items', id: 'hito' } })
    expect(e.time).toBeUndefined()
    expect(e.memberId).toBeUndefined()
    expect(e.author).toBeUndefined()
  })

  it('lo que solo dice estar hecho sin estarlo, lo futuro y lo de las colecciones privadas no sale', () => {
    const all = keys(mixed())
    // completedAt sin estar hecho no pasa la validación, pero si llega, no cuenta como terminado.
    expect(keys(data({ items: [item('reabierta', { status: 'in_progress', completedAt: '2026-10-24' })] }))).toEqual([])
    expect(all).not.toContain('fecha:items:futura:created')
    expect(all).not.toContain('registro:k6')
  })

  it('lo borrado sale con su título, sin enlace', () => {
    const list = studioTimeline(mixed(), { today: TODAY })
    const gone = list.find((e) => e.key === 'registro:k5')!
    expect(gone).toMatchObject({ title: 'Tarea borrada', deleted: true, verb: 'deleted' })
    expect(gone.target).toBeUndefined()
    expect(list.find((e) => e.key === 'registro:k1')!.target).toEqual({ collection: 'items', id: 'hoy' })
  })

  it('las fechas sin confirmar llevan su fiabilidad', () => {
    expect(studioTimeline(mixed(), { today: TODAY }).find((e) => e.key === 'fecha:builds:build-1:created')).toMatchObject({ confidence: 'to_confirm', version: '0.1', noun: 'build' })
  })

  it('el autor de un commit: la persona si se la reconoce (por sus nombres en git); si no, tal cual', () => {
    const list = studioTimeline(mixed(), { today: TODAY })
    expect(list.find((e) => e.key === 'codigo:c-ana')).toMatchObject({ memberId: 'ana' })
    expect(list.find((e) => e.key === 'codigo:c-ana')!.author).toBeUndefined()
    expect(list.find((e) => e.key === 'codigo:c-anon')).toMatchObject({ author: 'BananaPig8' })
    expect(list.find((e) => e.key === 'codigo:fusion')).toMatchObject({ verb: 'merge', ref: '#3', url: 'https://example.com/3', category: 'codigo' })
  })

  it('filtra por proyecto: en uno, solo lo suyo (lo del estudio no)', () => {
    const inA = keys(mixed(), { scope: 'a' })
    expect(inA).not.toContain('fecha:items:de-b:completed')
    expect(inA).not.toContain('fecha:resources:nota-estudio:dated')
    expect(keys(mixed(), { scope: 'b' })).toEqual(['fecha:items:de-b:completed'])
  })

  it('filtra por categoría, por persona y por periodo', () => {
    expect(keys(mixed(), { category: 'hitos' })).toEqual(['fecha:items:hito:completed'])
    expect(keys(mixed(), { category: 'bugs' })).toEqual(['fecha:items:bug:completed'])
    expect(keys(mixed(), { category: 'documentos' })).toEqual(['registro:k4', 'fecha:resources:acta:dated', 'fecha:resources:nota-estudio:dated'])
    expect(keys(mixed(), { category: 'codigo' })).toHaveLength(4)
    // Ana: lo suyo del registro y su commit (reconocido por su alias de git).
    expect(keys(mixed(), { person: 'ana' })).toEqual(['registro:k5', 'registro:k1', 'codigo:c-ana'])
    // Un autor de git sin ficha (sin distinguir mayúsculas).
    expect(keys(mixed(), { person: 'autor:bananapig8' })).toEqual(['codigo:c-anon'])
    expect(keys(mixed(), { period: { from: '2026-10-30', to: '2026-10-31' } })).toEqual([
      'codigo:fusion',
      'codigo:c-anon',
      'codigo:c-sin',
      'fecha:items:atrasada:completed',
    ])
    expect(keys(mixed(), { period: { from: TODAY, to: TODAY }, category: 'tareas', person: 'leo' })).toEqual(['registro:k2'])
  })

  it('cada entrada tiene una clave única', () => {
    const all = keys(mixed())
    expect(new Set(all).size).toBe(all.length)
  })

  it('sin nada, no hay actividad', () => {
    expect(studioTimeline(data(), { today: TODAY })).toEqual([])
  })

  it('un elemento creado y terminado el mismo día sin registro: dos entradas, terminar antes', () => {
    const d = data({ items: [item('rapida', { createdAt: '2026-10-20', status: 'done', completedAt: '2026-10-20' })] })
    expect(keys(d)).toEqual(['fecha:items:rapida:completed', 'fecha:items:rapida:created'])
  })

  it('el registro de un proyecto apunta a la ficha del proyecto', () => {
    const d = data({ changes: [change('p', { action: 'created', collection: 'projects', entityId: 'a', title: 'a', projectId: 'a' })] })
    expect(studioTimeline(d, { today: TODAY })[0]).toMatchObject({ noun: 'project', category: 'proyectos', target: { collection: 'projects', id: 'a' } })
  })
})

describe('Actividad: agrupar, personas, categorías y textos', () => {
  it('agrupa por día en el orden en que llega', () => {
    const days = timelineByDay(studioTimeline(mixed(), { today: TODAY }))
    expect(days.map((d) => d.date)).toEqual([TODAY, '2026-11-01', '2026-10-31', '2026-10-30', '2026-10-29', '2026-10-28', '2026-10-27', '2026-10-26', '2026-10-25', '2026-10-23', '2026-10-22', '2026-10-21', '2026-10-20'])
    expect(days[0].entries).toHaveLength(6)
  })

  it('quién aparece, de quien más a quien menos', () => {
    const people = timelinePeople(mixed(), studioTimeline(mixed(), { today: TODAY }))
    expect(people).toEqual([
      { key: 'ana', name: 'Ana', memberId: 'ana', count: 3 },
      { key: 'autor:BananaPig8', name: 'BananaPig8', count: 1 },
      { key: 'leo', name: 'Leo', memberId: 'leo', count: 1 },
    ])
  })

  it('cuenta por categoría y lee ?cat=', () => {
    const counts = timelineCategoryCounts(studioTimeline(mixed(), { today: TODAY }))
    expect(counts).toMatchObject({ tareas: 8, hitos: 1, bugs: 1, decisiones: 1, builds: 1, feedback: 2, documentos: 3, codigo: 4, eventos: 0 })
    expect(timelineCategoryOf('hitos')).toBe('hitos')
    expect(timelineCategoryOf('cualquiera')).toBeNull()
    expect(timelineCategoryOf(null)).toBeNull()
  })

  it('dice los estados con su nombre', () => {
    expect(timelineStatusLabel('items', 'in_progress')).toBe('En curso')
    expect(timelineStatusLabel('feedback', 'planned')).toBe('Planificado')
    expect(timelineStatusLabel('otra', 'raro')).toBe('raro')
  })

  it('cada acción tiene su texto', () => {
    const nouns = Object.keys(NOUN_CATEGORY) as TimelineNoun[]
    for (const noun of nouns)
      for (const verb of timelineVerbsOf(noun)) {
        const key = timelineActionKey(noun, verb)
        expect(tr(key), key).not.toBe(key)
      }
    expect(tr(timelineActionKey('milestone', 'completed'))).toBe('Hito alcanzado')
    expect(tr(timelineActionKey('issue', 'completed'))).toBe('Bug resuelto')
    expect(tr(timelineActionKey('decision', 'completed'))).toBe('Decisión registrada')
    expect(tr(timelineActionKey('build', 'created'))).toBe('Build registrada')
    expect(tr(timelineActionKey('feedback', 'created'))).toBe('Feedback añadido')
    for (const c of TIMELINE_CATEGORIES) expect(tr(`secciones.panel.actividad.categorias.${c}`)).not.toContain('secciones.')
  })
})

describe('panelFeedback: el bloque de feedback', () => {
  function withFeedback(): StudioData {
    return data({
      items: [item('issue-critica', { kind: 'issue', priority: 'critical' }), item('issue-enlazada', { kind: 'issue', priority: 'critical' })],
      feedback: [
        fb('nuevo-1', { impact: 'high', receivedAt: '2026-10-20' }),
        fb('nuevo-2', { impact: 'critical', kind: 'bug', receivedAt: '2026-10-10', linkedItemIds: ['issue-enlazada'] }),
        fb('revisado', { status: 'triaged', kind: 'comment', receivedAt: '2026-10-25' }),
        fb('aceptada', { status: 'planned', kind: 'request' }),
        fb('hecha', { status: 'addressed', kind: 'request' }),
        fb('bug-cerrado', { status: 'addressed', kind: 'bug', impact: 'critical' }),
        fb('descartada-1', { status: 'wont_do', resolution: 'No encaja', receivedAt: '2026-10-01' }),
        fb('descartada-2', { status: 'wont_do', receivedAt: '2026-10-15' }),
        fb('de-b', { projectId: 'b', status: 'new' }),
      ],
    })
  }
  const value = (d: StudioData, id: string, scope: string | null = null) => panelFeedback(d, scope).figures.find((f) => f.id === id)!

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(withFeedback())).toEqual([])
  })

  it('cada cifra es lo que sale en Feedback al pulsarla', () => {
    const d = withFeedback()
    for (const scope of [null, 'a', 'b']) {
      for (const f of panelFeedback(d, scope).figures) {
        if (f.value === null) continue
        const q = feedbackQueryOf(new URLSearchParams(f.to.split('?')[1]), scope, d)
        const shown = f.id === 'criticalBugs' ? feedbackBugs(d, q).length : feedbackList(d, q).length
        expect(f.value, `${f.id} en ${scope}`).toBe(shown)
        expect(f.to).toBe(PANEL_FEEDBACK_LINKS[f.id])
      }
    }
  })

  it('cuenta nuevo, revisado, mejoras, bugs críticos y descartado', () => {
    const d = withFeedback()
    expect(value(d, 'new').value).toBe(3)
    expect(value(d, 'new', 'a').value).toBe(2)
    expect(value(d, 'triaged').value).toBe(1)
    expect(value(d, 'accepted').value).toBe(1)
    expect(value(d, 'implemented').value).toBe(1)
    // El bug crítico nuevo y la incidencia crítica que ningún bug enlaza (la enlazada va dentro del bug).
    expect(value(d, 'criticalBugs')).toMatchObject({ value: 2, fromTasks: 1 })
    expect(value(d, 'discarded').value).toBe(2)
  })

  it('sin base no hay cifra: «—», no un 0', () => {
    expect(panelFeedback(data()).figures.every((f) => f.value === null && f.gap === 'noFeedback')).toBe(true)
    // En b hay feedback, pero ninguna mejora pedida ni ningún bug.
    const d = withFeedback()
    expect(value(d, 'accepted', 'b')).toMatchObject({ value: null, gap: 'noRequests' })
    expect(value(d, 'implemented', 'b')).toMatchObject({ value: null, gap: 'noRequests' })
    expect(value(d, 'criticalBugs', 'b')).toMatchObject({ value: null, gap: 'noBugs' })
    // Un 0 con base es un 0.
    expect(value(d, 'triaged', 'b')).toMatchObject({ value: 0 })
  })

  it('lo que pide mirarse: nuevo y revisado, de más a menos impacto, sin lo planificado', () => {
    const r = panelFeedback(withFeedback(), 'a')
    expect(r.toReview.map((f) => f.id)).toEqual(['nuevo-2', 'nuevo-1', 'revisado'])
    expect(r.discarded.map((f) => f.id)).toEqual(['descartada-2', 'descartada-1'])
    expect(r.total).toBe(8)
  })
})

describe('Convertir un feedback en tarea', () => {
  const source = { type: 'manual' as const, ref: 'Feedback «x»', date: TODAY }

  it('el tipo según lo que es y la prioridad según el impacto', () => {
    expect(feedbackTaskDefaults(fb('b', { kind: 'bug', impact: 'critical', buildId: 'build-1', detail: 'Se cuelga' }), source)).toEqual({
      title: 'b',
      projectId: 'a',
      kind: 'issue',
      priority: 'critical',
      description: 'Se cuelga',
      buildId: 'build-1',
      tags: [],
      sources: [source],
    })
    expect(feedbackTaskDefaults(fb('m', { kind: 'request', impact: 'low', tags: ['ux'] }), source)).toMatchObject({ kind: 'feature', priority: 'low', tags: ['ux'] })
    expect(feedbackTaskDefaults(fb('c', { kind: 'comment', buildId: 'build-1' }), source)).toMatchObject({ kind: 'task' })
    expect(feedbackTaskDefaults(fb('c', { kind: 'comment', buildId: 'build-1' }), source).buildId).toBeUndefined()
    expect(feedbackTaskDefaults(fb('s'), source)).toMatchObject({ kind: 'task', priority: 'medium' })
    expect(feedbackTaskDefaults(fb('s', { detail: '  ' }), source).description).toBeUndefined()
  })

  it('al guardar, el feedback queda enlazado y pasa a planificado si estaba nuevo o revisado', () => {
    expect(feedbackLinkedToTask(fb('n'), 't1')).toMatchObject({ status: 'planned', linkedItemIds: ['t1'] })
    expect(feedbackLinkedToTask(fb('r', { status: 'triaged', linkedItemIds: ['t0'] }), 't1')).toMatchObject({ status: 'planned', linkedItemIds: ['t0', 't1'] })
    expect(feedbackLinkedToTask(fb('p', { status: 'planned' }), 't1').status).toBe('planned')
    expect(feedbackLinkedToTask(fb('a', { status: 'addressed' }), 't1').status).toBe('addressed')
    expect(feedbackLinkedToTask(fb('w', { status: 'wont_do' }), 't1').status).toBe('wont_do')
    // Sin repetir el enlace.
    expect(feedbackLinkedToTask(fb('x', { linkedItemIds: ['t1'] }), 't1').linkedItemIds).toEqual(['t1'])
  })
})
