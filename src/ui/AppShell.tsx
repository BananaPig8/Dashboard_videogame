import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { STAGES } from '../domain/catalog'
import { formatLongDate, todayISO } from '../domain/dates'
import { isOpen } from '../domain/selectors'
import { useStudioData } from '../data/store'
import { Icon, type IconName } from './components/Icon'
import { useScope, useUI } from './context'

interface NavEntry {
  to: string
  label: string
  icon: IconName
  /** Pestaña equivalente dentro de la ficha de un proyecto. */
  tab?: string
}

const NAV: { title: string; entries: NavEntry[] }[] = [
  {
    title: 'Estudio',
    entries: [
      { to: '/', label: 'Panel', icon: 'home', tab: 'resumen' },
      { to: '/hoy', label: 'Hoy', icon: 'sun' },
      { to: '/agenda', label: 'Agenda', icon: 'calendar', tab: 'agenda' },
    ],
  },
  {
    title: 'Trabajo',
    entries: [
      { to: '/trabajo', label: 'Tareas y funcionalidades', icon: 'list', tab: 'trabajo' },
      { to: '/decisiones', label: 'Decisiones', icon: 'scale', tab: 'decisiones' },
      { to: '/feedback', label: 'Feedback', icon: 'message', tab: 'feedback' },
    ],
  },
  {
    title: 'Producción',
    entries: [
      { to: '/builds', label: 'Builds y versiones', icon: 'box', tab: 'builds' },
      { to: '/publicacion', label: 'Publicar y actualizar', icon: 'rocket', tab: 'publicacion' },
      { to: '/recursos', label: 'Documentos y recursos', icon: 'book', tab: 'recursos' },
      { to: '/historial', label: 'Historial', icon: 'history', tab: 'historial' },
    ],
  },
]

export function AppShell({ children }: { children: ReactNode }) {
  const data = useStudioData()
  const { scope, project, setScope, href } = useScope()
  const { create } = useUI()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const today = todayISO()

  useEffect(() => setMenuOpen(false), [location.pathname])

  const inProject = location.pathname.startsWith('/proyectos/')
  /** En la ficha de un proyecto, el menú lleva a sus pestañas; si no, a la vista del estudio. */
  const target = (e: NavEntry) => (inProject && project && e.tab ? `/proyectos/${project.slug}/${e.tab}` : href(e.to))
  const isActive = (e: NavEntry) => {
    if (inProject && project) {
      const tab = location.pathname.split('/')[3] ?? 'resumen'
      return e.tab === tab
    }
    return e.to === '/' ? location.pathname === '/' : location.pathname.startsWith(e.to)
  }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(`/trabajo?${new URLSearchParams({ ...(scope ? { p: scope } : {}), q, estado: 'todos' }).toString()}`)
  }

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <aside className="sidebar" aria-label="Navegación">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="target" size={18} />
          </span>
          <div>
            <strong>Studio Hub</strong>
            <span>{data.studio.name}</span>
          </div>
          <button type="button" className="icon-btn only-mobile" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <Icon name="close" />
          </button>
        </div>
        <nav>
          {NAV.map((group) => (
            <div className="nav-group" key={group.title}>
              <h2 className="nav-title">{group.title}</h2>
              {group.entries.map((e) => (
                <Link key={e.to} to={target(e)} className={isActive(e) ? 'nav-link active' : 'nav-link'} aria-current={isActive(e) ? 'page' : undefined}>
                  <Icon name={e.icon} size={17} />
                  {e.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="nav-group">
            <h2 className="nav-title">
              <NavLink to="/proyectos" className="nav-title-link">
                Proyectos
              </NavLink>
              <button type="button" className="icon-btn small" onClick={() => create('projects')} aria-label="Nuevo proyecto" title="Nuevo proyecto">
                <Icon name="plus" size={14} />
              </button>
            </h2>
            {data.projects.map((p) => {
              const open = data.items.filter((i) => i.projectId === p.id && isOpen(i)).length
              const active = project?.id === p.id && inProject
              return (
                <Link key={p.id} to={`/proyectos/${p.slug}`} className={active ? 'nav-link active' : 'nav-link'} title={STAGES[p.stage].label}>
                  <span className="dot" style={{ background: p.color }} />
                  <span className="nav-project-name">{p.name}</span>
                  <span className="nav-count">{open}</span>
                </Link>
              )
            })}
          </div>
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/ajustes" className={({ isActive: a }) => (a ? 'nav-link active' : 'nav-link')}>
            <Icon name="settings" size={17} /> Ajustes y datos
          </NavLink>
        </div>
      </aside>
      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn only-mobile" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <Icon name="menu" />
          </button>
          <label className="scope-switch">
            <span className="visually-hidden">Ámbito</span>
            {project && <span className="dot" style={{ background: project.color }} />}
            <select value={scope ?? ''} onChange={(e) => setScope(e.target.value || null)} aria-label="Ver todo el estudio o un proyecto">
              <option value="">Todo el estudio</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <form className="search" role="search" onSubmit={submitSearch}>
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Buscar tareas, decisiones, commits…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar"
            />
          </form>
          <span className="topbar-date">{formatLongDate(today)}</span>
          <button type="button" className="btn btn-primary" onClick={() => create('items')}>
            <Icon name="plus" size={16} /> <span className="hide-narrow">Nuevo</span>
          </button>
        </header>
        <main id="contenido" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
