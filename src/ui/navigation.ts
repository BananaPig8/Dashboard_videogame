// El mapa de la aplicación: las secciones del estudio, sus subsecciones y las cosas que se
// pueden crear desde cualquier sitio. De aquí salen la barra lateral, la paleta (Ctrl K),
// las migas y las pestañas de cada página. Añadir una sección o una subsección es añadir
// una entrada aquí (y su página).
//
// Las subsecciones son vistas de la misma página (la consulta de la URL: ?vista=, ?tipo=,
// ?filtro=, ?estado=…), no pantallas sueltas: todas leen los mismos datos y conservan el
// ámbito (todo el estudio o un proyecto).
import { tr } from '../i18n'
import type { CollectionKey } from '../data/store'
import type { IconName } from './components/Icon'
import type { WidgetId } from './prefs'

export type SectionId =
  | 'panel'
  | 'proyectos'
  | 'tareas'
  | 'roadmap'
  | 'calendario'
  | 'builds'
  | 'publicacion'
  | 'feedback'
  | 'eventos'
  | 'documentacion'
  | 'recursos'
  | 'equipo'
  | 'finanzas'
  | 'estadisticas'
  | 'ajustes'

export interface NavChild {
  id: string
  readonly label: string
  /** El parámetro de la URL que elige esta subsección (vista, filtro, tipo, canal…). */
  facet: string
  /** Su valor; null = sin el parámetro (lo que la página enseña por defecto). */
  value: string | null
  /** Vista aparte (otra página dentro de la sección): al entrar se quitan las demás facetas. */
  solo?: boolean
  /** Desde fuera de la sección: la raíz con solo este parámetro («/tareas?vista=tablero»). */
  to: string
}

export interface NavSection {
  id: SectionId
  readonly label: string
  /** Nombre corto para la pestaña de la ficha de un proyecto. */
  readonly tabLabel: string
  icon: IconName
  /** La raíz de la sección. */
  to: string
  /** Pestaña de la ficha de proyecto; sin ella, la sección no está en la ficha. */
  tab?: string
  children: NavChild[]
  /** Se puede ocultar desde Ajustes (Panel, Proyectos, Tareas y Ajustes no). */
  optional?: boolean
}

export interface NavGroup {
  id: string
  readonly title: string
  sections: NavSection[]
}

/** [id, faceta, valor, «solo»]: una subsección. El nombre sale de nav.children.<sección>.<id>. */
type ChildDef = [id: string, facet: string, value: string | null, solo?: 'solo']

const section = (s: Omit<NavSection, 'label' | 'tabLabel' | 'children'> & { children: ChildDef[] }): NavSection => ({
  ...s,
  children: s.children.map(([id, facet, value, solo]) => ({
    id,
    facet,
    value,
    solo: solo === 'solo' || undefined,
    to: value === null ? s.to : `${s.to}?${new URLSearchParams({ [facet]: value })}`,
    get label() {
      return tr(`nav.children.${s.id}.${id}`)
    },
  })),
  get label() {
    return tr(`nav.sections.${s.id}`)
  },
  get tabLabel() {
    return tr(`nav.tabs.${s.id}`)
  },
})

const group = (id: string, sections: NavSection[]): NavGroup => ({
  id,
  sections,
  get title() {
    return tr(`nav.groups.${id}`)
  },
})

