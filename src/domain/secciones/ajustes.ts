// Cálculos de la sección «ajustes» (y de la página de una etiqueta). Las pantallas los piden
// a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { LISTING_KINDS, STATUS_ORDER, STORE_PLATFORMS } from '../catalog'
import { COLLECTION_DEFS, COLLECTIONS, TAGGED, type CollectionKey } from '../collections'
import type { ID, ItemStatus, StudioData } from '../types'
import { byTag, normalize, type Scope } from '../selectors'

// ——— Perfil del estudio: la moneda ————————————————————————————————————————————

/** Monedas habituales (ISO 4217) para el desplegable del perfil. */
export const STUDIO_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'CAD', 'AUD', 'MXN', 'BRL', 'JPY'] as const

/** ¿Es un código de moneda con forma ISO 4217 (tres letras mayúsculas)? */
export const isCurrencyCode = (code: string | undefined): boolean => !!code && /^[A-Z]{3}$/.test(code)

/** Las monedas del desplegable: las habituales y, si el estudio usa otra, también esa (la primera). */
export function currencyOptions(current: string | undefined): string[] {
  const list: string[] = [...STUDIO_CURRENCIES]
  return isCurrencyCode(current) && !list.includes(current!) ? [current!, ...list] : list
}

/** Cuántos importes hay anotados en la moneda del estudio (cambiarla no los convierte). */
export function studioAmountCounts(data: StudioData): { transactions: number; budgets: number } {
  return { transactions: data.transactions.length, budgets: data.budgets.length }
}

// ——— Estados personalizables ——————————————————————————————————————————————————

/**
 * Los nombres propios de los estados, listos para guardar: sin espacios de más, sin los
 * vacíos y sin los que son iguales al nombre de siempre. Sin ninguno, undefined.
 */
