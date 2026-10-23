import { describe, expect, it } from 'vitest'
import { emptyCollections } from './collections'
import { normalizeData } from './migrate'
import { blockedBy, referencesTo, removeWithReferences } from './references'
import { SCHEMA_VERSION, type StudioData, type WorkItem } from './types'
import { validateStudioData } from './validate'

const project = (id: string) => ({ id, slug: id, name: id, description: '', platforms: [], stage: 'production' as const, color: '#000', versions: [], tags: [], links: [] })
const item = (id: string, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  projectId: 'p',
  kind: 'issue',
  title: id,
  status: 'backlog',
  priority: 'medium',
  tags: [],
  sources: [{ type: 'manual', ref: 'prueba' }],
  confidence: 'verified',
  ...over,
})
const src = [{ type: 'manual' as const, ref: 'prueba' }]

function data(): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    areas: [{ id: 'ux', name: 'UX', color: '#000' }],
    projects: [project('p'), project('q')],
    builds: [{ id: 'b', projectId: 'p', name: 'Demo', version: '1.0', channel: 'demo', platforms: [], status: 'published', sources: src, confidence: 'verified' }],
    items: [item('i1', { buildId: 'b', areaId: 'ux' }), item('i2', { parentId: 'i1' }), item('i3', { projectId: 'q', assigneeId: 'ana' })],
    members: [{ id: 'ana', name: 'Ana', kind: 'core', areaIds: ['ux'], active: true }],
    events: [{ id: 'e', projectId: 'p', title: 'Feria', type: 'fair', status: 'planned', dateConfirmed: false, sources: src, confidence: 'to_confirm' }],
    feedback: [{ id: 'f', projectId: 'p', title: 'F', origin: 'event', eventId: 'e', status: 'new', impact: 'medium', linkedItemIds: ['i1', 'i2'], sources: src, confidence: 'verified' }],
    transactions: [{ id: 't', kind: 'expense', projectId: 'p', eventId: 'e', category: 'events', description: 'Stand', amount: 12000, date: '2026-10-01', status: 'done', sources: src, confidence: 'verified' }],
    storeListings: [{ id: 'l', projectId: 'p', platform: 'steam', kind: 'game', status: 'not_started', sources: src, confidence: 'to_confirm' }],
    storeTexts: [{ id: 'tx', projectId: 'p', listingId: 'l', kind: 'short', language: 'es', text: 'Hola', status: 'draft' }],
    reminders: [{ id: 'r', title: 'Revisar build', date: '2026-10-20', targetCollection: 'builds', targetId: 'b', done: false }],
  }
}

describe('borrar con referencias', () => {
  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })

  it('al borrar una build, quien la citaba se queda sin ella', () => {
    const r = removeWithReferences(data(), 'builds', 'b')
    expect(r.deleted).toEqual(['builds:b'])
    expect(r.data.items.find((i) => i.id === 'i1')).not.toHaveProperty('buildId')
    expect(r.data.reminders[0]).not.toHaveProperty('targetId')
    expect(validateStudioData(r.data)).toEqual([])
  })

  it('al borrar un elemento se quita de los enlaces del feedback y de sus hijos', () => {
    const r = removeWithReferences(data(), 'items', 'i1')
    expect(r.data.feedback[0].linkedItemIds).toEqual(['i2'])
    expect(r.data.items.find((i) => i.id === 'i2')).not.toHaveProperty('parentId')
    expect(validateStudioData(r.data)).toEqual([])
  })

  it('al borrar un proyecto se va todo lo suyo, pero el dinero se queda sin proyecto', () => {
    const r = removeWithReferences(data(), 'projects', 'p')
    expect(r.data.items.map((i) => i.id)).toEqual(['i3'])
    expect(r.data.builds).toEqual([])
    expect(r.data.storeTexts).toEqual([])
    expect(r.data.transactions).toHaveLength(1)
    expect(r.data.transactions[0]).not.toHaveProperty('projectId')
    expect(r.data.transactions[0]).not.toHaveProperty('eventId')
    expect(r.deleted).toContain('storeTexts:tx')
    expect(validateStudioData(r.data)).toEqual([])
  })

  it('una ficha de tienda se lleva sus textos', () => {
    const r = removeWithReferences(data(), 'storeListings', 'l')
    expect(r.deleted.sort()).toEqual(['storeListings:l', 'storeTexts:tx'])
  })

  it('a una persona con trabajo no se la borra (se desactiva)', () => {
    expect(blockedBy(data(), 'members', 'ana')).toEqual([{ from: 'items', field: 'assigneeId', count: 1, onDelete: 'block' }])
    const r = removeWithReferences(data(), 'members', 'ana')
    expect(r.deleted).toEqual([])
    expect(r.data.members).toHaveLength(1)
  })

  it('dice quién apunta antes de borrar', () => {
    const refs = referencesTo(data(), 'events', 'e')
    expect(refs.map((r) => `${r.from}.${r.field}:${r.count}`).sort()).toEqual(['feedback.eventId:1', 'transactions.eventId:1'])
  })
})

