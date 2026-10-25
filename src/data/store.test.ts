import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../domain/collections'
import type { StudioData, WorkItem } from '../domain/types'
import { SCHEMA_VERSION } from '../domain/types'
import { MemoryAdapter } from './storage'
import { mergeSeed, StudioStore } from './store'

const task = (id: string, title: string): WorkItem => ({
  id,
  projectId: 'p',
  kind: 'task',
  title,
  status: 'backlog',
  priority: 'medium',
  tags: [],
  sources: [{ type: 'manual', ref: 'prueba' }],
  confidence: 'verified',
})

function seed(items: WorkItem[]): () => StudioData {
  return () => ({
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    areas: [],
    projects: [{ id: 'p', slug: 'p', name: 'P', description: '', platforms: [], stage: 'idea', color: '#000', versions: [], tags: [], links: [] }],
    items: structuredClone(items),
    builds: [],
    events: [],
    feedback: [],
    resources: [],
    checklists: [],
    activity: [],
  })
}

describe('StudioStore', () => {
  it('arranca con los datos iniciales y guarda los cambios', () => {
    const adapter = new MemoryAdapter()
    const s = new StudioStore(adapter, seed([task('a', 'Uno')]), 'v1')
    s.patch('items', 'a', { status: 'done', completedAt: '2026-10-18' })
    const again = new StudioStore(adapter, seed([task('a', 'Uno')]), 'v1')
    expect(again.getData().items[0].status).toBe('done')
    expect(again.getMeta().edited).toContain('items:a')
  })

  it('si lo guardado está roto, arranca con los datos iniciales y lo avisa', () => {
    const adapter = new MemoryAdapter()
    adapter.save({ data: { roto: true } as never, meta: { seedVersion: 'v1', edited: [], deleted: [] } })
    const s = new StudioStore(adapter, seed([task('a', 'Uno')]), 'v1')
    expect(s.loadErrors.length).toBeGreaterThan(0)
    expect(s.getData().items).toHaveLength(1)
  })

  it('al borrar un proyecto se va todo lo suyo', () => {
    const s = new StudioStore(new MemoryAdapter(), seed([task('a', 'Uno'), task('b', 'Dos')]), 'v1')
    s.remove('projects', 'p')
    expect(s.getData().projects).toHaveLength(0)
    expect(s.getData().items).toHaveLength(0)
    expect(s.getMeta().deleted).toEqual(expect.arrayContaining(['projects:p', 'items:a', 'items:b']))
  })

  it('no importa datos que no son válidos', () => {
    const s = new StudioStore(new MemoryAdapter(), seed([task('a', 'Uno')]), 'v1')
    expect(s.replaceAll({ schemaVersion: 1 }).length).toBeGreaterThan(0)
    expect(s.getData().items).toHaveLength(1)
  })

  it('avisa de que hay datos iniciales nuevos', () => {
    const adapter = new MemoryAdapter()
    new StudioStore(adapter, seed([task('a', 'Uno')]), 'v1').patch('items', 'a', { title: 'Uno bis' })
    const next = new StudioStore(adapter, seed([task('a', 'Uno')]), 'v2')
    expect(next.hasSeedUpdate()).toBe(true)
    next.applySeedUpdate()
    expect(next.hasSeedUpdate()).toBe(false)
  })
})

describe('mergeSeed', () => {
  it('añade lo nuevo, actualiza lo no tocado y respeta lo editado y lo borrado', () => {
    const current = seed([task('a', 'A viejo'), task('b', 'B editado a mano'), task('mio', 'Creado por el estudio')])()
    const fresh = seed([task('a', 'A nuevo'), task('b', 'B nuevo'), task('c', 'C nuevo'), task('d', 'D borrado')])()
    const merged = mergeSeed(current, { seedVersion: 'v1', edited: ['items:b', 'items:mio'], deleted: ['items:d'] }, fresh)
    const titles = Object.fromEntries(merged.items.map((i) => [i.id, i.title]))
    expect(titles).toEqual({ a: 'A nuevo', b: 'B editado a mano', mio: 'Creado por el estudio', c: 'C nuevo' })
  })

  it('quita lo que los datos iniciales han retirado, salvo lo editado', () => {
    const current = seed([task('viejo', 'Retirado'), task('tocado', 'Retirado pero editado'), task('a', 'A')])()
    const fresh = seed([task('a', 'A')])()
    const meta = { seedVersion: 'v1', edited: ['items:tocado'], deleted: [] }
    const merged = mergeSeed(current, meta, fresh, ['items:viejo', 'items:tocado'])
    expect(merged.items.map((i) => i.id).sort()).toEqual(['a', 'tocado'])
  })
})
