// El estado de Studio Hub: un único objeto StudioData inmutable. Cada cambio crea uno
// nuevo, se guarda y avisa a las pantallas (useSyncExternalStore).
import { useSyncExternalStore } from 'react'
import { COLLECTIONS, type CollectionKey } from '../domain/collections'
import { nowISODateTime } from '../domain/dates'
import { normalizeData } from '../domain/migrate'
import { removeWithReferences } from '../domain/references'
import { renameTag } from '../domain/secciones/etiquetas'
import type { ID, StudioData, Studio } from '../domain/types'
import { validateStudioData } from '../domain/validate'
import { reconcile, RemoteAdapter } from './remote'
import { capability, EN_CLAUDE } from './runtime'
import { createSeedData, SEED_RETIRED, SEED_VERSION } from './seed'
import { LocalStorageAdapter, type Persisted, type StorageAdapter, type StoreMeta } from './storage'

// Las colecciones salen del registro (domain/collections.ts).
export { COLLECTIONS, type CollectionKey }
export type EntityOf<K extends CollectionKey> = StudioData[K][number]

const key = (k: CollectionKey, id: ID) => `${k}:${id}`

export function newId(prefix: string): ID {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Trae los datos iniciales nuevos sin pisar lo que el estudio ha cambiado: añade lo que
 * falta, actualiza lo que nadie ha tocado y respeta lo editado o borrado a mano.
 */
export function mergeSeed(current: StudioData, meta: StoreMeta, seed: StudioData, retired: readonly string[] = []): StudioData {
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
  // Lo que el estudio haya puesto (moneda, nombres de estados…) nunca lo pisa la semilla.
  if (!edited.has('studio')) next.studio = { ...seed.studio, ...current.studio }
  // Lo que los datos iniciales han retirado («colección:id») se quita, con sus referencias,
  // salvo que el estudio lo haya editado.
  let out = next
  for (const kk of retired) {
    if (edited.has(kk)) continue
    const i = kk.indexOf(':')
    out = removeWithReferences(out, kk.slice(0, i) as CollectionKey, kk.slice(i + 1)).data
  }
  return out
}

type Listener = () => void

const NO_ERRORS: string[] = []

/**
 * Carga unos datos guardados: los normaliza (domain/migrate.ts) y los valida. Si son de
 * una versión más nueva de Studio Hub, no se usan ni se pisan.
 */
function prepare(raw: unknown): { data: StudioData | null; errors: string[]; newer: boolean } {
  const n = normalizeData(raw)
  if (n.newer) return { data: null, errors: [], newer: true }
  if (!n.data) return { data: null, errors: ['No es un objeto JSON.'], newer: false }
  const errors = validateStudioData(n.data)
  return { data: errors.length ? null : n.data, errors, newer: false }
}

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
  /** Los datos guardados son de una versión más nueva de Studio Hub: solo lectura hasta recargar. */
  newer?: boolean
}

export class StudioStore {
  private data: StudioData
  private meta: StoreMeta
  private listeners = new Set<Listener>()
  private status: StoreStatus
  private readonly remote: boolean
  /** Lo guardado es de una versión más nueva: no se toca (solo lectura). */
  private newer = false
  /** El navegador no dejó guardar el último cambio (sin espacio, modo privado…). */
  private localSaveError?: string
  /** Problemas encontrados al cargar lo guardado (si los hay, se arrancó con los datos iniciales). */
  loadErrors: string[] = NO_ERRORS

