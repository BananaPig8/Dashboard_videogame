// El armazón: barra lateral (contraíble en escritorio, panel en móvil), barra superior con
// ámbito, búsqueda, notificaciones y acciones rápidas, y atajos de teclado.
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { STAGES } from '../domain/catalog'
import { isOpen } from '../domain/selectors'
import { t } from '../i18n'
import { useStudioData } from '../data/store'
import { CommandPalette } from './CommandPalette'
import { Icon } from './components/Icon'
import { Popover } from './components/Popover'
import { useScope, useUI } from './context'
import { useFormat, useToday } from './hooks'
import { navGroups, quickCreate, type NavPage } from './navigation'
import { NotificationsMenu } from './Notifications'
import { updatePreferences, usePreferences } from './prefs'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export function AppShell({ children }: { children: ReactNode }) {
  const data = useStudioData()
  const prefs = usePreferences()
  const { scope, project, setScope, href } = useScope()
  const { create } = useUI()
  const location = useLocation()
  const today = useToday()
  const fmt = useFormat()
  const [menuOpen, setMenuOpen] = useState(false)
  const [palette, setPalette] = useState<{ open: boolean; query?: string }>({ open: false })
  const collapsed = prefs.sidebarCollapsed

  useEffect(() => setMenuOpen(false), [location.pathname])

  // Atajos: Ctrl/Cmd+K o «/» abren la paleta; «[» pliega la barra lateral.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette({ open: true })
      } else if (!isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey && !document.querySelector('dialog[open]')) {
        if (e.key === '/') {
          e.preventDefault()
          setPalette({ open: true })
        } else if (e.key === '[') {
          updatePreferences((p) => ({ sidebarCollapsed: !p.sidebarCollapsed }))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const inProject = location.pathname.startsWith('/proyectos/')
  const target = (e: NavPage) => (inProject && project && e.tab ? `/proyectos/${project.slug}/${e.tab}` : href(e.to))
  const isActive = (e: NavPage) => {
    if (inProject && project) return e.tab === (location.pathname.split('/')[3] ?? 'resumen')
    return e.to === '/' ? location.pathname === '/' : location.pathname.startsWith(e.to)
  }
  const currentPath = location.pathname + location.search

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`} data-sidebar={collapsed ? 'collapsed' : 'expanded'}>
      <a className="skip-link" href="#contenido">
        {t('app.skipToContent')}
      </a>
      <aside className="sidebar" aria-label={t('nav.navigation')}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="target" size={18} />
          </span>
          <div className="brand-text">
            <strong>{t('app.name')}</strong>
            <span>{data.studio.name}</span>
          </div>
          <button type="button" className="icon-btn only-mobile" onClick={() => setMenuOpen(false)} aria-label={t('nav.closeMenu')}>
            <Icon name="close" />
          </button>
        </div>
        <nav>
          {navGroups().map((group) => (
            <div className="nav-group" key={group.title}>
              <h2 className="nav-title">
                <span className="nav-title-text">{group.title}</span>
              </h2>
              {group.pages.map((e) => (
                <Link
                  key={e.to}
                  to={target(e)}
                  className={isActive(e) ? 'nav-link active' : 'nav-link'}
                  aria-current={isActive(e) ? 'page' : undefined}
                  title={collapsed ? e.label : undefined}
                  aria-label={collapsed ? e.label : undefined}
                >
                  <Icon name={e.icon} size={17} />
                  <span className="nav-label">{e.label}</span>
                </Link>
              ))}
            </div>
          ))}
          <div className="nav-group">
            <h2 className="nav-title">
              <NavLink to="/proyectos" className="nav-title-link nav-title-text">
                {t('nav.projects')}
              </NavLink>
              <button type="button" className="icon-btn small" onClick={() => create('projects')} aria-label={t('nav.newProject')} title={t('nav.newProject')}>
                <Icon name="plus" size={14} />
              </button>
            </h2>
            {data.projects.map((p) => {
              const open = data.items.filter((i) => i.projectId === p.id && isOpen(i)).length
              const active = project?.id === p.id && inProject
              return (
                <Link
                  key={p.id}
                  to={`/proyectos/${p.slug}`}
                  className={active ? 'nav-link active' : 'nav-link'}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? p.name : STAGES[p.stage].label}
                  aria-label={collapsed ? p.name : undefined}
                >
                  <span className="dot" style={{ background: p.color }} aria-hidden="true" />
                  <span className="nav-label">{p.name}</span>
                  <span className="nav-count" title={t('nav.openCount', { n: open })}>
                    {open}
                  </span>
                </Link>
              )
            })}
          </div>
          {prefs.savedViews.length > 0 && (
            <div className="nav-group">
              <h2 className="nav-title">
                <span className="nav-title-text">{t('nav.views')}</span>
              </h2>
              {prefs.savedViews.map((v) => (
                <Link
                  key={v.id}
                  to={v.path}
                  className={currentPath === v.path ? 'nav-link active' : 'nav-link'}
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
          <NavLink
            to="/ajustes"
            className={({ isActive: a }) => (a ? 'nav-link active' : 'nav-link')}
            title={collapsed ? t('nav.settings') : undefined}
            aria-label={collapsed ? t('nav.settings') : undefined}
          >
            <Icon name="settings" size={17} /> <span className="nav-label">{t('nav.settings')}</span>
          </NavLink>
          <button
            type="button"
            className="nav-link only-desktop"
            style={{ border: 0, background: 'transparent', cursor: 'pointer', width: '100%' }}
            onClick={() => updatePreferences((p) => ({ sidebarCollapsed: !p.sidebarCollapsed }))}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            title={`${collapsed ? t('nav.expand') : t('nav.collapse')} ( [ )`}
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={17} />
            <span className="nav-label">{t('actions.collapse')}</span>
          </button>
        </div>
      </aside>
      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn only-mobile" onClick={() => setMenuOpen(true)} aria-label={t('nav.openMenu')}>
            <Icon name="menu" />
          </button>
          <label className="scope-switch" title={t('topbar.scopeHint')}>
            <span className="visually-hidden">{t('topbar.scope')}</span>
            {project ? <span className="dot" style={{ background: project.color }} aria-hidden="true" /> : <Icon name="layout" size={15} />}
            <select value={scope ?? ''} onChange={(e) => setScope(e.target.value || null)} aria-label={t('topbar.scopeHint')}>
              <option value="">{t('topbar.wholeStudio')}</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="search-trigger" onClick={() => setPalette({ open: true })} aria-label={t('topbar.search')} aria-keyshortcuts="Control+K Meta+K /">
            <Icon name="search" size={16} />
            <span>{t('topbar.search')}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <span className="topbar-date">{fmt.longDate(today)}</span>
          <div className="topbar-actions">
            <NotificationsMenu />
            <Popover
              label={t('topbar.quickActions')}
              trigger={(p) => (
                <button type="button" className="btn btn-primary" onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup="menu">
                  <Icon name="plus" size={16} /> <span className="hide-narrow">{t('topbar.new')}</span>
                  <Icon name="chevronDown" size={14} />
                </button>
              )}
            >
              {(close) =>
                quickCreate().map((a, n) => (
                  <div key={a.id} role="none">
                    {n === quickCreate().length - 1 && <div className="menu-sep" role="separator" />}
                    <button
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      onClick={() => {
                        close()
                        create(a.collection, a.defaults)
                      }}
                    >
                      <Icon name={a.icon} size={16} /> {a.label}
                    </button>
                  </div>
                ))
              }
            </Popover>
          </div>
        </header>
        <main id="contenido" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <CommandPalette open={palette.open} initialQuery={palette.query} onClose={() => setPalette({ open: false })} />
    </div>
  )
}
