// Cálculos de la sección «panel». Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { addDays, daysBetween } from '../dates'
import type { ISODate, StudioData, WorkItem } from '../types'
import type { CalendarEntry } from './calendario'
import { isOpen, itemsOf, notificationsFor, type NotificationKind, type Scope, type StudioNotification } from '../selectors'

export * from './panel-indicadores'
export * from './panel-prioridades'
export * from './panel-lanzamientos'
export * from './panel-actividad'

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

/**
 * La cifra «Por confirmar»: lo que está en ese estado, como lo cuenta la tarjeta de cada
 * proyecto y lo lista Tareas (?estado=to_confirm). `unverified` es lo abierto en otro estado
 * con algún dato sin verificar (fiabilidad «por confirmar»), que se dice aparte.
 */
export function panelToConfirm(data: StudioData, scope: Scope = null): { status: number; unverified: number } {
  const items = itemsOf(data, scope)
  return {
    status: items.filter((i) => i.status === 'to_confirm').length,
    unverified: items.filter((i) => isOpen(i) && i.status !== 'to_confirm' && i.confidence === 'to_confirm').length,
  }
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

// ——— Periodo del Dashboard ——————————————————————————————————————————————————

/** hoy, los últimos 7 o 30 días (hoy incluido) o unas fechas a elegir. */
export type PeriodId = 'hoy' | '7d' | '30d' | 'personalizado'

export const PERIOD_IDS: readonly PeriodId[] = ['hoy', '7d', '30d', 'personalizado']

export const DEFAULT_PERIOD: PeriodId = '7d'

/** Un periodo cerrado, de `from` a `to` (los dos días incluidos). */
export interface Period {
  id: PeriodId
  from: ISODate
  to: ISODate
  /** Cuántos días abarca. */
  days: number
}

/**
 * El periodo elegido. Los fijos acaban hoy; el personalizado usa sus fechas (si faltan o
 * están al revés, se ordenan; si no hay ninguna, son los últimos 7 días).
 */
export function periodRange(id: PeriodId, today: ISODate, custom?: { from?: ISODate; to?: ISODate }): Period {
  if (id === 'personalizado' && (custom?.from || custom?.to)) {
    const a = custom.from ?? custom.to!
    const b = custom.to ?? custom.from!
    const [from, to] = a <= b ? [a, b] : [b, a]
    return { id, from, to, days: daysBetween(from, to) + 1 }
  }
  const days = id === 'hoy' ? 1 : id === '30d' ? 30 : 7
  return { id: id === 'personalizado' ? '7d' : id, from: addDays(today, -(days - 1)), to: today, days }
}

/** El periodo de la misma duración justo antes (para comparar). */
export function previousPeriod(p: Period): Period {
  const to = addDays(p.from, -1)
  return { id: p.id, from: addDays(to, -(p.days - 1)), to, days: p.days }
}

/** ¿Cae esta fecha (o el día de esta fecha y hora) dentro del periodo? */
export const inPeriod = (p: Period, date: string | undefined): boolean => !!date && date.slice(0, 10) >= p.from && date.slice(0, 10) <= p.to
