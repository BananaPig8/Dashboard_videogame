import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type ItemStatus, type StudioData, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import {
  cleanStatusLabels,
  cleanTag,
  currencyOptions,
  duplicatedStatusLabels,
  hostingOf,
  integrationsStatus,
  isCurrencyCode,
  privateCollections,
  settingsAreaUsage,
  settingsCollectionCounts,
  studioAmountCounts,
  tagPageGroups,
  taggedEntryLabel,
  tagRenamePlan,
} from '../selectors'
import { renameTag } from './etiquetas'

const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string, tags: string[] = []) => ({ id, slug: id, name: id, description: '', platforms: [], stage: 'production' as const, color: '#000', versions: [], tags, links: [] })
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

function data(): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01', currency: 'EUR' },
    areas: [
      { id: 'arte', name: 'Arte', color: '#000' },
      { id: 'audio', name: 'Audio', color: '#111' },
    ],
    projects: [project('p', ['demo']), project('q')],
    items: [
      item('Zeta', { tags: ['demo', 'feria'], areaId: 'arte' }),
      item('Alfa', { tags: ['Demo'] }),
      item('Otra', { projectId: 'q', tags: ['feria'], areaId: 'arte' }),
    ],
    members: [{ id: 'ana', name: 'Ana', kind: 'core', areaIds: ['arte', 'audio'], active: true }],
    builds: [{ id: 'b', projectId: 'p', name: 'Demo', version: '0.3', channel: 'demo', platforms: [], status: 'ready', tags: ['demo'], sources: src, confidence: 'verified' }],
    releases: [{ id: 'r', projectId: 'q', kind: 'update', name: 'Parche 1.1', version: '1.1', status: 'planned', tags: ['feria'], sources: src, confidence: 'to_confirm' }],
    storeListings: [{ id: 'l', projectId: 'p', platform: 'steam', kind: 'demo', status: 'not_started', tags: ['demo'], sources: src, confidence: 'to_confirm' }],
    metrics: [{ id: 'm', projectId: 'p', kind: 'wishlists', value: 10, date: '2026-10-01', platform: 'itch', sources: src, confidence: 'to_confirm' }],
    activity: [
      { id: 'a1', projectId: 'p', at: '2026-09-01T10:00', type: 'commit', title: 'Uno', areaId: 'arte' },
      { id: 'a2', projectId: 'p', at: '2026-10-02T10:00', type: 'commit', title: 'Dos' },
    ],
    transactions: [{ id: 't', kind: 'expense', category: 'events', description: 'Stand', amount: 12000, date: '2026-10-01', status: 'done', sources: src, confidence: 'verified' }],
  }
}

