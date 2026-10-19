// El armazón: barra lateral (contraíble en escritorio, panel en móvil), barra superior con
// ámbito, búsqueda, notificaciones y acciones rápidas, y atajos de teclado.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { t } from '../i18n'
import { useCanEdit, useStudioData } from '../data/store'
import { CommandPalette } from './CommandPalette'
import { Icon } from './components/Icon'
import { Popover } from './components/Popover'
import { useScope, useUI } from './context'
import { useFormat, useMediaQuery, useToday } from './hooks'
import { quickCreate } from './navigation'
import { Sidebar } from './Sidebar'
import { NotificationsMenu } from './Notifications'
import { updatePreferences, usePreferences } from './prefs'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export function AppShell({ children }: { children: ReactNode }) {
  const data = useStudioData()
  const canEdit = useCanEdit()
  const prefs = usePreferences()
  const { scope, project, setScope } = useScope()
  const { create } = useUI()
  const location = useLocation()
  const today = useToday()
  const fmt = useFormat()
  const [menuOpen, setMenuOpen] = useState(false)
  const [palette, setPalette] = useState<{ open: boolean; query?: string }>({ open: false })
  const collapsed = prefs.sidebarCollapsed

  const mobile = useMediaQuery('(max-width: 960px)')
  const menuButton = useRef<HTMLButtonElement>(null)
  // Cualquier navegación (también cambiar de subsección, que solo cambia la consulta) cierra el menú.
  useEffect(() => setMenuOpen(false), [location.key])
  // Abierto en móvil: el foco entra en el menú y Esc lo cierra (y vuelve al botón).
  useEffect(() => {
    if (!menuOpen) return
    document.querySelector<HTMLElement>('.sidebar .brand .icon-btn')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      menuButton.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

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


  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`} data-sidebar={collapsed ? 'collapsed' : 'expanded'}>
      <a className="skip-link" href="#contenido">
        {t('app.skipToContent')}
      </a>
      <Sidebar
        collapsed={collapsed}
        hiddenOnMobile={mobile && !menuOpen}
        onClose={() => {
          setMenuOpen(false)
          menuButton.current?.focus()
        }}
      />
      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button ref={menuButton} type="button" className="icon-btn only-mobile" onClick={() => setMenuOpen(true)} aria-label={t('nav.openMenu')} aria-expanded={menuOpen}>
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
            {canEdit && (
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
                  quickCreate(prefs.hiddenSections).map((a, n, all) => (
                    <div key={a.id} role="none">
                      {n > 0 && all[n - 1].group !== a.group && <div className="menu-sep" role="separator" />}
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
            )}
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
