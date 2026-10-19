// El estado de Studio Hub: un único objeto StudioData inmutable. Cada cambio crea uno
// nuevo, se guarda y avisa a las pantallas (useSyncExternalStore).
import { useSyncExternalStore } from 'react'
import { nowISODateTime } from '../domain/dates'
import type { ID, StudioData, Studio } from '../domain/types'
import { validateStudioData } from '../domain/validate'
import { reconcile, RemoteAdapter } from './remote'
import { capability, EN_CLAUDE } from './runtime'
import { createSeedData, SEED_VERSION } from './seed'
import { LocalStorageAdapter, type Persisted, type StorageAdapter, type StoreMeta } from './storage'

export type CollectionKey = 'areas' | 'projects' | 'items' | 'builds' | 'events' | 'feedback' | 'resources' | 'checklists' | 'activity'
export type EntityOf<K extends CollectionKey> = StudioData[K][number]

export const COLLECTIONS: CollectionKey[] = ['areas', 'projects', 'items', 'builds', 'events', 'feedback', 'resources', 'checklists', 'activity']

/** Colecciones que cuelgan de un proyecto (se borran con él). */
const PROJECT_OWNED: CollectionKey[] = ['items', 'builds', 'events', 'feedback', 'resources', 'checklists', 'activity']

const key = (k: CollectionKey, id: ID) => `${k}:${id}`

