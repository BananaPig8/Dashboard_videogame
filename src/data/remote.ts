// Almacén remoto: la base de datos de la página de Studio Hub en claude.ai, que comparten
// el estudio y Claude. Cada elemento es un documento («items/<id>»); las colecciones que
// crecen sin parar van agrupadas (el historial por proyecto y mes, las horas por persona y
// mes: «activity/<proyecto>~<AAAA-MM>» con {entries: […]}), según el registro de
// domain/collections.ts; el estudio va en «estudio/datos». Los cambios de otros (o de
// Claude) llegan en vivo y solo se escribe lo que cambia.
import { COLLECTIONS, COLLECTION_BY_KEY, type CollectionKey } from '../domain/collections'
import type { Activity, StudioData } from '../domain/types'
import type { Db, DbError, UserInfo } from './runtime'
import type { Persisted, RemoteStatus, StorageAdapter, StoreMeta } from './storage'

type Body = Record<string, unknown>

/** Dónde vive el estudio (nombre, lema) y la versión del esquema. */
export const STUDIO_DOC = 'estudio/datos'
/** Colecciones agrupadas: cada documento lleva {entries: [...]}. */
const BUCKETED = new Set<CollectionKey>(COLLECTIONS.filter((k) => COLLECTION_BY_KEY[k].bucket))

/** El documento de su colección agrupada donde va un elemento. */
function groupOf(k: CollectionKey, e: object): string {
  return docIdFor(COLLECTION_BY_KEY[k].bucket!(e as Record<string, unknown>))
}
/** Campo con el que se conserva el orden de las listas (la base ordena por id). */
const ORDER_FIELD = '_orden'

const SEGMENT = /^[A-Za-z0-9_\-.~:@+]{1,200}$/

/** El id de documento para un id del modelo (la base solo admite algunos caracteres). */
export function docIdFor(id: string): string {
  if (SEGMENT.test(id) && id !== '.' && id !== '..') return id
  const hex = Array.from(new TextEncoder().encode(id), (b) => b.toString(16).padStart(2, '0')).join('')
  return `x-${hex.slice(0, 190)}`
}

/** El documento del historial donde va una actividad: su proyecto y su mes. */
export function bucketOf(a: Pick<Activity, 'projectId' | 'at'>): string {
  return groupOf('activity', a)
}

/** Quita lo que la base no guarda (undefined) y deja JSON plano. */
const plain = (x: unknown): Body => JSON.parse(JSON.stringify(x)) as Body

const jsonCache = new WeakMap<object, string>()
const asJson = (x: object): string => {
  let j = jsonCache.get(x)
  if (j === undefined) {
    j = JSON.stringify(x)
    jsonCache.set(x, j)
  }
  return j
}

/**
 * Junta lo que llega de la base con lo que ya hay: lo que no ha cambiado conserva el mismo
 * objeto. Así el eco de lo que esta página acaba de guardar no cambia nada (ni repinta ni
 * rompe «Deshacer») y solo se escribe lo que de verdad se toca.
 */
export function reconcile(current: StudioData, fresh: StudioData): StudioData {
  let same = current.schemaVersion === fresh.schemaVersion
  const studio = asJson(current.studio) === asJson(fresh.studio) ? current.studio : fresh.studio
  if (studio !== current.studio) same = false
  const next = { ...fresh, studio } as unknown as Record<string, unknown>
  for (const k of COLLECTIONS) {
    const old = current[k] as { id: string }[]
    const byId = new Map(old.map((e) => [e.id, e]))
    let unchanged = old.length === (fresh[k] as unknown[]).length
    const list = (fresh[k] as { id: string }[]).map((e, n) => {
      const was = byId.get(e.id)
      const keep = was && (was === e || asJson(was) === asJson(e)) ? was : e
      if (keep !== old[n]) unchanged = false
      return keep
    })
    next[k] = unchanged ? old : list
    if (!unchanged) same = false
  }
  return same ? current : (next as unknown as StudioData)
}

const RETRYABLE = new Set(['unavailable', 'resource_exhausted'])
const UNAVAILABLE = new Set(['revoked', 'not_granted', 'capability_disabled', 'capability_removed'])

export interface RemoteOptions {
  /** Cuánto esperar a los datos definitivos antes de aceptar los de la caché. */
  readyTimeoutMs?: number
  /** Agrupa ráfagas de cambios remotos antes de avisar a las pantallas. */
  debounceMs?: number
  /** Escrituras a la vez como mucho. */
  concurrency?: number
}

export class RemoteAdapter implements StorageAdapter {
  private db: Db | null = null
  private readonly remote = new Map<CollectionKey, Map<string, Body>>()
  private studioBody: Body | undefined
  /** Suscripciones que ya han entregado algo, y las que ya tienen datos definitivos. */
  private readonly seen = new Set<string>()
  private readonly definitive = new Set<string>()
  /** Escrituras por hacer (ruta → cuerpo; null = borrar) y en curso. */
  private readonly queued = new Map<string, Body | null>()
  private readonly inflight = new Map<string, Body | null>()
  private readonly attempts = new Map<string, number>()
  private readonly entityCache = new WeakMap<object, unknown>()
  private cache: Persisted | null = null
  private dirty = true
  private current: RemoteStatus = { state: 'connecting', canWrite: true }
  private readonly listeners = new Set<() => void>()
  private notifyTimer: ReturnType<typeof setTimeout> | undefined
  private timedOut = false
  private readonly opts: Required<RemoteOptions>

