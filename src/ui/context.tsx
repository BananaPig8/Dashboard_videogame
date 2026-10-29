// Estado de la interfaz que comparten todas las pantallas: el ámbito (todo el estudio o
// un proyecto, en la URL para no perderlo al navegar) y el editor de elementos.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { todayISO } from '../domain/dates'
import type { Scope } from '../domain/selectors'
import type { ID, Project, StudioData } from '../domain/types'
import { newId, store, useStudioData, type CollectionKey } from '../data/store'
import { COLLECTION_DEFS } from '../domain/collections'
import { EditorModal } from './Editor'
import { useNotify } from './feedback'
import { t } from '../i18n'
import { getPreferences } from './prefs'
import { scopedHref, sectionOfPath } from './navigation'

// ——— Ámbito ———————————————————————————————————————————————————————————————

export interface ScopeInfo {
  scope: Scope
  project?: Project
  /** Cambia de ámbito sin salir de la pantalla. */
  setScope: (id: Scope) => void
  /** Enlace a otra pantalla conservando el ámbito (en la ficha, a su pestaña). */
  href: (path: string) => string
}

export function useScope(): ScopeInfo {
  const data = useStudioData()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const projectMatch = location.pathname.match(/^\/proyectos\/([^/]+)(?:\/([^/]+))?/)
  const fromPath = projectMatch ? data.projects.find((p) => p.slug === projectMatch[1]) : undefined
  const fromQuery = data.projects.find((p) => p.id === params.get('p'))
  const project = fromPath ?? fromQuery
  const scope: Scope = project?.id ?? null
  const projectSlug = fromPath?.slug

  const setScope = useCallback(
    (id: Scope) => {
      const target = data.projects.find((p) => p.id === id)
      if (projectSlug) {
        // En la ficha: a la misma pestaña (y vista) del otro proyecto, o a esa sección en todo el estudio.
        const tab = projectMatch?.[2]
        if (target) navigate(`/proyectos/${target.slug}${tab ? `/${tab}` : ''}${location.search}`)
        else navigate(`${sectionOfPath(location.pathname)?.to ?? '/'}${location.search}`)
        return
      }
      const next = new URLSearchParams(location.search)
      if (target) next.set('p', target.id)
      else next.delete('p')
      const qs = next.toString()
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`)
    },
    [data.projects, navigate, location.pathname, location.search, projectSlug, projectMatch],
  )

  const href = useCallback((path: string) => scopedHref(path, { projectSlug, scope }), [scope, projectSlug])

  return { scope, project, setScope, href }
}

// ——— Editor ———————————————————————————————————————————————————————————————

export interface EditorRequest {
  collection: CollectionKey
  /** Sin id: crear uno nuevo. */
  id?: ID
  defaults?: Record<string, unknown>
}

interface UIState {
  edit: (req: EditorRequest) => void
  openItem: (id: ID) => void
  create: (collection: CollectionKey, defaults?: Record<string, unknown>) => void
}

const UIContext = createContext<UIState | null>(null)

export function useUI(): UIState {
  const ui = useContext(UIContext)
  if (!ui) throw new Error('useUI fuera de UIProvider')
  return ui
}

const manualSource = () => [{ type: 'manual', ref: 'Anotado en Studio Hub', date: todayISO() }]

/**
 * Valores de partida de un elemento nuevo de cada colección. Lo que afirma un estado de
 * fuera (fichas de tienda, logros, versiones, métricas) empieza «por confirmar».
 */
export function newDefaults(collection: CollectionKey, data: StudioData, scope: Scope): Record<string, unknown> {
  const projectId = scope ?? data.projects[0]?.id
  const studioWide = scope ?? undefined
  const today = todayISO()
  const me = getPreferences().meId
  const assigneeId = me && data.members.some((m) => m.id === me && m.active) ? me : undefined
  const sourced = (confidence: 'verified' | 'to_confirm') => ({ confidence, sources: manualSource() })
  switch (collection) {
    case 'items':
      return { projectId, kind: 'task', status: 'backlog', priority: 'medium', assigneeId, tags: [], createdAt: today, ...sourced('verified') }
    case 'builds':
      return { projectId, channel: 'demo', status: 'in_progress', platforms: [], date: today, tags: [], ...sourced('verified') }
    case 'events':
      return { projectId: studioWide, type: 'fair', status: 'planned', dateConfirmed: false, tags: [], ...sourced('verified') }
    case 'feedback':
      return { projectId, origin: 'playtest', status: 'new', impact: 'medium', linkedItemIds: [], receivedAt: today, tags: [], ...sourced('verified') }
    case 'resources':
      return { projectId: studioWide, type: 'link', tags: [] }
    case 'checklists':
      return { projectId, target: 'other', items: [], tags: [] }
    case 'projects':
      return { stage: 'idea', color: '#4f46e5', platforms: [], versions: [], tags: [], links: [], description: '', startedAt: today }
    case 'areas':
      return { color: '#64748b' }
    case 'members':
      return { kind: 'core', areaIds: [], active: true, aliases: [] }
    case 'timeEntries':
      return { projectId, memberId: assigneeId, date: today }
    case 'phases':
      return { projectId, stage: data.projects.find((p) => p.id === projectId)?.stage ?? 'idea', status: 'planned' }
    case 'releases':
      return { projectId, kind: 'update', status: 'planned', tags: [], ...sourced('to_confirm') }
    case 'storeListings':
      return { projectId, platform: 'steam', kind: 'game', status: 'not_started', tags: [], ...sourced('to_confirm') }
    case 'storeTexts': {
      const listings = data.storeListings.filter((l) => l.projectId === projectId)
      return { projectId, listingId: listings.length === 1 ? listings[0].id : undefined, kind: 'short', language: 'es', status: 'draft', text: '' }
    }
    case 'achievements':
      return { projectId, status: 'idea', tags: [], ...sourced('to_confirm') }
    case 'playtests':
      return { projectId, method: 'friends', date: today, tags: [], ...sourced('verified') }
    case 'reminders':
      return { projectId: studioWide, date: today, done: false }
    case 'transactions':
      return { projectId: studioWide, kind: 'expense', category: 'other', status: 'done', date: today, tags: [], ...sourced('verified') }
    case 'budgets':
      return { projectId: studioWide, from: today }
    case 'metrics':
      // Una métrica necesita su fuente de verdad (Steamworks, un informe…): no se rellena sola.
      return { projectId, kind: 'wishlists', date: today, confidence: 'to_confirm', sources: [] }
    default:
      return {}
  }
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'proyecto'
  )
}

const PREFIX = Object.fromEntries(COLLECTION_DEFS.map((d) => [d.key, d.idPrefix])) as Record<CollectionKey, string>

/** El elemento tal y como se guardará: con id (y slug, si es un proyecto) si es nuevo. */
export function buildEntity(collection: CollectionKey, draft: Record<string, unknown>, data: StudioData): Record<string, unknown> {
  const entity = { ...draft }
  if (!entity.id) {
    if (collection === 'projects') {
      const base = slugify(String(entity.name ?? ''))
      let slug = base
      for (let n = 2; data.projects.some((p) => p.slug === slug || p.id === slug); n++) slug = `${base}-${n}`
      entity.id = slug
      entity.slug = slug
    } else {
      entity.id = newId(PREFIX[collection])
    }
  }
  return entity
}

/** Guarda un borrador nuevo o editado. Devuelve el id. */
export function saveDraft(collection: CollectionKey, draft: Record<string, unknown>, data: StudioData): ID {
  const entity = buildEntity(collection, draft, data)
  store.upsert(collection, entity as never)
  return entity.id as ID
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<EditorRequest | null>(null)
  const { toast } = useNotify()
  const value = useMemo<UIState>(
    () => ({
      edit: setRequest,
      openItem: (id) => setRequest({ collection: 'items', id }),
      // Quien solo puede ver no crea nada (abrir y consultar sí).
      create: (collection, defaults) =>
        store.canWrite() ? setRequest({ collection, defaults }) : toast({ message: t('feedbackMsg.readOnly'), tone: 'info' }),
    }),
    [toast],
  )
  return (
    <UIContext.Provider value={value}>
      {children}
      {request && <EditorModal request={request} onClose={() => setRequest(null)} />}
    </UIContext.Provider>
  )
}
