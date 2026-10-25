// Cálculos de la sección «Documentación»: el registro de decisiones y las actas de las
// reuniones (con las decisiones que salen de cada una). Los documentos, notas, guías y enlaces
// salen de recursos.ts (resourcesFor), igual que en Recursos.
// Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import type { ID, ISODate, Resource, StudioData, StudioEvent, WorkItem } from '../types'
import { byPriority, decisions, type Scope } from '../selectors'
import { compareResources } from './recursos'

// ——— Decisiones ——————————————————————————————————————————————————————————————

/** Cuándo se tomó una decisión: el día en que se cerró. Sin él, no se sabe (no se supone otra fecha). */
export const decisionDate = (d: WorkItem): ISODate | undefined => d.completedAt

export interface DecisionMonth {
  /** «AAAA-MM»; null para las que no tienen fecha. */
  month: string | null
  decisions: WorkItem[]
}

/**
 * El registro de lo decidido (cerrado: tomado o descartado), por meses, del más reciente al
 * más antiguo; las que no tienen fecha, al final.
 */
export function decisionLog(data: StudioData, scope: Scope = null): DecisionMonth[] {
  const taken = [...decisions(data, scope).taken].sort((a, b) => {
    const da = decisionDate(a)
    const db = decisionDate(b)
    if (!!da !== !!db) return da ? -1 : 1
    return (db ?? '').localeCompare(da ?? '') || a.title.localeCompare(b.title, 'es')
  })
  const out: DecisionMonth[] = []
  for (const d of taken) {
    const month = decisionDate(d)?.slice(0, 7) ?? null
    const last = out[out.length - 1]
    if (last && last.month === month) last.decisions.push(d)
    else out.push({ month, decisions: [d] })
  }
  return out
}

/** Las decisiones que salen de una reunión o un evento: las abiertas primero, luego por fecha. */
export function decisionsFromEvent(data: StudioData, eventId: ID): WorkItem[] {
  return data.items
    .filter((i) => i.kind === 'decision' && i.eventId === eventId)
    .sort((a, b) => {
      const ca = a.status === 'done' || a.status === 'cancelled'
      const cb = b.status === 'done' || b.status === 'cancelled'
      if (ca !== cb) return ca ? 1 : -1
      return ca ? (b.completedAt ?? '').localeCompare(a.completedAt ?? '') : byPriority(a, b)
    })
}

// ——— Actas ———————————————————————————————————————————————————————————————————

export interface MinutesEntry {
  minutes: Resource
  /** La reunión del acta (si la tiene y existe). */
  event?: StudioEvent
  /** Las decisiones que salen de esa reunión. */
  decisions: WorkItem[]
}

/** Las actas del ámbito (con un proyecto, también las del estudio), por fecha, con su reunión y sus decisiones. */
export function minutesOf(data: StudioData, scope: Scope = null): MinutesEntry[] {
  const events = new Map(data.events.map((e) => [e.id, e]))
  return data.resources
    .filter((r) => r.type === 'minutes' && (scope === null || !r.projectId || r.projectId === scope))
    .sort(compareResources)
    .map((minutes) => ({
      minutes,
      event: minutes.eventId ? events.get(minutes.eventId) : undefined,
      decisions: minutes.eventId ? decisionsFromEvent(data, minutes.eventId) : [],
    }))
}

export interface MeetingWithoutMinutes {
  event: StudioEvent
  /** Con fecha posterior a hoy: todavía no se ha celebrado. */
  upcoming: boolean
  decisions: WorkItem[]
}

/**
 * Las reuniones (no canceladas) del ámbito que no tienen acta: primero las ya celebradas (la
 * más reciente arriba), luego las que no tienen fecha y, al final, las próximas (la más cercana
 * arriba). Un acta cuenta aunque sea de otro ámbito: lo que importa es que apunte a la reunión.
 */
export function meetingsWithoutMinutes(data: StudioData, today: ISODate, scope: Scope = null): MeetingWithoutMinutes[] {
  const withMinutes = new Set(data.resources.filter((r) => r.type === 'minutes' && r.eventId).map((r) => r.eventId))
  const rank = (m: MeetingWithoutMinutes) => (m.upcoming ? 2 : m.event.date ? 0 : 1)
  return data.events
    .filter((e) => e.type === 'meeting' && e.status !== 'cancelled' && !withMinutes.has(e.id))
    .filter((e) => scope === null || !e.projectId || e.projectId === scope)
    .map((event) => ({ event, upcoming: !!event.date && event.date > today, decisions: decisionsFromEvent(data, event.id) }))
    .sort((a, b) => {
      const r = rank(a) - rank(b)
      if (r) return r
      const da = a.event.date ?? ''
      const db = b.event.date ?? ''
      return (a.upcoming ? da.localeCompare(db) : db.localeCompare(da)) || a.event.title.localeCompare(b.event.title, 'es')
    })
}

/** Valores de partida del acta de una reunión: tipo, reunión, fecha, proyecto y título. */
export function minutesDefaults(event: StudioEvent, title: string): Partial<Resource> {
  return { type: 'minutes', eventId: event.id, date: event.date, projectId: event.projectId, title, tags: [] }
}
