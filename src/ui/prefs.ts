// Preferencias de quien usa el panel en este navegador: aspecto, panel, región y vistas
// guardadas. No van con los datos del estudio (cada persona puede tener las suyas).
import { useSyncExternalStore } from 'react'
import { DEFAULT_TIME_ZONE, setClockTimeZone, type WeekStart } from '../domain/dates'
import { DEFAULT_LOCALE, setLocale, type Locale } from '../i18n'
import type { DateFormat, HourCycle } from '../i18n/format'
import { migratePath } from './navigation'

export type ThemePref = 'dark' | 'light' | 'system'
export type Density = 'comfortable' | 'compact'

/** Los bloques del Dashboard (sections/panel/widgets). */
export type WidgetId =
  | 'kpis'
  | 'priorities'
  | 'projects'
  | 'agenda'
  | 'attention'
  | 'launch'
  | 'feedback'
  | 'activity'
  | 'builds'
  | 'evolution'
  | 'decisions'
  | 'resources'

/** Orden por defecto: las cifras y lo urgente arriba; lo que se consulta de vez en cuando, abajo. */
export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'kpis',
  'priorities',
  'projects',
  'agenda',
  'attention',
  'launch',
  'feedback',
  'activity',
  'builds',
  'evolution',
  'decisions',
  'resources',
]

/** Bloques de versiones anteriores y en cuál han quedado. */
const OLD_WIDGETS: Record<string, WidgetId> = { today: 'priorities', blocked: 'priorities', publish: 'launch', recent: 'activity' }

/** Ancho de un bloque: una columna o las dos. Las cifras ocupan siempre las dos. */
export type WidgetSize = 'normal' | 'wide'

export const DEFAULT_WIDGET_SIZES: Partial<Record<WidgetId, WidgetSize>> = { priorities: 'wide', projects: 'wide', evolution: 'wide' }

/** Las tarjetas de indicadores del Dashboard. */
export type KpiId =
  | 'activeProjects'
  | 'pending'
  | 'completed'
  | 'overdue'
  | 'blocked'
  | 'milestonesSoon'
  | 'milestonesDone'
  | 'eventsSoon'
  | 'recentBuilds'
  | 'feedbackNew'

export const DEFAULT_KPI_ORDER: KpiId[] = [
  'activeProjects',
  'pending',
  'completed',
  'overdue',
  'blocked',
  'milestonesSoon',
  'milestonesDone',
  'eventsSoon',
  'recentBuilds',
  'feedbackNew',
]

/** Cómo quiere ver cada persona su Dashboard. */
export interface DashboardLayout {
  order: WidgetId[]
  hidden: WidgetId[]
  collapsed: WidgetId[]
  sizes: Partial<Record<WidgetId, WidgetSize>>
  kpis: { order: KpiId[]; hidden: KpiId[] }
  /** El calendario resumido: lista o calendario compacto. */
  agendaView: 'list' | 'calendar'
}

export const DEFAULT_DASHBOARD: DashboardLayout = {
  order: DEFAULT_WIDGET_ORDER,
  hidden: [],
  collapsed: [],
  sizes: DEFAULT_WIDGET_SIZES,
  kpis: { order: DEFAULT_KPI_ORDER, hidden: [] },
  agendaView: 'list',
}

/** La disposición de quien no ha dicho quién es (o de todo el que use este navegador). */
export const ANYONE = '_'

export interface SavedView {
  id: string
  name: string
  /** Ruta de la aplicación con sus filtros, p. ej. «/trabajo?estado=blocked&p=indie-dev-tycoon». */
  path: string
  createdAt: string
}

export interface Preferences {
  theme: ThemePref
  /** Id de un acento predefinido o un color «#rrggbb». */
  accent: string
  density: Density
  sidebarCollapsed: boolean
  /** Secciones de la barra lateral desplegadas a mano (la activa siempre lo está). */
  navExpanded: string[]
  /** Secciones activas que se han plegado a mano. */
  navFolded: string[]
  /** Secciones opcionales que el estudio no usa y no salen en la barra lateral. */
  hiddenSections: string[]
  /** Quién soy en el equipo (para «Mis tareas»), en este navegador. */
  meId?: string
  /** La disposición del Dashboard de cada persona («Quién soy»), o la de ANYONE. */
  dashboards: Record<string, DashboardLayout>
  savedViews: SavedView[]
  locale: Locale
  timeZone: string
  dateFormat: DateFormat
  hourCycle: HourCycle
  weekStart: WeekStart
  /** Notificaciones ya vistas. */
  readNotifications: string[]
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  accent: 'violet',
  density: 'comfortable',
  sidebarCollapsed: false,
  navExpanded: [],
  navFolded: [],
  hiddenSections: [],
  dashboards: {},
  savedViews: [],
  locale: DEFAULT_LOCALE,
  timeZone: DEFAULT_TIME_ZONE,
  dateFormat: 'short',
  hourCycle: 'h23',
  weekStart: 1,
  readNotifications: [],
}

