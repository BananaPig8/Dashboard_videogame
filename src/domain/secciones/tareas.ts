// Cálculos de la sección «Tareas»: qué cuenta como tarea, los filtros de sus subsecciones
// (Mis tareas, Bloqueadas, Vencidas) y los finos de la página, el tablero, el calendario y
// el plan de hoy. Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { STATUSES, STATUS_ORDER, TASK_KINDS } from '../catalog'
import type { Confidence, ID, ISODate, ItemKind, ItemStatus, Member, Priority, Studio, StudioData, WorkItem } from '../types'
import { byPriority, isActionable, isOpen, itemDate, itemsOf, matchesQuery, todayItems, type Scope, type TodayEntry } from '../selectors'
import { calendarEntries, type CalendarEntry } from './calendario'
import { hasTag } from './etiquetas'

/** Subsecciones de la faceta «filtro» (null = todas las tareas). */
export type TaskFilter = 'mias' | 'bloqueadas' | 'vencidas'

export const TASK_FILTERS: readonly TaskFilter[] = ['mias', 'bloqueadas', 'vencidas']

/** Valor de ?persona= para lo que no lleva nadie. */
export const TASK_NOBODY = 'nadie'

/** El filtro de la URL (?filtro=). Las URL antiguas con ?estado=blocked son «Bloqueadas». */
export function taskFilterOf(filtro: string | null, estado?: string | null): TaskFilter | null {
  if (filtro && (TASK_FILTERS as readonly string[]).includes(filtro)) return filtro as TaskFilter
  return !filtro && estado === 'blocked' ? 'bloqueadas' : null
}

/** Lo que enseña Tareas: tareas, funcionalidades, hitos, decisiones e incidencias (los objetivos son del Roadmap). */
export function taskItems(data: StudioData, scope: Scope = null): WorkItem[] {
  return itemsOf(data, scope).filter((i) => TASK_KINDS.includes(i.kind))
}

/** Abierta y con la fecha límite ya pasada. */
export const taskOverdue = (i: WorkItem, today: ISODate): boolean => isOpen(i) && !!i.dueDate && i.dueDate < today

/**
 * Orden de las listas: por estado (en curso primero), prioridad, fecha límite (las que
 * tienen, antes) y, al final, lo más reciente.
 */
export function compareTasks(a: WorkItem, b: WorkItem): number {
  const rank = (s: ItemStatus) => STATUS_ORDER.indexOf(s)
  return (
    rank(a.status) - rank(b.status) ||
    byPriority(a, b) ||
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
    (itemDate(b) ?? '').localeCompare(itemDate(a) ?? '')
  )
}

export interface TaskQuery {
  scope?: Scope
  /** La subsección (?filtro=). */
  filtro?: TaskFilter | null
  /** Quién soy (preferencias de este navegador). Sin él, «Mis tareas» no tiene nada. */
  meId?: ID
  today: ISODate
  /** 'abiertos' (por defecto), 'todos' o un estado concreto. */
  estado?: string | null
  /** Un tipo; con él se pueden ver también los objetivos. */
  tipo?: ItemKind | null
  area?: ID | null
  prioridad?: Priority | null
  fiabilidad?: Confidence | null
  /** Un miembro del equipo o TASK_NOBODY (sin asignar). */
  persona?: string | null
  etiqueta?: string | null
  /** Búsqueda libre (título, descripción, etiquetas, fuentes…). */
  q?: string | null
}

function inFilter(i: WorkItem, q: TaskQuery): boolean {
  switch (q.filtro) {
    case 'mias':
      return !!q.meId && i.assigneeId === q.meId
    case 'bloqueadas':
      return i.status === 'blocked'
    case 'vencidas':
      return taskOverdue(i, q.today)
    default:
      return true
  }
}

/** ¿Lo lleva esta persona? (TASK_NOBODY = nadie). */
export const taskAssignedTo = (i: WorkItem, persona: string | null | undefined): boolean =>
  !persona || (persona === TASK_NOBODY ? !i.assigneeId : i.assigneeId === persona)

/** Las tareas de la subsección y los filtros finos, sin ordenar. */
export function filterTasks(data: StudioData, q: TaskQuery): WorkItem[] {
  const scope = q.scope ?? null
  const base = q.tipo ? itemsOf(data, scope).filter((i) => i.kind === q.tipo) : taskItems(data, scope)
  const estado = q.estado || 'abiertos'
  return base.filter(
    (i) =>
      inFilter(i, q) &&
      (estado === 'todos' || (estado === 'abiertos' ? isOpen(i) : i.status === estado)) &&
      (!q.area || i.areaId === q.area) &&
      (!q.prioridad || i.priority === q.prioridad) &&
      (!q.fiabilidad || i.confidence === q.fiabilidad) &&
      taskAssignedTo(i, q.persona) &&
      hasTag(i, q.etiqueta ?? null) &&
      matchesQuery(i, q.q ?? ''),
  )
}

/** Lo abierto que lleva una persona, en el orden de las listas. Sin persona, nada. */
export function myTasks(data: StudioData, meId: ID | undefined, scope: Scope = null): WorkItem[] {
  if (!meId) return []
  return taskItems(data, scope)
    .filter((i) => isOpen(i) && i.assigneeId === meId)
    .sort(compareTasks)
}

