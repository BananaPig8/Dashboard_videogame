// Cálculos del Dashboard: la cabecera (saludo) y las tarjetas de indicadores. Se reexportan
// desde panel.ts (y este, desde selectors.ts).
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { SECTOR_EVENT_TYPES, type Tone } from '../catalog'
import { addDays } from '../dates'
import type { ISODate, StudioData, WorkItem } from '../types'
import { inPeriod, isOpen, itemsOf, panelOwn, previousPeriod, projectsInGroup, taskItems, type Period, type Scope } from '../selectors'

// ——— Saludo ————————————————————————————————————————————————————————————————

export type PanelGreeting = 'morning' | 'afternoon' | 'night'

/**
 * El saludo según la hora («HH:mm») en la zona horaria del estudio: «Buenos días» de 6:00 a
 * 13:59, «Buenas tardes» de 14:00 a 20:59 y «Buenas noches» de 21:00 a 5:59.
 */
export function panelGreeting(time: string): PanelGreeting {
  const hour = Number(time.slice(0, 2))
  if (!Number.isFinite(hour)) return 'morning'
  if (hour >= 6 && hour < 14) return 'morning'
  if (hour >= 14 && hour < 21) return 'afternoon'
  return 'night'
}

// ——— Indicadores ————————————————————————————————————————————————————————————

/** Las tarjetas de indicadores (ui/prefs.ts guarda cuáles ve cada persona y en qué orden). */
export type PanelKpiId =
  | 'activeProjects'
  | 'pending'
  | 'completed'
  | 'overdue'
  | 'blocked'
  | 'milestonesSoon'
  | 'milestonesDone'
  | 'eventsSoon'
  | 'recentBuilds'
  | 'feedbackNew'

export const PANEL_KPI_IDS: readonly PanelKpiId[] = [
  'activeProjects',
  'pending',
  'completed',
  'overdue',
  'blocked',
  'milestonesSoon',
  'milestonesDone',
  'eventsSoon',
  'recentBuilds',
  'feedbackNew',
]

/** Los que solo tienen sentido en la vista de todo el estudio. */
export const PANEL_KPI_STUDIO_ONLY: readonly PanelKpiId[] = ['activeProjects']

/** Días por delante que mira «Hitos próximos» (hoy incluido). */
export const KPI_AHEAD_DAYS = 30

/** Por qué una tarjeta no tiene cifra: se pinta «—» con el motivo, nunca un 0 que engañe. */
export type PanelKpiEmpty =
  | 'noProjects'
  | 'noTasks'
  | 'noOpenTasks'
  | 'noDueDates'
  | 'noMilestones'
  | 'noOpenMilestones'
  | 'noMilestoneDates'
  | 'noEvents'
  | 'noEventDates'
  | 'noBuilds'
  | 'noBuildDates'
  | 'noFeedback'

/** Un dato aparte que acompaña a la cifra. */
export type PanelKpiNote =
  /** Hitos abiertos con la fecha límite ya pasada. */
  | 'overdue'
  /** Abiertos o por delante, sin fecha. */
  | 'undated'
  /** Eventos de la cifra con la fecha prevista, no confirmada. */
  | 'unconfirmed'

export interface PanelKpi {
  id: PanelKpiId
  /** La cifra; null = sin datos suficientes (va «—» con `empty`). */
  value: number | null
  empty?: PanelKpiEmpty
  /** Tono de la cifra (los de catalog.ts): rojo si hay algo vencido o bloqueado, ámbar si hay feedback nuevo. */
  tone: Tone
  /** Sobre cuántos se cuenta (proyectos, abiertas con fecha, abiertas, feedback registrado). */
  of?: number
  /**
   * El mismo cálculo en el periodo anterior de la misma duración. Solo en lo que pasa en un
   * periodo (completadas, hitos completados, builds) y si hay datos de entonces.
   */
  previous?: number
  notes: { kind: PanelKpiNote; n: number }[]
}

export interface PanelKpiQuery {
  scope?: Scope
  today: ISODate
  period: Period
  /** Las tarjetas que se ven, en su orden. Las demás no se calculan. */
  ids: readonly PanelKpiId[]
}

const note = (kind: PanelKpiNote, n: number) => (n > 0 ? [{ kind, n }] : [])
const empty = (id: PanelKpiId, reason: PanelKpiEmpty): PanelKpi => ({ id, value: null, empty: reason, tone: 'muted', notes: [] })

/** ¿Hay algún registro de antes de que acabe el periodo anterior? Si no, su 0 no significa nada. */
const covers = (dates: (string | undefined)[], p: Period) => dates.some((d) => !!d && d.slice(0, 10) <= p.to)

/** Las fechas que dicen desde cuándo se lleva un elemento de trabajo. */
const workDates = (i: WorkItem) => [i.createdAt, i.startedAt, i.completedAt]

/**
 * Terminadas (estado «Hecho», no las descartadas) con fecha de fin en el periodo, y en el
 * anterior si hay datos de entonces. Sin elementos: «—». Lo hecho siempre lleva fecha de fin
 * (validate.ts); si faltara, no cuenta en ningún periodo.
 */
function doneInPeriod(id: PanelKpiId, items: WorkItem[], period: Period, none: PanelKpiEmpty): PanelKpi {
  if (items.length === 0) return empty(id, none)
  const done = items.filter((i) => i.status === 'done' && i.completedAt)
  const prev = previousPeriod(period)
  return {
    id,
    value: done.filter((i) => inPeriod(period, i.completedAt)).length,
    tone: 'neutral',
    previous: covers(items.flatMap(workDates), prev) ? done.filter((i) => inPeriod(prev, i.completedAt)).length : undefined,
    notes: [],
  }
}