describe('ajustes: datos de prueba', () => {
  it('son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })
})

describe('perfil del estudio: la moneda', () => {
  it('reconoce códigos ISO 4217 por su forma', () => {
    expect(isCurrencyCode('EUR')).toBe(true)
    expect(isCurrencyCode('eur')).toBe(false)
    expect(isCurrencyCode('EURO')).toBe(false)
    expect(isCurrencyCode(undefined)).toBe(false)
  })

  it('ofrece las habituales y, si el estudio usa otra, también esa (la primera)', () => {
    expect(currencyOptions('EUR').slice(0, 3)).toEqual(['EUR', 'USD', 'GBP'])
    expect(currencyOptions('ARS')[0]).toBe('ARS')
    expect(currencyOptions('ARS')).toContain('EUR')
    expect(currencyOptions('nada')).not.toContain('nada')
  })

  it('cuenta los importes que no se convierten al cambiarla', () => {
    expect(studioAmountCounts(data())).toEqual({ transactions: 1, budgets: 0 })
  })
})

describe('estados personalizables', () => {
  const defaults = { idea: 'Idea', backlog: 'Pendiente', planned: 'Planificado', in_progress: 'En curso', review: 'En revisión', blocked: 'Bloqueado', paused: 'En pausa', to_confirm: 'Por confirmar', done: 'Hecho', cancelled: 'Descartado' } as Record<ItemStatus, string>

  it('guarda solo los nombres propios: sin vacíos, sin espacios de más y sin los de siempre', () => {
    expect(cleanStatusLabels({ blocked: '  Atascado   ya ', done: 'Hecho', idea: '   ' }, defaults)).toEqual({ blocked: 'Atascado ya' })
  })

  it('sin ninguno propio, nada que guardar', () => {
    expect(cleanStatusLabels({}, defaults)).toBeUndefined()
    expect(cleanStatusLabels({ done: 'Hecho' }, defaults)).toBeUndefined()
  })

  it('detecta dos estados que se llamarían igual (sin mirar mayúsculas ni tildes)', () => {
    expect(duplicatedStatusLabels({ ...defaults, review: 'en curso' })).toEqual(['in_progress', 'review'])
    expect(duplicatedStatusLabels({ ...defaults, done: 'Revisión', review: 'revision' })).toEqual(['review', 'done'])
    expect(duplicatedStatusLabels(defaults)).toEqual([])
  })
})

describe('categorías: áreas y etiquetas', () => {
  it('cuenta el uso de cada área en el trabajo, las personas y el historial', () => {
    expect(settingsAreaUsage(data())).toEqual({ arte: { items: 2, members: 1, activity: 1 }, audio: { items: 0, members: 1, activity: 0 } })
  })

  it('limpia una etiqueta escrita a mano', () => {
    expect(cleanTag('  ##feria  de   otoño ')).toBe('feria de otoño')
  })

  it('renombrar: cuántos elementos cambian en todo el estudio', () => {
    expect(tagRenamePlan(data(), 'feria', 'ferias')).toEqual({ target: 'ferias', problem: undefined, merge: false, affected: 3, alreadyTarget: 0 })
  })

  it('fusionar: el nombre nuevo ya existe (sin mirar mayúsculas)', () => {
    const plan = tagRenamePlan(data(), 'feria', '#DEMO')
    expect(plan.merge).toBe(true)
    expect(plan.target).toBe('DEMO')
    // «feria» la llevan Zeta, Otra y la versión; «demo» sin «feria», Alfa, la build, la ficha y el proyecto p.
    expect(plan.affected).toBe(3)
    expect(plan.alreadyTarget).toBe(4)
  })

  it('fusionar aunque la otra solo esté en elementos que ya llevan las dos', () => {
    const d = data()
    d.items = [item('x', { tags: ['a', 'b'] })]
    d.projects = []
    d.builds = []
    d.releases = []
    d.storeListings = []
    expect(tagRenamePlan(d, 'a', 'b')).toMatchObject({ merge: true, affected: 1, alreadyTarget: 0 })
  })

  it('cambiar solo mayúsculas es renombrar, no fusionar', () => {
    expect(tagRenamePlan(data(), 'demo', 'Demo')).toMatchObject({ merge: false, problem: undefined })
  })

  it('dice por qué no se puede', () => {
    expect(tagRenamePlan(data(), 'demo', '  # ').problem).toBe('empty')
    expect(tagRenamePlan(data(), 'demo', 'a, b').problem).toBe('comma')
    expect(tagRenamePlan(data(), 'demo', 'demo').problem).toBe('same')
  })

  it('lo que dice el plan coincide con lo que hace renameTag', () => {
    const plan = tagRenamePlan(data(), 'feria', 'demo')
    const r = renameTag(data(), 'feria', plan.target)
    expect(r.changed).toHaveLength(plan.affected)
    expect(r.data.items.find((i) => i.id === 'Zeta')?.tags).toEqual(['demo'])
  })
})

describe('la página de una etiqueta', () => {
  it('agrupa por colección, en el orden del registro, y ordena por nombre', () => {
    const groups = tagPageGroups(data(), 'demo')
    expect(groups.map((g) => g.collection)).toEqual(['projects', 'items', 'builds', 'storeListings'])
    expect(groups[1].entries.map((e) => e.label)).toEqual(['Alfa', 'Zeta'])
    expect(groups[0].entries[0]).toMatchObject({ id: 'p', projectId: 'p', tags: ['demo'] })
  })

  it('respeta el ámbito', () => {
    const groups = tagPageGroups(data(), 'feria', 'q')
    expect(groups.map((g) => [g.collection, g.entries.map((e) => e.id)])).toEqual([
      ['items', ['Otra']],
      ['releases', ['r']],
    ])
    expect(tagPageGroups(data(), 'nada')).toEqual([])
  })

  it('da nombre a todo: fichas de tienda por plataforma y tipo, builds y versiones con su número', () => {
    const d = data()
    expect(taggedEntryLabel('storeListings', d.storeListings[0] as unknown as Record<string, unknown>)).toBe('Steam · Demo')
    expect(taggedEntryLabel('builds', d.builds[0] as unknown as Record<string, unknown>)).toBe('Demo 0.3')
    expect(taggedEntryLabel('releases', d.releases[0] as unknown as Record<string, unknown>)).toBe('Parche 1.1')
    expect(taggedEntryLabel('transactions', d.transactions[0] as unknown as Record<string, unknown>)).toBe('Stand')
    expect(taggedEntryLabel('items', { id: 'sin-nombre' })).toBe('sin-nombre')
  })
})

describe('integraciones', () => {
  it('ninguna activa fuera de claude.ai; nada aparenta estar conectado', () => {
    const list = integrationsStatus(data(), false)
    expect(list.filter((i) => i.state === 'active')).toEqual([])
    const state = Object.fromEntries(list.map((i) => [i.id, i.state]))
    expect(state).toEqual({
      storage: 'local',
      hosting: 'outside',
      github: 'manual',
      steamworks: 'off',
      itch: 'off',
      discord: 'off',
      talo: 'off',
      calendar: 'file',
      backup: 'file',
    })
  })

  it('en claude.ai, solo la base de datos de la página está activa', () => {
    expect(integrationsStatus(data(), true).filter((i) => i.state === 'active').map((i) => i.id)).toEqual(['storage'])
  })

  it('cuenta lo anotado a mano y lo importado, sin ceros', () => {
    const byId = Object.fromEntries(integrationsStatus(data(), false).map((i) => [i.id, i]))
    expect(byId.github).toMatchObject({ counts: { activity: 2 }, lastAt: '2026-10-02T10:00' })
    expect(byId.steamworks.counts).toEqual({ storeListings: 1 })
    expect(byId.itch.counts).toEqual({ metrics: 1 })
    expect(byId.discord.counts).toEqual({})
  })

  it('sin historial importado, no hay última fecha', () => {
    const d = data()
    d.activity = []
    expect(integrationsStatus(d, false).find((i) => i.id === 'github')).toMatchObject({ counts: {}, lastAt: undefined })
  })

  it('sabe desde dónde se abre (solo por la dirección)', () => {
    expect(hostingOf('dashboardmytu.cuenta.workers.dev', false)).toBe('cloudflare')
    expect(hostingOf('localhost', false)).toBe('local')
    expect(hostingOf('127.0.0.1', false)).toBe('local')
    expect(hostingOf('studio.example.com', false)).toBe('other')
    expect(hostingOf('lo-que-sea', true)).toBe('claude')
  })
})

describe('seguridad y datos', () => {
  it('las colecciones privadas en claude.ai son las finanzas', () => {
    expect(privateCollections()).toEqual(['transactions', 'budgets'])
  })

  it('cuenta cada colección: las que tienen algo, de más a menos, y las vacías aparte', () => {
    const { filled, empty } = settingsCollectionCounts(data())
    expect(filled[0]).toEqual(['items', 3])
    expect(filled).toContainEqual(['transactions', 1])
    expect(empty).toContain('budgets')
    expect(empty).not.toContain('items')
  })
})
