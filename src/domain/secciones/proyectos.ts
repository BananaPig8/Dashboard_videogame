// Cálculos de la sección «proyectos». Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { STAGE_GROUPS, STAGES } from '../catalog'
import type { Project, ProjectStage, StudioData } from '../types'

/** Los grupos de etapas que son las subsecciones de Proyectos (?estado=). */
export type ProjectStageGroup = keyof typeof STAGE_GROUPS

/** En el orden de las subsecciones: lo que se está haciendo primero. */
export const PROJECT_GROUPS: ProjectStageGroup[] = ['activos', 'planificacion', 'pausa', 'lanzados', 'archivados']

/** ¿Es un grupo de etapas? (para leer ?estado= sin fiarse de la URL). */
export function isProjectStageGroup(value: string | null | undefined): value is ProjectStageGroup {
  return !!value && value in STAGE_GROUPS
}

/** El grupo de una etapa: «release» está en activos; lanzados es solo «live». */
export function stageGroupOf(stage: ProjectStage): ProjectStageGroup {
  return PROJECT_GROUPS.find((g) => STAGE_GROUPS[g].includes(stage)) ?? 'activos'
}

/** Por etapa (de la idea al archivo) y, dentro de cada una, por nombre. */
export const projectsByStage = (a: Project, b: Project) => STAGES[a.stage].order - STAGES[b.stage].order || a.name.localeCompare(b.name, 'es')

/** Los proyectos de un grupo (null = todos), ordenados por etapa y nombre. */
export function projectsInGroup(data: StudioData, group: ProjectStageGroup | null): Project[] {
  return data.projects.filter((p) => group === null || stageGroupOf(p.stage) === group).sort(projectsByStage)
}

/** Cuántos proyectos hay en cada grupo. */
export function projectGroupCounts(data: StudioData): Record<ProjectStageGroup, number> {
  const counts = Object.fromEntries(PROJECT_GROUPS.map((g) => [g, 0])) as Record<ProjectStageGroup, number>
  for (const p of data.projects) counts[stageGroupOf(p.stage)]++
  return counts
}

/** Cuántos proyectos hay en cada etapa (para la línea de etapas). */
export function projectStageCounts(data: StudioData): Record<ProjectStage, number> {
  const counts = Object.fromEntries(Object.keys(STAGES).map((s) => [s, 0])) as Record<ProjectStage, number>
  for (const p of data.projects) counts[p.stage]++
  return counts
}