export const PREFS_KEY = 'studio-hub:preferencias'

const strings = (list: unknown): string[] => (Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])

const WIDGET_IDS = new Set<string>(DEFAULT_WIDGET_ORDER)
const KPI_IDS = new Set<string>(DEFAULT_KPI_ORDER)

/** Los bloques de una lista guardada, con los de versiones anteriores ya en su bloque de ahora. */
function widgetIds(list: unknown): WidgetId[] {
  if (!Array.isArray(list)) return []
  const out = list.map((x) => (typeof x === 'string' ? (OLD_WIDGETS[x] ?? x) : x)).filter((x): x is WidgetId => typeof x === 'string' && WIDGET_IDS.has(x))
  return [...new Set(out)]
}

/** Una disposición guardada, completada con lo que falte (bloques o cifras nuevos, al final). */
export function sanitizeLayout(raw: unknown): DashboardLayout {
  const l = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof DashboardLayout, unknown>>
  const order = widgetIds(l.order)
  for (const w of DEFAULT_WIDGET_ORDER) if (!order.includes(w)) order.push(w)
  const sizes: Partial<Record<WidgetId, WidgetSize>> = { ...DEFAULT_WIDGET_SIZES }
  if (l.sizes && typeof l.sizes === 'object')
    for (const [w, size] of Object.entries(l.sizes as Record<string, unknown>))
      if (WIDGET_IDS.has(w) && (size === 'normal' || size === 'wide')) sizes[w as WidgetId] = size
  const k = (l.kpis && typeof l.kpis === 'object' ? l.kpis : {}) as { order?: unknown; hidden?: unknown }
  const kpiIds = (list: unknown) => (Array.isArray(list) ? [...new Set(list.filter((x): x is KpiId => typeof x === 'string' && KPI_IDS.has(x)))] : [])
  const kpiOrder = kpiIds(k.order)
  for (const id of DEFAULT_KPI_ORDER) if (!kpiOrder.includes(id)) kpiOrder.push(id)
  return {
    order,
    hidden: widgetIds(l.hidden),
    collapsed: widgetIds(l.collapsed),
    sizes,
    kpis: { order: kpiOrder, hidden: kpiIds(k.hidden) },
    agendaView: l.agendaView === 'calendar' ? 'calendar' : 'list',
  }
}

