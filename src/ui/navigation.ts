// Las pantallas de la aplicación y las cosas que se pueden crear desde cualquier sitio.
import { t } from '../i18n'
import type { CollectionKey } from '../data/store'
import type { IconName } from './components/Icon'

export interface NavPage {
  to: string
  label: string
  icon: IconName
  /** Pestaña equivalente dentro de la ficha de un proyecto. */
  tab?: string
}

export function navGroups(): { title: string; pages: NavPage[] }[] {
  return [
    {
      title: t('nav.studio'),
      pages: [
        { to: '/', label: t('nav.dashboard'), icon: 'home', tab: 'resumen' },
        { to: '/hoy', label: t('nav.today'), icon: 'sun' },
        { to: '/agenda', label: t('nav.agenda'), icon: 'calendar', tab: 'agenda' },
      ],
    },
    {
      title: t('nav.work'),
      pages: [
        { to: '/trabajo', label: t('nav.tasks'), icon: 'list', tab: 'trabajo' },
        { to: '/decisiones', label: t('nav.decisions'), icon: 'scale', tab: 'decisiones' },
        { to: '/feedback', label: t('nav.feedback'), icon: 'message', tab: 'feedback' },
      ],
    },
    {
      title: t('nav.production'),
      pages: [
        { to: '/builds', label: t('nav.builds'), icon: 'box', tab: 'builds' },
        { to: '/publicacion', label: t('nav.publish'), icon: 'rocket', tab: 'publicacion' },
        { to: '/recursos', label: t('nav.resources'), icon: 'book', tab: 'recursos' },
        { to: '/historial', label: t('nav.history'), icon: 'history', tab: 'historial' },
      ],
    },
  ]
}

export function navPages(): NavPage[] {
  return [
    ...navGroups().flatMap((g) => g.pages),
    { to: '/proyectos', label: t('nav.projects'), icon: 'folder' },
    { to: '/ajustes', label: t('nav.settings'), icon: 'settings' },
  ]
}

export interface QuickCreate {
  id: string
  label: string
  icon: IconName
  collection: CollectionKey
  defaults?: Record<string, unknown>
}

export function quickCreate(): QuickCreate[] {
  return [
    { id: 'task', label: t('quick.task'), icon: 'check', collection: 'items', defaults: { kind: 'task' } },
    { id: 'decision', label: t('quick.decision'), icon: 'scale', collection: 'items', defaults: { kind: 'decision', status: 'to_confirm' } },
    { id: 'issue', label: t('quick.issue'), icon: 'bug', collection: 'items', defaults: { kind: 'issue', priority: 'high' } },
    { id: 'event', label: t('quick.event'), icon: 'calendar', collection: 'events' },
    { id: 'build', label: t('quick.build'), icon: 'box', collection: 'builds' },
    { id: 'feedback', label: t('quick.feedback'), icon: 'message', collection: 'feedback' },
    { id: 'resource', label: t('quick.resource'), icon: 'book', collection: 'resources' },
    { id: 'checklist', label: t('quick.checklist'), icon: 'rocket', collection: 'checklists' },
    { id: 'project', label: t('quick.project'), icon: 'folder', collection: 'projects' },
  ]
}
