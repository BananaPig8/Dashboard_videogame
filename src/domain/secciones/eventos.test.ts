import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Feedback, type StudioData, type StudioEvent } from '../types'
import { validateStudioData } from '../validate'
import {
  eventoDefaultType,
  eventoFollowUp,
  eventoFollowUps,
  eventoIsStale,
  eventoMaterials,
  eventoRegistrations,
  eventosAgenda,
  eventoTipoOf,
  eventoTypes,
  registrationsClosingSoon,
  sectorEvents,
  upcomingEventoMaterials,
} from '../selectors'

const TODAY = '2026-10-20'
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
const ev = (id: string, over: Partial<StudioEvent> = {}): StudioEvent => ({
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
const fb = (id: string, over: Partial<Feedback> = {}): Feedback => ({
  id,
  projectId: 'p',
  title: id,
  origin: 'event',
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

describe('subsecciones de Eventos', () => {
  const d = data({
    events: [
      ev('feria', { date: '2026-11-10' }),
      ev('festival', { type: 'festival', date: '2026-11-01' }),
      ev('premio', { type: 'award' }),
      ev('showcase', { type: 'showcase', date: '2026-12-01' }),
      ev('presentacion', { type: 'presentation', date: '2026-10-25', tags: ['prensa'] }),
      ev('reunion', { type: 'meeting', date: '2026-10-21' }),
      ev('entrega', { type: 'delivery', date: '2026-10-22' }),
      ev('steam-v1', { type: 'steam' }),
      ev('del-estudio', { projectId: undefined, type: 'fair', date: '2026-11-20' }),
      ev('de-otro', { projectId: 'q', type: 'fair' }),
    ],
  })
  const ids = (tipo: string | null, scope: string | null = null, tag: string | null = null) =>
    sectorEvents(d, { tipo: eventoTipoOf(tipo), scope, tag })
      .map((e) => e.id)
      .sort()

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('todos: solo los del sector (las reuniones y entregas son del Calendario)', () => {
    expect(ids(null)).toEqual(['de-otro', 'del-estudio', 'feria', 'festival', 'premio', 'presentacion', 'showcase'])
  })

  it('cada tipo, con sus tipos de evento', () => {
    expect(ids('ferias')).toEqual(['de-otro', 'del-estudio', 'feria'])
    expect(ids('festivales')).toEqual(['festival'])
    expect(ids('premios')).toEqual(['premio'])
    expect(ids('presentaciones')).toEqual(['presentacion', 'showcase'])
    expect(ids('otra')).toEqual(ids(null))
  })

  it('en un proyecto salen también los de todo el estudio', () => {
    expect(ids('ferias', 'p')).toEqual(['del-estudio', 'feria'])
    expect(ids(null, 'q')).toEqual(['de-otro', 'del-estudio'])
  })

  it('respeta la etiqueta', () => {
    expect(ids(null, null, 'PRENSA')).toEqual(['presentacion'])
  })

  it('el tipo con el que se crea un evento desde cada subsección', () => {
    expect(eventoDefaultType(null)).toBe('fair')
    expect(eventoDefaultType(eventoTipoOf('premios'))).toBe('award')
    expect(eventoDefaultType(eventoTipoOf('presentaciones'))).toBe('presentation')
    expect(eventoTypes(null)).not.toContain('meeting')
  })
})

describe('agenda de eventos', () => {
  const list = [
    ev('pronto', { date: '2026-10-25' }),
    ev('luego', { date: '2026-12-01' }),
    ev('sin-fecha'),
    ev('pasado', { date: '2026-09-01', status: 'done' }),
    ev('mas-pasado', { date: '2026-08-01', status: 'confirmed' }),
    ev('en-curso', { date: '2026-10-18', endDate: '2026-10-21' }),
    ev('cancelado', { date: '2026-11-01', status: 'cancelled' }),
  ]

  it('próximos por fecha, sin fecha, pasados del más reciente y cancelados', () => {
    const a = eventosAgenda(list, TODAY)
    expect(a.upcoming.map((e) => e.id)).toEqual(['en-curso', 'pronto', 'luego'])
    expect(a.undated.map((e) => e.id)).toEqual(['sin-fecha'])
    expect(a.past.map((e) => e.id)).toEqual(['pasado', 'mas-pasado'])
    expect(a.cancelled.map((e) => e.id)).toEqual(['cancelado'])
  })

  it('¿se celebró? solo si pasó y sigue como previsto', () => {
    expect(eventoIsStale(list[4], TODAY)).toBe(true)
    expect(eventoIsStale(list[3], TODAY)).toBe(false)
    expect(eventoIsStale(list[5], TODAY)).toBe(false)
  })
})

describe('inscripciones', () => {
  const d = data({
    events: [
      ev('cierra-pronto', { date: '2026-12-01', registrationStatus: 'open', registrationDeadline: '2026-10-25' }),
      ev('cierra-hoy', { date: '2026-12-02', registrationStatus: 'not_open', registrationDeadline: TODAY }),
      ev('cierra-tarde', { date: '2026-12-03', registrationStatus: 'open', registrationDeadline: '2026-11-30' }),
      ev('abierta-sin-plazo', { registrationStatus: 'open' }),
      ev('vencida', { date: '2026-12-04', registrationStatus: 'open', registrationDeadline: '2026-10-10' }),
      ev('enviada', { date: '2026-12-05', registrationStatus: 'submitted' }),
      ev('aceptada', { date: '2026-12-06', registrationStatus: 'accepted' }),
      ev('sin-datos', { date: '2026-12-07' }),
      ev('no-hace-falta', { date: '2026-12-08', registrationStatus: 'not_needed' }),
      ev('ya-pasado', { date: '2026-09-01', registrationStatus: 'open', registrationDeadline: '2026-10-22' }),
      ev('cancelado', { status: 'cancelled', registrationStatus: 'open', registrationDeadline: '2026-10-22' }),
      ev('reunion', { type: 'meeting', date: '2026-12-01', registrationStatus: 'open', registrationDeadline: '2026-10-23' }),
    ],
  })

  it('lo que cierra pronto, primero (como registrationsClosingSoon)', () => {
    const r = eventoRegistrations(d, TODAY)
    expect(r.soon.map((e) => e.id)).toEqual(['cierra-hoy', 'cierra-pronto'])
    expect(registrationsClosingSoon(d, TODAY, 14).map((e) => e.id)).toContain('reunion')
  })

  it('el resto, por grupos (sin los pasados, cancelados ni los que no son del sector)', () => {
    const r = eventoRegistrations(d, TODAY)
    expect(r.overdue.map((e) => e.id)).toEqual(['vencida'])
    expect(r.open.map((e) => e.id)).toEqual(['cierra-tarde', 'abierta-sin-plazo'])
    expect(r.submitted.map((e) => e.id)).toEqual(['enviada'])
    expect(r.decided.map((e) => e.id)).toEqual(['aceptada'])
    expect(r.missing.map((e) => e.id)).toEqual(['sin-datos'])
    expect(r.notNeeded.map((e) => e.id)).toEqual(['no-hace-falta'])
  })

  it('la ventana de «cierra pronto» se puede cambiar', () => {
    expect(eventoRegistrations(d, TODAY, {}, 60).soon.map((e) => e.id)).toEqual(['cierra-hoy', 'cierra-pronto', 'cierra-tarde'])
  })
})

describe('materiales y seguimiento', () => {
  const d = data({
    events: [
      ev('feria', { date: '2026-11-10' }),
      ev('vacia', { date: '2026-11-20', type: 'award' }),
      ev('pasada', { date: '2026-09-10', status: 'confirmed' }),
      ev('celebrada', { date: '2026-10-01', status: 'done', followUp: 'Contactos de prensa' }),
      ev('cancelada', { date: '2026-09-01', status: 'cancelled' }),
    ],
    checklists: [
      {
        id: 'pasos',
        projectId: 'p',
        title: 'Preparar la feria',
        target: 'event',
        eventId: 'feria',
        tags: [],
        items: [
          { id: 'a', label: 'Roll-up', done: true },
          { id: 'b', label: 'QR', done: false },
          { id: 'c', label: 'Pegatinas', done: false },
        ],
      },
    ],
    builds: [{ id: 'demo', projectId: 'p', name: 'Demo feria', version: '1.0', channel: 'event', platforms: [], status: 'ready', eventId: 'feria', sources: src, confidence: 'verified' }],
    resources: [{ id: 'cartel', projectId: 'p', title: 'Cartel', type: 'marketing', url: 'https://example.com/cartel', eventId: 'feria', tags: [] }],
    playtests: [{ id: 'prueba', projectId: 'p', title: 'En el stand', method: 'event', eventId: 'celebrada', date: '2026-10-01', sources: src, confidence: 'verified' }],
    feedback: [
      fb('del-evento', { eventId: 'celebrada', receivedAt: '2026-10-01' }),
      fb('de-su-prueba', { origin: 'playtest', playtestId: 'prueba', receivedAt: '2026-10-02' }),
      fb('de-otro', { eventId: 'pasada' }),
    ],
    transactions: [
      { id: 'stand', kind: 'expense', projectId: 'p', eventId: 'celebrada', category: 'events', description: 'Stand', amount: 12000, date: '2026-09-01', status: 'done', sources: src, confidence: 'verified' },
      { id: 'viaje', kind: 'expense', projectId: 'p', eventId: 'celebrada', category: 'events', description: 'Viaje', amount: 4550, date: '2026-09-30', status: 'pending', sources: src, confidence: 'verified' },
      { id: 'premio', kind: 'income', projectId: 'p', eventId: 'celebrada', category: 'grants', description: 'Premio', amount: 50000, date: '2026-10-01', status: 'done', sources: src, confidence: 'verified' },
      { id: 'anulado', kind: 'expense', projectId: 'p', eventId: 'celebrada', category: 'events', description: 'Anulado', amount: 999, date: '2026-10-01', status: 'cancelled', sources: src, confidence: 'verified' },
    ],
  })

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('materiales: listas, builds, recursos y lo que falta', () => {
    const m = eventoMaterials(d, d.events[0])
    expect(m.checklists.map((c) => [c.checklist.id, c.done, c.total])).toEqual([['pasos', 1, 3]])
    expect(m.builds.map((b) => b.id)).toEqual(['demo'])
    expect(m.resources.map((r) => r.id)).toEqual(['cartel'])
    expect(m.pendingSteps).toBe(2)
    expect(m.missing).toEqual(['steps'])
    expect(eventoMaterials(d, d.events[1]).missing).toEqual(['checklist', 'build', 'resources'])
  })

  it('materiales: solo los eventos que están por delante', () => {
    expect(upcomingEventoMaterials(d, TODAY).map((m) => m.event.id)).toEqual(['feria', 'vacia'])
    expect(upcomingEventoMaterials(d, TODAY, { tipo: 'premios' }).map((m) => m.event.id)).toEqual(['vacia'])
  })

  it('seguimiento: los pasados o celebrados, del más reciente al más antiguo (sin cancelados)', () => {
    const f = eventoFollowUps(d, TODAY)
    expect(f.map((x) => [x.event.id, x.stale])).toEqual([
      ['celebrada', false],
      ['pasada', true],
    ])
  })

  it('seguimiento: feedback (también el de sus pruebas), pruebas y gastos', () => {
    const f = eventoFollowUp(d, d.events[3], TODAY)
    expect(f.feedback.map((x) => x.id)).toEqual(['de-su-prueba', 'del-evento'])
    expect(f.playtests.map((p) => p.id)).toEqual(['prueba'])
    expect(f.transactions.map((t) => t.id)).toEqual(['premio', 'viaje', 'stand'])
    expect([f.spent, f.plannedSpend, f.income]).toEqual([12000, 4550, 50000])
  })
})
