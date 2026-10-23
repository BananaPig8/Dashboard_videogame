// Cabecera de cada sección: migas («Tareas › Bloqueadas»), título, acciones y las
// subsecciones como pestañas-enlace (cambian la URL, así se pueden guardar y compartir).
// Dentro de la ficha de un proyecto solo se pintan las subsecciones, que llevan a la misma
// pestaña del proyecto.
import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { t, tr } from '../../i18n'
import { useScope } from '../context'
import { activeChildren, atSectionRoot, childHref, sectionById, sectionHref, type NavChild, type NavSection, type SectionId } from '../navigation'

export interface SectionNav {
  section: NavSection
  /** Las subsecciones que corresponden a la URL (puede haber una por faceta). */
  active: NavChild[]
  /** ¿Sin ninguna faceta en la URL? */
  root: boolean
  /** El enlace a una subsección desde aquí (conserva el ámbito, la ficha y las demás facetas). */
  href: (c: NavChild) => string
  /** La raíz de la sección desde aquí. */
  rootHref: string
}

export function useSectionNav(id: SectionId): SectionNav {
  const location = useLocation()
  const { scope, project } = useScope()
  const section = sectionById(id)
  const inProject = location.pathname.startsWith('/proyectos/')
  const where = { projectSlug: inProject ? project?.slug : undefined, scope }
  return {
    section,
    active: activeChildren(section, location.search),
    root: atSectionRoot(section, location.search),
    href: (c) => childHref(section, c, where, location.search),
    rootHref: sectionHref(section, where),
  }
}

/** Pone el título de la pestaña del navegador («Bloqueadas · Tareas · Studio Hub»). */
export function useDocumentTitle(parts: (string | undefined)[]) {
  const title = t('nav.pageTitle', { page: parts.filter(Boolean).join(' · ') })
  useEffect(() => {
    document.title = title
  }, [title])
}

export function SectionHeader({
  id,
  embedded,
  actions,
  subtitle,
  title,
}: {
  id: SectionId
  /** En la ficha de un proyecto (sin título grande). */
  embedded?: boolean
  actions?: ReactNode
  /** Por defecto, el de la sección (secciones.<id>.subtitle). */
  subtitle?: ReactNode
  /** Por defecto, el nombre de la subsección activa o de la sección. */
  title?: ReactNode
}) {
  const { section, active, root, href, rootHref } = useSectionNav(id)
  const { project } = useScope()
  // Las subsecciones elegidas (las que no son «lo de por defecto»), en el orden del registro.
  const chosen = active.filter((c) => c.value !== null)
  const here = chosen.map((c) => c.label).join(' · ')
  useDocumentTitle([here, section.label, embedded ? project?.name : undefined])
  const tabs = (
    <nav className="section-tabs" aria-label={t('section.subsections', { name: section.label })}>
      <ul>
        {section.children.map((c) => {
          const on = active.includes(c)
          return (
            <li key={c.id}>
              <Link to={href(c)} className={on ? 'section-tab active' : 'section-tab'} aria-current={on ? (active.length === 1 ? 'page' : 'true') : undefined}>
                {c.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
  if (embedded)
    return (
      <div className="section-head embedded">
        {tabs}
        {actions && <div className="embedded-actions">{actions}</div>}
      </div>
    )
  return (
    <header className="section-head">
      <div className="page-header">
        <div>
          <nav className="breadcrumb" aria-label={t('nav.breadcrumb')}>
            <ol>
              <li>{root || !chosen.length ? <span>{section.label}</span> : <Link to={rootHref}>{section.label}</Link>}</li>
              {chosen.length > 0 && (
                <li>
                  <span aria-current="page">{here}</span>
                </li>
              )}
            </ol>
          </nav>
          <h1>{title ?? (chosen.length ? here : section.label)}</h1>
          <p className="page-subtitle">{subtitle ?? tr(`secciones.${id}.subtitle`)}</p>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {tabs}
    </header>
  )
}
