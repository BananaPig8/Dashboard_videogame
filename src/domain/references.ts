// Qué pasa al borrar algo a lo que apuntan otros elementos: se aplica la regla de cada
// referencia del registro (collections.ts) de forma transitiva (borrar un proyecto borra
// sus listas, y los textos de sus fichas de tienda, y quita las referencias a todo ello).
// Puro: el store lo usa al borrar y el editor, para avisar antes de confirmar.
import { COLLECTION_DEFS, refsTo, type CollectionKey } from './collections'
import type { ID, StudioData } from './types'

type Row = Record<string, unknown>

export interface Reference {
  /** La colección y el campo que apuntan. */
  from: CollectionKey
  field: string
  /** Cuántos elementos apuntan. */
  count: number
  onDelete: 'unset' | 'pull' | 'cascade' | 'block'
}

/** Quién apunta a un elemento (sin contar lo que cuelga de su proyecto, si es un proyecto). */
export function referencesTo(data: StudioData, k: CollectionKey, id: ID): Reference[] {
  const out: Reference[] = []
  for (const [from, ref] of refsTo(k)) {
    const count = (data[from] as unknown as Row[]).filter((e) => (ref.many ? Array.isArray(e[ref.field]) && (e[ref.field] as unknown[]).includes(id) : e[ref.field] === id)).length
    if (count) out.push({ from, field: ref.field, count, onDelete: ref.onDelete })
  }
  if (k === 'projects')
    for (const d of COLLECTION_DEFS) {
      if (!d.withProject) continue
      const count = (data[d.key] as unknown as Row[]).filter((e) => e.projectId === id).length
      if (count) out.push({ from: d.key, field: 'projectId', count, onDelete: d.withProject })
    }
  if (k !== 'reminders') {
    const count = data.reminders.filter((r) => r.targetCollection === k && r.targetId === id).length
    if (count) out.push({ from: 'reminders', field: 'targetId', count, onDelete: 'unset' })
  }
  return out
}

/** ¿Hay algo que impide borrarlo? (p. ej. una persona con trabajo asignado: se desactiva). */
export function blockedBy(data: StudioData, k: CollectionKey, id: ID): Reference[] {
  return referencesTo(data, k, id).filter((r) => r.onDelete === 'block')
}

export interface Removal {
  data: StudioData
  /** Lo borrado, como «colección:id» (lo pide el store para no traerlo de vuelta). */
  deleted: string[]
}

/** Borra un elemento y aplica las reglas de sus referencias. Si algo lo bloquea, no hace nada. */
export function removeWithReferences(data: StudioData, k: CollectionKey, id: ID): Removal {
  if (blockedBy(data, k, id).length) return { data, deleted: [] }
  const next = { ...data } as unknown as Record<CollectionKey, Row[]>
  const deleted: string[] = []
  const queue: [CollectionKey, ID][] = [[k, id]]
  const gone = new Set<string>()
  while (queue.length) {
    const [ck, cid] = queue.shift()!
    const key = `${ck}:${cid}`
    if (gone.has(key)) continue
    gone.add(key)
    deleted.push(key)
    next[ck] = (next[ck] as Row[]).filter((e) => e.id !== cid)
    // Lo que cuelga de un proyecto.
    if (ck === 'projects')
      for (const d of COLLECTION_DEFS) {
        if (!d.withProject) continue
        const list = next[d.key] as Row[]
        if (!list.some((e) => e.projectId === cid)) continue
        if (d.withProject === 'cascade') {
          for (const e of list) if (e.projectId === cid) queue.push([d.key, e.id as ID])
        } else {
          // El dinero no se borra solo: se queda sin proyecto.
          next[d.key] = list.map((e) => {
            if (e.projectId !== cid) return e
            const { projectId: _p, ...rest } = e
            void _p
            return rest
          })
        }
      }
    // Las referencias a lo borrado.
    for (const [from, ref] of refsTo(ck)) {
      const list = next[from] as Row[]
      const points = (e: Row) => (ref.many ? Array.isArray(e[ref.field]) && (e[ref.field] as unknown[]).includes(cid) : e[ref.field] === cid)
      if (!list.some(points)) continue
      if (ref.onDelete === 'cascade') {
        for (const e of list) if (points(e)) queue.push([from, e.id as ID])
        continue
      }
      next[from] = list.map((e) => {
        if (!points(e)) return e
        if (ref.many) return { ...e, [ref.field]: (e[ref.field] as unknown[]).filter((x) => x !== cid) }
        const copy = { ...e }
        delete copy[ref.field]
        return copy
      })
    }
    // Los recordatorios que apuntaban aquí se quedan sin destino.
    if (next.reminders.some((r) => r.targetCollection === ck && r.targetId === cid))
      next.reminders = next.reminders.map((r) => {
        if (r.targetCollection !== ck || r.targetId !== cid) return r
        const { targetCollection: _c, targetId: _i, ...rest } = r
        void _c
        void _i
        return rest
      })
  }
  return { data: next as unknown as StudioData, deleted }
}