export function newId(prefix: string): ID {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Trae los datos iniciales nuevos sin pisar lo que el estudio ha cambiado: añade lo que
 * falta, actualiza lo que nadie ha tocado y respeta lo editado o borrado a mano.
 */
export function mergeSeed(current: StudioData, meta: StoreMeta, seed: StudioData): StudioData {
  const edited = new Set(meta.edited)
  const deleted = new Set(meta.deleted)
  const next: StudioData = { ...current, schemaVersion: seed.schemaVersion }
  for (const k of COLLECTIONS) {
    const list = [...(current[k] as { id: ID }[])]
    const index = new Map(list.map((x, n) => [x.id, n]))
    for (const s of seed[k] as { id: ID }[]) {
      const kk = key(k, s.id)
      if (deleted.has(kk)) continue
      const n = index.get(s.id)
      if (n === undefined) list.push(s)
      else if (!edited.has(kk)) list[n] = s
    }
    ;(next as unknown as Record<CollectionKey, unknown>)[k] = list
  }
  if (!edited.has('studio')) next.studio = { ...seed.studio, name: current.studio.name, tagline: current.studio.tagline }
  return next
}

type Listener = () => void

const NO_ERRORS: string[] = []

/** Dónde y cómo se están guardando los datos. */
export interface StoreStatus {
  /** true en la página de claude.ai (base de datos compartida). */
  remote: boolean
  /** local: en este navegador; connecting / ready / unavailable: la base de la página. */
  state: 'local' | 'connecting' | 'ready' | 'unavailable'
  /** false si quien mira solo puede leer. */
  canWrite: boolean
  /** El último cambio que no se pudo guardar. */
  saveError?: string
  /** Problemas de los datos guardados (si los hay, no se han cargado). */
  loadErrors: string[]
}

export class StudioStore {
  private data: StudioData
  private meta: StoreMeta
  private listeners = new Set<Listener>()
  private status: StoreStatus
  private readonly remote: boolean
  /** Problemas encontrados al cargar lo guardado (si los hay, se arrancó con los datos iniciales). */
  loadErrors: string[] = NO_ERRORS

  constructor(
    private readonly adapter: StorageAdapter,
    private readonly seed: () => StudioData = createSeedData,
    private readonly seedVersion = SEED_VERSION,
  ) {
    const saved = adapter.load()
    const errors = saved ? validateStudioData(saved.data) : []
    if (saved && errors.length === 0) {
      this.data = saved.data
      this.meta = { ...saved.meta, edited: saved.meta.edited ?? [], deleted: saved.meta.deleted ?? [] }
    } else {
      this.loadErrors = errors.length ? errors : NO_ERRORS
      this.data = seed()
      this.meta = { seedVersion: seedVersion, edited: [], deleted: [] }
    }
    this.remote = Boolean(adapter.status)
    this.status = this.readStatus()
    adapter.watch?.(() => {
      const fresh = adapter.load()
      if (fresh) {
        const problems = validateStudioData(fresh.data)
        if (problems.length === 0) {
          this.data = this.remote ? reconcile(this.data, fresh.data) : fresh.data
          // En la base compartida, «qué se editó» no viaja: es cosa de los datos iniciales locales.
          if (!this.remote) this.meta = fresh.meta
          this.loadErrors = NO_ERRORS
        } else if (this.remote) {
          this.loadErrors = problems
        }
      }
      this.status = this.readStatus()
      this.emit()
    })
  }

  private readStatus(): StoreStatus {
    const r = this.adapter.status?.()
    const next: StoreStatus = r
      ? { remote: true, state: r.state, canWrite: r.canWrite, saveError: r.saveError, loadErrors: this.loadErrors }
      : { remote: false, state: 'local', canWrite: true, loadErrors: this.loadErrors }
    const cur = this.status
    // El mismo objeto si nada cambió (useSyncExternalStore).
    if (
      cur &&
      cur.state === next.state &&
      cur.canWrite === next.canWrite &&
      cur.saveError === next.saveError &&
      cur.loadErrors === next.loadErrors
    )
      return cur
    return next
  }

  // ——— lectura ———

  getData = (): StudioData => this.data

  getMeta = (): StoreMeta => this.meta

  getStatus = (): StoreStatus => this.status

  /** ¿Se pueden cambiar los datos ahora? (en la página compartida: conectada y con permiso). */
  canWrite(): boolean {
    return this.status.canWrite && (this.status.state === 'local' || this.status.state === 'ready')
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** ¿Hay datos iniciales más nuevos que los que se cargaron? */
  hasSeedUpdate(): boolean {
    return !this.remote && this.meta.seedVersion !== this.seedVersion
  }

  // ——— escritura ———

  private commit(data: StudioData, meta: StoreMeta = this.meta) {
    // Quien solo puede ver no cambia nada (las pantallas ya esconden los controles).
    if (!this.canWrite()) return
    const prev: Persisted = { data: this.data, meta: this.meta }
    this.data = data
    this.meta = { ...meta, savedAt: nowISODateTime() }
    this.adapter.save({ data: this.data, meta: this.meta } satisfies Persisted, prev)
    this.emit()
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  private markEdited(...keys: string[]): StoreMeta {
    const edited = new Set(this.meta.edited)
    for (const k of keys) edited.add(k)
    return { ...this.meta, edited: [...edited] }
  }

  /** Crea o sustituye un elemento de una colección (por id). */
  upsert<K extends CollectionKey>(k: K, entity: EntityOf<K>): void {
    const list = this.data[k] as EntityOf<K>[]
    const n = list.findIndex((x) => x.id === entity.id)
    const next = n === -1 ? [...list, entity] : list.map((x, i) => (i === n ? entity : x))
    this.commit({ ...this.data, [k]: next }, this.markEdited(key(k, entity.id)))
  }

  /** Cambia algunos campos de un elemento. */
  patch<K extends CollectionKey>(k: K, id: ID, changes: Partial<EntityOf<K>>): void {
    const current = (this.data[k] as EntityOf<K>[]).find((x) => x.id === id)
    if (current) this.upsert(k, { ...current, ...changes })
  }

  /** Borra un elemento; si es un proyecto, también todo lo suyo. */
  remove(k: CollectionKey, id: ID): void {
    const deleted = new Set(this.meta.deleted)
    deleted.add(key(k, id))
    let data: StudioData = { ...this.data, [k]: (this.data[k] as { id: ID }[]).filter((x) => x.id !== id) }
    if (k === 'projects') {
      for (const c of PROJECT_OWNED) {
        const list = data[c] as { id: ID; projectId?: ID }[]
        for (const x of list) if (x.projectId === id) deleted.add(key(c, x.id))
        data = { ...data, [c]: list.filter((x) => x.projectId !== id) }
      }
    }
    if (k === 'items') {
      // Que el feedback no apunte a un elemento que ya no existe.
      data = {
        ...data,
        feedback: data.feedback.map((f) =>
          f.linkedItemIds.includes(id) ? { ...f, linkedItemIds: f.linkedItemIds.filter((x) => x !== id) } : f,
        ),
      }
    }
    this.commit(data, { ...this.meta, deleted: [...deleted] })
  }

  updateStudio(changes: Partial<Studio>): void {
    this.commit({ ...this.data, studio: { ...this.data.studio, ...changes } }, this.markEdited('studio'))
  }

  /** Sustituye todos los datos (importar). Devuelve los problemas si no son válidos. */
  replaceAll(raw: unknown): string[] {
    const errors = validateStudioData(raw)
    if (errors.length) return errors
    this.commit(raw as StudioData, { seedVersion: this.seedVersion, edited: [], deleted: [] })
    return []
  }

  /** Vuelve a los datos iniciales y olvida los cambios. */
  resetToSeed(): void {
    this.commit(this.seed(), { seedVersion: this.seedVersion, edited: [], deleted: [] })
  }

  /** Trae los datos iniciales nuevos respetando lo editado. */
  applySeedUpdate(): void {
    this.commit(mergeSeed(this.data, this.meta, this.seed()), { ...this.meta, seedVersion: this.seedVersion })
  }

  /** Foto del estado (datos y qué se ha editado), para poder deshacer. */
  snapshot(): Persisted {
    return { data: this.data, meta: this.meta }
  }

  /** Vuelve a una foto tomada con snapshot(). */
  restore(p: Persisted): void {
    this.commit(p.data, p.meta)
  }

  exportJSON(): string {
    return JSON.stringify(this.data, null, 2)
  }
}

function createStore(): StudioStore {
  if (!EN_CLAUDE) return new StudioStore(new LocalStorageAdapter())
  // En claude.ai: los datos están en la base de la página (la build no lleva datos iniciales).
  const meta: StoreMeta = { seedVersion: SEED_VERSION, edited: [], deleted: [] }
  return new StudioStore(new RemoteAdapter(capability('db'), capability('user'), createSeedData, meta))
}

export const store = createStore()

/** Los datos del estudio, siempre al día. */
export function useStudioData(): StudioData {
  return useSyncExternalStore(store.subscribe, store.getData)
}

export function useStoreMeta(): StoreMeta {
  return useSyncExternalStore(store.subscribe, store.getMeta)
}

/** Dónde se guardan los datos y si se pueden cambiar. */
export function useStoreStatus(): StoreStatus {
  return useSyncExternalStore(store.subscribe, store.getStatus)
}

/** ¿Puede quien mira cambiar los datos? */
export function useCanEdit(): boolean {
  const s = useStoreStatus()
  return s.canWrite && (s.state === 'local' || s.state === 'ready')
}
