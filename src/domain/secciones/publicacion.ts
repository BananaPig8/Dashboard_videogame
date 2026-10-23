// Cálculos de la sección «Publicación»: fichas de tienda, sus textos, logros, versiones para
// jugadores y lo que falta para tener lista la página de Steam. Todo lo apunta el estudio a
// mano: nada de esto sale de Steamworks ni de ninguna tienda.
// Las pantallas los piden a selectors.ts, que reexporta este fichero.
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
import { STAGE_GROUPS } from '../catalog'
import type {
  Achievement,
  AchievementStatus,
  Build,
  Checklist,
  ChecklistTarget,
  ID,
  ISODate,
  ListingKind,
  ListingStatus,
  Project,
  Release,
  ReleaseKind,
  Resource,
  ResourceType,
  StorePlatform,
  StoreListing,
  StoreText,
  StudioData,
  WorkItem,
} from '../types'
import { type Scope } from '../selectors'

const own = (scope: Scope) => (x: { projectId?: ID }) => scope === null || x.projectId === scope

// ——— Fichas de tienda ——————————————————————————————————————————————————————

/** El recorrido de una ficha, en orden. «Con cambios pedidos» es una vuelta atrás desde la revisión. */
export const LISTING_FLOW: ListingStatus[] = ['not_started', 'draft', 'in_review', 'approved', 'coming_soon', 'released']

/** En qué paso del recorrido está una ficha (los cambios pedidos cuentan como la revisión). */
export function listingStep(status: ListingStatus): number {
  return LISTING_FLOW.indexOf(status === 'changes_requested' ? 'in_review' : status)
}

const KIND_ORDER: ListingKind[] = ['game', 'demo', 'dlc', 'playtest']
const PLATFORM_ORDER: StorePlatform[] = ['steam', 'itch', 'epic', 'gog', 'console', 'web', 'other']

/** Las fichas de tienda del ámbito (de una tienda, si se dice), por proyecto, tienda y tipo. */
export function listingsOf(data: StudioData, scope: Scope = null, platform?: StorePlatform): StoreListing[] {
  const names = new Map(data.projects.map((p) => [p.id, p.name]))
  return data.storeListings
    .filter((l) => own(scope)(l) && (!platform || l.platform === platform))
    .sort(
      (a, b) =>
        (names.get(a.projectId) ?? '').localeCompare(names.get(b.projectId) ?? '', 'es') ||
        PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform) ||
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
    )
}

// ——— Lo que falta para Steam —————————————————————————————————————————————

export type SteamGap = 'listing' | 'texts' | 'screenshots' | 'achievements'

export interface SteamGaps {
  project: Project
  /** Sus fichas de Steam (puede no haber ninguna). */
  listings: StoreListing[]
  missing: SteamGap[]
  /** Textos de sus fichas de Steam que siguen en borrador. */
  draftTexts: number
}

/**
 * Lo que no está apuntado todavía para la página de Steam de cada proyecto: la ficha, sus
 * textos, capturas y logros. Es lo que falta en Studio Hub, no lo que diga Steam. En todo
 * el estudio salen los proyectos en marcha o lanzados y los que ya tienen algo de Steam;
 * con un proyecto elegido, ese proyecto.
 */
export function steamGaps(data: StudioData, scope: Scope = null): SteamGaps[] {
  const active = new Set<string>([...STAGE_GROUPS.activos, ...STAGE_GROUPS.lanzados])
  const out: SteamGaps[] = []
  for (const project of data.projects) {
    if (scope !== null && project.id !== scope) continue
    const listings = data.storeListings.filter((l) => l.projectId === project.id && l.platform === 'steam')
    const steamLists = data.checklists.some((c) => c.projectId === project.id && c.target === 'steam')
    if (scope === null && !active.has(project.stage) && !listings.length && !steamLists) continue
    const ids = new Set(listings.map((l) => l.id))
    const texts = data.storeTexts.filter((t) => ids.has(t.listingId))
    const missing: SteamGap[] = []
    if (!listings.length) missing.push('listing')
    if (!texts.length) missing.push('texts')
    if (!data.resources.some((r) => r.projectId === project.id && r.type === 'screenshot')) missing.push('screenshots')
    if (!data.achievements.some((a) => a.projectId === project.id)) missing.push('achievements')
    out.push({ project, listings, missing, draftTexts: texts.filter((t) => t.status === 'draft').length })
  }
  return out.sort((a, b) => b.missing.length - a.missing.length || a.project.name.localeCompare(b.project.name, 'es'))
}

// ——— Listas de pasos ——————————————————————————————————————————————————————

/** Las listas de pasos para esos destinos (Steam, lanzamiento, demo, actualización…). */
export function publicationChecklists(data: StudioData, targets: ChecklistTarget[], scope: Scope = null): Checklist[] {
  return data.checklists.filter((c) => own(scope)(c) && targets.includes(c.target))
}

// ——— Versiones para jugadores ——————————————————————————————————————————————

/** La fecha que resume una versión: la de publicación o, si no ha salido, la prevista. */
export const releaseDate = (r: Release): ISODate | undefined => r.releasedAt ?? r.targetDate

/** Por fecha (las que no tienen, al final) y por nombre. */
export function compareReleases(a: Release, b: Release): number {
  const da = releaseDate(a)
  const db = releaseDate(b)
  if (!!da !== !!db) return da ? -1 : 1
  return (da ?? '').localeCompare(db ?? '') || a.name.localeCompare(b.name, 'es')
}

const pending = (r: Release) => r.status !== 'released' && r.status !== 'cancelled' && !r.releasedAt