const TREE: NavGroup[] = [
  group('estudio', [
    section({
      id: 'panel',
      icon: 'home',
      to: '/',
      tab: 'resumen',
      children: [
        ['resumen', 'ver', null],
        ['actividad', 'ver', 'actividad'],
        ['fechas', 'ver', 'fechas'],
        ['prioritarias', 'ver', 'prioritarias'],
        ['proyectos', 'ver', 'proyectos'],
        ['alertas', 'ver', 'alertas'],
      ],
    }),
    section({
      id: 'proyectos',
      icon: 'folder',
      to: '/proyectos',
      children: [
        ['todos', 'estado', null],
        ['activos', 'estado', 'activos'],
        ['planificacion', 'estado', 'planificacion'],
        ['pausa', 'estado', 'pausa'],
        ['lanzados', 'estado', 'lanzados'],
        ['archivados', 'estado', 'archivados'],
      ],
    }),
  ]),
  group('trabajo', [
    section({
      id: 'tareas',
      icon: 'list',
      to: '/tareas',
      tab: 'tareas',
      children: [
        ['hoy', 'vista', 'hoy', 'solo'],
        ['mias', 'filtro', 'mias'],
        ['todas', 'filtro', null],
        ['tablero', 'vista', 'tablero'],
        ['lista', 'vista', null],
        ['calendario', 'vista', 'calendario'],
        ['bloqueadas', 'filtro', 'bloqueadas'],
        ['vencidas', 'filtro', 'vencidas'],
      ],
    }),
    section({
      id: 'roadmap',
      icon: 'map',
      to: '/roadmap',
      tab: 'roadmap',
      optional: true,
      children: [
        ['hitos', 'vista', null],
        ['fases', 'vista', 'fases'],
        ['objetivos', 'vista', 'objetivos'],
        ['versiones', 'vista', 'versiones'],
        ['linea', 'vista', 'linea'],
      ],
    }),
    section({
      id: 'calendario',
      icon: 'calendar',
      to: '/calendario',
      tab: 'calendario',
      optional: true,
      children: [
        ['todo', 'tipo', null],
        ['limites', 'tipo', 'limites'],
        ['entregas', 'tipo', 'entregas'],
        ['eventos', 'tipo', 'eventos'],
        ['festivales', 'tipo', 'festivales'],
        ['reuniones', 'tipo', 'reuniones'],
        ['publicacion', 'tipo', 'publicacion'],
        ['recordatorios', 'tipo', 'recordatorios'],
      ],
    }),
  ]),
  group('produccion', [
    section({
      id: 'builds',
      icon: 'box',
      to: '/builds',
      tab: 'builds',
      optional: true,
      children: [
        ['todas', 'canal', null],
        ['desarrollo', 'canal', 'desarrollo'],
        ['pruebas', 'canal', 'pruebas'],
        ['demos', 'canal', 'demos'],
        ['publicas', 'canal', 'publicas'],
        ['candidatas', 'canal', 'candidatas'],
        ['cambios', 'vista', 'cambios', 'solo'],
        ['incidencias', 'vista', 'incidencias', 'solo'],
      ],
    }),
    section({
      id: 'publicacion',
      icon: 'rocket',
      to: '/publicacion',
      tab: 'publicacion',
      optional: true,
      children: [
        ['steam', 'vista', null],
        ['lanzamiento', 'vista', 'lanzamiento'],
        ['materiales', 'vista', 'materiales'],
        ['descripciones', 'vista', 'descripciones'],
        ['capturas', 'vista', 'capturas'],
        ['logros', 'vista', 'logros'],
        ['dlc', 'vista', 'dlc'],
        ['estado', 'vista', 'estado'],
      ],
    }),
    section({
      id: 'feedback',
      icon: 'message',
      to: '/feedback',
      tab: 'feedback',
      optional: true,
      children: [
        ['todo', 'tipo', null],
        ['comentarios', 'tipo', 'comentarios'],
        ['informes', 'vista', 'informes', 'solo'],
        ['bugs', 'tipo', 'bugs'],
        ['mejoras', 'tipo', 'mejoras'],
        ['priorizacion', 'vista', 'priorizacion'],
        ['cambios', 'vista', 'cambios'],
      ],
    }),
    section({
      id: 'eventos',
      icon: 'ticket',
      to: '/eventos',
      tab: 'eventos',
      optional: true,
      children: [
        ['todos', 'tipo', null],
        ['ferias', 'tipo', 'ferias'],
        ['festivales', 'tipo', 'festivales'],
        ['premios', 'tipo', 'premios'],
        ['presentaciones', 'tipo', 'presentaciones'],
        ['inscripciones', 'vista', 'inscripciones'],
        ['materiales', 'vista', 'materiales'],
        ['seguimiento', 'vista', 'seguimiento'],
      ],
    }),
  ]),
  group('conocimiento', [
    section({
      id: 'documentacion',
      icon: 'fileText',
      to: '/documentacion',
      tab: 'documentacion',
      optional: true,
      children: [
        ['todo', 'tipo', null],
        ['diseno', 'tipo', 'diseno'],
        ['tecnica', 'tipo', 'tecnica'],
        ['notas', 'tipo', 'notas'],
        ['decisiones', 'tipo', 'decisiones', 'solo'],
        ['actas', 'tipo', 'actas'],
        ['guias', 'tipo', 'guias'],
        ['enlaces', 'tipo', 'enlaces'],
      ],
    }),
    section({
      id: 'recursos',
      icon: 'image',
      to: '/recursos',
      tab: 'recursos',
      optional: true,
      children: [
        ['todo', 'tipo', null],
        ['capturas', 'tipo', 'capturas'],
        ['videos', 'tipo', 'videos'],
        ['imagenes', 'tipo', 'imagenes'],
        ['logos', 'tipo', 'logos'],
        ['documentos', 'tipo', 'documentos'],
        ['enlaces', 'tipo', 'enlaces'],
        ['arte', 'tipo', 'arte'],
        ['referencia', 'tipo', 'referencia'],
      ],
    }),
  ]),
  group('gestion', [
    section({
      id: 'equipo',
      icon: 'users',
      to: '/equipo',
      tab: 'equipo',
      optional: true,
      children: [
        ['miembros', 'vista', null],
        ['responsabilidades', 'vista', 'responsabilidades'],
        ['asignaciones', 'vista', 'asignaciones'],
        ['carga', 'vista', 'carga'],
        ['externos', 'vista', 'externos'],
      ],
    }),
    section({
      id: 'finanzas',
      icon: 'wallet',
      to: '/finanzas',
      tab: 'finanzas',
      optional: true,
      children: [
        ['resumen', 'vista', null],
        ['gastos', 'vista', 'gastos'],
        ['ingresos', 'vista', 'ingresos'],
        ['presupuestos', 'vista', 'presupuestos'],
        ['proyectos', 'vista', 'proyectos'],
        ['eventos', 'vista', 'eventos'],
        ['informes', 'vista', 'informes'],
      ],
    }),
    section({
      id: 'estadisticas',
      icon: 'chart',
      to: '/estadisticas',
      tab: 'estadisticas',
      optional: true,
      children: [
        ['progreso', 'vista', null],
        ['tareas', 'vista', 'tareas'],
        ['hitos', 'vista', 'hitos'],
        ['tiempo', 'vista', 'tiempo'],
        ['actividad', 'vista', 'actividad'],
        ['lanzamiento', 'vista', 'lanzamiento'],
        ['comerciales', 'vista', 'comerciales'],
      ],
    }),
  ]),
]

