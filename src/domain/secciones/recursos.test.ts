import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type Resource, type StudioData } from '../types'
import { validateStudioData } from '../validate'
import { resourceCounts, resourceDefaultType, resourceGroups, resourceHref, resourcesFor, resourceSubsections, resourceTypesFor } from '../selectors'

const project = (id: string, repoUrl?: string) => ({
  id,
  slug: id,
  name: id,
  description: '',
  platforms: [],
  stage: 'production' as const,
  color: '#000',
  versions: [],
  tags: [],
  links: [],
  repoUrl,
})
const res = (id: string, over: Partial<Resource> = {}): Resource => ({
  id,
  projectId: 'p',
  title: id,
  type: 'doc',
  url: `https://ejemplo.org/${id}`,
  tags: [],
  ...over,
})

function data(resources: Resource[]): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('p', 'https://github.com/estudio/p/'), project('q')],
    resources,
  }
}

const ids = (list: { id: string }[]) => list.map((r) => r.id)

describe('recursos por subsección', () => {
  const d = data([
    res('enlace', { type: 'link', date: '2026-10-01' }),
    res('enlace-q', { type: 'link', projectId: 'q' }),
    res('enlace-estudio', { type: 'link', projectId: undefined }),
    res('herramienta', { type: 'tool' }),
    res('repo', { type: 'repo', title: 'Alfa' }),
    res('captura', { type: 'screenshot', date: '2026-09-01' }),
    res('captura-nueva', { type: 'screenshot', date: '2026-10-05' }),
    res('comercial', { type: 'marketing' }),
    res('documento', { type: 'doc' }),
  ])

  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(d)).toEqual([])
  })

  it('los enlaces salen igual en Documentación y en Recursos', () => {
    expect(ids(resourcesFor(d, 'documentacion', 'enlaces'))).toEqual(ids(resourcesFor(d, 'recursos', 'enlaces')))
    expect(ids(resourcesFor(d, 'recursos', 'enlaces'))).toEqual(['enlace', 'enlace-estudio', 'enlace-q'])
  })

  it('con un proyecto, lo suyo y lo del estudio; nada de otros proyectos', () => {
    expect(ids(resourcesFor(d, 'recursos', 'enlaces', 'p'))).toEqual(['enlace', 'enlace-estudio'])
    expect(ids(resourcesFor(d, 'recursos', 'enlaces', 'q'))).toEqual(['enlace-estudio', 'enlace-q'])
  })

  it('una subsección junta sus tipos: lo fechado primero (lo más reciente arriba) y luego por título', () => {
    expect(ids(resourcesFor(d, 'documentacion', 'tecnica'))).toEqual(['repo', 'herramienta'])
    expect(ids(resourcesFor(d, 'recursos', 'capturas'))).toEqual(['captura-nueva', 'captura'])
  })

  it('«todo» es la unión de la sección (el material comercial en Recursos, los documentos en las dos)', () => {
    expect(ids(resourcesFor(d, 'recursos', null))).toContain('comercial')
    expect(ids(resourcesFor(d, 'documentacion', null))).not.toContain('comercial')
    expect(ids(resourcesFor(d, 'documentacion', null))).toContain('documento')
    expect(ids(resourcesFor(d, 'documentacion', null))).not.toContain('captura')
  })

  it('una subsección que no es de recursos no tiene ninguno', () => {
    expect(resourceTypesFor('documentacion', 'decisiones')).toBeUndefined()
    expect(resourcesFor(d, 'documentacion', 'decisiones')).toEqual([])
    expect(resourcesFor(d, 'recursos', 'no-existe')).toEqual([])
  })

  it('las subsecciones van en el orden del catálogo, sin «todo»', () => {
    expect(resourceSubsections('documentacion')).toEqual(['diseno', 'tecnica', 'notas', 'actas', 'guias', 'enlaces'])
    expect(resourceSubsections('recursos')).toEqual(['capturas', 'videos', 'imagenes', 'logos', 'documentos', 'enlaces', 'arte', 'referencia'])
  })
})

describe('grupos y recuentos de «todo»', () => {
  const d = data([
    res('enlace', { type: 'link' }),
    res('captura', { type: 'screenshot' }),
    res('comercial', { type: 'marketing' }),
    res('documento', { type: 'doc' }),
    res('guia', { type: 'guide' }),
  ])

  it('un grupo por subsección con algo y otro por cada tipo sin subsección propia', () => {
    expect(resourceGroups(d, 'recursos').map((g) => g.key)).toEqual(['capturas', 'documentos', 'enlaces', 'marketing'])
    expect(resourceGroups(d, 'recursos').at(-1)).toMatchObject({ sub: null, type: 'marketing' })
    expect(resourceGroups(d, 'documentacion').map((g) => g.key)).toEqual(['guias', 'enlaces', 'doc'])
  })

  it('sin recursos, sin grupos', () => {
    expect(resourceGroups(data([]), 'recursos')).toEqual([])
  })

  it('los recuentos dicen también las subsecciones vacías', () => {
    const counts = resourceCounts(d, 'recursos')
    expect(counts.find((c) => c.sub === 'capturas')?.count).toBe(1)
    expect(counts.find((c) => c.sub === 'videos')?.count).toBe(0)
    expect(counts).toHaveLength(8)
  })
})

describe('adónde lleva un recurso', () => {
  const p = project('p', 'https://github.com/estudio/p/')

  it('su enlace, si lo tiene', () => {
    expect(resourceHref(res('a', { path: 'README.md' }), p)).toBe('https://ejemplo.org/a')
  })

  it('si solo tiene ruta, el archivo en el repositorio del proyecto', () => {
    expect(resourceHref(res('a', { url: undefined, path: '/docs/diseno.md' }), p)).toBe('https://github.com/estudio/p/blob/main/docs/diseno.md')
  })

  it('sin repositorio ni enlace, a ningún sitio', () => {
    expect(resourceHref(res('a', { url: undefined, path: 'README.md' }), project('q'))).toBeUndefined()
    expect(resourceHref(res('a', { url: undefined, body: 'Texto' }), p)).toBeUndefined()
  })
})

describe('tipo al crear', () => {
  it('el primero de la subsección; en «todo», el más general', () => {
    expect(resourceDefaultType('documentacion', 'tecnica')).toBe('technical')
    expect(resourceDefaultType('documentacion', 'actas')).toBe('minutes')
    expect(resourceDefaultType('recursos', 'arte')).toBe('asset')
    expect(resourceDefaultType('documentacion', null)).toBe('doc')
    expect(resourceDefaultType('recursos', null)).toBe('image')
    expect(resourceDefaultType('documentacion', 'decisiones')).toBe('doc')
  })
})