/**
 * La próxima versión prevista: la que no ha salido ni se ha cancelado con la fecha más
 * cercana (aunque ya haya pasado: entonces va con retraso); si ninguna tiene fecha, la
 * primera en preparación o prevista.
 */
export function nextRelease(data: StudioData, scope: Scope = null, kinds?: ReleaseKind[]): Release | undefined {
  const list = data.releases.filter((r) => own(scope)(r) && pending(r) && (!kinds || kinds.includes(r.kind)))
  const dated = list.filter((r) => r.targetDate).sort(compareReleases)
  if (dated.length) return dated[0]
  const rank: Record<Release['status'], number> = { in_progress: 0, planned: 1, idea: 2, released: 3, cancelled: 4 }
  return list.sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name, 'es'))[0]
}

/** ¿La fecha prevista ya pasó y la versión no ha salido? */
export const releaseLate = (r: Release, today: ISODate): boolean => pending(r) && !!r.targetDate && r.targetDate < today

export interface ReleaseContent {
  release: Release
  builds: Build[]
  items: WorkItem[]
  listings: StoreListing[]
}

/** Las versiones de esos tipos con sus builds, sus elementos y sus fichas de tienda, por fecha. */
export function releasesWithContent(data: StudioData, kinds: ReleaseKind[], scope: Scope = null): ReleaseContent[] {
  return data.releases
    .filter((r) => own(scope)(r) && kinds.includes(r.kind))
    .sort(compareReleases)
    .map((release) => ({
      release,
      builds: data.builds.filter((b) => b.releaseId === release.id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
      items: data.items.filter((i) => i.releaseId === release.id),
      listings: data.storeListings.filter((l) => l.releaseId === release.id),
    }))
}

// ——— Textos de las fichas —————————————————————————————————————————————————

/** Caracteres de un texto tal y como se ven (un emoji o una letra con tilde cuentan uno). */
export function textLength(text: string): number {
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length
  return [...text.normalize('NFC')].length
}

export interface ListingTexts {
  /** Sin ficha: textos cuya ficha ya no existe. */
  listing?: StoreListing
  projectId: ID
  /** Por idioma (en orden alfabético) y, dentro, por tipo de texto. */
  languages: { language: string; texts: StoreText[] }[]
}

const TEXT_ORDER: StoreText['kind'][] = ['short', 'long', 'about', 'features', 'tags', 'requirements', 'other']

/** Los textos de cada ficha, por idioma. Salen también las fichas sin textos (para poder añadirlos). */
export function storeTextsByListing(data: StudioData, scope: Scope = null): ListingTexts[] {
  const listings = listingsOf(data, scope)
  const known = new Set(listings.map((l) => l.id))
  const group = (texts: StoreText[]) => {
    const langs = [...new Set(texts.map((t) => t.language))].sort()
    return langs.map((language) => ({
      language,
      texts: texts.filter((t) => t.language === language).sort((a, b) => TEXT_ORDER.indexOf(a.kind) - TEXT_ORDER.indexOf(b.kind)),
    }))
  }
  const texts = data.storeTexts.filter(own(scope))
  const out: ListingTexts[] = listings.map((listing) => ({
    listing,
    projectId: listing.projectId,
    languages: group(texts.filter((t) => t.listingId === listing.id)),
  }))
  const orphans = texts.filter((t) => !known.has(t.listingId))
  for (const projectId of [...new Set(orphans.map((t) => t.projectId))])
    out.push({ projectId, languages: group(orphans.filter((t) => t.projectId === projectId)) })
  return out
}

// ——— Logros ———————————————————————————————————————————————————————————————

const ACHIEVEMENT_ORDER: AchievementStatus[] = ['in_store', 'implemented', 'designed', 'idea']

/** Los logros del ámbito: primero los más avanzados (en la tienda, en el juego…) y por nombre. */
export function achievementsOf(data: StudioData, scope: Scope = null): Achievement[] {
  return data.achievements
    .filter(own(scope))
    .sort((a, b) => ACHIEVEMENT_ORDER.indexOf(a.status) - ACHIEVEMENT_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, 'es'))
}

/** Cuántos logros hay en cada estado (solo los estados con alguno). */
export function achievementCounts(list: Achievement[]): { status: AchievementStatus; count: number }[] {
  return ACHIEVEMENT_ORDER.map((status) => ({ status, count: list.filter((a) => a.status === status).length })).filter((c) => c.count > 0)
}

// ——— Material ————————————————————————————————————————————————————————————

/** Los recursos de esos tipos del ámbito (con un proyecto elegido, también los del estudio). */
export function publicationResources(data: StudioData, types: readonly ResourceType[], scope: Scope = null): Resource[] {
  return data.resources
    .filter((r) => types.includes(r.type) && (scope === null || !r.projectId || r.projectId === scope))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title, 'es'))
}

/** Etiqueta con la que se marca lo que es para prensa. */
export const PRESS_TAG = 'prensa'

export interface PressKit {
  logos: Resource[]
  images: Resource[]
  screenshots: Resource[]
  videos: Resource[]
  /** Lo que lleva la etiqueta #prensa (de cualquier tipo). */
  tagged: Resource[]
}

/** Lo que hay para prensa: logos, imágenes, capturas, vídeos y lo etiquetado #prensa. */
export function pressKit(data: StudioData, scope: Scope = null): PressKit {
  const of = (type: ResourceType) => publicationResources(data, [type], scope)
  const isPress = (r: Resource) => r.tags.some((t) => t.toLocaleLowerCase('es') === PRESS_TAG)
  return {
    logos: of('logo'),
    images: of('image'),
    screenshots: of('screenshot'),
    videos: of('video'),
    tagged: data.resources.filter((r) => (scope === null || !r.projectId || r.projectId === scope) && isPress(r)),
  }
}