  constructor(
    db: Promise<Db | null>,
    user: Promise<UserInfo | null>,
    /** Los datos vacíos de partida (sin proyectos): lo que hay si la base no tiene nada. */
    private readonly empty: () => StudioData,
    private readonly meta: StoreMeta,
    options: RemoteOptions = {},
  ) {
    this.opts = { readyTimeoutMs: 10_000, debounceMs: 120, concurrency: 4, ...options }
    void db.then((d) => this.connect(d))
    void user
      .then((u) => u?.can('data.write'))
      .then((can) => {
        if (can === false) this.setStatus({ canWrite: false })
      })
      .catch(() => {})
  }

  // ——— StorageAdapter ———

  load(): Persisted | null {
    if (this.current.state !== 'ready') return null
    if (this.dirty || !this.cache) {
      this.cache = { data: this.build(), meta: this.meta }
      this.dirty = false
    }
    return this.cache
  }

  save(p: Persisted, prev: Persisted): void {
    if (!this.db || this.current.state !== 'ready' || !this.current.canWrite) return
    const next = p.data
    const before = prev.data
    if (next.studio !== before.studio || next.schemaVersion !== before.schemaVersion)
      this.enqueue(STUDIO_DOC, plain({ studio: next.studio, schemaVersion: next.schemaVersion }))
    for (const k of COLLECTIONS) {
      const list = next[k] as { id: string }[]
      const old = before[k] as { id: string }[]
      if (list === old) continue
      const prevById = new Map(old.map((e) => [e.id, e]))
      const nextIds = new Set(list.map((e) => e.id))
      if (BUCKETED.has(k)) {
        const touched = new Set<string>()
        for (const e of list) {
          const was = prevById.get(e.id)
          if (was === e) continue
          touched.add(groupOf(k, e))
          if (was) touched.add(groupOf(k, was))
        }
        for (const e of old) if (!nextIds.has(e.id)) touched.add(groupOf(k, e))
        for (const bucket of touched) {
          const entries = list.filter((e) => groupOf(k, e) === bucket)
          this.enqueue(`${k}/${bucket}`, entries.length ? plain({ entries }) : null)
        }
      } else {
        list.forEach((e, n) => {
          if (prevById.get(e.id) !== e) this.enqueue(`${k}/${docIdFor(e.id)}`, { ...plain(e), [ORDER_FIELD]: n })
        })
        for (const e of old) if (!nextIds.has(e.id)) this.enqueue(`${k}/${docIdFor(e.id)}`, null)
      }
    }
    this.dirty = true
    this.pump()
  }

  clear(): void {
    // Borrar la base entera no se hace desde la página.
  }

  watch(onChange: () => void): () => void {
    this.listeners.add(onChange)
    return () => this.listeners.delete(onChange)
  }

  status(): RemoteStatus {
    return this.current
  }

  /** ¿Queda algo por guardar? */
  get pending(): number {
    return this.queued.size + this.inflight.size
  }

  // ——— Conexión ———

  private connect(db: Db | null) {
    if (!db) {
      this.setStatus({ state: 'unavailable' })
      return
    }
    this.db = db
    for (const k of COLLECTIONS) this.subscribeCollection(k)
    this.subscribeStudio()
    setTimeout(() => {
      this.timedOut = true
      this.checkReady()
    }, this.opts.readyTimeoutMs)
  }

  private subscribeCollection(k: CollectionKey, retries = 0) {
    this.db!.collection(k).onSnapshot(
      (snap) => {
        const docs = new Map<string, Body>()
        for (const d of snap.docs) if (d.exists) docs.set(d.id, d.data() as Body)
        this.remote.set(k, docs)
        this.received(k, snap.metadata.fromCache)
      },
      (e) => this.lost(e, () => this.subscribeCollection(k, retries + 1), retries),
    )
  }

  private subscribeStudio(retries = 0) {
    this.db!.doc(STUDIO_DOC).onSnapshot(
      (snap) => {
        this.studioBody = snap.exists ? (snap.data() as Body) : undefined
        this.received(STUDIO_DOC, snap.metadata.fromCache)
      },
      (e) => this.lost(e, () => this.subscribeStudio(retries + 1), retries),
    )
  }

  private received(key: string, fromCache: boolean) {
    this.seen.add(key)
    if (!fromCache) this.definitive.add(key)
    this.dirty = true
    this.checkReady()
    this.scheduleNotify()
  }

  private lost(e: DbError, resubscribe: () => void, retries: number) {
    if (e.code === 'unavailable' && retries < 3) {
      setTimeout(resubscribe, 1000 * 2 ** retries)
      return
    }
    if (UNAVAILABLE.has(e.code) || e.code === 'unavailable') this.setStatus({ state: 'unavailable' })
    else this.setStatus({ saveError: e.message })
  }

