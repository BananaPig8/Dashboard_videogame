import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Achievement, type Project, type Release, type Resource, type StoreListing, type StoreText, type StudioData } from '../types'
import { validateStudioData } from '../validate'
import {
  achievementCounts,
  achievementsOf,
  listingStep,
  listingsOf,
  nextRelease,
  pressKit,
  publicationChecklists,
  publicationResources,
  releaseDate,
  releaseLate,
  releasesWithContent,
  steamGaps,
  storeTextsByListing,
  textLength,
} from '../selectors'

const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string, over: Partial<Project> = {}): Project => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  description: '',
  platforms: [],
  stage: 'production',
  color: '#000',
  versions: [],
  tags: [],
  links: [],
  ...over,
})
const listing = (id: string, over: Partial<StoreListing> = {}): StoreListing => ({
  id,
  projectId: 'p',
  platform: 'steam',
  kind: 'game',
  status: 'draft',
  sources: src,
  confidence: 'to_confirm',
  ...over,
})
const text = (id: string, over: Partial<StoreText> = {}): StoreText => ({
  id,
  projectId: 'p',
  listingId: 'l-juego',
  kind: 'short',
  language: 'es',
  text: 'Hola',
  status: 'draft',
  ...over,
})
const release = (id: string, over: Partial<Release> = {}): Release => ({
  id,
  projectId: 'p',
  kind: 'update',
  name: id,
  status: 'planned',
  sources: src,
  confidence: 'to_confirm',
  ...over,
})
const achievement = (id: string, over: Partial<Achievement> = {}): Achievement => ({
  id,
  projectId: 'p',
  name: id,
  status: 'idea',
  sources: src,
  confidence: 'to_confirm',
  ...over,
})
const resource = (id: string, over: Partial<Resource> = {}): Resource => ({
  id,
  projectId: 'p',
  title: id,
  type: 'link',
  url: 'https://ejemplo.org',
  tags: [],
  ...over,
})

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('p'), project('q'), project('idea', { stage: 'idea' }), project('archivado', { stage: 'archived' })],
    ...over,
  }
}

describe('fichas de tienda', () => {
  const d = data({
    storeListings: [
      listing('l-demo', { kind: 'demo' }),
      listing('l-juego'),
      listing('l-itch', { platform: 'itch' }),
      listing('l-q', { projectId: 'q', status: 'released' }),
    ],
  })

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('por proyecto, tienda (Steam primero) y tipo; se pueden pedir las de una tienda', () => {
    expect(listingsOf(d).map((l) => l.id)).toEqual(['l-juego', 'l-demo', 'l-itch', 'l-q'])
    expect(listingsOf(d, 'p', 'steam').map((l) => l.id)).toEqual(['l-juego', 'l-demo'])
  })

  it('los cambios pedidos cuentan como el paso de revisión', () => {
    expect(listingStep('not_started')).toBe(0)
    expect(listingStep('changes_requested')).toBe(listingStep('in_review'))
    expect(listingStep('released')).toBe(5)
  })
})

describe('lo que falta para Steam', () => {
  it('sin nada apuntado, falta todo', () => {
    const g = steamGaps(data(), 'p')
    expect(g).toHaveLength(1)
    expect(g[0].missing).toEqual(['listing', 'texts', 'screenshots', 'achievements'])
  })

  it('con ficha, textos, capturas y logros no falta nada; cuenta los textos en borrador', () => {
    const d = data({
      storeListings: [listing('l-juego')],
      storeTexts: [text('t1'), text('t2', { kind: 'long', status: 'final' })],
      resources: [resource('cap', { type: 'screenshot' })],
      achievements: [achievement('a1')],
    })
    expect(validateStudioData(d)).toEqual([])
    const [g] = steamGaps(d, 'p')
    expect(g.missing).toEqual([])
    expect(g.draftTexts).toBe(1)
    expect(g.listings.map((l) => l.id)).toEqual(['l-juego'])
  })

  it('los textos de otra tienda o las capturas de otro proyecto no cuentan', () => {
    const d = data({
      storeListings: [listing('l-itch', { platform: 'itch' })],
      storeTexts: [text('t1', { listingId: 'l-itch' })],
      resources: [resource('cap', { projectId: 'q', type: 'screenshot' })],
    })
    expect(steamGaps(d, 'p')[0].missing).toEqual(['listing', 'texts', 'screenshots', 'achievements'])
  })

  it('en todo el estudio: los proyectos en marcha y los que ya tienen algo de Steam', () => {
    const d = data({ checklists: [{ id: 'c', projectId: 'idea', title: 'Steam', target: 'steam', items: [] }] })
    expect(steamGaps(d).map((g) => g.project.id)).toEqual(['idea', 'p', 'q'])
    expect(steamGaps(d, 'archivado').map((g) => g.project.id)).toEqual(['archivado'])
  })
})

