// Estado de la interfaz que comparten todas las pantallas: el ámbito (todo el estudio o
// un proyecto, en la URL para no perderlo al navegar) y el editor de elementos.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { todayISO } from '../domain/dates'
import type { Scope } from '../domain/selectors'
import type { ID, Project, StudioData } from '../domain/types'
import { newId, store, useStudioData, type CollectionKey } from '../data/store'
import { EditorModal } from './Editor'
import { useNotify } from './feedback'
import { t } from '../i18n'

// ——— Ámbito ———————————————————————————————————————————————————————————————

export interface ScopeInfo {
  scope: Scope
  project?: Project
  /** Cambia de ámbito sin salir de la pantalla. */
  setScope: (id: Scope) => void
  /** Enlace a otra pantalla conservando el ámbito. */
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

  const setScope = useCallback(
    (id: Scope) => {
      const target = data.projects.find((p) => p.id === id)
      if (projectMatch) {
        // En la ficha de un proyecto, cambiar de ámbito es ir a la misma pestaña del otro.
        if (target) navigate(`/proyectos/${target.slug}${projectMatch[2] ? `/${projectMatch[2]}` : ''}`)
        else navigate('/')
        return
      }
      const next = new URLSearchParams(location.search)
      if (target) next.set('p', target.id)
      else next.delete('p')
      const qs = next.toString()
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`)
    },
    [data.projects, navigate, location.pathname, location.search, projectMatch],
  )

  const href = useCallback((path: string) => (scope && !projectMatch ? `${path}?p=${scope}` : path), [scope, projectMatch])

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

/** Valores de partida de un elemento nuevo de cada colección. */
export function newDefaults(collection: CollectionKey, data: StudioData, scope: Scope): Record<string, unknown> {
  const projectId = scope ?? data.projects[0]?.id
  const today = todayISO()
  switch (collection) {
    case 'items':
      return { projectId, kind: 'task', status: 'backlog', priority: 'medium', confidence: 'verified', tags: [], sources: manualSource(), createdAt: today }
    case 'builds':
      return { projectId, channel: 'demo', status: 'in_progress', platforms: [], confidence: 'verified', sources: manualSource(), date: today }
    case 'events':
      return { projectId: scope ?? undefined, type: 'fair', status: 'planned', dateConfirmed: false, confidence: 'verified', sources: manualSource() }
    case 'feedback':
      return { projectId, origin: 'playtest', status: 'new', impact: 'medium', linkedItemIds: [], confidence: 'verified', sources: manualSource(), receivedAt: today }
    case 'resources':
      return { projectId: scope ?? undefined, type: 'link', tags: [] }
    case 'checklists':
      return { projectId, target: 'other', items: [] }
    case 'projects':
      return { stage: 'idea', color: '#4f46e5', platforms: [], versions: [], tags: [], links: [], description: '', startedAt: today }
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

const PREFIX: Record<CollectionKey, string> = {
  areas: 'area',
  projects: 'proyecto',
  items: 'item',
  builds: 'build',
  events: 'evento',
  feedback: 'feedback',
  resources: 'recurso',
  checklists: 'lista',
  activity: 'actividad',
}

/** Guarda un borrador nuevo o editado. Devuelve el id. */
export function saveDraft(collection: CollectionKey, draft: Record<string, unknown>, data: StudioData): ID {
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