/** Ajustes va aparte, al pie de la barra lateral. */
const SETTINGS: NavSection = section({
  id: 'ajustes',
  icon: 'settings',
  to: '/ajustes',
  children: [
    ['estudio', 'seccion', null],
    ['preferencias', 'seccion', 'preferencias'],
    ['categorias', 'seccion', 'categorias'],
    ['estados', 'seccion', 'estados'],
    ['integraciones', 'seccion', 'integraciones'],
    ['seguridad', 'seccion', 'seguridad'],
    ['datos', 'seccion', 'datos'],
  ],
})

/** Qué bloque del panel enseña cada subsección (?ver=): modo foco, sin tocar las preferencias. */
export const PANEL_FOCUS: Record<string, WidgetId[]> = {
  actividad: ['recent'],
  fechas: ['agenda'],
  prioritarias: ['today', 'blocked'],
  proyectos: ['projects'],
  alertas: ['attention'],
}

/** Los grupos de la barra lateral, sin las secciones que el estudio ha ocultado. */
export function navGroups(hidden: readonly string[] = []): NavGroup[] {
  return TREE.map((g) => ({ ...g, title: g.title, sections: g.sections.filter((s) => !isHidden(s, hidden)) })).filter((g) => g.sections.length > 0)
}

/** Una sección oculta en Ajustes (solo las opcionales se pueden ocultar). */
export function isHidden(s: NavSection, hidden: readonly string[]): boolean {
  return !!s.optional && hidden.includes(s.id)
}

