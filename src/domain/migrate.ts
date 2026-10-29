// Normaliza unos datos antes de usarlos: completa lo que falte (colecciones nuevas,
// listas vacías) y quita las referencias opcionales que apuntan a algo que ya no existe.
// Es idempotente y no mira schemaVersion: lee igual datos de la versión 1 (sin las
// colecciones nuevas) que documentos sueltos de la base de claude.ai escritos con
// cualquier versión, sin reescribirlos. Solo se niega con datos de una versión más nueva
// que esta aplicación (los abriría y los pisaría a medias).
import { COLLECTIONS, COLLECTION_DEFS, type CollectionKey } from './collections'
import { SCHEMA_VERSION, type StudioData } from './types'

export interface Normalized {
  /** null si no es un objeto de datos. */
  data: StudioData | null
  /** Lo que se ha arreglado (referencias perdidas, elementos de un proyecto que no existe). */
  warnings: string[]
  /** Los datos son de una versión más nueva de Studio Hub: no se tocan. */
  newer: boolean
}

type Row = Record<string, unknown>

/** Listas que tienen que existir en cada elemento (aunque estén vacías). */
const REQUIRED_LISTS: Partial<Record<CollectionKey, string[]>> = {
  projects: ['platforms', 'versions', 'tags', 'links'],
  items: ['tags', 'sources'],
  resources: ['tags'],
  feedback: ['linkedItemIds', 'sources'],
  checklists: ['items'],
  members: ['areaIds'],
  builds: ['platforms', 'sources'],
  events: ['sources'],
}

export function normalizeData(raw: unknown): Normalized {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { data: null, warnings: [], newer: false }
  const input = raw as Row
  if (typeof input.schemaVersion === 'number' && input.schemaVersion > SCHEMA_VERSION)
    return { data: input as unknown as StudioData, warnings: [], newer: true }

  const warnings: string[] = []
  const out: Row = { ...input, schemaVersion: SCHEMA_VERSION }
  for (const k of COLLECTIONS) {
    const list = Array.isArray(input[k]) ? (input[k] as unknown[]) : []
    const lists = REQUIRED_LISTS[k] ?? []
    out[k] = list.map((e) => {
      if (!e || typeof e !== 'object') return e
      let row = e as Row
      for (const field of lists)
        if (!Array.isArray(row[field])) {
          if (row === e) row = { ...row }
          row[field] = []
        }
      if (k === 'members' && typeof row.active !== 'boolean') {
        if (row === e) row = { ...row }
        row.active = true
      }
      return row
    })
  }

  // Lo de un proyecto que ya no existe no se puede enseñar en ningún sitio.
  const projectIds = new Set((out.projects as Row[]).map((p) => p?.id))
  for (const d of COLLECTION_DEFS) {
    if (!d.projectRequired) continue
    const list = out[d.key] as Row[]
    const kept = list.filter((e) => projectIds.has(e?.projectId))
    if (kept.length !== list.length) {
      warnings.push(`${d.key}: ${list.length - kept.length} sin proyecto (se ocultan)`)
      out[d.key] = kept
    }
  }

  // Referencias opcionales a algo que no existe: se quitan (no bloquean la carga).
  const ids = Object.fromEntries(COLLECTIONS.map((k) => [k, new Set((out[k] as Row[]).map((e) => e?.id))])) as Record<CollectionKey, Set<unknown>>
  for (const d of COLLECTION_DEFS) {
    if (!d.refs.length) continue
    out[d.key] = (out[d.key] as Row[]).map((e) => {
      if (!e || typeof e !== 'object') return e
      let row = e
      for (const r of d.refs) {
        const value = row[r.field]
        if (value === undefined) continue
        if (r.many) {
          if (!Array.isArray(value)) continue
          const keep = value.filter((id) => ids[r.to].has(id))
          if (keep.length !== value.length) {
            warnings.push(`${d.key} ${String(row.id)}: ${value.length - keep.length} referencias perdidas en ${r.field}`)
            row = { ...row, [r.field]: keep }
          }
        } else if (!ids[r.to].has(value)) {
          warnings.push(`${d.key} ${String(row.id)}: ${r.field} apuntaba a «${String(value)}», que no existe`)
          row = { ...row }
          delete row[r.field]
        }
      }
      return row
    })
  }

  // Un recordatorio que apuntaba a algo borrado se queda sin destino.
  out.reminders = (out.reminders as Row[]).map((r) => {
    const target = r?.targetCollection as CollectionKey | undefined
    if (!r || !target || r.targetId === undefined) return r
    if (ids[target]?.has(r.targetId)) return r
    const { targetCollection: _c, targetId: _i, ...rest } = r
    void _c
    void _i
    return rest
  })

  return { data: out as unknown as StudioData, warnings, newer: false }
}
