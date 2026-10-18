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

export interface StorageAdapter {
  load(): Persisted | null
  save(p: Persisted): void
  clear(): void
  /** Avisa cuando los datos cambian fuera (otra pestaña). Devuelve cómo dejar de escuchar. */
  watch?(onChange: () => void): () => void
}

export const STORAGE_KEY = 'studio-hub:v1'

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly key = STORAGE_KEY) {}

  load(): Persisted | null {
    try {
      const raw = localStorage.getItem(this.key)
      return raw ? (JSON.parse(raw) as Persisted) : null
    } catch {
      return null
    }
  }

  save(p: Persisted): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(p))
    } catch {
      // Sin espacio o en modo privado: el panel sigue funcionando en memoria.
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
  save(p: Persisted): void {
    this.value = JSON.stringify(p)
  }
  clear(): void {
    this.value = null
  }
}
