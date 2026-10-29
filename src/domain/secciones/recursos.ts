// Cálculos de la sección «Recursos» (y de los recursos de «Documentación»): qué recursos salen
// en cada subsección según el catálogo (RESOURCE_SECTIONS), cómo se agrupan y adónde lleva
// cada uno. Studio Hub no guarda archivos: cada recurso apunta a dónde está (un enlace o una
// ruta del repositorio del proyecto).
// Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { RESOURCE_SECTIONS } from '../catalog'
import type { Project, Resource, ResourceType, StudioData } from '../types'
import type { Scope } from '../selectors'

/** Las secciones que se llenan con la colección de recursos. */
export type ResourceSection = 'documentacion' | 'recursos'

const TABLE = RESOURCE_SECTIONS as unknown as Record<ResourceSection, Record<string, readonly ResourceType[]>>

/** Las subsecciones de una sección que salen de los recursos, en orden (sin «todo»). */
export function resourceSubsections(section: ResourceSection): string[] {
  return Object.keys(TABLE[section]).filter((k) => k !== 'todo')
}

/** Los tipos de una subsección (null = todo); undefined si esa subsección no es de recursos. */
export function resourceTypesFor(section: ResourceSection, sub: string | null): readonly ResourceType[] | undefined {
  return Object.hasOwn(TABLE[section], sub ?? 'todo') ? TABLE[section][sub ?? 'todo'] : undefined
}

/** ¿Es de este ámbito? Con un proyecto elegido, también lo que es de todo el estudio. */
const inResourceScope = (scope: Scope) => (r: Resource) => scope === null || !r.projectId || r.projectId === scope

/** Los fechados primero, del más reciente al más antiguo; luego, por título. */
export function compareResources(a: Resource, b: Resource): number {
  if (!!a.date !== !!b.date) return a.date ? -1 : 1
  return (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title, 'es')
}

/**
 * Los recursos de una subsección (null = todo lo de la sección) en el ámbito. Un tipo puede
 * salir en las dos secciones (los enlaces): la consulta es la misma. Una subsección que no
 * es de recursos (p. ej. «decisiones») no tiene ninguno.
 */
export function resourcesFor(data: StudioData, section: ResourceSection, sub: string | null, scope: Scope = null): Resource[] {
  const types = resourceTypesFor(section, sub)
  if (!types) return []
  return data.resources.filter((r) => types.includes(r.type) && inResourceScope(scope)(r)).sort(compareResources)
}

export interface ResourceGroup {
  /** La subsección o, si el tipo no tiene subsección propia en esta sección, el tipo. */
  key: string
  sub: string | null
  /** Solo en los grupos de un tipo sin subsección (documentos en Documentación, material comercial en Recursos). */
  type?: ResourceType
  resources: Resource[]
}

/**
 * «Todo» en grupos: uno por subsección, en el orden del catálogo, y uno por cada tipo que sale
 * en la sección sin tener subsección propia. Solo los grupos con algo.
 */
export function resourceGroups(data: StudioData, section: ResourceSection, scope: Scope = null): ResourceGroup[] {
  const all = resourcesFor(data, section, null, scope)
  const out: ResourceGroup[] = []
  const covered = new Set<ResourceType>()
  for (const sub of resourceSubsections(section)) {
    const types = TABLE[section][sub]
    types.forEach((t) => covered.add(t))
    const list = all.filter((r) => types.includes(r.type))
    if (list.length) out.push({ key: sub, sub, resources: list })
  }
  for (const type of TABLE[section].todo) {
    if (covered.has(type)) continue
    const list = all.filter((r) => r.type === type)
    if (list.length) out.push({ key: type, sub: null, type, resources: list })
  }
  return out
}

/** Cuántos recursos hay en cada subsección (las vacías, con 0), para el resumen de «todo». */
export function resourceCounts(data: StudioData, section: ResourceSection, scope: Scope = null): { sub: string; count: number }[] {
  return resourceSubsections(section).map((sub) => ({ sub, count: resourcesFor(data, section, sub, scope).length }))
}

/**
 * Adónde lleva un recurso: su enlace o, si solo tiene una ruta, ese archivo en el repositorio
 * del proyecto (si el proyecto tiene repositorio). Sin ninguno de los dos, a ningún sitio.
 */
export function resourceHref(r: Resource, project?: Project): string | undefined {
  if (r.url) return r.url
  const repo = project?.repoUrl?.replace(/\/+$/, '')
  if (!r.path || !repo) return undefined
  return `${repo}/blob/main/${r.path.replace(/^\/+/, '')}`
}

/** El tipo con el que se crea un recurso desde una subsección (en «todo», el más general). */
export function resourceDefaultType(section: ResourceSection, sub: string | null): ResourceType {
  const types = sub ? resourceTypesFor(section, sub) : undefined
  if (types?.length) return types[0]
  return section === 'documentacion' ? 'doc' : 'image'
}