/** Quién lleva una tarea (si el miembro sigue existiendo). */
export function taskAssignee(data: StudioData, item: WorkItem): Member | undefined {
  return item.assigneeId ? data.members.find((m) => m.id === item.assigneeId) : undefined
}

/** El equipo para elegir persona: primero quien sigue activo, por nombre. */
export function taskPeople(data: StudioData): Member[] {
  return [...data.members].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es'))
}

// ——— Tablero ——————————————————————————————————————————————————————————————

export interface TaskColumn {
  /** Id de la columna: uno de los de por defecto o, si el estudio ha elegido columnas, el estado. */
  id: string
  statuses: ItemStatus[]
}

/** Columnas por defecto: los estados agrupados como se trabajan (las canceladas no salen). */
export const DEFAULT_TASK_COLUMNS: readonly TaskColumn[] = [
  { id: 'ideas', statuses: ['idea', 'to_confirm'] },
  { id: 'todo', statuses: ['backlog', 'planned'] },
  { id: 'doing', statuses: ['in_progress'] },
  { id: 'review', statuses: ['review'] },
  { id: 'stopped', statuses: ['blocked', 'paused'] },
  { id: 'done', statuses: ['done'] },
]

/** Las columnas del tablero: las del estudio (Ajustes › Estados), una por estado, o las de por defecto. */
export function taskBoardColumns(studio: Pick<Studio, 'statusOrder'>): TaskColumn[] {
  const own = (studio.statusOrder ?? []).filter((s, n, all) => s in STATUSES && all.indexOf(s) === n)
  return own.length ? own.map((s) => ({ id: s, statuses: [s] })) : DEFAULT_TASK_COLUMNS.map((c) => ({ ...c, statuses: [...c.statuses] }))
}

export interface TaskBoardColumn {
  column: TaskColumn
  /** Las que se pintan (en las cerradas, solo las últimas). */
  items: WorkItem[]
  total: number
}

export interface TaskBoard {
  columns: TaskBoardColumn[]
  /** Tareas con un estado que no tiene columna (p. ej. canceladas). */
  hidden: WorkItem[]
}

/** Reparte las tareas por columnas. En las de cerradas, las `closedLimit` terminadas más recientes. */
export function taskBoard(items: WorkItem[], columns: TaskColumn[], closedLimit = 20): TaskBoard {
  const placed = new Set<ID>()
  const out = columns.map((column) => {
    const list = items.filter((i) => column.statuses.includes(i.status))
    for (const i of list) placed.add(i.id)
    const closed = column.statuses.every((s) => !STATUSES[s].open)
    const sorted = closed
      ? [...list].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || byPriority(a, b)).slice(0, closedLimit)
      : [...list].sort(compareTasks)
    return { column, items: sorted, total: list.length }
  })
  return { columns: out, hidden: items.filter((i) => !placed.has(i.id)) }
}

// ——— Calendario ————————————————————————————————————————————————————————————

/** Mes de ?mes=AAAA-MM como su día 1; si no vale, el de hoy. */
export function taskMonth(mes: string | null, today: ISODate): ISODate {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? `${mes}-01` : `${today.slice(0, 7)}-01`
}

/** Las fechas límite de estas tareas que caen en el periodo (las del calendario del estudio). */
export function taskCalendarEntries(data: StudioData, tasks: WorkItem[], from: ISODate, to: ISODate): CalendarEntry[] {
  const ids = new Set(tasks.map((i) => i.id))
  return calendarEntries(data, { from, to, kinds: ['deadline'] }).filter((e) => e.target.collection === 'items' && ids.has(e.target.id))
}

/** Lo abierto sin fecha límite (lo que falta para que el calendario esté completo). */
export function undatedTasks(tasks: WorkItem[]): WorkItem[] {
  return tasks.filter((i) => isOpen(i) && !i.dueDate).sort(compareTasks)
}

// ——— Plan de hoy ———————————————————————————————————————————————————————————

export interface TaskTodayPlan {
  /** Lo que toca hoy, con su motivo (vencido, vence hoy, marcado, en curso, en revisión). */
  entries: TodayEntry[]
  /** Lo abierto y en marcha (sin lo bloqueado) que se puede añadir al día, por prioridad. */
  candidates: WorkItem[]
  /** Lo bloqueado, por si se puede desbloquear antes de empezar. */
  blocked: WorkItem[]
}

/** El plan del día, solo con tareas (sin objetivos) y, si se da `persona`, solo lo suyo. */
export function taskTodayPlan(data: StudioData, today: ISODate, scope: Scope = null, persona?: string | null): TaskTodayPlan {
  const isTask = (i: WorkItem) => TASK_KINDS.includes(i.kind) && taskAssignedTo(i, persona)
  const entries = todayItems(data, today, scope).filter((e) => isTask(e.item))
  const inToday = new Set(entries.map((e) => e.item.id))
  const tasks = taskItems(data, scope).filter((i) => taskAssignedTo(i, persona))
  return {
    entries,
    candidates: tasks.filter((i) => isActionable(i) && i.status !== 'blocked' && !inToday.has(i.id)).sort((a, b) => byPriority(a, b) || compareTasks(a, b)),
    blocked: tasks.filter((i) => i.status === 'blocked').sort(byPriority),
  }
}
