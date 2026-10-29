// Las etiquetas son las mismas en todo el estudio: una etiqueta junta tareas, builds,
// eventos, feedback, recursos… de cualquier colección que las tenga.
import { TAGGED, type CollectionKey } from '../collections'
import type { ID, StudioData } from '../types'
import { normalize, type Scope } from '../selectors'

type Row = { id: ID; projectId?: ID; tags?: string[] }

const tagsOf = (e: Row) => (Array.isArray(e.tags) ? e.tags : [])
const sameTag = (a: string, b: string) => normalize(a) === normalize(b)

export interface TagUse {
  tag: string
  count: number
  /** En qué colecciones aparece. */
  collections: CollectionKey[]
}

/** Todas las etiquetas del estudio con cuántas veces se usan (de más a menos). */
export function allTags(data: StudioData, scope: Scope = null): TagUse[] {
  const uses = new Map<string, TagUse>()
  for (const k of TAGGED)
    for (const e of data[k] as unknown as Row[]) {
      if (scope !== null && k !== 'projects' && e.projectId !== scope) continue
      if (scope !== null && k === 'projects' && e.id !== scope) continue
      for (const tag of tagsOf(e)) {
        const key = normalize(tag)
        const u = uses.get(key) ?? { tag, count: 0, collections: [] }
        u.count++
        if (!u.collections.includes(k)) u.collections.push(k)
        uses.set(key, u)
      }
    }
  return [...uses.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'es'))
}

/** Lo que lleva una etiqueta, por colección (solo las colecciones donde hay algo). */
export function byTag(data: StudioData, tag: string, scope: Scope = null): Partial<Record<CollectionKey, Row[]>> {
  const out: Partial<Record<CollectionKey, Row[]>> = {}
  for (const k of TAGGED) {
    const list = (data[k] as unknown as Row[]).filter(
      (e) => tagsOf(e).some((t) => sameTag(t, tag)) && (scope === null || (k === 'projects' ? e.id === scope : e.projectId === scope)),
    )
    if (list.length) out[k] = list
  }
  return out
}

/** ¿Lleva esta etiqueta? (para el filtro ?etiqueta= de cualquier sección). */
export function hasTag(entity: { tags?: string[] }, tag: string | null): boolean {
  return !tag || tagsOf(entity as Row).some((t) => sameTag(t, tag))
}

/**
 * Renombra (o fusiona, si el nombre nuevo ya existe) una etiqueta en todas las colecciones.
 * Devuelve los datos nuevos y qué elementos han cambiado, como «colección:id».
 */
export function renameTag(data: StudioData, from: string, to: string): { data: StudioData; changed: string[] } {
  const target = to.trim()
  if (!target || from === target) return { data, changed: [] }
  const next = { ...data } as unknown as Record<CollectionKey, Row[]>
  const changed: string[] = []
  for (const k of TAGGED) {
    const list = next[k]
    if (!list.some((e) => tagsOf(e).some((t) => sameTag(t, from)))) continue
    next[k] = list.map((e) => {
      if (!tagsOf(e).some((t) => sameTag(t, from))) return e
      changed.push(`${k}:${e.id}`)
      const tags: string[] = []
      for (const t of tagsOf(e)) {
        const v = sameTag(t, from) ? target : t
        if (!tags.some((x) => sameTag(x, v))) tags.push(v)
      }
      return { ...e, tags }
    })
  }
  return { data: next as unknown as StudioData, changed }
}