/**
 * Una tarjeta. En todo el estudio no cuenta lo de los proyectos cerrados (`panelOwn`); en un
 * proyecto, lo suyo (y, en los eventos, también los del estudio).
 */
function kpi(data: StudioData, id: PanelKpiId, scope: Scope, today: ISODate, period: Period): PanelKpi {
  const ahead = addDays(today, KPI_AHEAD_DAYS - 1)
  const own = panelOwn(data, scope)
  const tasks = () => taskItems(data, scope).filter(own)
  switch (id) {
    case 'activeProjects': {
      if (data.projects.length === 0) return empty(id, 'noProjects')
      return { id, value: projectsInGroup(data, 'activos').length, tone: 'neutral', of: data.projects.length, notes: [] }
    }
    case 'pending': {
      const all = tasks()
      if (all.length === 0) return empty(id, 'noTasks')
      return { id, value: all.filter(isOpen).length, tone: 'neutral', of: all.length, notes: [] }
    }
    case 'completed':
      return doneInPeriod(id, tasks(), period, 'noTasks')
    case 'overdue': {
      const all = tasks()
      if (all.length === 0) return empty(id, 'noTasks')
      const open = all.filter(isOpen)
      if (open.length === 0) return empty(id, 'noOpenTasks')
      const dated = open.filter((i) => i.dueDate)
      if (dated.length === 0) return empty(id, 'noDueDates')
      const n = dated.filter((i) => i.dueDate! < today).length
      return { id, value: n, tone: n ? 'danger' : 'neutral', of: dated.length, notes: [] }
    }
    case 'blocked': {
      const all = tasks()
      if (all.length === 0) return empty(id, 'noTasks')
      const open = all.filter(isOpen)
      if (open.length === 0) return empty(id, 'noOpenTasks')
      const n = open.filter((i) => i.status === 'blocked').length
      return { id, value: n, tone: n ? 'danger' : 'neutral', of: open.length, notes: [] }
    }
    case 'milestonesSoon': {
      const all = itemsOf(data, scope).filter((i) => i.kind === 'milestone' && own(i))
      if (all.length === 0) return empty(id, 'noMilestones')
      const open = all.filter(isOpen)
      if (open.length === 0) return empty(id, 'noOpenMilestones')
      const dated = open.filter((i) => i.dueDate)
      const undated = note('undated', open.length - dated.length)
      if (dated.length === 0) return { ...empty(id, 'noMilestoneDates'), notes: undated }
      return {
        id,
        value: dated.filter((i) => i.dueDate! >= today && i.dueDate! <= ahead).length,
        tone: 'neutral',
        notes: [...note('overdue', dated.filter((i) => i.dueDate! < today).length), ...undated],
      }
    }
    case 'milestonesDone':
      return doneInPeriod(
        id,
        itemsOf(data, scope).filter((i) => i.kind === 'milestone' && own(i)),
        period,
        'noMilestones',
      )
    case 'eventsSoon': {
      // Los del sector (ferias, festivales, premios, presentaciones…), los mismos que Eventos:
      // las reuniones, entregas y fechas límite están en el Calendario.
      const events = data.events.filter((e) => SECTOR_EVENT_TYPES.includes(e.type) && panelOwn(data, scope, true)(e))
      if (events.length === 0) return empty(id, 'noEvents')
      const pending = events.filter((e) => e.status !== 'done' && e.status !== 'cancelled')
      const undated = note('undated', pending.filter((e) => !e.date).length)
      if (!events.some((e) => e.date && e.status !== 'cancelled')) return { ...empty(id, 'noEventDates'), notes: undated }
      // Todo lo que está por delante (Eventos › Próximos): lo que empieza de hoy en adelante y lo
      // de varios días que ya ha empezado y no ha acabado.
      const soon = pending.filter((e) => e.date && (e.endDate ?? e.date) >= today)
      return { id, value: soon.length, tone: 'neutral', notes: [...note('unconfirmed', soon.filter((e) => !e.dateConfirmed).length), ...undated] }
    }
    case 'recentBuilds': {
      const builds = data.builds.filter(own)
      if (builds.length === 0) return empty(id, 'noBuilds')
      const dated = builds.filter((b) => b.date)
      const undated = note('undated', builds.length - dated.length)
      if (dated.length === 0) return { ...empty(id, 'noBuildDates'), notes: undated }
      const prev = previousPeriod(period)
      return {
        id,
        value: dated.filter((b) => inPeriod(period, b.date)).length,
        tone: 'neutral',
        previous: covers(dated.map((b) => b.date), prev) ? dated.filter((b) => inPeriod(prev, b.date)).length : undefined,
        notes: undated,
      }
    }
    case 'feedbackNew': {
      const feedback = data.feedback.filter(own)
      if (feedback.length === 0) return empty(id, 'noFeedback')
      const n = feedback.filter((f) => f.status === 'new').length
      return { id, value: n, tone: n ? 'warning' : 'neutral', of: feedback.length, notes: [] }
    }
  }
}

/**
 * Las tarjetas de indicadores que se ven, en su orden: solo se calculan las pedidas, y en un
 * proyecto no sale «Proyectos activos». Cada cifra sale de los datos; si no hay datos
 * suficientes para que un número signifique algo, la cifra es null y `empty` dice por qué.
 */
export function panelKpis(data: StudioData, q: PanelKpiQuery): PanelKpi[] {
  const scope = q.scope ?? null
  return q.ids.filter((id) => !(scope && PANEL_KPI_STUDIO_ONLY.includes(id))).map((id) => kpi(data, id, scope, q.today, q.period))
}
