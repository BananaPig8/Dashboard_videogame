// Cálculos del Dashboard: lanzamientos. Se reexportan desde panel.ts (y este, desde selectors.ts).
// Regla: lo que se importa de '../selectors' solo se usa dentro de funciones (hay un ciclo de import).
//
// «Lo que falta para publicar», por proyecto y por categoría. Todo sale de lo registrado en
// Studio Hub (versiones, builds, listas de pasos, textos y fichas de tienda, logros); nada viene
// de Steam ni de otra tienda. Cada categoría dice cuánto hay registrado, para que la pantalla
// distinga «no hay nada registrado» de «está todo hecho» (nunca «0 pendientes» sin datos).
import type { Achievement, Build, Checklist, ChecklistItem, ChecklistTarget, ID, Project, Release, ReleaseKind, StoreListing, StoreText, StudioData } from '../types'
import { BUILD_GROUPS, compareBuilds, compareReleases, listingsOf, projectsByStage, type Scope } from '../selectors'

/** Las categorías del panel, en el orden en que salen. */
export type LaunchCategoryId = 'launches' | 'demos' | 'candidates' | 'materials' | 'achievements' | 'reviews' | 'updates' | 'dlc'

export const LAUNCH_CATEGORIES: readonly LaunchCategoryId[] = ['launches', 'demos', 'candidates', 'materials', 'achievements', 'reviews', 'updates', 'dlc']

/** Las listas de pasos que son de publicar (las de ferias y las de «otro» no). */
export const LAUNCH_CHECKLIST_TARGETS: readonly ChecklistTarget[] = ['steam', 'release', 'demo', 'update']

/** Qué estados de una versión cuentan como pendientes en cada categoría de versiones. */
const RELEASE_RULES: Record<'launches' | 'demos' | 'updates' | 'dlc', { kinds: ReleaseKind[]; statuses: Release['status'][] }> = {
  // El lanzamiento del juego que no ha salido.
  launches: { kinds: ['launch'], statuses: ['idea', 'planned', 'in_progress'] },
  // Demos que no han salido.
  demos: { kinds: ['demo'], statuses: ['idea', 'planned', 'in_progress'] },
  // Actualizaciones y parches previstos o en marcha (las ideas, no).
  updates: { kinds: ['update', 'patch'], statuses: ['planned', 'in_progress'] },
  // DLC y expansiones en idea o previstos (y en marcha, para que no se pierdan de vista).
  dlc: { kinds: ['dlc', 'expansion'], statuses: ['idea', 'planned', 'in_progress'] },
}

/** Una cosa pendiente (o un grupo de ellas, cuando son pasos, textos o logros). */
export type LaunchLine =
  /** Una versión pendiente; en las demos, con sus builds en preparación. */
  | { kind: 'release'; id: string; release: Release; builds: Build[] }
  | { kind: 'build'; id: string; build: Build }
  /** Una lista de pasos con los pasos sin hacer. */
  | { kind: 'checklist'; id: string; checklist: Checklist; pending: ChecklistItem[]; done: number; total: number }
  /** Los textos en borrador de una ficha de tienda (sin ficha: textos cuya ficha ya no existe). */
  | { kind: 'texts'; id: string; listing?: StoreListing; texts: StoreText[] }
  /**
   * Logros por implementar (en idea o diseñados) o por verificar (en el juego o en la tienda con
   * la fiabilidad sin verificar o sin decidir si son ocultos). `unverified` y `undecided` dicen
   * por qué (un logro puede tener los dos motivos y cuenta una vez).
   */
  | { kind: 'achievements'; id: string; reason: 'implement' | 'verify'; achievements: Achievement[]; unverified: number; undecided: number }
  /** Una ficha de tienda en revisión o con cambios pedidos. */
  | { kind: 'listing'; id: string; listing: StoreListing }

export interface LaunchCategory {
  id: LaunchCategoryId
  /** Cuántas cosas de esta categoría hay registradas (0: «no hay nada registrado»). */
  registered: number
  /** Cuántas están pendientes, cada una una vez (pasos, textos y logros uno a uno). */
  pending: number
  /** De lo que cuenta, lo hecho y el total (para «Todo hecho (56 de 56)»). */
  done: number
  total: number
  lines: LaunchLine[]
}

