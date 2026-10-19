// Los datos con los que arranca Studio Hub la primera vez. Cada proyecto tiene su
// carpeta en seed/<proyecto>/ con su ficha (project.ts) y sus listas en JSON; para
// añadir un juego a los datos iniciales basta con otra carpeta y una línea en PROJECTS.
import type {
  Activity,
  Build,
  Checklist,
  Feedback,
  Project,
  Resource,
  StudioData,
  StudioEvent,
  WorkItem,
} from '../../domain/types'
import { SCHEMA_VERSION } from '../../domain/types'
import { DEFAULT_AREAS } from './areas'
import { INDIE_DEV_TYCOON } from './indie-dev-tycoon/project'
import idtActivity from './indie-dev-tycoon/activity.json'
import idtBuilds from './indie-dev-tycoon/builds.json'
import idtChecklists from './indie-dev-tycoon/checklists.json'
import idtEvents from './indie-dev-tycoon/events.json'
import idtFeedback from './indie-dev-tycoon/feedback.json'
import idtItems from './indie-dev-tycoon/items.json'
import idtResources from './indie-dev-tycoon/resources.json'

/** Súbelo cada vez que cambien los datos iniciales: el panel ofrecerá traer lo nuevo. */
export const SEED_VERSION = '2026-10-19.1'

interface SeedProject {
  project: Project
  items: unknown
  builds: unknown
  events: unknown
  feedback: unknown
  resources: unknown
  checklists: unknown
  activity: unknown
}

const PROJECTS: SeedProject[] = [
  {
    project: INDIE_DEV_TYCOON,
    items: idtItems,
    builds: idtBuilds,
    events: idtEvents,
    feedback: idtFeedback,
    resources: idtResources,
    checklists: idtChecklists,
    activity: idtActivity,
  },
]

/**
 * La actividad (commits y PR) no trae área: se la pone el primer elemento de trabajo que
 * cita ese commit o esa PR como fuente, para poder ver la evolución por áreas.
 */
function withAreas(activity: Activity[], items: WorkItem[]): Activity[] {
  const areaByRef = new Map<string, string>()
  for (const item of items) {
    if (!item.areaId) continue
    for (const s of item.sources) {
      if ((s.type === 'commit' || s.type === 'pr') && !areaByRef.has(`${item.projectId}:${s.ref}`))
        areaByRef.set(`${item.projectId}:${s.ref}`, item.areaId)
    }
  }
  return activity.map((a) => {
    const areaId = a.areaId ?? (a.ref ? areaByRef.get(`${a.projectId}:${a.ref}`) : undefined)
    return areaId ? { ...a, areaId } : a
  })
}

export function createSeedData(): StudioData {
  const items = PROJECTS.flatMap((p) => p.items as WorkItem[])
  return structuredClone({
    schemaVersion: SCHEMA_VERSION,
    studio: {
      id: 'estudio',
      name: 'Mi estudio',
      tagline: 'Cámbialo en Ajustes.',
      createdAt: '2026-09-27',
    },
    areas: DEFAULT_AREAS,
    projects: PROJECTS.map((p) => p.project),
    items,
    builds: PROJECTS.flatMap((p) => p.builds as Build[]),
    events: PROJECTS.flatMap((p) => p.events as StudioEvent[]),
    feedback: PROJECTS.flatMap((p) => p.feedback as Feedback[]),
    resources: PROJECTS.flatMap((p) => p.resources as Resource[]),
    checklists: PROJECTS.flatMap((p) => p.checklists as Checklist[]),
    activity: withAreas(
      PROJECTS.flatMap((p) => p.activity as Activity[]),
      items,
    ),
  })
}
