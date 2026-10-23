import { describe, expect, it } from 'vitest'
import { STAGE_GROUPS, STAGES } from '../catalog'
import { emptyCollections } from '../collections'
import { isProjectStageGroup, PROJECT_GROUPS, projectGroupCounts, projectsInGroup, projectStageCounts, stageGroupOf } from '../selectors'
import { SCHEMA_VERSION, type ProjectStage, type StudioData } from '../types'
import { validateStudioData } from '../validate'

const project = (id: string, stage: ProjectStage, name = id, tags: string[] = []) => ({
  id,
  slug: id,
  name,
  description: '',
  platforms: [],
  stage,
  color: '#000',
  versions: [],
  tags,
  links: [],
})

function data(): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [
      project('zeta', 'production', 'Zeta', ['godot']),
      project('alfa', 'production', 'Alfa'),
      project('salida', 'release'),
      project('idea', 'idea'),
      project('publicado', 'live', 'publicado', ['Godot']),
      project('parado', 'paused'),
      project('viejo', 'archived'),
    ],
  }
}

describe('proyectos por grupo de etapas', () => {
  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })

  it('cada etapa está en un grupo y solo en uno', () => {
    for (const stage of Object.keys(STAGES) as ProjectStage[]) {
      const groups = PROJECT_GROUPS.filter((g) => STAGE_GROUPS[g].includes(stage))
      expect(groups).toEqual([stageGroupOf(stage)])
    }
  })

  it('el lanzamiento sigue activo; lanzados es solo lo publicado', () => {
    expect(stageGroupOf('release')).toBe('activos')
    expect(stageGroupOf('live')).toBe('lanzados')
    expect(stageGroupOf('concept')).toBe('planificacion')
  })

  it('filtra por grupo y ordena por etapa y nombre', () => {
    expect(projectsInGroup(data(), 'activos').map((p) => p.id)).toEqual(['alfa', 'zeta', 'salida'])
    expect(projectsInGroup(data(), 'lanzados').map((p) => p.id)).toEqual(['publicado'])
    expect(projectsInGroup(data(), null).map((p) => p.id)).toEqual(['idea', 'alfa', 'zeta', 'salida', 'publicado', 'parado', 'viejo'])
  })

  it('cuenta los proyectos de cada grupo y de cada etapa', () => {
    expect(projectGroupCounts(data())).toEqual({ activos: 3, planificacion: 1, pausa: 1, lanzados: 1, archivados: 1 })
    const stages = projectStageCounts(data())
    expect(stages.production).toBe(2)
    expect(stages.polish).toBe(0)
    expect(Object.values(stages).reduce((a, b) => a + b, 0)).toBe(7)
  })

  it('con ?etiqueta=, solo los que la llevan (sin distinguir mayúsculas), en la lista y en las cifras', () => {
    expect(projectsInGroup(data(), null, 'godot').map((p) => p.id)).toEqual(['zeta', 'publicado'])
    expect(projectsInGroup(data(), 'activos', 'godot').map((p) => p.id)).toEqual(['zeta'])
    expect(projectGroupCounts(data(), 'godot')).toEqual({ activos: 1, planificacion: 0, pausa: 0, lanzados: 1, archivados: 0 })
  })

  it('sin proyectos, todo a cero y listas vacías', () => {
    const empty = { ...data(), projects: [] }
    expect(projectsInGroup(empty, 'pausa')).toEqual([])
    expect(Object.values(projectGroupCounts(empty))).toEqual([0, 0, 0, 0, 0])
  })

  it('solo acepta los grupos que existen en ?estado=', () => {
    expect(isProjectStageGroup('pausa')).toBe(true)
    expect(isProjectStageGroup('blocked')).toBe(false)
    expect(isProjectStageGroup(null)).toBe(false)
  })
})