  constructor(
    private readonly adapter: StorageAdapter,
    private readonly seed: () => StudioData = createSeedData,
    private readonly seedVersion = SEED_VERSION,
  ) {
    const saved = adapter.load()
    const loaded = saved ? prepare(saved.data) : null
    if (saved && loaded?.data) {
      this.data = loaded.data
      this.meta = { ...saved.meta, edited: saved.meta.edited ?? [], deleted: saved.meta.deleted ?? [] }
    } else {
      this.newer = loaded?.newer ?? false
      this.loadErrors = loaded?.errors.length ? loaded.errors : NO_ERRORS
      this.data = seed()
      this.meta = { seedVersion: seedVersion, edited: [], deleted: [] }
    }
    this.remote = Boolean(adapter.status)
    this.status = this.readStatus()
    adapter.watch?.(() => {
      const fresh = adapter.load()
      if (fresh) {
        const next = prepare(fresh.data)
        if (next.newer) {
          this.newer = true
        } else if (next.data) {
          this.data = this.remote ? reconcile(this.data, next.data) : next.data
          // En la base compartida, «qué se editó» no viaja: es cosa de los datos iniciales locales.
          if (!this.remote) this.meta = fresh.meta
          this.loadErrors = NO_ERRORS
        } else if (this.remote) {
          this.loadErrors = next.errors
        }
      }
      this.status = this.readStatus()
      this.emit()
    })
  }

  private readStatus(): StoreStatus {
    const r = this.adapter.status?.()
    const next: StoreStatus = r
      ? { remote: true, state: r.state, canWrite: r.canWrite && !this.newer, saveError: r.saveError, loadErrors: this.loadErrors, newer: this.newer }
      : { remote: false, state: 'local', canWrite: !this.newer, saveError: this.localSaveError, loadErrors: this.loadErrors, newer: this.newer }
    const cur = this.status
    // El mismo objeto si nada cambió (useSyncExternalStore).
    if (
      cur &&
      cur.state === next.state &&
      cur.canWrite === next.canWrite &&
      cur.saveError === next.saveError &&
      cur.loadErrors === next.loadErrors &&
      cur.newer === next.newer
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
    const ok = this.adapter.save({ data: this.data, meta: this.meta } satisfies Persisted, prev)
    if (!this.remote) {
      this.localSaveError = ok === false ? 'Este navegador no ha dejado guardar el último cambio (¿sin espacio o en modo privado?). Exporta una copia.' : undefined
      this.status = this.readStatus()
    }
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

  /**
   * Borra un elemento y aplica las reglas de sus referencias (domain/references.ts): lo de
   * un proyecto se va con él y lo que apuntaba aquí se queda sin esa referencia. Si algo
   * lo impide (una persona con trabajo asignado), no borra nada y devuelve false.
   */
  remove(k: CollectionKey, id: ID): boolean {
    const r = removeWithReferences(this.data, k, id)
    if (!r.deleted.length) return false
    const deleted = new Set(this.meta.deleted)
    for (const d of r.deleted) deleted.add(d)
    this.commit(r.data, { ...this.meta, deleted: [...deleted] })
    return true
  }

  /**
   * Renombra o fusiona una etiqueta en todas las colecciones (domain/secciones/etiquetas.ts).
   * Devuelve cuántos elementos han cambiado.
   */
  renameTag(from: string, to: string): number {
    const r = renameTag(this.data, from, to)
    if (!r.changed.length) return 0
    // «colección:id», la misma clave que lleva la lista de editados.
    this.commit(r.data, this.markEdited(...r.changed))
    return r.changed.length
  }

  updateStudio(changes: Partial<Studio>): void {
    this.commit({ ...this.data, studio: { ...this.data.studio, ...changes } }, this.markEdited('studio'))
  }

  /** Sustituye todos los datos (importar). Devuelve los problemas si no son válidos. */
  replaceAll(raw: unknown): string[] {
    const r = prepare(raw)
    if (r.newer) return ['La copia es de una versión más nueva de Studio Hub: actualiza la aplicación antes de importarla.']
    if (!r.data) return r.errors
    this.commit(r.data, { seedVersion: this.seedVersion, edited: [], deleted: [] })
    return []
  }

  /** Vuelve a los datos iniciales y olvida los cambios. */
  resetToSeed(): void {
    this.commit(this.seed(), { seedVersion: this.seedVersion, edited: [], deleted: [] })
  }

  /** Trae los datos iniciales nuevos respetando lo editado. */
  applySeedUpdate(): void {
    this.commit(mergeSeed(this.data, this.meta, this.seed(), SEED_RETIRED), { ...this.meta, seedVersion: this.seedVersion })
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