describe('listas de pasos de publicación', () => {
  it('filtra por destino y ámbito', () => {
    const d = data({
      checklists: [
        { id: 'a', projectId: 'p', title: 'Steam', target: 'steam', items: [] },
        { id: 'b', projectId: 'p', title: 'Lanzar', target: 'release', items: [] },
        { id: 'c', projectId: 'q', title: 'Demo', target: 'demo', items: [] },
        { id: 'd', projectId: 'p', title: 'Feria', target: 'event', items: [] },
      ],
    })
    expect(publicationChecklists(d, ['steam']).map((c) => c.id)).toEqual(['a'])
    expect(publicationChecklists(d, ['release', 'demo', 'update']).map((c) => c.id)).toEqual(['b', 'c'])
    expect(publicationChecklists(d, ['release', 'demo', 'update'], 'q').map((c) => c.id)).toEqual(['c'])
  })
})

describe('versiones para jugadores', () => {
  const d = data({
    releases: [
      release('lanzada', { kind: 'launch', status: 'released', releasedAt: '2026-09-01', targetDate: '2026-08-01' }),
      release('sin-fecha', { status: 'in_progress' }),
      release('tarde', { targetDate: '2026-10-01' }),
      release('luego', { kind: 'dlc', targetDate: '2026-12-01' }),
      release('cancelada', { status: 'cancelled', targetDate: '2026-09-15' }),
      release('ajena', { projectId: 'q', kind: 'patch', status: 'idea' }),
    ],
    builds: [
      {
        id: 'b1',
        projectId: 'p',
        name: 'B1',
        version: '1',
        channel: 'full',
        platforms: [],
        status: 'ready',
        releaseId: 'luego',
        date: '2026-10-02',
        sources: src,
        confidence: 'verified',
      },
    ],
    items: [
      {
        id: 'i1',
        projectId: 'p',
        kind: 'feature',
        title: 'I1',
        status: 'planned',
        priority: 'medium',
        tags: [],
        sources: src,
        confidence: 'verified',
        releaseId: 'luego',
      },
    ],
    storeListings: [listing('l-dlc', { kind: 'dlc', releaseId: 'luego' })],
  })

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('la fecha de una versión: la de salida o la prevista', () => {
    expect(releaseDate(d.releases[0])).toBe('2026-09-01')
    expect(releaseDate(d.releases[2])).toBe('2026-10-01')
    expect(releaseDate(d.releases[1])).toBeUndefined()
  })

  it('la próxima versión es la pendiente con la fecha más cercana, aunque vaya con retraso', () => {
    expect(nextRelease(d)?.id).toBe('tarde')
    expect(nextRelease(d, 'p', ['dlc'])?.id).toBe('luego')
    expect(releaseLate(d.releases[2], '2026-10-19')).toBe(true)
    expect(releaseLate(d.releases[3], '2026-10-19')).toBe(false)
    expect(releaseLate(d.releases[0], '2026-10-19')).toBe(false)
  })

  it('sin fechas, la que está en preparación; sin nada pendiente, ninguna', () => {
    expect(nextRelease(d, 'p', ['update', 'patch'])?.id).toBe('tarde')
    expect(nextRelease(d, 'q')?.id).toBe('ajena')
    expect(nextRelease(data({ releases: [release('x', { status: 'idea' }), release('y', { status: 'in_progress' })] }))?.id).toBe('y')
    expect(nextRelease(data({ releases: [release('x', { status: 'released' })] }))).toBeUndefined()
  })

  it('cada versión con sus builds, sus elementos y sus fichas, por fecha', () => {
    const list = releasesWithContent(d, ['update', 'patch', 'dlc', 'expansion'])
    expect(list.map((r) => r.release.id)).toEqual(['cancelada', 'tarde', 'luego', 'ajena', 'sin-fecha'])
    const luego = list.find((r) => r.release.id === 'luego')!
    expect(luego.builds.map((b) => b.id)).toEqual(['b1'])
    expect(luego.items.map((i) => i.id)).toEqual(['i1'])
    expect(luego.listings.map((l) => l.id)).toEqual(['l-dlc'])
    expect(releasesWithContent(d, ['launch', 'demo'], 'p').map((r) => r.release.id)).toEqual(['lanzada'])
  })
})

