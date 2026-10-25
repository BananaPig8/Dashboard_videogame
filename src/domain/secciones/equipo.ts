// Cálculos de la sección «Equipo»: quién hay, de qué área responde cada uno, qué lleva y
// cuánta carga tiene. Las personas son del estudio (no de un proyecto); lo que se cuenta de
// ellas (elementos abiertos, horas apuntadas) sí respeta el ámbito.
// Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { PRIORITIES, TASK_KINDS } from '../catalog'
import { addDays } from '../dates'
import type { Area, ID, ISODate, Member, MemberKind, StudioData, WorkItem } from '../types'
import { isOpen, type Scope } from '../selectors'
import { hasTag } from './etiquetas'
import { compareTasks } from './tareas'

/** Semanas que mira la carga de trabajo (horas apuntadas frente a horas semanales). */
export const TEAM_WEEKS = 4

const own = (scope: Scope) => (x: { projectId?: ID }) => scope === null || x.projectId === scope

/** Del estudio antes que externos y, dentro de cada grupo, por nombre. */
export const compareMembers = (a: Member, b: Member): number =>
  (a.kind === b.kind ? 0 : a.kind === 'core' ? -1 : 1) || a.name.localeCompare(b.name, 'es')

/** Lo que se cuenta como trabajo de alguien: abierto y de los tipos de Tareas (sin objetivos). */
function openWork(data: StudioData, scope: Scope, tag: string | null = null): WorkItem[] {
  return data.items.filter((i) => own(scope)(i) && TASK_KINDS.includes(i.kind) && isOpen(i) && hasTag(i, tag))
}

/** Las áreas de una persona que siguen existiendo, en el orden del estudio. */
export function teamAreasOf(data: StudioData, m: Member): Area[] {
  return data.areas.filter((a) => m.areaIds.includes(a.id))
}

export interface TeamRoster {
  active: Member[]
  /** Quien ya no está en el estudio (no se borra si tuvo trabajo: se desactiva). */
  former: Member[]
}

/** Las personas, activas y antiguas, en orden. Con `kind`, solo las del estudio o solo los externos. */
export function teamRoster(data: StudioData, kind?: MemberKind): TeamRoster {
  const all = data.members.filter((m) => !kind || m.kind === kind).sort(compareMembers)
  return { active: all.filter((m) => m.active), former: all.filter((m) => !m.active) }
}

// ——— Carga de trabajo ————————————————————————————————————————————————————————

export interface TeamLoad {
  /** Elementos abiertos (sin objetivos) en el ámbito. */
  open: number
  /** Los abiertos ponderados por prioridad (crítica 4, alta 3, media 2, baja 1). */
  load: number
  overdue: number
  blocked: number
  /** Minutos apuntados en las últimas TEAM_WEEKS semanas, en el ámbito. */
  minutes: number
}

export interface TeamPerson extends TeamLoad {
  member: Member
  areas: Area[]
  /** Minutos que caben en TEAM_WEEKS semanas según sus horas semanales; null si no las tiene apuntadas. */
  capacity: number | null
  /** Apuntado / capacidad; null sin capacidad (no se inventa). */
  ratio: number | null
}

export interface TeamWorkload {
  /** El periodo de las horas: las últimas TEAM_WEEKS semanas hasta hoy. */
  from: ISODate
  to: ISODate
  /** Todas las personas, en orden (las antiguas también: pueden seguir teniendo trabajo). */
  people: TeamPerson[]
  /** Lo abierto que no lleva nadie y las horas apuntadas sin persona. */
  nobody: TeamLoad
  /** ¿Hay horas apuntadas en el periodo (de quien sea)? */
  anyTime: boolean
}

const emptyLoad = (): TeamLoad => ({ open: 0, load: 0, overdue: 0, blocked: 0, minutes: 0 })

/** Del primer día del periodo de la carga a hoy (ambos incluidos). */
export function teamWindow(today: ISODate): { from: ISODate; to: ISODate } {
  return { from: addDays(today, -(TEAM_WEEKS * 7 - 1)), to: today }
}

/**
 * Carga de cada persona: lo abierto que lleva, ponderado por prioridad, lo vencido y las
 * horas apuntadas en las últimas cuatro semanas frente a lo que caben sus horas semanales.
 * Sin horas semanales en su ficha no hay capacidad: se dice, no se supone una jornada.
 */
