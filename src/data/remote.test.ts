import { describe, expect, it } from 'vitest'
import type { Activity, StudioData, WorkItem } from '../domain/types'
import { SCHEMA_VERSION } from '../domain/types'
import { bucketOf, docIdFor, reconcile, RemoteAdapter, STUDIO_DOC } from './remote'
import type { Db, DbDoc, DbError, DbQuerySnapshot, UserInfo } from './runtime'
import { StudioStore } from './store'

type Body = Record<string, unknown>

/** Una base de datos en memoria con la misma forma que la de claude.ai. */
class FakeDb implements Db {
  docs = new Map<string, Body>()
  writes: { path: string; body: Body | null }[] = []
  /** Si se pone, la próxima escritura falla con este código. */
  failNext?: string
  private collListeners = new Map<string, Set<(s: DbQuerySnapshot) => void>>()
  private docListeners = new Map<string, Set<(s: DbDoc) => void>>()

  seed(path: string, body: Body) {
    this.docs.set(path, Object.freeze(structuredClone(body)))
  }

  private snapDoc(path: string): DbDoc {
    const body = this.docs.get(path)
    return { id: path.split('/').pop()!, exists: !!body, data: () => body, metadata: { fromCache: false, hasPendingWrites: false } }
  }

  private snapColl(name: string): DbQuerySnapshot {
    const docs = [...this.docs.keys()]
      .filter((p) => p.split('/')[0] === name)
      .sort()
      .map((p) => this.snapDoc(p))
    return { docs, metadata: { fromCache: false, hasPendingWrites: false } }
  }

  /** Avisa a quien escucha (como la base: un poco después). */
  private changed(path: string) {
    const coll = path.split('/')[0]
    setTimeout(() => {
      for (const fn of this.collListeners.get(coll) ?? []) fn(this.snapColl(coll))
      for (const fn of this.docListeners.get(path) ?? []) fn(this.snapDoc(path))
    }, 1)
  }

  /** Escribe como si fuera otra persona (o Claude). */
  external(path: string, body: Body | null) {
    if (body) this.seed(path, body)
    else this.docs.delete(path)
    this.changed(path)
  }

  doc(path: string) {
    const write = (body: Body | null) => {
      this.writes.push({ path, body })
      if (this.failNext) {
        const e: DbError = { code: this.failNext, message: this.failNext }
        this.failNext = undefined
        return Promise.reject(e)
      }
      this.external(path, body)
      return Promise.resolve()
    }
    return {
      set: (body: Body) => write(body),
      delete: () => write(null),
      onSnapshot: (next: (s: DbDoc) => void) => {
        const set = this.docListeners.get(path) ?? new Set()
        set.add(next)
        this.docListeners.set(path, set)
        setTimeout(() => next(this.snapDoc(path)), 1)
        return () => set.delete(next)
      },
    }
  }

  collection(name: string) {
    return {
      doc: (id: string) => this.doc(`${name}/${id}`),
      onSnapshot: (next: (s: DbQuerySnapshot) => void) => {
        const set = this.collListeners.get(name) ?? new Set()
        set.add(next)
        this.collListeners.set(name, set)
        setTimeout(() => next(this.snapColl(name)), 1)
        return () => set.delete(next)
      },
    }
  }
}

const empty = (): StudioData => ({
  schemaVersion: SCHEMA_VERSION,
  studio: { id: 'estudio', name: 'Mi estudio', createdAt: '2026-09-27' },
  areas: [],
  projects: [],
  items: [],
  builds: [],
  events: [],
  feedback: [],
  resources: [],
  checklists: [],
  activity: [],
})

const project = { id: 'p', slug: 'p', name: 'P', description: '', platforms: [], stage: 'idea', color: '#000', versions: [], tags: [], links: [] }
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
const commit = (id: string, at: string): Activity => ({ id, projectId: 'p', at, type: 'commit', title: id })

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms))

function setup(db: FakeDb | null, canWrite: boolean | null = true) {
  const user: UserInfo = { can: async () => canWrite }
  const adapter = new RemoteAdapter(Promise.resolve(db), Promise.resolve(user), empty, { seedVersion: 'base', edited: [], deleted: [] }, { debounceMs: 0, readyTimeoutMs: 50 })
  const store = new StudioStore(adapter, empty, 'base')
  return { adapter, store }
}

function filled(): FakeDb {
  const db = new FakeDb()
  db.seed(STUDIO_DOC, { studio: { id: 'estudio', name: 'Estudio X', createdAt: '2026-09-27' }, schemaVersion: SCHEMA_VERSION })
  db.seed('projects/p', { ...project, _orden: 0 })
  db.seed('items/b', { ...task('b', 'Segunda'), _orden: 1 })
  db.seed('items/a', { ...task('a', 'Primera'), _orden: 0 })
  db.seed('activity/p~2026-10', { entries: [commit('c1', '2026-10-01T10:00')] })
  return db
}