  private checkReady() {
    if (this.current.state !== 'connecting') return
    const keys = [...COLLECTIONS, STUDIO_DOC]
    const all = (s: Set<string>) => keys.every((k) => s.has(k))
    if (all(this.definitive) || (this.timedOut && all(this.seen))) this.setStatus({ state: 'ready' })
  }

  private setStatus(change: Partial<RemoteStatus>) {
    this.current = { ...this.current, ...change }
    this.dirty = true
    this.scheduleNotify(true)
  }

  private scheduleNotify(now = false) {
    if (this.current.state === 'connecting' && !now) return
    clearTimeout(this.notifyTimer)
    this.notifyTimer = setTimeout(() => {
      for (const fn of this.listeners) fn()
    }, now ? 0 : this.opts.debounceMs)
  }

  // ——— Lectura: de documentos a StudioData ———

  /** Lo que hay en la base más lo que esta página aún está guardando. */
  private view(k: CollectionKey): Map<string, Body> {
    const docs = new Map(this.remote.get(k) ?? [])
    for (const pending of [this.inflight, this.queued]) {
      for (const [path, body] of pending) {
        const [coll, id] = path.split('/')
        if (coll !== k) continue
        if (body) docs.set(id, body)
        else docs.delete(id)
      }
    }
    return docs
  }

  /** Copia un cuerpo (los de la base llegan congelados), una vez por cuerpo. */
  private entity<T>(body: Body, make: (b: Body) => T): T {
    let e = this.entityCache.get(body) as T | undefined
    if (e === undefined) {
      e = make(structuredClone(body))
      this.entityCache.set(body, e)
    }
    return e
  }

  private build(): StudioData {
    const base = this.empty()
    const pendingStudio = this.queued.has(STUDIO_DOC) ? this.queued.get(STUDIO_DOC) : this.inflight.get(STUDIO_DOC)
    const studioBody = pendingStudio ?? this.studioBody
    const data: StudioData = {
      ...base,
      studio: (studioBody?.studio as StudioData['studio']) ?? base.studio,
      schemaVersion: (studioBody?.schemaVersion as number) ?? base.schemaVersion,
    }
    for (const k of COLLECTIONS) {
      const docs = [...this.view(k).entries()]
      if (BUCKETED.has(k)) {
        const entries = docs
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .flatMap(([, body]) => this.entity(body, (b) => (Array.isArray(b.entries) ? (b.entries as unknown[]) : [])))
        ;(data as unknown as Record<string, unknown>)[k] = entries
      } else {
        const order = (b: Body) => (typeof b[ORDER_FIELD] === 'number' ? (b[ORDER_FIELD] as number) : Number.MAX_SAFE_INTEGER)
        const list = docs
          .sort(([ida, a], [idb, b]) => order(a) - order(b) || (ida < idb ? -1 : ida > idb ? 1 : 0))
          .map(([, body]) =>
            this.entity(body, (b) => {
              delete b[ORDER_FIELD]
              return b
            }),
          )
        ;(data as unknown as Record<string, unknown>)[k] = list
      }
    }
    return data
  }

  // ——— Escritura ———

  private enqueue(path: string, body: Body | null) {
    this.queued.set(path, body)
    this.attempts.delete(path)
  }

  private pump() {
    if (!this.db) return
    for (const [path, body] of this.queued) {
      if (this.inflight.size >= this.opts.concurrency) return
      if (this.inflight.has(path)) continue // una escritura a la vez por documento
      this.queued.delete(path)
      this.inflight.set(path, body)
      const ref = this.db.doc(path)
      const op = body ? ref.set(body) : ref.delete()
      op.then(
        () => this.settled(path),
        (e: DbError) => this.failed(path, body, e),
      )
    }
  }

  private settled(path: string) {
    this.inflight.delete(path)
    this.attempts.delete(path)
    this.dirty = true
    if (this.current.saveError) this.setStatus({ saveError: undefined })
    this.pump()
  }

  private failed(path: string, body: Body | null, e: DbError) {
    this.inflight.delete(path)
    const n = (this.attempts.get(path) ?? 0) + 1
    if (RETRYABLE.has(e?.code) && n <= 5) {
      this.attempts.set(path, n)
      // Se reintenta si no hay ya una versión más nueva esperando.
      setTimeout(() => {
        if (!this.queued.has(path)) this.queued.set(path, body)
        this.pump()
      }, 400 * 2 ** n + Math.random() * 300)
      return
    }
    this.attempts.delete(path)
    if (e?.code === 'invalid_argument' || e?.code === 'transform_error') {
      // Una escritura bien formada rechazada: quien mira solo puede leer. Se descarta lo
      // pendiente y la página vuelve a lo que hay en la base.
      this.queued.clear()
      this.setStatus({ canWrite: false })
    } else if (e?.code === 'quota_exceeded') {
      this.setStatus({ saveError: 'La base de datos de la página está llena: no se ha guardado el último cambio.' })
    } else {
      this.setStatus({ saveError: 'No se ha podido guardar el último cambio.' })
    }
    this.pump()
  }
}