/** Completa lo que falte y descarta lo que no se entienda (preferencias de otra versión). */
export function sanitizePreferences(raw: unknown): Preferences {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Preferences>
  const d = DEFAULT_PREFERENCES
  // Las preferencias de antes guardaban una sola disposición en «widgets»: pasa a ser la de ANYONE.
  const old = (p as { widgets?: unknown }).widgets
  const rawDashboards = p.dashboards && typeof p.dashboards === 'object' ? (p.dashboards as Record<string, unknown>) : old ? { [ANYONE]: old } : {}
  const dashboards: Record<string, DashboardLayout> = {}
  for (const [who, layout] of Object.entries(rawDashboards).slice(0, 50)) if (typeof who === 'string' && who) dashboards[who] = sanitizeLayout(layout)
  return {
    theme: p.theme === 'light' || p.theme === 'system' || p.theme === 'dark' ? p.theme : d.theme,
    accent: typeof p.accent === 'string' && (p.accent in ACCENTS || /^#[0-9a-f]{6}$/i.test(p.accent)) ? p.accent : d.accent,
    density: p.density === 'compact' ? 'compact' : 'comfortable',
    sidebarCollapsed: !!p.sidebarCollapsed,
    navExpanded: strings(p.navExpanded).slice(0, 30),
    navFolded: strings(p.navFolded).slice(0, 30),
    hiddenSections: strings(p.hiddenSections).slice(0, 30),
    meId: typeof p.meId === 'string' && p.meId ? p.meId : undefined,
    dashboards,
    // Las vistas guardadas con rutas de la versión anterior se reescriben a las de ahora.
    savedViews: Array.isArray(p.savedViews)
      ? p.savedViews
          .filter((v) => v && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.path === 'string' && v.path.startsWith('/'))
          .map((v) => ({ ...v, path: migratePath(v.path) }))
      : [],
    locale: p.locale === 'es' ? p.locale : d.locale,
    timeZone: typeof p.timeZone === 'string' && p.timeZone ? p.timeZone : d.timeZone,
    dateFormat: p.dateFormat && ['short', 'numeric', 'long', 'iso'].includes(p.dateFormat) ? p.dateFormat : d.dateFormat,
    hourCycle: p.hourCycle === 'h12' ? 'h12' : 'h23',
    weekStart: p.weekStart === 0 ? 0 : 1,
    readNotifications: Array.isArray(p.readNotifications) ? p.readNotifications.filter((x) => typeof x === 'string').slice(-500) : [],
  }
}

// ——— Colores de acento ————————————————————————————————————————————————————

export interface AccentPreset {
  name: string
  dark: string
  light: string
}

/** Acentos con contraste comprobado sobre el fondo de cada tema. */
export const ACCENTS: Record<string, AccentPreset> = {
  violet: { name: 'Violeta', dark: '#9b8cff', light: '#6d4fe0' },
  blue: { name: 'Azul eléctrico', dark: '#5b9dff', light: '#1f63e0' },
  green: { name: 'Verde', dark: '#3ccf8e', light: '#127443' },
  teal: { name: 'Turquesa', dark: '#2fc4d6', light: '#0b7a8c' },
  pink: { name: 'Rosa', dark: '#f472b6', light: '#c0266d' },
}

/** Luminancia relativa (WCAG) de un color «#rrggbb». */
export function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** El color del acento en ese tema y el del texto que va encima (el que más contraste dé). */
export function resolveAccent(accent: string, theme: 'dark' | 'light'): { color: string; onColor: string } {
  const color = ACCENTS[accent]?.[theme] ?? (/^#[0-9a-f]{6}$/i.test(accent) ? accent : ACCENTS.violet[theme])
  const onColor = contrast(color, '#0b0d12') >= contrast(color, '#ffffff') ? '#0b0d12' : '#ffffff'
  return { color, onColor }
}

// ——— El almacén ——————————————————————————————————————————————————————————

function load(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return sanitizePreferences(raw ? JSON.parse(raw) : {})
  } catch {
    return DEFAULT_PREFERENCES
  }
}

let prefs: Preferences = DEFAULT_PREFERENCES
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

/** Aplica lo que no es React: zona horaria, idioma y aspecto del documento. */
function applyGlobals(p: Preferences) {
  setClockTimeZone(p.timeZone)
  setLocale(p.locale)
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const theme = resolvedTheme(p.theme)
  root.dataset.theme = theme
  root.dataset.density = p.density
  root.lang = p.locale
  const { color, onColor } = resolveAccent(p.accent, theme)
  root.style.setProperty('--accent', color)
  root.style.setProperty('--accent-text', onColor)
}

function systemPrefersLight(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: light)').matches
}

export function resolvedTheme(theme: ThemePref): 'dark' | 'light' {
  if (theme === 'system') return systemPrefersLight() ? 'light' : 'dark'
  return theme
}

/** Carga las preferencias y las aplica. Se llama una vez al arrancar. */
export function initPreferences(): void {
  prefs = load()
  applyGlobals(prefs)
  if (typeof window === 'undefined') return
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (prefs.theme === 'system') {
      applyGlobals(prefs)
      emit()
    }
  })
  window.addEventListener('storage', (e) => {
    if (e.key === PREFS_KEY) {
      prefs = load()
      applyGlobals(prefs)
      emit()
    }
  })
}

export function getPreferences(): Preferences {
  return prefs
}

export function updatePreferences(change: Partial<Preferences> | ((p: Preferences) => Partial<Preferences>)): void {
  const patch = typeof change === 'function' ? change(prefs) : change
  prefs = sanitizePreferences({ ...prefs, ...patch })
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Sin almacenamiento (modo privado): valen para esta visita.
  }
  applyGlobals(prefs)
  emit()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences)
}

/** De quién es la disposición del Dashboard que se ve: la de «Quién soy», o la de cualquiera. */
export const dashboardKey = (p: Preferences): string => p.meId ?? ANYONE

/** La disposición de quien mira; si aún no tiene la suya, la de cualquiera (y si no, la de serie). */
export function dashboardOf(p: Preferences): DashboardLayout {
  return p.dashboards[dashboardKey(p)] ?? p.dashboards[ANYONE] ?? DEFAULT_DASHBOARD
}

export function useDashboardLayout(): DashboardLayout {
  return dashboardOf(usePreferences())
}

/** Cambia la disposición de quien mira (la primera vez, parte de la que estaba viendo). */
export function updateDashboardLayout(change: (l: DashboardLayout) => Partial<DashboardLayout>): void {
  updatePreferences((p) => {
    const current = dashboardOf(p)
    return { dashboards: { ...p.dashboards, [dashboardKey(p)]: sanitizeLayout({ ...current, ...change(current) }) } }
  })
}

/** Vuelve a la disposición de serie (solo la de quien mira). */
export function resetDashboardLayout(): void {
  updatePreferences((p) => ({ dashboards: { ...p.dashboards, [dashboardKey(p)]: DEFAULT_DASHBOARD } }))
}
