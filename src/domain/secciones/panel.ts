// Cálculos de la sección «panel». Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import type { ISODate, StudioData, WorkItem } from '../types'
import type { CalendarEntry } from './calendario'
import { itemsOf, notificationsFor, type NotificationKind, type Scope, type StudioNotification } from '../selectors'

/**
 * Los avisos que el bloque «Necesita atención» añade a la salud de cada proyecto: los que
 * no salen ya en otro bloque del panel (lo vencido y lo bloqueado están en Hoy y en
 * Bloqueado; los eventos, en Próximas fechas).
 */
export const PANEL_ALERT_KINDS: readonly NotificationKind[] = ['reminder', 'registrationSoon', 'releaseSoon', 'releaseLate', 'budgetOver']

/**
 * Los avisos de hoy en un ámbito (los mismos que la campana). En un proyecto salen los suyos
 * y los de todo el estudio que tienen fecha (eventos, inscripciones, recordatorios), como en
 * el calendario; un presupuesto del estudio no es de ningún proyecto. Sin `kinds`, todos.
 */
export function panelAlerts(data: StudioData, today: ISODate, scope: Scope = null, kinds?: readonly NotificationKind[]): StudioNotification[] {
  return notificationsFor(data, today).filter(
    (n) => (!kinds || kinds.includes(n.kind)) && (scope === null || n.projectId === scope || (!n.projectId && n.kind !== 'budgetOver')),
  )
}

/** Lo terminado, de lo más reciente a lo más antiguo (solo lo que tiene fecha de fin). */
export function panelRecentDone(data: StudioData, scope: Scope = null): WorkItem[] {
  return itemsOf(data, scope)
    .filter((i) => i.status === 'done' && !!i.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!) || a.title.localeCompare(b.title, 'es'))
}

/** Las fechas agrupadas por mes («2026-10»), en el orden en que llegan. */
export function panelEntriesByMonth(entries: CalendarEntry[]): { month: string; entries: CalendarEntry[] }[] {
  const groups: { month: string; entries: CalendarEntry[] }[] = []
  for (const e of entries) {
    const month = e.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last?.month === month) last.entries.push(e)
    else groups.push({ month, entries: [e] })
  }
  return groups
}
