import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Resource, type StudioData, type StudioEvent, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import { decisionDate, decisionLog, decisionsFromEvent, meetingsWithoutMinutes, minutesDefaults, minutesOf } from '../selectors'

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
const decision = (id: string, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  projectId: 'p',
  kind: 'decision',
  title: id,
  status: 'done',
  priority: 'medium',
  tags: [],
  sources: src,
  confidence: 'verified',
  ...over,
})
const meeting = (id: string, over: Partial<StudioEvent> = {}): StudioEvent => ({
  id,
  projectId: 'p',
  title: id,
  type: 'meeting',
  status: 'done',
  dateConfirmed: true,
  sources: src,
  confidence: 'verified',
  ...over,
})
const minutes = (id: string, over: Partial<Resource> = {}): Resource => ({ id, projectId: 'p', title: id, type: 'minutes', body: 'Acta', tags: [], ...over })

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('p'), project('q')],
    ...over,
  }
}

const ids = (list: { id: string }[]) => list.map((r) => r.id)
const TODAY = '2026-10-20'

describe('registro de decisiones', () => {
  const d = data({
    items: [
      decision('vieja', { completedAt: '2026-09-02' }),
      decision('nueva', { completedAt: '2026-10-10' }),
      decision('octubre', { completedAt: '2026-10-01', status: 'cancelled' }),
      decision('sin-fecha', { status: 'cancelled', startedAt: '2026-10-15' }),
      decision('abierta', { status: 'to_confirm' }),
      decision('de-q', { projectId: 'q', completedAt: '2026-10-12' }),
      { ...decision('tarea', { completedAt: '2026-10-11' }), kind: 'task' },
    ],
  })

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('por meses, de lo más reciente a lo más antiguo, con lo descartado y sin las abiertas', () => {
    const log = decisionLog(d, 'p')
    expect(log.map((m) => m.month)).toEqual(['2026-10', '2026-09', null])
    expect(ids(log[0].decisions)).toEqual(['nueva', 'octubre'])
    expect(ids(log[1].decisions)).toEqual(['vieja'])
  })

  it('sin la fecha en que se cerró, no se supone otra: va al final, sin fecha', () => {
    const log = decisionLog(d, 'p')
    expect(log.at(-1)).toEqual({ month: null, decisions: [expect.objectContaining({ id: 'sin-fecha' })] })
    expect(decisionDate(d.items.find((i) => i.id === 'sin-fecha')!)).toBeUndefined()
  })

  it('en todo el estudio salen las de todos los proyectos', () => {
    expect(ids(decisionLog(d)[0].decisions)).toEqual(['de-q', 'nueva', 'octubre'])
  })
})

describe('actas y reuniones', () => {
  const d = data({
    events: [
      meeting('reunion-acta', { date: '2026-10-01' }),
      meeting('reunion-sin-acta', { date: '2026-10-08' }),
      meeting('reunion-antigua', { date: '2026-09-01' }),
      meeting('reunion-proxima', { date: '2026-10-27', status: 'planned' }),
      meeting('reunion-lejana', { date: '2026-11-15', status: 'planned' }),
      meeting('reunion-sin-fecha', { status: 'planned', dateConfirmed: false }),
      meeting('reunion-cancelada', { date: '2026-10-02', status: 'cancelled' }),
      meeting('reunion-q', { projectId: 'q', date: '2026-10-03' }),
      meeting('reunion-estudio', { projectId: undefined, date: '2026-10-04' }),
      { ...meeting('feria', { date: '2026-10-05' }), type: 'fair' },
    ],
    resources: [
      minutes('acta-1', { eventId: 'reunion-acta', date: '2026-10-01' }),
      minutes('acta-suelta', { date: '2026-10-09' }),
      minutes('acta-sin-fecha'),
      minutes('acta-q', { projectId: 'q', eventId: 'reunion-q', date: '2026-10-03' }),
    ],
    items: [
      decision('de-la-reunion', { eventId: 'reunion-acta', completedAt: '2026-10-01' }),
      decision('abierta-de-la-reunion', { eventId: 'reunion-acta', status: 'review', priority: 'high' }),
      decision('de-otra', { eventId: 'reunion-sin-acta', status: 'to_confirm' }),
      decision('sin-reunion', { completedAt: '2026-10-02' }),
    ],
  })

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('las actas del ámbito por fecha, con su reunión y las decisiones que salen de ella', () => {
    const list = minutesOf(d, 'p')
    expect(ids(list.map((m) => m.minutes))).toEqual(['acta-suelta', 'acta-1', 'acta-sin-fecha'])
    const acta = list.find((m) => m.minutes.id === 'acta-1')!
    expect(acta.event?.id).toBe('reunion-acta')
    expect(ids(acta.decisions)).toEqual(['abierta-de-la-reunion', 'de-la-reunion'])
    expect(list.find((m) => m.minutes.id === 'acta-suelta')).toMatchObject({ event: undefined, decisions: [] })
  })

  it('en todo el estudio salen las actas de todos los proyectos', () => {
    expect(ids(minutesOf(d).map((m) => m.minutes))).toContain('acta-q')
  })

  it('las decisiones de una reunión: abiertas primero', () => {
    expect(ids(decisionsFromEvent(d, 'reunion-acta'))).toEqual(['abierta-de-la-reunion', 'de-la-reunion'])
    expect(decisionsFromEvent(d, 'feria')).toEqual([])
  })

  it('reuniones sin acta: celebradas (la más reciente arriba), sin fecha y próximas (la más cercana arriba)', () => {
    const list = meetingsWithoutMinutes(d, TODAY, 'p')
    expect(list.map((m) => m.event.id)).toEqual([
      'reunion-sin-acta',
      'reunion-estudio',
      'reunion-antigua',
      'reunion-sin-fecha',
      'reunion-proxima',
      'reunion-lejana',
    ])
    expect(list.find((m) => m.event.id === 'reunion-proxima')?.upcoming).toBe(true)
    expect(list.find((m) => m.event.id === 'reunion-sin-fecha')?.upcoming).toBe(false)
    expect(ids(list[0].decisions)).toEqual(['de-otra'])
  })

  it('ni las canceladas, ni las que tienen acta, ni lo que no es una reunión, ni otros proyectos', () => {
    const list = meetingsWithoutMinutes(d, TODAY, 'p').map((m) => m.event.id)
    for (const id of ['reunion-cancelada', 'reunion-acta', 'feria', 'reunion-q']) expect(list).not.toContain(id)
    expect(meetingsWithoutMinutes(d, TODAY).map((m) => m.event.id)).not.toContain('reunion-q')
  })

  it('el acta nueva de una reunión lleva su tipo, su reunión, su fecha y su proyecto', () => {
    const e = d.events.find((x) => x.id === 'reunion-sin-acta')!
    expect(minutesDefaults(e, 'Acta')).toEqual({ type: 'minutes', eventId: 'reunion-sin-acta', date: '2026-10-08', projectId: 'p', title: 'Acta', tags: [] })
    const estudio = d.events.find((x) => x.id === 'reunion-estudio')!
    expect(minutesDefaults(estudio, 'Acta').projectId).toBeUndefined()
  })
})