export interface LaunchProject {
  project: Project
  categories: LaunchCategory[]
  /** Lo pendiente de todas sus categorías. */
  pending: number
  /** Lo registrado de todas sus categorías (0: no tiene nada de publicación apuntado). */
  registered: number
}

const notOut = (r: Release) => r.status !== 'released' && r.status !== 'cancelled' && !r.releasedAt

const STATUS_RANK: Record<Release['status'], number> = { in_progress: 0, planned: 1, idea: 2, released: 3, cancelled: 4 }

/** Lo pendiente: con fecha primero (la más cercana antes) y, sin fecha, lo que está en marcha antes. */
const byPending = (a: Release, b: Release) =>
  !!a.targetDate !== !!b.targetDate
    ? a.targetDate
      ? -1
      : 1
    : (a.targetDate ?? '').localeCompare(b.targetDate ?? '') || STATUS_RANK[a.status] - STATUS_RANK[b.status] || compareReleases(a, b)

/** Las versiones de una categoría: registradas, hechas y las pendientes como líneas. */
function releaseCategory(id: 'launches' | 'updates' | 'dlc', releases: Release[]): LaunchCategory {
  const rule = RELEASE_RULES[id]
  const own = releases.filter((r) => rule.kinds.includes(r.kind))
  const pending = own.filter((r) => notOut(r) && rule.statuses.includes(r.status)).sort(byPending)
  const counted = own.filter((r) => r.status !== 'cancelled')
  return {
    id,
    registered: own.length,
    pending: pending.length,
    done: counted.filter((r) => !notOut(r)).length,
    total: counted.length,
    lines: pending.map((release) => ({ kind: 'release', id: `releases:${release.id}`, release, builds: [] })),
  }
}

/**
 * Demos pendientes: las versiones «demo» que no han salido y las builds de demo (canal Demo o
 * Demo de evento, las de Builds › Demos) en preparación. Una build que cuelga de una versión
 * demo cuenta con esa versión (y, si está en preparación y la versión no ha salido, va en su
 * línea): no sale dos veces.
 */
function demoCategory(releases: Release[], builds: Build[]): LaunchCategory {
  const demos = releases.filter((r) => r.kind === 'demo' && r.status !== 'cancelled')
  const demoIds = new Set(demos.map((r) => r.id))
  const demoBuilds = builds.filter((b) => (BUILD_GROUPS.demos.channels as string[]).includes(b.channel) && b.status !== 'withdrawn')
  const preparing = (b: Build) => b.status === 'in_progress'
  const standalone = demoBuilds.filter((b) => !b.releaseId || !demoIds.has(b.releaseId))
  const pendingReleases = demos.filter(notOut).sort(byPending)
  const pendingBuilds = standalone.filter(preparing).sort(compareBuilds)
  const lines: LaunchLine[] = [
    ...pendingReleases.map((release): LaunchLine => ({
      kind: 'release',
      id: `releases:${release.id}`,
      release,
      builds: demoBuilds.filter((b) => b.releaseId === release.id && preparing(b)).sort(compareBuilds),
    })),
    ...pendingBuilds.map((build): LaunchLine => ({ kind: 'build', id: `builds:${build.id}`, build })),
  ]
  const total = demos.length + standalone.length
  return {
    id: 'demos',
    registered: releases.filter((r) => r.kind === 'demo').length + standalone.length,
    pending: lines.length,
    done: total - lines.length,
    total,
    lines,
  }
}

/** Materiales de publicación: los pasos sin hacer de las listas de publicar y los textos de tienda en borrador. */
function materialsCategory(data: StudioData, projectId: ID, listings: StoreListing[]): LaunchCategory {
  const lists = data.checklists
    .filter((c) => c.projectId === projectId && LAUNCH_CHECKLIST_TARGETS.includes(c.target))
    .sort((a, b) => LAUNCH_CHECKLIST_TARGETS.indexOf(a.target) - LAUNCH_CHECKLIST_TARGETS.indexOf(b.target) || a.title.localeCompare(b.title, 'es'))
  const texts = data.storeTexts.filter((t) => t.projectId === projectId)
  const steps = lists.reduce((s, c) => s + c.items.length, 0)
  const stepsDone = lists.reduce((s, c) => s + c.items.filter((i) => i.done).length, 0)
  const drafts = texts.filter((t) => t.status === 'draft')
  const lines: LaunchLine[] = []
  for (const checklist of lists) {
    const pending = checklist.items.filter((i) => !i.done)
    if (pending.length)
      lines.push({ kind: 'checklist', id: `checklists:${checklist.id}`, checklist, pending, done: checklist.items.length - pending.length, total: checklist.items.length })
  }
  // Los borradores, por ficha (en el orden de las fichas; los de una ficha que ya no existe, al final).
  const byListing = new Map<string, StoreText[]>()
  for (const t of drafts) byListing.set(t.listingId, [...(byListing.get(t.listingId) ?? []), t])
  for (const listing of listings) {
    const own = byListing.get(listing.id)
    if (own) lines.push({ kind: 'texts', id: `storeTexts:${listing.id}`, listing, texts: own })
    byListing.delete(listing.id)
  }
  const orphans = [...byListing.values()].flat()
  if (orphans.length) lines.push({ kind: 'texts', id: `storeTexts:${projectId}:sin-ficha`, texts: orphans })
  const total = steps + texts.length
  const pending = steps - stepsDone + drafts.length
  return { id: 'materials', registered: total, pending, done: total - pending, total, lines }
}