describe('normalizar datos', () => {
  it('lee datos de la versión 1 sin las colecciones nuevas', () => {
    const v1 = { schemaVersion: 1, studio: { id: 's', name: 'E', createdAt: '2026-01-01' }, areas: [], projects: [project('p')], items: [item('a')], builds: [], events: [], feedback: [], resources: [], checklists: [], activity: [] }
    const n = normalizeData(v1)
    expect(n.newer).toBe(false)
    expect(n.data?.schemaVersion).toBe(SCHEMA_VERSION)
    expect(n.data?.members).toEqual([])
    expect(validateStudioData(n.data)).toEqual([])
  })

  it('es idempotente', () => {
    const once = normalizeData(data()).data
    const twice = normalizeData(once).data
    expect(twice).toEqual(once)
  })

  it('quita referencias perdidas y oculta lo de proyectos que no existen, con aviso', () => {
    const raw = data()
    raw.items.push(item('huerfano', { projectId: 'nadie' }), item('i4', { assigneeId: 'nadie', buildId: 'nada' }))
    raw.feedback[0].linkedItemIds.push('no-existe')
    const n = normalizeData(raw)
    expect(n.data?.items.map((i) => i.id)).not.toContain('huerfano')
    const i4 = n.data?.items.find((i) => i.id === 'i4')
    expect(i4).not.toHaveProperty('assigneeId')
    expect(i4).not.toHaveProperty('buildId')
    expect(n.data?.feedback[0].linkedItemIds).toEqual(['i1', 'i2'])
    expect(n.warnings.length).toBeGreaterThanOrEqual(3)
    expect(validateStudioData(n.data)).toEqual([])
  })

  it('no toca datos de una versión más nueva', () => {
    const n = normalizeData({ ...data(), schemaVersion: SCHEMA_VERSION + 1 })
    expect(n.newer).toBe(true)
  })
})

describe('validar lo nuevo', () => {
  it('un estado externo «verificado» necesita una fuente comprobable', () => {
    const d = data()
    d.metrics.push({ id: 'm', projectId: 'p', kind: 'wishlists', value: 10, date: '2026-10-01', sources: src, confidence: 'verified' })
    expect(validateStudioData(d).join(' ')).toContain('única fuente es «anotado a mano»')
    d.metrics[0].sources = [{ type: 'manual', ref: 'Steamworks', note: 'Informe de wishlists del 01-10' }]
    expect(validateStudioData(d)).toEqual([])
  })

  it('los importes van en céntimos enteros', () => {
    const d = data()
    d.transactions[0].amount = 12.5
    expect(validateStudioData(d).join(' ')).toContain('céntimos')
  })

  it('el feedback de un evento tiene que tener origen «evento»', () => {
    const d = data()
    d.feedback[0].origin = 'community'
    expect(validateStudioData(d).join(' ')).toContain('viene de un evento')
  })
})

describe('etiquetas comunes', () => {
  it('renombra y fusiona una etiqueta en todas las colecciones', async () => {
    const { renameTag, allTags, byTag } = await import('./selectors')
    const d = data()
    d.items[0].tags = ['Steam', 'demo']
    d.builds[0].tags = ['steam']
    d.events[0].tags = ['feria']
    expect(allTags(d).find((u) => u.tag.toLowerCase() === 'steam')?.count).toBe(2)
    expect(Object.keys(byTag(d, 'STEAM'))).toEqual(['items', 'builds'])
    const r = renameTag(d, 'steam', 'demo')
    expect(r.changed.sort()).toEqual(['builds:b', 'items:i1'])
    expect(r.data.items[0].tags).toEqual(['demo'])
    expect(r.data.builds[0].tags).toEqual(['demo'])
  })
})
