// Cálculos de la sección «panel». Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { addDays, daysBetween } from '../dates'
import type { ID, ISODate, Project, ProjectStage, StudioData } from '../types'
import { notificationsFor, type NotificationKind, type Scope, type StudioNotification } from '../selectors'

export * from './panel-indicadores'
export * from './panel-prioridades'
export * from './panel-lanzamientos'
export * from './panel-actividad'

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

// ——— Proyectos cerrados ———————————————————————————————————————————————————————

/**
 * Las etapas de un proyecto que ya no se trabaja (archivado; si algún día hay «cancelado», va
 * aquí). En la vista de todo el estudio, lo de esos proyectos no sale en Prioridades, en los
 * indicadores ni en Lanzamientos (en su propia ficha, sí). «Proyectos activos» cuenta aparte
 * (solo los activos).
 */
export const PANEL_CLOSED_STAGES: readonly ProjectStage[] = ['archived']

export const isClosedProject = (p: Pick<Project, 'stage'>): boolean => PANEL_CLOSED_STAGES.includes(p.stage)

/** Los ids de los proyectos cerrados. */
export function closedProjectIds(data: StudioData): Set<ID> {
  return new Set(data.projects.filter(isClosedProject).map((p) => p.id))
}

/**
 * ¿Cuenta esto en el Dashboard de este ámbito? En un proyecto, lo suyo; en todo el estudio, todo
 * menos lo de los proyectos cerrados. `withStudio`: lo que no es de ningún proyecto también vale
 * en un proyecto (eventos del estudio).
 */
export function panelOwn(data: StudioData, scope: Scope, withStudio = false): (x: { projectId?: ID }) => boolean {
  if (scope !== null) return (x) => x.projectId === scope || (withStudio && !x.projectId)
  const closed = closedProjectIds(data)
  return (x) => !x.projectId || !closed.has(x.projectId)
}

/** Parámetro que llevan los enlaces de las cifras a una lista que deja fuera los proyectos cerrados. */
export const CLOSED_PARAM = 'archivados'
export const CLOSED_PARAM_OFF = 'no'

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
 * están al revés, se ordenan; si no hay ninguna, son los últimos 7 días). Nunca acaba después
 * de hoy: lo que no ha pasado no se cuenta (si las dos fechas son futuras, queda en hoy).
 */
export function periodRange(id: PeriodId, today: ISODate, custom?: { from?: ISODate; to?: ISODate }): Period {
  if (id === 'personalizado' && (custom?.from || custom?.to)) {
    const a = custom.from ?? custom.to!
    const b = custom.to ?? custom.from!
    const [first, last] = a <= b ? [a, b] : [b, a]
    const to = last > today ? today : last
    const from = first > to ? to : first
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