export function settingsSection(): NavSection {
  return SETTINGS
}

/** Todas las secciones, en orden (Ajustes al final). */
export function allSections(): NavSection[] {
  return [...TREE.flatMap((g) => g.sections), SETTINGS]
}

export function sectionById(id: SectionId): NavSection {
  return allSections().find((s) => s.id === id)!
}

/** Las secciones que tienen pestaña en la ficha de un proyecto, en orden (sin las ocultas). */
export function projectTabs(hidden: readonly string[] = []): NavSection[] {
  return allSections().filter((s) => s.tab && !isHidden(s, hidden))
}

// ——— Dónde estoy ————————————————————————————————————————————————————————————

/** Dónde se está: en el estudio (con ámbito o sin él) o en la ficha de un proyecto. */
export interface Here {
  projectSlug?: string
  scope?: string | null
}

const PROJECT_PATH = /^\/proyectos\/([^/]+)(?:\/([^/]+))?\/?$/

function split(to: string): { path: string; params: URLSearchParams } {
  const i = to.indexOf('?')
  return i < 0 ? { path: to, params: new URLSearchParams() } : { path: to.slice(0, i), params: new URLSearchParams(to.slice(i + 1)) }
}

const join = (path: string, params: URLSearchParams) => {
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/**
 * La sección de una ruta del estudio («/tareas») o de la ficha de un proyecto
 * («/proyectos/<slug>/tareas»; sin pestaña, el resumen = Panel).
 */
export function sectionOfPath(pathname: string): NavSection | undefined {
  const inProject = pathname.match(PROJECT_PATH)
  if (inProject) {
    const tab = inProject[2] ?? 'resumen'
    return projectTabs().find((s) => s.tab === tab)
  }
  if (pathname === '/') return allSections()[0]
  return allSections().find((s) => s.to !== '/' && (pathname === s.to || pathname.startsWith(`${s.to}/`)))
}

/** Las facetas de una sección que no tienen subsección «por defecto»: se quitan al volver a la raíz. */
function orphanFacets(s: NavSection): Set<string> {
  const facets = new Set(s.children.map((c) => c.facet))
  for (const c of s.children) if (c.value === null) facets.delete(c.facet)
  return facets
}

/** ¿El valor de esta faceta en la URL es el de una vista aparte? */
const soloActive = (s: NavSection, params: URLSearchParams) => s.children.some((c) => c.solo && params.get(c.facet) === c.value)

/**
 * Los parámetros de la URL tras elegir una subsección estando en `search` (dentro de la
 * sección): cambia solo su faceta y conserva las demás; una vista aparte las quita todas, y
 * al salir de una vista aparte se quita ella.
 */
export function childParams(s: NavSection, c: NavChild, search: string): URLSearchParams {
  const params = new URLSearchParams(search)
  const facets = new Set(s.children.map((x) => x.facet))
  if (c.solo || soloActive(s, params)) for (const f of facets) params.delete(f)
  if (c.value === null) {
    params.delete(c.facet)
    for (const f of orphanFacets(s)) params.delete(f)
  } else params.set(c.facet, c.value)
  return params
}

/** Solo las facetas de la sección, para comparar dos URL. */
function facetKey(s: NavSection, params: URLSearchParams): string {
  const facets = [...new Set(s.children.map((c) => c.facet))].sort()
  return facets.map((f) => `${f}=${params.get(f) ?? ''}`).join('&')
}

/**
 * Las subsecciones activas: las que, al pulsarlas, no cambiarían lo que se ve. Puede haber
 * una por faceta («Mis tareas» y «Tablero» a la vez).
 */
export function activeChildren(s: NavSection, search: string): NavChild[] {
  const now = facetKey(s, new URLSearchParams(search))
  return s.children.filter((c) => facetKey(s, childParams(s, c, search)) === now)
}

/** La subsección principal activa (la primera de las activas que lleva parámetro, o la de por defecto). */
export function activeChild(s: NavSection, search: string): NavChild | undefined {
  const active = activeChildren(s, search)
  return active.find((c) => c.value !== null) ?? active[0]
}

/** ¿Estoy en la raíz de la sección (sin ninguna faceta)? */
export function atSectionRoot(s: NavSection, search: string): boolean {
  const params = new URLSearchParams(search)
  return s.children.every((c) => !params.has(c.facet))
}

/**
 * Lleva una ruta del estudio al ámbito de aquí: en la ficha de un proyecto, a su pestaña
 * (si la sección la tiene); en el estudio con un proyecto elegido, con ?p=. Une la consulta
 * con URLSearchParams (nunca pega «?p=» a mano).
 */
export function scopedHref(to: string, here: Here): string {
  const { path, params } = split(to)
  // La página de una etiqueta no es de ninguna sección: el proyecto va siempre con ?p=.
  if (path.startsWith('/etiquetas/')) {
    const scope = here.scope ?? undefined
    if (scope) params.set('p', scope)
    return join(path, params)
  }
  const s = sectionOfPath(path)
  if (here.projectSlug && !path.startsWith('/proyectos')) {
    if (s?.tab) {
      params.delete('p')
      return join(s.tab === 'resumen' ? `/proyectos/${here.projectSlug}` : `/proyectos/${here.projectSlug}/${s.tab}`, params)
    }
    return join(path, params)
  }
  if (here.scope && s && s.id !== 'proyectos' && s.id !== 'ajustes' && !path.startsWith('/proyectos/')) params.set('p', here.scope)
  return join(path, params)
}

/**
 * Adónde lleva una subsección desde aquí. Si ya estoy en su sección (`search` dado),
 * conserva las demás facetas y los filtros; si no, va a la raíz con solo ese parámetro.
 */
export function childHref(s: NavSection, c: NavChild, here: Here, search?: string): string {
  if (search === undefined) return scopedHref(c.to, here)
  const params = childParams(s, c, search)
  return scopedHref(join(s.to, params), { ...here, scope: here.projectSlug ? undefined : here.scope })
}

/** La raíz de una sección desde aquí. */
export function sectionHref(s: NavSection, here: Here): string {
  return scopedHref(s.to, here)
}

/** La página de una etiqueta: todo lo que la lleva, de cualquier colección. */
export const tagPath = (tag: string) => `/etiquetas/${encodeURIComponent(tag)}`

/** La misma ruta con los parámetros ordenados (para comparar vistas guardadas). */
export function normalizePath(to: string): string {
  const { path, params } = split(to)
  params.sort()
  return join(path, params)
}

/** Parámetros de la URL que no eligen subsección (el ámbito, la búsqueda, la etiqueta y cómo se pinta). */
const NOT_A_VIEW = new Set(['p', 'q', 'etiqueta', 'mostrar'])

/** ¿Hay en la URL algún parámetro que elija vista? (para saber si una vista guardada es solo un filtro). */
export function viewParams(search: string): string[] {
  return [...new URLSearchParams(search).keys()].filter((k) => !NOT_A_VIEW.has(k))
}

// ——— Rutas antiguas —————————————————————————————————————————————————————————

/** Rutas de la versión anterior → las de ahora (la consulta de la antigua se conserva). */
const OLD_ROUTES: Record<string, string> = {
  '/hoy': '/tareas?vista=hoy',
  '/trabajo': '/tareas',
  '/agenda': '/calendario',
  '/decisiones': '/documentacion?tipo=decisiones',
  '/historial': '/builds?vista=cambios',
}

/** Las rutas antiguas que redirigen (App las registra). */
export const OLD_PATHS = Object.keys(OLD_ROUTES)

/** ¿Es una pestaña antigua de la ficha de un proyecto? */
export const isOldTab = (tab: string) => tab in OLD_TABS

/** Pestañas antiguas de la ficha de un proyecto. */
const OLD_TABS: Record<string, string> = {
  trabajo: 'tareas',
  agenda: 'calendario',
  decisiones: 'documentacion?tipo=decisiones',
  historial: 'builds?vista=cambios',
}

/** Valores antiguos de Tareas (?estado=blocked del panel) → las subsecciones de ahora. */
function migrateTaskParams(params: URLSearchParams) {
  if (params.get('estado') === 'blocked' && !params.has('filtro')) {
    params.delete('estado')
    params.set('filtro', 'bloqueadas')
  }
  if (params.get('vista') === 'lista') params.delete('vista')
}

const merge = (target: string, extra: URLSearchParams) => {
  const { path, params } = split(target)
  for (const [k, v] of extra) if (!params.has(k)) params.set(k, v)
  return { path, params }
}

/**
 * Reescribe una ruta de la versión anterior (o con valores antiguos) a la de ahora. La usan
 * las redirecciones, la ficha de proyecto y las vistas guardadas. Si no hay nada que
 * cambiar, devuelve la misma ruta.
 */
export function migratePath(to: string): string {
  const { path, params } = split(to)
  let next = { path, params }
  if (OLD_ROUTES[path]) next = merge(OLD_ROUTES[path], params)
  const tab = path.match(PROJECT_PATH)
  if (tab && tab[2] && OLD_TABS[tab[2]]) next = merge(`/proyectos/${tab[1]}/${OLD_TABS[tab[2]]}`, params)
  if (next.path === '/tareas' || /^\/proyectos\/[^/]+\/tareas$/.test(next.path)) migrateTaskParams(next.params)
  const out = join(next.path, next.params)
  return out === to ? to : out
}

export interface QuickCreate {
  id: string
  readonly label: string
  icon: IconName
  collection: CollectionKey
  defaults?: Record<string, unknown>
  /** Grupo del menú «Nuevo» (se separan con una raya). */
  group: 'trabajo' | 'produccion' | 'estudio'
  /** Si la sección está oculta en Ajustes, tampoco se ofrece crear aquí. */
  section?: SectionId
}

const quick = (
  group: QuickCreate['group'],
  id: string,
  icon: IconName,
  collection: CollectionKey,
  defaults?: Record<string, unknown>,
  section?: SectionId,
): QuickCreate => ({
  id,
  icon,
  collection,
  defaults,
  group,
  section,
  get label() {
    return tr(`quick.${id}`)
  },
})

/** Lo que se puede crear desde cualquier pantalla (botón «Nuevo» y paleta). */
export function quickCreate(hidden: readonly string[] = []): QuickCreate[] {
  return [
    quick('trabajo', 'task', 'check', 'items', { kind: 'task' }),
    quick('trabajo', 'decision', 'scale', 'items', { kind: 'decision', status: 'to_confirm' }),
    quick('trabajo', 'issue', 'bug', 'items', { kind: 'issue', priority: 'high' }),
    quick('trabajo', 'reminder', 'bell', 'reminders'),
    quick('produccion', 'event', 'calendar', 'events'),
    quick('produccion', 'build', 'box', 'builds'),
    quick('produccion', 'release', 'rocket', 'releases'),
    quick('produccion', 'playtest', 'users', 'playtests'),
    quick('produccion', 'feedback', 'message', 'feedback'),
    quick('estudio', 'resource', 'book', 'resources'),
    quick('estudio', 'checklist', 'list', 'checklists'),
    quick('estudio', 'timeEntry', 'clock', 'timeEntries', undefined, 'equipo'),
    quick('estudio', 'member', 'users', 'members', undefined, 'equipo'),
    quick('estudio', 'transaction', 'wallet', 'transactions', undefined, 'finanzas'),
    quick('estudio', 'metric', 'chart', 'metrics', undefined, 'estadisticas'),
    quick('estudio', 'project', 'folder', 'projects'),
  ].filter((q) => !q.section || !hidden.includes(q.section))
}
