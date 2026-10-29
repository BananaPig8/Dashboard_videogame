// Dónde se guardan los datos. Hoy, en el navegador (localStorage); la interfaz
// StorageAdapter permite cambiarlo por un servidor o un fichero sin tocar las pantallas.
import type { StudioData } from '../domain/types'

export interface StoreMeta {
  /** Versión de los datos iniciales con la que se crearon o actualizaron estos datos. */
  seedVersion: string
  /** Elementos tocados a mano («items:idt-…»): al traer datos iniciales nuevos no se pisan. */
  edited: string[]
  /** Elementos borrados a mano: al traer datos iniciales nuevos no vuelven. */
  deleted: string[]
  savedAt?: string
}

export interface Persisted {
  data: StudioData
  meta: StoreMeta
}

/** Estado de un almacén remoto (la base de datos de la página en claude.ai). */
export interface RemoteStatus {
  /** connecting: aún no han llegado los datos; unavailable: no hay base de datos. */
  state: 'connecting' | 'ready' | 'unavailable'
  /** false si quien mira solo puede leer. */
  canWrite: boolean
  /** El último cambio que no se pudo guardar, si lo hay. */
  saveError?: string
}

export interface StorageAdapter {
  load(): Persisted | null
  /** Guarda el estado nuevo; `prev` es el anterior, para guardar solo lo que cambió. false: no se pudo. */
  save(p: Persisted, prev: Persisted): boolean | void
  clear(): void
  /** Avisa cuando los datos cambian fuera (otra pestaña). Devuelve cómo dejar de escuchar. */
  watch?(onChange: () => void): () => void
  /** Solo los almacenes remotos: conexión y permisos. */
  status?(): RemoteStatus
}

export const STORAGE_KEY = 'studio-hub:v2'
/** Donde guardaba la versión 1 de los datos. Se lee una vez y se deja como copia. */
export const STORAGE_KEY_V1 = 'studio-hub:v1'

export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly key = STORAGE_KEY,
    private readonly previousKey: string | null = STORAGE_KEY_V1,
  ) {}

  load(): Persisted | null {
    try {
      // Si aún no hay datos v2, se arranca con los v1 (se normalizan al cargar; la clave v1
      // no se borra, así una pestaña antigua abierta no pisa los datos nuevos).
      const raw = localStorage.getItem(this.key) ?? (this.previousKey ? localStorage.getItem(this.previousKey) : null)
      return raw ? (JSON.parse(raw) as Persisted) : null
    } catch {
      return null
    }
  }

  save(p: Persisted): boolean {
    try {
      localStorage.setItem(this.key, JSON.stringify(p))
      return true
    } catch {
      // Sin espacio o en modo privado: el panel sigue funcionando en memoria y lo avisa.
      return false
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key)
    } catch {
      /* nada que borrar */
    }
  }

  watch(onChange: () => void): () => void {
    if (typeof window === 'undefined') return () => {}
    const handler = (e: StorageEvent) => {
      if (e.key === this.key) onChange()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }
}

/** Para las pruebas: guarda en memoria. */
export class MemoryAdapter implements StorageAdapter {
  private value: string | null = null
  load(): Persisted | null {
    return this.value ? (JSON.parse(this.value) as Persisted) : null
  }
  save(p: Persisted): boolean {
    this.value = JSON.stringify(p)
    return true
  }
  clear(): void {
    this.value = null
  }
}