describe('almacén remoto (base de datos de la página)', () => {
  it('espera a la base y carga lo que hay, en su orden', async () => {
    const { store } = setup(filled())
    expect(store.getStatus().state).toBe('connecting')
    expect(store.canWrite()).toBe(false)
    await tick()
    expect(store.getStatus().state).toBe('ready')
    const data = store.getData()
    expect(data.studio.name).toBe('Estudio X')
    expect(data.items.map((i) => i.title)).toEqual(['Primera', 'Segunda'])
    expect(data.items[0]).not.toHaveProperty('_orden')
    expect(data.activity.map((a) => a.id)).toEqual(['c1'])
  })

  it('guarda solo el elemento que cambia, y el eco no cambia nada', async () => {
    const db = filled()
    const { store } = setup(db)
    await tick()
    store.patch('items', 'b', { status: 'done', completedAt: '2026-10-18' })
    const after = store.getData()
    await tick()
    expect(db.writes.map((w) => w.path)).toEqual(['items/b'])
    expect(db.writes[0].body).toMatchObject({ status: 'done', _orden: 1 })
    // El eco de la base no cambia el estado: «Deshacer» sigue funcionando.
    expect(store.getData()).toBe(after)
  })

  it('al borrar un proyecto borra lo suyo, y el historial va por meses', async () => {
    const db = filled()
    const { store } = setup(db)
    await tick()
    store.remove('projects', 'p')
    await tick()
    expect(db.writes.map((w) => w.path).sort()).toEqual(['activity/p~2026-10', 'items/a', 'items/b', 'projects/p'])
    expect(db.writes.every((w) => w.body === null)).toBe(true)
    expect([...db.docs.keys()]).toEqual([STUDIO_DOC])
  })

  it('agrupa la actividad nueva en el documento de su mes', async () => {
    const db = filled()
    const { store } = setup(db)
    await tick()
    store.upsert('activity', commit('c2', '2026-11-02T09:00'))
    await tick()
    expect(db.writes).toEqual([{ path: 'activity/p~2026-11', body: { entries: [commit('c2', '2026-11-02T09:00')] } }])
    expect(store.getData().activity.map((a) => a.id)).toEqual(['c1', 'c2'])
  })

  it('trae en vivo lo que escribe otra persona (o Claude)', async () => {
    const db = filled()
    const { store } = setup(db)
    await tick()
    db.external('items/c', { ...task('c', 'Tercera'), _orden: 2 })
    await tick()
    expect(store.getData().items.map((i) => i.title)).toEqual(['Primera', 'Segunda', 'Tercera'])
    expect(db.writes).toEqual([])
  })

  it('si lo que llega no es válido, se queda con lo último bueno y lo dice', async () => {
    const db = filled()
    const { store } = setup(db)
    await tick()
    db.external('items/d', { ...task('d', 'Rota'), projectId: 'no-existe' })
    await tick()
    expect(store.getData().items).toHaveLength(2)
    expect(store.getStatus().loadErrors.length).toBeGreaterThan(0)
  })

  it('quien solo puede ver no cambia nada', async () => {
    const db = filled()
    const { store } = setup(db, false)
    await tick()
    expect(store.getStatus().canWrite).toBe(false)
    store.patch('items', 'a', { title: 'Cambiada' })
    await tick()
    expect(store.getData().items[0].title).toBe('Primera')
    expect(db.writes).toEqual([])
  })

  it('si la base rechaza una escritura, pasa a solo lectura y vuelve a lo guardado', async () => {
    const db = filled()
    const { store } = setup(db, null)
    await tick()
    db.failNext = 'invalid_argument'
    store.patch('items', 'a', { title: 'Cambiada' })
    expect(store.getData().items[0].title).toBe('Cambiada')
    await tick()
    expect(store.getStatus().canWrite).toBe(false)
    expect(store.getData().items[0].title).toBe('Primera')
  })

  it('reintenta lo que falla un momento', async () => {
    const db = filled()
    const { store } = setup(db)
    await tick()
    db.failNext = 'unavailable'
    store.patch('items', 'a', { title: 'Cambiada' })
    await tick(1500)
    expect(db.docs.get('items/a')).toMatchObject({ title: 'Cambiada' })
    expect(store.getStatus().saveError).toBeUndefined()
  })

  it('sin base de datos lo dice (fuera de claude.ai o sin sesión)', async () => {
    const { store } = setup(null)
    await tick()
    expect(store.getStatus().state).toBe('unavailable')
  })

  it('una base vacía es un estudio vacío, y lo primero que se crea se guarda', async () => {
    const db = new FakeDb()
    const { store } = setup(db)
    await tick()
    expect(store.getStatus().state).toBe('ready')
    expect(store.getData().projects).toEqual([])
    store.upsert('projects', project as never)
    await tick()
    expect(db.docs.get('projects/p')).toMatchObject({ name: 'P', _orden: 0 })
  })
})

describe('ids y agrupación', () => {
  it('los ids raros se codifican y los normales se quedan igual', () => {
    expect(docIdFor('idt-c-abc1234')).toBe('idt-c-abc1234')
    expect(docIdFor('con espacio/barra')).toMatch(/^x-[0-9a-f]+$/)
    expect(docIdFor('..')).toMatch(/^x-/)
  })

  it('cada actividad va al documento de su proyecto y su mes', () => {
    expect(bucketOf({ projectId: 'indie-dev-tycoon', at: '2026-09-27T18:00' })).toBe('indie-dev-tycoon~2026-09')
  })

  it('reconcile conserva los objetos que no cambian', () => {
    const a = { ...empty(), items: [task('a', 'A'), task('b', 'B')] }
    const same = structuredClone(a)
    expect(reconcile(a, same)).toBe(a)
    const changed = { ...same, items: [same.items[0], { ...same.items[1], title: 'B2' }] }
    const r = reconcile(a, changed)
    expect(r).not.toBe(a)
    expect(r.items[0]).toBe(a.items[0])
    expect(r.items[1].title).toBe('B2')
    expect(r.projects).toBe(a.projects)
  })
})
