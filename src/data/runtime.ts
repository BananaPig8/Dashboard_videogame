// Dónde se ejecuta Studio Hub. La build normal guarda en el navegador; la build para
// claude.ai (VITE_DESTINO=artifact) guarda en la base de datos de la página, que comparten
// el estudio y Claude. Aquí solo están los tipos mínimos de lo que se usa de esa página.

/** true en la build para claude.ai (página privada con base de datos compartida). */
export const EN_CLAUDE = import.meta.env?.VITE_DESTINO === 'artifact'

export interface DbError {
  code: string
  message: string
}

export interface DbSnapshotMeta {
  fromCache: boolean
  hasPendingWrites: boolean
}

export interface DbDoc {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
  metadata: DbSnapshotMeta
}

export interface DbQuerySnapshot {
  docs: DbDoc[]
  metadata: DbSnapshotMeta
}

export interface DbDocRef {
  set(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  onSnapshot(next: (snap: DbDoc) => void, error?: (e: DbError) => void): () => void
}

export interface DbCollectionRef {
  doc(id: string): DbDocRef
  onSnapshot(next: (snap: DbQuerySnapshot) => void, error?: (e: DbError) => void): () => void
}

export interface Db {
  doc(path: string): DbDocRef
  collection(path: string): DbCollectionRef
}

export interface Downloads {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: 'saved' | 'delivered' }>
}

export interface UserInfo {
  can(capability: string): Promise<boolean | null>
}

interface Capabilities {
  db: Db
  downloads: Downloads
  user: UserInfo
}

interface ClaudeRuntime {
  use<K extends keyof Capabilities>(name: K): Promise<Capabilities[K] | null>
}

/** Pide una capacidad de la página; null si no está (fuera de claude.ai, sin sesión…). */
export function capability<K extends keyof Capabilities>(name: K): Promise<Capabilities[K] | null> {
  const claude = (globalThis as { claude?: ClaudeRuntime }).claude
  if (!claude?.use) return Promise.resolve(null)
  return claude.use(name).catch(() => null)
}