export function teamWorkload(data: StudioData, today: ISODate, scope: Scope = null): TeamWorkload {
  const { from, to } = teamWindow(today)
  const byId = new Map(data.members.map((m) => [m.id, emptyLoad()]))
  const nobody = emptyLoad()
  const slot = (id: ID | undefined) => (id && byId.get(id)) || nobody
  for (const i of openWork(data, scope)) {
    const s = slot(i.assigneeId)
    s.open++
    s.load += PRIORITIES[i.priority].weight
    if (i.dueDate && i.dueDate < today) s.overdue++
    if (i.status === 'blocked') s.blocked++
  }
  let anyTime = false
  for (const e of data.timeEntries) {
    if (!own(scope)(e) || e.date < from || e.date > to) continue
    slot(e.memberId).minutes += e.minutes
    anyTime = true
  }
  const people = [...data.members].sort(compareMembers).map((member): TeamPerson => {
    const l = byId.get(member.id)!
    const capacity = member.weeklyHours !== undefined && member.weeklyHours > 0 ? member.weeklyHours * TEAM_WEEKS * 60 : null
    return { member, areas: teamAreasOf(data, member), ...l, capacity, ratio: capacity ? l.minutes / capacity : null }
  })
  return { from, to, people, nobody, anyTime }
}

// ——— Asignaciones ———————————————————————————————————————————————————————————

export interface TeamAssignment {
  member: Member
  /** Lo abierto que lleva, en el orden de Tareas. */
  items: WorkItem[]
}

export interface TeamAssignments {
  /** Quien lleva algo; las antiguas solo si aún tienen trabajo (hay que reasignarlo). */
  people: TeamAssignment[]
  /** Activas sin nada abierto asignado. */
  idle: Member[]
  /** Lo abierto sin nadie (o con alguien que ya no existe). */
  nobody: WorkItem[]
}

/** Lo abierto por persona y lo que no lleva nadie (con ?etiqueta=, solo lo que la lleva). */
export function teamAssignments(data: StudioData, scope: Scope = null, tag: string | null = null): TeamAssignments {
  const byMember = new Map<ID, WorkItem[]>()
  const nobody: WorkItem[] = []
  const known = new Set(data.members.map((m) => m.id))
  for (const i of openWork(data, scope, tag)) {
    if (i.assigneeId && known.has(i.assigneeId)) byMember.set(i.assigneeId, [...(byMember.get(i.assigneeId) ?? []), i])
    else nobody.push(i)
  }
  const sorted = [...data.members].sort((a, b) => Number(b.active) - Number(a.active) || compareMembers(a, b))
  return {
    people: sorted.filter((m) => byMember.has(m.id)).map((member) => ({ member, items: byMember.get(member.id)!.sort(compareTasks) })),
    idle: sorted.filter((m) => m.active && !byMember.has(m.id)),
    nobody: nobody.sort(compareTasks),
  }
}

// ——— Responsabilidades ——————————————————————————————————————————————————————

export interface TeamAreaRow {
  area: Area
  /** Responsables que siguen en el estudio. */
  owners: Member[]
  /** Quien lo fue y ya no está. */
  former: Member[]
  /** Elementos abiertos de esa área en el ámbito. */
  open: number
}

export interface TeamResponsibilities {
  areas: TeamAreaRow[]
  /** Las áreas sin nadie activo al frente; primero las que tienen más trabajo abierto. */
  unowned: TeamAreaRow[]
}

/** Quién responde de cada área (member.areaIds) y qué áreas no tienen a nadie. */
export function teamResponsibilities(data: StudioData, scope: Scope = null): TeamResponsibilities {
  const open = new Map<ID, number>()
  for (const i of openWork(data, scope)) if (i.areaId) open.set(i.areaId, (open.get(i.areaId) ?? 0) + 1)
  const members = [...data.members].sort(compareMembers)
  const areas = data.areas.map((area) => {
    const all = members.filter((m) => m.areaIds.includes(area.id))
    return { area, owners: all.filter((m) => m.active), former: all.filter((m) => !m.active), open: open.get(area.id) ?? 0 }
  })
  return { areas, unowned: areas.filter((a) => a.owners.length === 0).sort((a, b) => b.open - a.open) }
}
