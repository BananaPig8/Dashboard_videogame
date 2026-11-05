import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import {
  SCHEMA_VERSION,
  type Achievement,
  type Build,
  type Checklist,
  type Release,
  type StoreListing,
  type StoreText,
  type StudioData,
} from '../types'
import { validateStudioData } from '../validate'
import { launchPanel, launchProject, type LaunchCategory, type LaunchCategoryId, type LaunchProject } from '../selectors'

const src = [{ type: 'doc' as const, ref: 'Documento de prueba', url: 'https://example.com/prueba' }]
const project = (id: string, status = 'desarrollo') => ({
  id,
  slug: id,
  name: id,
  description: '',
  platforms: [],
  status,
  color: '#000000',
  versions: [],
  tags: [],
  links: [],
})
const release = (id: string, over: Partial<Release> = {}): Release => ({ id, projectId: 'p', kind: 'demo', name: id, status: 'planned', sources: src, confidence: 'verified', ...over })
const build = (id: string, over: Partial<Build> = {}): Build => ({
  id,
  projectId: 'p',
  name: id,
  version: '1.0',
  channel: 'demo',
  platforms: [],
  status: 'published',
  sources: src,
  confidence: 'verified',
  ...over,
})
const checklist = (id: string, done: boolean[], over: Partial<Checklist> = {}): Checklist => ({
  id,
  projectId: 'p',
  title: id,
  target: 'steam',
  items: done.map((d, n) => ({ id: `${id}-${n}`, label: `Paso ${n + 1}`, done: d })),
  ...over,
})
const listing = (id: string, over: Partial<StoreListing> = {}): StoreListing => ({ id, projectId: 'p', platform: 'steam', kind: 'game', status: 'draft', sources: src, confidence: 'verified', ...over })
const text = (id: string, over: Partial<StoreText> = {}): StoreText => ({ id, projectId: 'p', listingId: 'ficha', kind: 'short', language: 'es', text: 'Un juego', status: 'draft', ...over })
const achievement = (id: string, over: Partial<Achievement> = {}): Achievement => ({
  id,
  projectId: 'p',
  name: id,
  status: 'implemented',
  hidden: false,
  sources: src,
  confidence: 'verified',
  ...over,
})

function data(over: Partial<StudioData> = {}): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('p'), project('q', 'idea'), project('viejo', 'archivado')],
    ...over,
  }
}

const cat = (lp: LaunchProject, id: LaunchCategoryId): LaunchCategory => lp.categories.find((c) => c.id === id)!
const ofP = (d: StudioData) => launchProject(d, d.projects[0])
const lineIds = (c: LaunchCategory) => c.lines.map((l) => l.id)

