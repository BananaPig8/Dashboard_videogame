// El registro de colecciones: una entrada por cada lista de StudioData con lo que el resto
// de la aplicación necesita saber de ella (prefijo de los ids nuevos, si cuelga de un
// proyecto, cómo se agrupa en la base de claude.ai, quién puede leerla allí y a qué apunta).
// validate.ts, migrate.ts, el store, el almacén remoto y los formularios salen de aquí:
// añadir una colección es añadir una entrada.
import type { StudioData } from './types'

export type CollectionKey = Exclude<keyof StudioData, 'schemaVersion' | 'studio'>

/**
 * Qué pasa con una referencia cuando se borra lo referenciado:
 * - unset: se quita el campo.
 * - pull: se quita el id de la lista.
 * - cascade: se borra también lo que apunta.
 * - block: no se puede borrar (p. ej. una persona con trabajo: se desactiva).
 */
export type OnDelete = 'unset' | 'pull' | 'cascade' | 'block'

export interface RefDef {
  field: string
  to: CollectionKey
  /** El campo es una lista de ids. */
  many?: boolean
  onDelete: OnDelete
}

export interface CollectionDef {
  key: CollectionKey
  /** Prefijo de los ids que se crean desde la interfaz. */
  idPrefix: string
  /**
   * Al borrar su proyecto: cascade (se borran con él), unset (se quedan sin proyecto: el
   * dinero no se borra solo) o false (no cuelgan de un proyecto).
   */
  withProject: 'cascade' | 'unset' | false
  /** projectId obligatorio. */
  projectRequired: boolean
  /** Lleva etiquetas (tags). */
  tagged: boolean
  /**
   * En la base de claude.ai: documentos agrupados por esta clave ({entries: […]}) en vez de
   * uno por elemento, para colecciones que crecen sin parar. Cada grupo tiene un solo
   * escritor habitual (una persona, un importador).
   */
  bucket?: (entity: Record<string, unknown>) => string
  /** En la base de claude.ai, solo la leen quienes pueden editar (Editor o dueño). */
  private?: boolean
  refs: RefDef[]
}

const def = (d: Omit<CollectionDef, 'refs' | 'tagged' | 'projectRequired'> & Partial<Pick<CollectionDef, 'refs' | 'tagged' | 'projectRequired'>>): CollectionDef => ({
  refs: [],
  tagged: false,
  projectRequired: false,
  ...d,
})

const month = (date: unknown) => String(date ?? '').slice(0, 7)

