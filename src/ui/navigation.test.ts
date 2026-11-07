import { describe, expect, it } from 'vitest'
import { activeChildren, allSections, childHref, migratePath, projectOnlySections, projectTabs, scopedHref, sectionById, sectionOfPath, studioHref } from './navigation'

const ids = (list: { id: string }[]) => list.map((c) => c.id)
const tareas = sectionById('tareas')
const child = (sectionId: Parameters<typeof sectionById>[0], id: string) => sectionById(sectionId).children.find((c) => c.id === id)!

describe('registro de navegación', () => {
  it('cada sección tiene una subsección por defecto que lleva a su raíz', () => {
    for (const s of allSections()) expect(s.children.some((c) => c.to === s.to), s.id).toBe(true)
  })

  it('no hay dos subsecciones con la misma faceta y valor', () => {
    for (const s of allSections()) {
      const keys = s.children.map((c) => `${c.facet}=${c.value}`)
      expect(new Set(keys).size, s.id).toBe(keys.length)
    }
  })

  it('las secciones que se pueden ocultar no salen como pestañas del proyecto', () => {
    expect(ids(projectTabs(['finanzas']))).not.toContain('finanzas')
    expect(ids(projectTabs(['tareas']))).toContain('tareas')
  })

  it('las pestañas de la ficha, en su orden (con «Demo y pruebas» e «Historial», sin Estadísticas)', () => {
    expect(projectTabs().map((s) => s.tab)).toEqual([
      'resumen',
      'tareas',
      'roadmap',
      'calendario',
      'builds',
      'pruebas',
      'publicacion',
      'feedback',
      'eventos',
      'documentacion',
      'recursos',
      'equipo',
      'finanzas',
      'historial',
    ])
    // Las que solo tiene la ficha no salen en la barra lateral.
    for (const s of projectOnlySections()) expect(ids(allSections())).not.toContain(s.id)
  })

  it('las pestañas que solo tiene la ficha: sus subsecciones llevan a ella y, fuera, a la vista del estudio', () => {
    const pruebas = sectionById('pruebas')
    expect(childHref(pruebas, child('pruebas', 'sesiones'), { projectSlug: 'idt' }, '')).toBe('/proyectos/idt/pruebas?vista=sesiones')
    expect(childHref(pruebas, child('pruebas', 'demos'), { projectSlug: 'idt' })).toBe('/proyectos/idt/pruebas?vista=demos')
    expect(studioHref('/proyectos/idt/pruebas', '?vista=demos&q=feria')).toBe('/builds?canal=demos&q=feria')
    expect(studioHref('/proyectos/idt/historial', '')).toBe('/?ver=actividad')
    expect(studioHref('/proyectos/idt/tareas', '?vista=tablero')).toBe('/tareas?vista=tablero')
    expect(studioHref('/ficha/historial', '?tipo=x')).toBe('/?ver=actividad&tipo=x')
  })
})

