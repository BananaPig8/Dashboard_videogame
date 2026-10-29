// La barra lateral: las secciones del estudio en grupos, cada una con sus subsecciones
// (desplegables), la lista rápida de juegos y las vistas guardadas. Sale del registro de
// navigation.ts: añadir una sección allí la pone aquí, en la paleta y en las migas.
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { STAGES, type Tone } from '../domain/catalog'
import { blockedItems, isOpen, overdueItems, registrationsClosingSoon } from '../domain/selectors'
import type { StudioData } from '../domain/types'
import { t, tr } from '../i18n'
import { useCanEdit, useStudioData } from '../data/store'
import { Icon } from './components/Icon'
import { useScope, useUI } from './context'
import { useToday } from './hooks'
import { activeChildren, childHref, navGroups, normalizePath, sectionHref, sectionOfPath, settingsSection, type NavSection, type SectionId } from './navigation'
import { updatePreferences, usePreferences } from './prefs'

interface Badge {
  count: number
  tone: Tone
  /** Lo que lee un lector de pantalla (y el título al pasar el ratón). */
  label: string
}

const counted = (n: number, key: 'overdue' | 'blocked' | 'feedback' | 'registrations') =>
  n === 1 ? tr(`nav.badges.${key}One`) : tr(`nav.badges.${key}Other`, { n })

/** Contadores de la barra lateral: solo lo que pide acción, y siempre con texto. */
function navBadges(data: StudioData, today: string, scope: string | null): Partial<Record<SectionId, Badge>> {
  const out: Partial<Record<SectionId, Badge>> = {}
  const overdue = overdueItems(data, today, scope)
  const blocked = blockedItems(data, scope)
  // Una tarea vencida y bloqueada cuenta una vez.
  const urgent = new Set([...overdue, ...blocked].map((i) => i.id)).size
  if (urgent > 0) {
    const parts = [overdue.length ? counted(overdue.length, 'overdue') : '', blocked.length ? counted(blocked.length, 'blocked') : ''].filter(Boolean)
    out.tareas = { count: urgent, tone: 'danger', label: new Intl.ListFormat('es', { type: 'conjunction' }).format(parts) }
  }
  const fresh = data.feedback.filter((f) => f.status === 'new' && (!scope || f.projectId === scope)).length
  if (fresh > 0) out.feedback = { count: fresh, tone: 'warning', label: counted(fresh, 'feedback') }
  const closing = registrationsClosingSoon(data, today, undefined, scope).length
  if (closing > 0) out.eventos = { count: closing, tone: 'warning', label: counted(closing, 'registrations') }
  return out
}

