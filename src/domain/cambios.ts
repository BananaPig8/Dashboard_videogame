// El registro de cambios: qué se ha hecho en la aplicación, cuándo y quién. Lo escribe el
// store al guardar (data/store.ts) con estas funciones puras. No recoge lo que viene de
// fuera (los datos iniciales, una copia importada ni el historial de git, que va en activity).
import { COLLECTION_BY_KEY, type CollectionKey } from './collections'
import type { ChangeAction, ChangeEntry, ID, ISODateTime } from './types'

/** Cuántos cambios se guardan como mucho (los más antiguos se van). Unos 150 bytes cada uno. */
export const MAX_CHANGES = 5000

/** Dos cambios seguidos de lo mismo y de la misma persona dentro de este rato cuentan como uno. */
const MERGE_MINUTES = 10

/** Lo que no se apunta: el propio registro y el historial del código (viene de git). */
const NOT_LOGGED: readonly string[] = ['changes', 'activity']

/**
 * Lo privado (el dinero) tampoco: en la base de claude.ai solo lo leen quienes pueden editar,
 * y el registro lo lee cualquiera, así que su título no puede ir aquí.
 */
const isPrivate = (k: string) => k in COLLECTION_BY_KEY && COLLECTION_BY_KEY[k as CollectionKey].private === true

type Row = Record<string, unknown>

/** Cuándo un cambio de estado es «terminar» en cada colección. */
const DONE_STATUS: Partial<Record<CollectionKey, string>> = {
  items: 'done',
  builds: 'published',
  feedback: 'addressed',
  releases: 'released',
  events: 'done',
  phases: 'done',
  achievements: 'in_store',
}

const titleOf = (e: Row): string => String(e.title ?? e.name ?? e.label ?? e.id ?? '')

/** El tipo de algo, para poder filtrar (task, issue, milestone…; el tipo de un recurso o de un evento). */
const kindOf = (e: Row): string | undefined => (typeof e.kind === 'string' ? e.kind : typeof e.type === 'string' ? e.type : undefined)

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

export interface ChangeContext {
  id: ID
  at: ISODateTime
  memberId?: ID
}

/**
 * La entrada del registro que corresponde a guardar `next` donde estaba `prev` (crear si no
 * había `prev`, borrar si no hay `next`). null si no hay nada que apuntar.
 */
export function changeFor(k: CollectionKey | 'studio', prev: object | undefined, next: object | undefined, ctx: ChangeContext): ChangeEntry | null {
  if (NOT_LOGGED.includes(k) || isPrivate(k) || (!prev && !next)) return null
  const p = prev as Row | undefined
  const n = next as Row | undefined
  const e = (n ?? p)!
  let action: ChangeAction
  let fields: string[] | undefined
  let from: string | undefined
  let to: string | undefined
  if (!p) action = 'created'
  else if (!n) action = 'deleted'
  else {
    fields = [...new Set([...Object.keys(p), ...Object.keys(n)])].filter((f) => !same(p[f], n[f])).sort()
    if (!fields.length) return null
    const doneStatus = k === 'studio' ? undefined : DONE_STATUS[k]
    const doneNow = k === 'reminders' ? n.done === true && p.done !== true : !!doneStatus && n.status === doneStatus && p.status !== doneStatus
    if (doneNow) action = 'completed'
    else if (typeof n.status === 'string' && p.status !== n.status) action = 'status'
    else action = 'updated'
    if (action !== 'updated' && typeof p.status === 'string') {
      from = p.status
      to = String(n.status)
    }
  }
  const projectId = k === 'projects' ? (e.id as string) : typeof e.projectId === 'string' ? e.projectId : undefined
  const entry: ChangeEntry = { id: ctx.id, at: ctx.at, action, collection: k, entityId: String(e.id ?? k), title: titleOf(e) }
  const kind = kindOf(e)
  if (kind) entry.entityKind = kind
  if (projectId) entry.projectId = projectId
  if (ctx.memberId) entry.memberId = ctx.memberId
  if (fields && action === 'updated') entry.fields = fields
  if (from !== undefined) {
    entry.from = from
    entry.to = to
  }
  return entry
}

const minutesBetween = (a: ISODateTime, b: ISODateTime) => Math.abs(Date.parse(`${b}Z`) - Date.parse(`${a}Z`)) / 60_000

/**
 * Añade una entrada al registro. Si la anterior es un cambio de lo mismo, de la misma
 * persona y de hace menos de diez minutos, se juntan (escribir un título letra a letra no
 * llena el historial). Se quedan los MAX_CHANGES más recientes.
 */
export function appendChange(list: readonly ChangeEntry[], entry: ChangeEntry | null, max = MAX_CHANGES): ChangeEntry[] {
  if (!entry) return list as ChangeEntry[]
  const last = list[list.length - 1]
  if (
    last &&
    entry.action === 'updated' &&
    last.action === 'updated' &&
    last.collection === entry.collection &&
    last.entityId === entry.entityId &&
    last.memberId === entry.memberId &&
    minutesBetween(last.at, entry.at) <= MERGE_MINUTES
  ) {
    const merged: ChangeEntry = { ...entry, id: last.id, fields: [...new Set([...(last.fields ?? []), ...(entry.fields ?? [])])].sort() }
    return [...list.slice(0, -1), merged]
  }
  const out = [...list, entry]
  return out.length > max ? out.slice(out.length - max) : out
}