describe('dónde estoy', () => {
  it('en la raíz de Tareas se ve «Todas» en «Lista»', () => {
    expect(ids(activeChildren(tareas, ''))).toEqual(['todas', 'lista'])
  })

  it('«Mis tareas» y «Tablero» pueden estar activas a la vez', () => {
    expect(ids(activeChildren(tareas, '?filtro=mias&vista=tablero'))).toEqual(['mias', 'tablero'])
  })

  it('desde «Mis tareas», «Tablero» conserva el filtro', () => {
    expect(childHref(tareas, child('tareas', 'tablero'), {}, '?filtro=mias')).toBe('/tareas?filtro=mias&vista=tablero')
  })

  it('«Plan de hoy» es una vista aparte: quita los filtros, y al salir se quita ella', () => {
    expect(childHref(tareas, child('tareas', 'hoy'), {}, '?filtro=mias')).toBe('/tareas?vista=hoy')
    expect(childHref(tareas, child('tareas', 'mias'), {}, '?vista=hoy')).toBe('/tareas?filtro=mias')
    expect(ids(activeChildren(tareas, '?vista=hoy'))).toEqual(['hoy'])
  })

  it('«Todo» vuelve a la raíz aunque haya una vista sin «por defecto»', () => {
    const feedback = sectionById('feedback')
    expect(childHref(feedback, child('feedback', 'todo'), {}, '?tipo=bugs&vista=priorizacion')).toBe('/feedback')
    expect(ids(activeChildren(feedback, '?tipo=bugs&vista=priorizacion'))).toEqual(['bugs', 'priorizacion'])
  })

  it('conserva el ámbito y los filtros finos', () => {
    expect(childHref(tareas, child('tareas', 'bloqueadas'), { scope: 'idt' }, '?p=idt&area=ui')).toBe('/tareas?p=idt&area=ui&filtro=bloqueadas')
  })

  it('en la ficha de un proyecto, las subsecciones llevan a su pestaña', () => {
    expect(childHref(tareas, child('tareas', 'tablero'), { projectSlug: 'idt' }, '')).toBe('/proyectos/idt/tareas?vista=tablero')
    expect(childHref(tareas, child('tareas', 'vencidas'), { projectSlug: 'idt' })).toBe('/proyectos/idt/tareas?filtro=vencidas')
  })

  it('el resumen de un proyecto es su panel', () => {
    expect(sectionOfPath('/proyectos/idt')?.id).toBe('panel')
    expect(sectionOfPath('/proyectos/idt/builds')?.id).toBe('builds')
    expect(sectionOfPath('/proyectos')?.id).toBe('proyectos')
  })
})

describe('enlaces con ámbito', () => {
  it('une la consulta en vez de pegar «?p=»', () => {
    expect(scopedHref('/tareas?filtro=bloqueadas', { scope: 'idt' })).toBe('/tareas?filtro=bloqueadas&p=idt')
  })

  it('en la ficha lleva a la pestaña del proyecto', () => {
    expect(scopedHref('/tareas?filtro=bloqueadas', { projectSlug: 'idt' })).toBe('/proyectos/idt/tareas?filtro=bloqueadas')
    expect(scopedHref('/?ver=fechas', { projectSlug: 'idt' })).toBe('/proyectos/idt?ver=fechas')
    // La actividad del Panel es, en la ficha, la pestaña Historial.
    expect(scopedHref('/?ver=actividad&quien=ana', { projectSlug: 'idt' })).toBe('/proyectos/idt/historial?quien=ana')
    // Ajustes no tiene pestaña: se queda en el estudio.
    expect(scopedHref('/ajustes', { projectSlug: 'idt' })).toBe('/ajustes')
  })

  it('la página de una etiqueta conserva el proyecto, también desde su ficha', () => {
    expect(scopedHref('/etiquetas/demo', { scope: 'idt' })).toBe('/etiquetas/demo?p=idt')
    expect(scopedHref('/etiquetas/demo', { projectSlug: 'idt', scope: 'idt' })).toBe('/etiquetas/demo?p=idt')
    expect(scopedHref('/etiquetas/demo', {})).toBe('/etiquetas/demo')
  })

  it('Proyectos y Ajustes no llevan ámbito', () => {
    expect(scopedHref('/proyectos?estado=activos', { scope: 'idt' })).toBe('/proyectos?estado=activos')
    expect(scopedHref('/ajustes', { scope: 'idt' })).toBe('/ajustes')
  })
})

describe('rutas antiguas', () => {
  it('lleva las rutas de antes a las de ahora conservando la consulta', () => {
    expect(migratePath('/hoy')).toBe('/tareas?vista=hoy')
    expect(migratePath('/trabajo?estado=blocked&p=idt')).toBe('/tareas?p=idt&filtro=bloqueadas')
    expect(migratePath('/decisiones?p=idt')).toBe('/documentacion?tipo=decisiones&p=idt')
    expect(migratePath('/proyectos/idt/trabajo?vista=tablero')).toBe('/proyectos/idt/tareas?vista=tablero')
    // «Historial» vuelve a ser una pestaña: el registro de cambios del proyecto.
    expect(migratePath('/proyectos/idt/historial')).toBe('/proyectos/idt/historial')
  })

  it('no toca las rutas de ahora', () => {
    for (const s of allSections()) for (const c of s.children) expect(migratePath(c.to)).toBe(c.to)
  })
})