describe('lanzamientos: lo que falta para publicar', () => {
  it('los datos de prueba son válidos', () => {
    const d = data({
      releases: [release('r')],
      builds: [build('b', { releaseId: 'r' })],
      checklists: [checklist('c', [true, false])],
      storeListings: [listing('ficha')],
      storeTexts: [text('t')],
      achievements: [achievement('a')],
    })
    expect(validateStudioData(d)).toEqual([])
  })

  it('sin nada registrado, cada categoría lo dice (registered 0), no «0 pendientes» comprobados', () => {
    const lp = ofP(data())
    for (const c of lp.categories) expect(c).toMatchObject({ registered: 0, pending: 0, lines: [] })
    expect(lp).toMatchObject({ registered: 0, pending: 0 })
  })

  it('demos: versiones «demo» que no han salido y builds de demo en preparación, sin repetir', () => {
    const d = data({
      releases: [
        release('demo-hecha', { status: 'released', releasedAt: '2026-10-01' }),
        release('demo-nueva', { status: 'in_progress' }),
        release('demo-idea', { status: 'idea' }),
        release('demo-cancelada', { status: 'cancelled' }),
        release('salida-marcada', { status: 'planned', releasedAt: '2026-10-05' }),
        release('actualizacion', { kind: 'update' }),
      ],
      builds: [
        build('build-de-la-nueva', { releaseId: 'demo-nueva', status: 'in_progress' }),
        build('build-de-la-hecha', { releaseId: 'demo-hecha' }),
        build('feria-suelta', { channel: 'event', status: 'in_progress' }),
        build('demo-vieja', { status: 'superseded' }),
        build('retirada', { status: 'withdrawn' }),
        build('juego', { channel: 'full', status: 'in_progress' }),
      ],
    })
    const demos = cat(ofP(d), 'demos')
    // La build de la demo nueva va en su línea; la de feria suelta, aparte; la del juego completo, no.
    expect(lineIds(demos)).toEqual(['releases:demo-nueva', 'releases:demo-idea', 'builds:feria-suelta'])
    const nueva = demos.lines[0]
    expect(nueva.kind === 'release' && nueva.builds.map((b) => b.id)).toEqual(['build-de-la-nueva'])
    // Cuentan: 4 demos no canceladas + 2 builds sueltas (feria y la vieja); hechas, 3.
    expect(demos).toMatchObject({ pending: 3, total: 6, done: 3, registered: 7 })
  })

  it('lanzamientos, actualizaciones y DLC: cada uno con sus estados pendientes', () => {
    const d = data({
      releases: [
        release('salida', { kind: 'launch', status: 'planned' }),
        release('salida-vieja', { kind: 'launch', status: 'released', releasedAt: '2026-01-01' }),
        release('parche', { kind: 'patch', status: 'in_progress' }),
        release('actualizacion-idea', { kind: 'update', status: 'idea' }),
        release('actualizacion-hecha', { kind: 'update', status: 'released' }),
        release('dlc-idea', { kind: 'dlc', status: 'idea' }),
        release('expansion-cancelada', { kind: 'expansion', status: 'cancelled' }),
      ],
    })
    const lp = ofP(d)
    expect(lineIds(cat(lp, 'launches'))).toEqual(['releases:salida'])
    expect(cat(lp, 'launches')).toMatchObject({ pending: 1, done: 1, total: 2 })
    // Las ideas de actualización no son «previstas o en marcha».
    expect(lineIds(cat(lp, 'updates'))).toEqual(['releases:parche'])
    expect(cat(lp, 'updates')).toMatchObject({ registered: 3, pending: 1, total: 3 })
    expect(lineIds(cat(lp, 'dlc'))).toEqual(['releases:dlc-idea'])
    expect(cat(lp, 'dlc')).toMatchObject({ registered: 2, pending: 1, total: 1 })
    // Las demos no se mezclan con el resto.
    expect(cat(lp, 'demos').registered).toBe(0)
  })

  it('builds candidatas', () => {
    const d = data({ builds: [build('rc', { status: 'candidate', channel: 'full' }), build('lista', { status: 'ready' })] })
    const c = cat(ofP(d), 'candidates')
    expect(lineIds(c)).toEqual(['builds:rc'])
    expect(c).toMatchObject({ registered: 2, pending: 1 })
    // Una candidata de demo no es una demo «en preparación».
    expect(cat(ofP(data({ builds: [build('rc-demo', { status: 'candidate' })] })), 'demos').pending).toBe(0)
  })

  it('materiales: pasos sin hacer de las listas de publicar y textos en borrador; las de ferias no cuentan', () => {
    const d = data({
      checklists: [
        checklist('steam', [true, false, false]),
        checklist('demo', [true, true], { target: 'demo' }),
        checklist('actualizar', [false], { target: 'update' }),
        checklist('feria', [false, false], { target: 'event' }),
        checklist('otra', [false], { target: 'other' }),
      ],
      storeListings: [listing('ficha')],
      storeTexts: [text('corta'), text('larga', { kind: 'long', status: 'final' }), text('perdido', { listingId: 'no-existe' })],
    })
    const m = cat(ofP(d), 'materials')
    expect(lineIds(m)).toEqual(['checklists:steam', 'checklists:actualizar', 'storeTexts:ficha', 'storeTexts:p:sin-ficha'])
    // Pasos: 6, hechos 3; textos: 3, definitivos 1.
    expect(m).toMatchObject({ registered: 9, total: 9, done: 4, pending: 5 })
    const steam = m.lines[0]
    expect(steam.kind === 'checklist' && steam.pending.map((i) => i.label)).toEqual(['Paso 2', 'Paso 3'])
  })

  it('materiales: con todo hecho, pendientes 0 y el total para decir «Todo hecho (n de n)»', () => {
    const m = cat(ofP(data({ checklists: [checklist('steam', [true, true])] })), 'materials')
    expect(m).toMatchObject({ registered: 2, pending: 0, done: 2, total: 2, lines: [] })
  })

  it('logros: por implementar y por verificar (sin verificar o sin decidir si son ocultos), cada uno una vez', () => {
    const d = data({
      achievements: [
        achievement('idea', { status: 'idea' }),
        achievement('disenado', { status: 'designed' }),
        achievement('listo', { status: 'implemented' }),
        achievement('deducido', { confidence: 'inferred' }),
        achievement('sin-decidir', { hidden: undefined }),
        achievement('los-dos', { confidence: 'to_confirm', hidden: undefined }),
        achievement('en-tienda-sin-decidir', { status: 'in_store', hidden: undefined }),
        achievement('en-tienda', { status: 'in_store', hidden: true }),
      ],
    })
    const a = cat(ofP(d), 'achievements')
    expect(a).toMatchObject({ registered: 8, pending: 6, done: 2, total: 8 })
    const [implement, verify] = a.lines
    expect(implement.kind === 'achievements' && implement.achievements.map((x) => x.id)).toEqual(['disenado', 'idea'])
    expect(verify).toMatchObject({ reason: 'verify', unverified: 2, undecided: 3 })
    expect(verify.kind === 'achievements' && verify.achievements.length).toBe(4)
  })

  it('logros: todos en el juego, verificados y con la visibilidad decidida → nada pendiente', () => {
    const a = cat(ofP(data({ achievements: [achievement('a'), achievement('b', { hidden: true })] })), 'achievements')
    expect(a).toMatchObject({ registered: 2, pending: 0, done: 2, total: 2, lines: [] })
  })

  it('revisiones: fichas en revisión o con cambios pedidos', () => {
    const d = data({
      storeListings: [
        listing('revision', { status: 'in_review' }),
        listing('cambios', { status: 'changes_requested', kind: 'demo' }),
        listing('sin-empezar', { status: 'not_started', kind: 'dlc' }),
      ],
    })
    const r = cat(ofP(d), 'reviews')
    expect(lineIds(r)).toEqual(['storeListings:revision', 'storeListings:cambios'])
    expect(r).toMatchObject({ registered: 3, pending: 2 })
  })

  it('el ámbito: un proyecto (aunque no tenga nada) o, en el estudio, los no archivados por etapa', () => {
    const d = data({
      releases: [release('de-q', { projectId: 'q' }), release('del-archivado', { projectId: 'viejo' })],
      checklists: [checklist('de-p', [false])],
    })
    expect(launchPanel(d).map((x) => x.project.id)).toEqual(['q', 'p'])
    const soloP = launchPanel(d, 'p')
    expect(soloP.map((x) => x.project.id)).toEqual(['p'])
    expect(cat(soloP[0], 'demos').registered).toBe(0)
    expect(soloP[0]).toMatchObject({ pending: 1, registered: 1 })
    // Lo de otro proyecto no se cuela.
    expect(cat(launchPanel(d, 'q')[0], 'materials').registered).toBe(0)
    expect(launchPanel(d, 'viejo').map((x) => x.project.id)).toEqual(['viejo'])
    expect(launchPanel(d, 'no-existe')).toEqual([])
  })
})