export function cleanStatusLabels(
  draft: Partial<Record<ItemStatus, string>>,
  defaults: Record<ItemStatus, string>,
): Partial<Record<ItemStatus, string>> | undefined {
  const out: Partial<Record<ItemStatus, string>> = {}
  for (const k of STATUS_ORDER) {
    const v = draft[k]?.replace(/\s+/g, ' ').trim()
    if (v && v !== defaults[k]) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

/** Nombres propios repetidos (dos estados que se llamarían igual y no se distinguirían). */
export function duplicatedStatusLabels(labels: Record<ItemStatus, string>): ItemStatus[] {
  const seen = new Map<string, ItemStatus[]>()
  for (const k of STATUS_ORDER) {
    const key = normalize(labels[k].trim())
    if (!key) continue
    seen.set(key, [...(seen.get(key) ?? []), k])
  }
  return [...seen.values()].filter((list) => list.length > 1).flat()
}

// ——— Categorías: áreas y etiquetas ————————————————————————————————————————————

/** Para cada área, cuánto la usa: elementos de trabajo, personas y entradas del historial. */
export function settingsAreaUsage(data: StudioData): Record<ID, { items: number; members: number; activity: number }> {
  const out: Record<ID, { items: number; members: number; activity: number }> = {}
  for (const a of data.areas) out[a.id] = { items: 0, members: 0, activity: 0 }
  for (const i of data.items) if (i.areaId && out[i.areaId]) out[i.areaId].items++
  for (const m of data.members) for (const id of m.areaIds ?? []) if (out[id]) out[id].members++
  for (const e of data.activity) if (e.areaId && out[e.areaId]) out[e.areaId].activity++
  return out
}

type Tagged = { id: ID; projectId?: ID; tags?: string[] }

/** Deja una etiqueta escrita a mano como se guarda: sin «#» delante ni espacios de más. */
export const cleanTag = (tag: string): string => tag.replace(/^\s*#+/, '').replace(/\s+/g, ' ').trim()

export interface TagRenamePlan {
  /** El nombre nuevo, limpio. */
  target: string
  /** Por qué no se puede (vacío, con comas o igual que el de ahora); undefined si se puede. */
  problem?: 'empty' | 'comma' | 'same'
  /** Ya existe otra etiqueta con ese nombre: se juntan las dos. */
  merge: boolean
  /** Elementos que llevan la etiqueta de ahora (en todo el estudio). */
  affected: number
  /** Elementos que ya llevan la otra y no esta (si se fusionan). */
  alreadyTarget: number
}

/** Qué pasaría al renombrar `from` como `to` (en todo el estudio), para confirmarlo antes. */
export function tagRenamePlan(data: StudioData, from: string, to: string): TagRenamePlan {
  const target = cleanTag(to)
  const same = (a: string, b: string) => normalize(a) === normalize(b)
  const other = !!target && !same(target, from)
  let affected = 0
  let alreadyTarget = 0
  let exists = false
  for (const k of TAGGED)
    for (const e of data[k] as unknown as Tagged[]) {
      const tags = Array.isArray(e.tags) ? e.tags : []
      const hasTarget = other && tags.some((t) => same(t, target))
      exists ||= hasTarget
      if (tags.some((t) => same(t, from))) affected++
      else if (hasTarget) alreadyTarget++
    }
  const merge = other && exists
  const problem = !target ? 'empty' : target.includes(',') ? 'comma' : target === from ? 'same' : undefined
  return { target, problem, merge, affected, alreadyTarget: merge ? alreadyTarget : 0 }
}

// ——— La página de una etiqueta ————————————————————————————————————————————————

export interface TaggedEntry {
  id: ID
  collection: CollectionKey
  /** El nombre con el que se reconoce (título, nombre, concepto…). */
  label: string
  projectId?: ID
  tags: string[]
}

export interface TaggedGroup {
  collection: CollectionKey
  entries: TaggedEntry[]
}

/** El nombre de un elemento de cualquier colección con etiquetas. */
export function taggedEntryLabel(collection: CollectionKey, e: Record<string, unknown>): string {
  if (collection === 'storeListings') {
    const platform = STORE_PLATFORMS[e.platform as keyof typeof STORE_PLATFORMS] ?? String(e.platform ?? '')
    const kind = LISTING_KINDS[e.kind as keyof typeof LISTING_KINDS] ?? String(e.kind ?? '')
    return [platform, kind].filter(Boolean).join(' · ')
  }
  const name = String(e.title ?? e.name ?? e.description ?? e.label ?? '').trim()
  // Builds y versiones: el número, si el nombre no lo lleva ya.
  const version = typeof e.version === 'string' ? e.version.trim() : ''
  if ((collection === 'builds' || collection === 'releases') && version && !name.includes(version)) return name ? `${name} ${version}` : version
  return name || String(e.id)
}

/** Todo lo que lleva una etiqueta, por colección (en el orden del registro) y por nombre. */
export function tagPageGroups(data: StudioData, tag: string, scope: Scope = null): TaggedGroup[] {
  const found = byTag(data, tag, scope)
  const groups: TaggedGroup[] = []
  for (const k of TAGGED) {
    const list = found[k]
    if (!list?.length) continue
    const entries = list
      .map((e) => ({
        id: e.id,
        collection: k,
        label: taggedEntryLabel(k, e as unknown as Record<string, unknown>),
        projectId: k === 'projects' ? e.id : e.projectId,
        tags: Array.isArray(e.tags) ? e.tags : [],
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    groups.push({ collection: k, entries })
  }
  return groups
}

// ——— Integraciones ————————————————————————————————————————————————————————————

/**
 * Cómo está cada integración. Ninguna lee ni escribe sola en un servicio de fuera:
 * - active: funcionando (solo la base de la página de claude.ai, cuando se usa allí).
 * - local: los datos se guardan en este navegador (no es una integración).
 * - outside: lo configura el estudio fuera de Studio Hub (publicación y acceso).
 * - manual: se trae a mano con un script.
 * - file: solo un fichero que se descarga (o se importa); nada se sincroniza.
 * - off: no conectada; lo suyo se apunta a mano en su sección.
 */
export type IntegrationState = 'active' | 'local' | 'outside' | 'manual' | 'file' | 'off'

export type IntegrationId = 'storage' | 'hosting' | 'github' | 'steamworks' | 'itch' | 'discord' | 'talo' | 'calendar' | 'backup'

export interface IntegrationInfo {
  id: IntegrationId
  state: IntegrationState
  /** Lo que hay anotado (o importado) que tiene que ver con ese servicio, por colección. */
  counts: Partial<Record<CollectionKey, number>>
  /** La última entrada importada (el historial de git). */
  lastAt?: string
}

/** El registro honesto de integraciones: qué hay, qué no y dónde se lleva a mano. */
export function integrationsStatus(data: StudioData, enClaude: boolean): IntegrationInfo[] {
  const onPlatform = (p: string) => ({
    storeListings: data.storeListings.filter((l) => l.platform === p).length,
    metrics: data.metrics.filter((m) => m.platform === p).length,
  })
  const nonZero = (c: Partial<Record<CollectionKey, number>>) => Object.fromEntries(Object.entries(c).filter(([, n]) => n)) as Partial<Record<CollectionKey, number>>
  const lastAt = data.activity.reduce<string | undefined>((max, a) => (a.at && (!max || a.at > max) ? a.at : max), undefined)
  return [
    { id: 'storage', state: enClaude ? 'active' : 'local', counts: {} },
    { id: 'hosting', state: 'outside', counts: {} },
    { id: 'github', state: 'manual', counts: nonZero({ activity: data.activity.length }), lastAt },
    { id: 'steamworks', state: 'off', counts: nonZero({ ...onPlatform('steam'), achievements: data.achievements.length }) },
    { id: 'itch', state: 'off', counts: nonZero(onPlatform('itch')) },
    { id: 'discord', state: 'off', counts: {} },
    { id: 'talo', state: 'off', counts: {} },
    { id: 'calendar', state: 'file', counts: {} },
    { id: 'backup', state: 'file', counts: {} },
  ]
}

/** Dónde se está abriendo Studio Hub, según la dirección (lo único que se puede saber desde aquí). */
export type Hosting = 'claude' | 'cloudflare' | 'local' | 'other'

export function hostingOf(hostname: string, enClaude: boolean): Hosting {
  if (enClaude) return 'claude'
  const host = hostname.toLowerCase()
  if (host.endsWith('.workers.dev')) return 'cloudflare'
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host.endsWith('.localhost')) return 'local'
  return 'other'
}

// ——— Seguridad y datos ————————————————————————————————————————————————————————

/** Las colecciones que en la página de claude.ai solo leen quienes editan (las finanzas). */
export function privateCollections(): CollectionKey[] {
  return COLLECTION_DEFS.filter((d) => d.private).map((d) => d.key)
}

/** Cuántos hay de cada colección: las que tienen algo (de más a menos) y las vacías. */
export function settingsCollectionCounts(data: StudioData): { filled: [CollectionKey, number][]; empty: CollectionKey[] } {
  const filled: [CollectionKey, number][] = []
  const empty: CollectionKey[] = []
  for (const k of COLLECTIONS) {
    const n = (data[k] as unknown[]).length
    if (n) filled.push([k, n])
    else empty.push(k)
  }
  filled.sort((a, b) => b[1] - a[1])
  return { filled, empty }
}