export const COLLECTION_DEFS: CollectionDef[] = [
  def({ key: 'areas', idPrefix: 'area', withProject: false }),
  def({ key: 'projects', idPrefix: 'proyecto', withProject: false, tagged: true }),
  def({
    key: 'items',
    idPrefix: 'item',
    withProject: 'cascade',
    projectRequired: true,
    tagged: true,
    refs: [
      { field: 'areaId', to: 'areas', onDelete: 'unset' },
      { field: 'parentId', to: 'items', onDelete: 'unset' },
      { field: 'assigneeId', to: 'members', onDelete: 'block' },
      { field: 'buildId', to: 'builds', onDelete: 'unset' },
      { field: 'releaseId', to: 'releases', onDelete: 'unset' },
      { field: 'eventId', to: 'events', onDelete: 'unset' },
    ],
  }),
  def({
    key: 'builds',
    idPrefix: 'build',
    withProject: 'cascade',
    projectRequired: true,
    tagged: true,
    refs: [
      { field: 'releaseId', to: 'releases', onDelete: 'unset' },
      { field: 'eventId', to: 'events', onDelete: 'unset' },
    ],
  }),
  def({
    key: 'events',
    idPrefix: 'evento',
    withProject: 'cascade',
    tagged: true,
    refs: [{ field: 'memberIds', to: 'members', many: true, onDelete: 'block' }],
  }),
  def({
    key: 'feedback',
    idPrefix: 'feedback',
    withProject: 'cascade',
    projectRequired: true,
    tagged: true,
    refs: [
      { field: 'linkedItemIds', to: 'items', many: true, onDelete: 'pull' },
      { field: 'eventId', to: 'events', onDelete: 'unset' },
      { field: 'playtestId', to: 'playtests', onDelete: 'unset' },
      { field: 'buildId', to: 'builds', onDelete: 'unset' },
    ],
  }),
  def({
    key: 'resources',
    idPrefix: 'recurso',
    withProject: 'cascade',
    tagged: true,
    refs: [
      { field: 'eventId', to: 'events', onDelete: 'unset' },
      { field: 'releaseId', to: 'releases', onDelete: 'unset' },
    ],
  }),
  def({
    key: 'checklists',
    idPrefix: 'lista',
    withProject: 'cascade',
    projectRequired: true,
    tagged: true,
    refs: [
      { field: 'eventId', to: 'events', onDelete: 'unset' },
      { field: 'releaseId', to: 'releases', onDelete: 'unset' },
      { field: 'listingId', to: 'storeListings', onDelete: 'unset' },
    ],
  }),
  def({
    key: 'activity',
    idPrefix: 'actividad',
    withProject: 'cascade',
    projectRequired: true,
    bucket: (a) => `${a.projectId}~${month(a.at)}`,
    refs: [
      { field: 'areaId', to: 'areas', onDelete: 'unset' },
      { field: 'memberId', to: 'members', onDelete: 'block' },
    ],
  }),
  def({
    key: 'members',
    idPrefix: 'persona',
    withProject: false,
    refs: [{ field: 'areaIds', to: 'areas', many: true, onDelete: 'pull' }],
  }),
  def({
    key: 'timeEntries',
    idPrefix: 'horas',
    withProject: 'cascade',
    projectRequired: true,
    bucket: (e) => `${e.memberId ?? 'sin-persona'}~${month(e.date)}`,
    refs: [
      { field: 'memberId', to: 'members', onDelete: 'block' },
      { field: 'itemId', to: 'items', onDelete: 'unset' },
    ],
  }),
  def({ key: 'phases', idPrefix: 'fase', withProject: 'cascade', projectRequired: true }),
  def({ key: 'releases', idPrefix: 'version', withProject: 'cascade', projectRequired: true, tagged: true }),
  def({
    key: 'storeListings',
    idPrefix: 'ficha',
    withProject: 'cascade',
    projectRequired: true,
    tagged: true,
    refs: [{ field: 'releaseId', to: 'releases', onDelete: 'unset' }],
  }),
  def({
    key: 'storeTexts',
    idPrefix: 'texto',
    withProject: 'cascade',
    projectRequired: true,
    refs: [{ field: 'listingId', to: 'storeListings', onDelete: 'cascade' }],
  }),
  def({ key: 'achievements', idPrefix: 'logro', withProject: 'cascade', projectRequired: true, tagged: true }),
  def({
    key: 'playtests',
    idPrefix: 'prueba',
    withProject: 'cascade',
    projectRequired: true,
    tagged: true,
    refs: [
      { field: 'buildId', to: 'builds', onDelete: 'unset' },
      { field: 'eventId', to: 'events', onDelete: 'unset' },
    ],
  }),
  def({ key: 'reminders', idPrefix: 'recordatorio', withProject: 'cascade' }),
  def({
    key: 'transactions',
    idPrefix: 'movimiento',
    withProject: 'unset',
    tagged: true,
    private: true,
    refs: [{ field: 'eventId', to: 'events', onDelete: 'unset' }],
  }),
  def({ key: 'budgets', idPrefix: 'presupuesto', withProject: 'unset', private: true }),
  def({ key: 'metrics', idPrefix: 'metrica', withProject: 'cascade', projectRequired: true }),
]

export const COLLECTIONS: CollectionKey[] = COLLECTION_DEFS.map((d) => d.key)

export const COLLECTION_BY_KEY = Object.fromEntries(COLLECTION_DEFS.map((d) => [d.key, d])) as Record<CollectionKey, CollectionDef>

/** Las referencias que apuntan a una colección: [colección de origen, referencia]. */
export function refsTo(target: CollectionKey): [CollectionKey, RefDef][] {
  return COLLECTION_DEFS.flatMap((d) => d.refs.filter((r) => r.to === target).map((r) => [d.key, r] as [CollectionKey, RefDef]))
}

/** Las colecciones que tienen etiquetas. */
export const TAGGED: CollectionKey[] = COLLECTION_DEFS.filter((d) => d.tagged).map((d) => d.key)

/** Datos vacíos: todas las colecciones sin nada. */
export function emptyCollections(): Omit<StudioData, 'schemaVersion' | 'studio'> {
  return Object.fromEntries(COLLECTIONS.map((k) => [k, []])) as unknown as Omit<StudioData, 'schemaVersion' | 'studio'>
}