describe('textos de las fichas', () => {
  it('cuenta caracteres como se ven', () => {
    expect(textLength('')).toBe(0)
    expect(textLength('Árbol')).toBe(5)
    expect(textLength('Árbol')).toBe(5)
    expect(textLength('🎮 juego')).toBe(7)
  })

  it('agrupa por ficha e idioma, con las fichas sin textos y los textos sin ficha', () => {
    const d = data({
      storeListings: [listing('l-juego'), listing('l-demo', { kind: 'demo' })],
      storeTexts: [
        text('en-largo', { language: 'en', kind: 'long' }),
        text('es-largo', { kind: 'long' }),
        text('es-corto'),
        text('huerfano', { listingId: 'borrada' }),
        text('ajeno', { projectId: 'q', listingId: 'otra' }),
      ],
    })
    const g = storeTextsByListing(d, 'p')
    expect(g.map((x) => x.listing?.id ?? 'sin ficha')).toEqual(['l-juego', 'l-demo', 'sin ficha'])
    expect(g[0].languages.map((l) => [l.language, l.texts.map((t) => t.id)])).toEqual([
      ['en', ['en-largo']],
      ['es', ['es-corto', 'es-largo']],
    ])
    expect(g[1].languages).toEqual([])
    expect(g[2].languages[0].texts.map((t) => t.id)).toEqual(['huerfano'])
    expect(storeTextsByListing(d).map((x) => x.listing?.id ?? `sin ficha ${x.projectId}`)).toEqual(['l-juego', 'l-demo', 'sin ficha p', 'sin ficha q'])
  })
})

describe('logros', () => {
  it('primero los más avanzados y cuántos hay de cada estado', () => {
    const d = data({
      achievements: [
        achievement('Zeta', { status: 'implemented' }),
        achievement('Alfa'),
        achievement('Beta', { status: 'in_store' }),
        achievement('Otro', { projectId: 'q' }),
      ],
    })
    const list = achievementsOf(d, 'p')
    expect(list.map((a) => a.id)).toEqual(['Beta', 'Zeta', 'Alfa'])
    expect(achievementCounts(list)).toEqual([
      { status: 'in_store', count: 1 },
      { status: 'implemented', count: 1 },
      { status: 'idea', count: 1 },
    ])
  })
})

describe('material de publicación', () => {
  const d = data({
    resources: [
      resource('cartel', { type: 'marketing', date: '2026-10-01' }),
      resource('nota', { type: 'marketing', projectId: undefined, date: '2026-10-05' }),
      resource('captura', { type: 'screenshot' }),
      resource('trailer', { type: 'video', projectId: 'q' }),
      resource('logo', { type: 'logo', tags: ['Prensa'] }),
      resource('dossier', { type: 'doc', tags: ['prensa'] }),
    ],
  })

  it('los del proyecto y los del estudio, de lo más reciente a lo más antiguo', () => {
    expect(publicationResources(d, ['marketing'], 'p').map((r) => r.id)).toEqual(['nota', 'cartel'])
    expect(publicationResources(d, ['screenshot', 'video']).map((r) => r.id)).toEqual(['captura', 'trailer'])
    expect(publicationResources(d, ['screenshot', 'video'], 'p').map((r) => r.id)).toEqual(['captura'])
  })

  it('lo que hay para prensa', () => {
    const kit = pressKit(d, 'p')
    expect(kit.logos.map((r) => r.id)).toEqual(['logo'])
    expect(kit.screenshots.map((r) => r.id)).toEqual(['captura'])
    expect(kit.videos).toEqual([])
    expect(kit.tagged.map((r) => r.id)).toEqual(['logo', 'dossier'])
  })
})