export function Sidebar({ collapsed, hiddenOnMobile, onClose }: { collapsed: boolean; hiddenOnMobile: boolean; onClose: () => void }) {
  const data = useStudioData()
  const prefs = usePreferences()
  const canEdit = useCanEdit()
  const today = useToday()
  const { create } = useUI()
  const { scope, project } = useScope()
  const location = useLocation()
  const inProject = location.pathname.startsWith('/proyectos/')
  const where = { projectSlug: inProject ? project?.slug : undefined, scope }
  // En el resumen de un proyecto se marca el juego (en «Juegos»), no el Panel del estudio.
  const current = inProject && location.pathname.split('/').filter(Boolean).length === 2 ? undefined : sectionOfPath(location.pathname)
  const badges = useMemo(() => navBadges(data, today, scope), [data, today, scope])
  const groups = navGroups(prefs.hiddenSections)
  const currentPath = normalizePath(location.pathname + location.search)

  const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  // La activa se despliega sola salvo que se pliegue a mano; las demás, al revés.
  const toggle = (id: SectionId, active: boolean) =>
    updatePreferences((p) => (active ? { navFolded: flip(p.navFolded, id) } : { navExpanded: flip(p.navExpanded, id) }))

  const renderSection = (s: NavSection) => {
    const active = current?.id === s.id
    // Contraída la barra en escritorio, el CSS esconde subsecciones y flechas (en móvil se ven).
    const expanded = active ? !prefs.navFolded.includes(s.id) : prefs.navExpanded.includes(s.id)
    const activeSubs = active ? activeChildren(s, location.search) : []
    const badge = badges[s.id]
    const listId = `nav-${s.id}`
    return (
      <li key={s.id} className={`nav-section ${active ? 'current' : ''}`}>
        <div className="nav-row">
          <Link
            to={sectionHref(s, where)}
            className={active ? 'nav-link active' : 'nav-link'}
            aria-current={active && activeSubs.length === 0 ? 'page' : undefined}
            title={collapsed ? s.label : undefined}
            aria-label={collapsed ? (badge ? `${s.label}: ${badge.label}` : s.label) : undefined}
          >
            <Icon name={s.icon} size={17} />
            <span className="nav-label">{s.label}</span>
            {badge && (
              <span className={`nav-badge tone-${badge.tone}`} title={badge.label}>
                <span aria-hidden="true">{badge.count}</span>
                <span className="visually-hidden">{badge.label}</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={expanded ? t('nav.collapseSection', { name: s.label }) : t('nav.expandSection', { name: s.label })}
            onClick={() => toggle(s.id, active)}
          >
            <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} />
          </button>
        </div>
        <ul className="nav-children" id={listId} hidden={!expanded}>
          {s.children.map((c) => {
            const on = activeSubs.includes(c)
            return (
              <li key={c.id}>
                <Link
                  to={childHref(s, c, where, active ? location.search : undefined)}
                  className={on ? 'nav-sublink active' : 'nav-sublink'}
                  aria-current={on ? (activeSubs.length === 1 ? 'page' : 'true') : undefined}
                >
                  {c.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </li>
    )
  }

  const renderGroup = (g: (typeof groups)[number]) => (
    <div className="nav-group" key={g.id}>
      <h2 className="nav-title">
        <span className="nav-title-text">{g.title}</span>
      </h2>
      <ul className="nav-sections">{g.sections.map(renderSection)}</ul>
    </div>
  )

  return (
    // Cerrado en móvil, el panel está fuera de la pantalla: «inert» para que el tabulador no entre.
    <aside className="sidebar" aria-label={t('nav.navigation')} inert={hiddenOnMobile}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="target" size={18} />
        </span>
        <div className="brand-text">
          <strong>{t('app.name')}</strong>
          <span>{data.studio.name}</span>
        </div>
        <button type="button" className="icon-btn only-mobile" onClick={onClose} aria-label={t('nav.closeMenu')}>
          <Icon name="close" />
        </button>
      </div>
      <nav aria-label={t('nav.sectionsLabel')}>
        {groups.slice(0, 1).map(renderGroup)}
        <div className="nav-group">
          <h2 className="nav-title">
            <span className="nav-title-text">{t('nav.games')}</span>
            {canEdit && (
              <button type="button" className="icon-btn small" onClick={() => create('projects')} aria-label={t('nav.newProject')} title={t('nav.newProject')}>
                <Icon name="plus" size={14} />
              </button>
            )}
          </h2>
          {data.projects
            .filter((p) => p.stage !== 'archived')
            .map((p) => {
              const open = data.items.filter((i) => i.projectId === p.id && isOpen(i)).length
              const active = project?.id === p.id && inProject
              return (
                <Link
                  key={p.id}
                  to={`/proyectos/${p.slug}`}
                  className={active ? 'nav-link active' : 'nav-link'}
                  aria-current={active && location.pathname === `/proyectos/${p.slug}` ? 'page' : undefined}
                  title={collapsed ? p.name : STAGES[p.stage].label}
                  aria-label={collapsed ? p.name : undefined}
                >
                  <span className="dot" style={{ background: p.color }} aria-hidden="true" />
                  <span className="nav-label">{p.name}</span>
                  <span className="nav-count" title={t('nav.openCount', { n: open })}>
                    <span aria-hidden="true">{open}</span>
                    <span className="visually-hidden">{t('nav.openCount', { n: open })}</span>
                  </span>
                </Link>
              )
            })}
        </div>
        {groups.slice(1).map(renderGroup)}
        {prefs.savedViews.length > 0 && (
          <div className="nav-group">
            <h2 className="nav-title">
              <span className="nav-title-text">{t('nav.views')}</span>
            </h2>
            {prefs.savedViews.map((v) => (
              <Link
                key={v.id}
                to={v.path}
                className={currentPath === normalizePath(v.path) ? 'nav-link active' : 'nav-link'}
                aria-current={currentPath === normalizePath(v.path) ? 'page' : undefined}
                title={collapsed ? v.name : undefined}
                aria-label={collapsed ? v.name : undefined}
              >
                <Icon name="bookmark" size={16} />
                <span className="nav-label">{v.name}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>
      <div className="sidebar-foot">
        <ul className="nav-sections">{renderSection(settingsSection())}</ul>
        <button
          type="button"
          className="nav-link only-desktop nav-collapse"
          onClick={() => updatePreferences((p) => ({ sidebarCollapsed: !p.sidebarCollapsed }))}
          aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          title={`${collapsed ? t('nav.expand') : t('nav.collapse')} ( [ )`}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={17} />
          <span className="nav-label">{t('actions.collapse')}</span>
        </button>
      </div>
    </aside>
  )
}
