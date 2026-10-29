// Los datos con los que arranca Studio Hub la primera vez. Cada proyecto tiene su
// carpeta en seed/<proyecto>/ con su ficha (project.ts) y sus listas en JSON (una por
// colección, con el nombre de la colección); para añadir un juego a los datos iniciales
// basta con otra carpeta y una entrada en PROJECTS.
import type { Activity, Project, StudioData, WorkItem } from '../../domain/types'
import { SCHEMA_VERSION } from '../../domain/types'
import { COLLECTIONS, type CollectionKey } from '../../domain/collections'
import { DEFAULT_AREAS } from './areas'
import { INDIE_DEV_TYCOON } from './indie-dev-tycoon/project'
import idtAchievements from './indie-dev-tycoon/achievements.json'
import idtActivity from './indie-dev-tycoon/activity.json'
import idtBuilds from './indie-dev-tycoon/builds.json'
import idtChecklists from './indie-dev-tycoon/checklists.json'
import idtEvents from './indie-dev-tycoon/events.json'
import idtFeedback from './indie-dev-tycoon/feedback.json'
import idtItems from './indie-dev-tycoon/items.json'
import idtPlaytests from './indie-dev-tycoon/playtests.json'
import idtReleases from './indie-dev-tycoon/releases.json'
import idtResources from './indie-dev-tycoon/resources.json'
import idtStoreListings from './indie-dev-tycoon/storeListings.json'

/** Súbelo cada vez que cambien los datos iniciales: el panel ofrecerá traer lo nuevo. */
export const SEED_VERSION = '2026-10-29.2'

/**
 * Lo que estaba en unos datos iniciales anteriores y ya no está («colección:id»), para que
 * al traer los nuevos se quite si el estudio no lo ha editado. El evento de Steam de la v1
 * es ahora la ficha de Steam del juego.
 */
export const SEED_RETIRED: string[] = ['events:idt-steam-proximamente']

/** Las colecciones que trae cada proyecto (las áreas son del estudio y los proyectos, su ficha). */
type SeedList = Exclude<CollectionKey, 'areas' | 'projects'>

const SEED_LISTS = COLLECTIONS.filter((k): k is SeedList => k !== 'areas' && k !== 'projects')

interface SeedProject {
  project: Project
  lists: Partial<Record<SeedList, unknown[]>>
}

const PROJECTS: SeedProject[] = [
  {
    project: INDIE_DEV_TYCOON,
    lists: {
      items: idtItems,
      builds: idtBuilds,
      events: idtEvents,
      feedback: idtFeedback,
      resources: idtResources,
      checklists: idtChecklists,
      activity: idtActivity,
      releases: idtReleases,
      storeListings: idtStoreListings,
      achievements: idtAchievements,
      playtests: idtPlaytests,
    },
  },
]

/** Una colección con lo de todos los proyectos. */
function seedList<K extends SeedList>(k: K): StudioData[K] {
  return PROJECTS.flatMap((p) => p.lists[k] ?? []) as StudioData[K]
}

/**
 * La actividad (commits y PR) no trae área: se la ponen los elementos de trabajo que citan
 * ese commit o esa PR como fuente, para poder ver la evolución por áreas. Si lo citan
 * elementos de varias áreas, gana la de más elementos; si empatan, la del elemento más
 * concreto (el que cita menos commits y PR: «Traducir las frases» y no «Abrir la PR de todo»),
 * y después el primero. Así no depende del orden de items.json.
 */
export function withAreas(activity: Activity[], items: WorkItem[]): Activity[] {
  const votes = new Map<string, Map<string, { count: number; specific: number; first: number }>>()
  items.forEach((item, order) => {
    if (!item.areaId) return
    const refs = item.sources.filter((s) => s.type === 'commit' || s.type === 'pr')
    for (const s of refs) {
      const key = `${item.projectId}:${s.ref}`
      const byArea = votes.get(key) ?? new Map()
      const v = byArea.get(item.areaId) ?? { count: 0, specific: Infinity, first: order }
      byArea.set(item.areaId, { count: v.count + 1, specific: Math.min(v.specific, refs.length), first: Math.min(v.first, order) })
      votes.set(key, byArea)
    }
  })
  const areaOf = (key: string) => {
    const byArea = votes.get(key)
    if (!byArea) return undefined
    return [...byArea.entries()].sort(([, a], [, b]) => b.count - a.count || a.specific - b.specific || a.first - b.first)[0][0]
  }
  return activity.map((a) => {
    const areaId = a.areaId ?? (a.ref ? areaOf(`${a.projectId}:${a.ref}`) : undefined)
    return areaId ? { ...a, areaId } : a
  })
}

export function createSeedData(): StudioData {
  const lists = Object.fromEntries(SEED_LISTS.map((k) => [k, seedList(k)])) as Pick<StudioData, SeedList>
  return structuredClone({
    ...lists,
    schemaVersion: SCHEMA_VERSION,
    studio: {
      id: 'estudio',
      name: 'Mi estudio',
      tagline: 'Cámbialo en Ajustes.',
      createdAt: '2026-09-27',
    },
    areas: DEFAULT_AREAS,
    projects: PROJECTS.map((p) => p.project),
    activity: withAreas(lists.activity, lists.items),
  })
}