/** Logros por implementar (idea o diseñados) y por verificar (en el juego o en la tienda, sin verificar o sin decidir si son ocultos). */
function achievementsCategory(list: Achievement[]): LaunchCategory {
  const toImplement = list.filter((a) => a.status === 'idea' || a.status === 'designed')
  const unverified = (a: Achievement) => a.confidence !== 'verified'
  const undecided = (a: Achievement) => typeof a.hidden !== 'boolean'
  const toVerify = list.filter((a) => (a.status === 'implemented' || a.status === 'in_store') && (unverified(a) || undecided(a)))
  const byName = (a: Achievement, b: Achievement) => a.name.localeCompare(b.name, 'es')
  const lines: LaunchLine[] = []
  if (toImplement.length)
    lines.push({ kind: 'achievements', id: 'achievements:implement', reason: 'implement', achievements: toImplement.sort(byName), unverified: 0, undecided: 0 })
  if (toVerify.length)
    lines.push({
      kind: 'achievements',
      id: 'achievements:verify',
      reason: 'verify',
      achievements: toVerify.sort(byName),
      unverified: toVerify.filter(unverified).length,
      undecided: toVerify.filter(undecided).length,
    })
  const pending = toImplement.length + toVerify.length
  return { id: 'achievements', registered: list.length, pending, done: list.length - pending, total: list.length, lines }
}

/** Lo que falta para publicar un proyecto, por categorías. */
export function launchProject(data: StudioData, project: Project): LaunchProject {
  const own = <T extends { projectId: ID }>(list: T[]) => list.filter((x) => x.projectId === project.id)
  const releases = own(data.releases)
  const builds = own(data.builds)
  const listings = listingsOf(data, project.id)
  const candidates = builds.filter((b) => b.status === 'candidate').sort(compareBuilds)
  const inReview = listings.filter((l) => l.status === 'in_review' || l.status === 'changes_requested')
  const categories: LaunchCategory[] = [
    releaseCategory('launches', releases),
    demoCategory(releases, builds),
    {
      id: 'candidates',
      registered: builds.length,
      pending: candidates.length,
      done: builds.length - candidates.length,
      total: builds.length,
      lines: candidates.map((build) => ({ kind: 'build', id: `builds:${build.id}`, build })),
    },
    materialsCategory(data, project.id, listings),
    achievementsCategory(own(data.achievements)),
    {
      id: 'reviews',
      registered: listings.length,
      pending: inReview.length,
      done: listings.length - inReview.length,
      total: listings.length,
      lines: inReview.map((listing) => ({ kind: 'listing', id: `storeListings:${listing.id}`, listing })),
    },
    releaseCategory('updates', releases),
    releaseCategory('dlc', releases),
  ]
  return {
    project,
    categories,
    pending: categories.reduce((s, c) => s + c.pending, 0),
    registered: categories.reduce((s, c) => s + c.registered, 0),
  }
}

/**
 * El panel de lanzamientos de un ámbito: con un proyecto, ese proyecto (aunque no tenga nada
 * registrado); en todo el estudio, cada proyecto no archivado, por etapa y nombre.
 */
export function launchPanel(data: StudioData, scope: Scope = null): LaunchProject[] {
  return data.projects
    .filter((p) => (scope === null ? p.stage !== 'archived' : p.id === scope))
    .sort(projectsByStage)
    .map((p) => launchProject(data, p))
}
