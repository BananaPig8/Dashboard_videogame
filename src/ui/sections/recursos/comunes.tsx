// Piezas comunes de Recursos y Documentación: el icono y la etiqueta de cada tipo de recurso,
// adónde lleva cada uno, el texto escrito aquí (notas y actas) y las vistas en rejilla, en
// filas y en tabla. Studio Hub no guarda archivos ni carga nada de fuera: un icono por tipo,
// nunca miniaturas.
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { RESOURCE_TYPES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { resourceCounts, resourceHref, resourceTypesFor, type ResourceSection } from '../../../domain/selectors'
import type { Project, Resource, ResourceType } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t, tr } from '../../../i18n'
import { Pill, ProjectChip } from '../../components/Badges'
import { ExternalLink } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { TagLinks } from '../../components/TagFilter'
import { useSectionNav } from '../../components/SectionHeader'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import './recursos.css'

/** Un icono por tipo de recurso (no hay miniaturas). */
export const RESOURCE_ICON: Record<ResourceType, IconName> = {
  design: 'palette',
  technical: 'code',
  note: 'sticky',
  minutes: 'users',
  guide: 'book',
  doc: 'fileText',
  link: 'link',
  repo: 'git',
  tool: 'settings',
  screenshot: 'camera',
  video: 'video',
  image: 'image',
  logo: 'star',
  asset: 'layers',
  reference: 'bookmark',
  marketing: 'megaphone',
}

/** El icono de una subsección: el de su primer tipo. */
export function subsectionIcon(section: ResourceSection, sub: string): IconName {
  const first = resourceTypesFor(section, sub)?.[0]
  return first ? RESOURCE_ICON[first] : 'fileText'
}

/** El tipo de un recurso, con icono y texto. */
export const ResourceTypeTag = ({ type }: { type: ResourceType }) => (
  <Pill tone="neutral" icon={RESOURCE_ICON[type]}>
    {RESOURCE_TYPES[type]}
  </Pill>
)

/** Cuántos recursos, en palabras. */
export const countResources = (n: number) => t(n === 1 ? 'secciones.recursos.count.one' : 'secciones.recursos.count.many', { n })

/** Los proyectos, eventos y versiones, para poner nombre a lo que cita cada recurso. */
function useLookups() {
  const data = useStudioData()
  return {
    projects: new Map(data.projects.map((p) => [p.id, p])),
    events: new Map(data.events.map((e) => [e.id, e])),
    releases: new Map(data.releases.map((r) => [r.id, r])),
  }
}

/** El título: enlace a donde está, si se puede abrir; si no, texto. */
export function ResourceTitle({ resource: r, project }: { resource: Resource; project?: Project }) {
  const href = resourceHref(r, project)
  return href ? <ExternalLink href={href}>{r.title}</ExternalLink> : <span>{r.title}</span>
}

/** Botón de editar (solo si se puede escribir). */
export function EditResourceButton({ resource: r }: { resource: Resource }) {
  const { edit } = useUI()
  if (!useCanEdit()) return null
  const label = t('secciones.recursos.actions.edit', { name: r.title })
  return (
    <button type="button" className="icon-btn small" aria-label={label} title={label} onClick={() => edit({ collection: 'resources', id: r.id })}>
      <Icon name="edit" size={14} />
    </button>
  )
}

/** Dónde está: el enlace, la ruta en el repositorio (con enlace si el proyecto lo tiene) o nada. */
export function ResourceWhere({ resource: r, project }: { resource: Resource; project?: Project }) {
  const href = resourceHref(r, project)
  if (r.url)
    return (
      <ExternalLink href={r.url}>
        {t('secciones.recursos.item.open')}
        <span className="visually-hidden"> {r.title}</span>
      </ExternalLink>
    )
  if (r.path)
    return href ? (
      <ExternalLink href={href}>
        <code className="recursos-path">{r.path}</code>
        <span className="visually-hidden"> · {t('secciones.recursos.item.inRepo')}</span>
      </ExternalLink>
    ) : (
      <span className="recursos-path-only">
        <code className="recursos-path">{r.path}</code>
        <span className="muted small">{t('secciones.recursos.item.pathOnly')}</span>
      </span>
    )
  if (r.body) return <span className="muted">{t('secciones.recursos.item.written')}</span>
  return <span className="muted">{t('secciones.recursos.item.nowhere')}</span>
}

/** Proyecto (o «del estudio»), fecha, reunión o evento, versión, ruta y etiquetas. */
export function ResourceMeta({ resource: r, showProject, withPath = true }: { resource: Resource; showProject: boolean; withPath?: boolean }) {
  const fmt = useFormat()
  const year = yearOf(useToday())
  const { projects, events, releases } = useLookups()
  const project = r.projectId ? projects.get(r.projectId) : undefined
  const event = r.eventId ? events.get(r.eventId) : undefined
  const release = r.releaseId ? releases.get(r.releaseId) : undefined
  const missing = t('secciones.recursos.item.missing')
  return (
    <div className="item-meta">
      {!r.projectId ? (
        <span className="meta-date recursos-studio">
          <Icon name="home" size={12} /> {t('secciones.recursos.item.studio')}
        </span>
      ) : (
        showProject && <ProjectChip project={project} />
      )}
      {r.date && <span className="meta-date">{fmt.date(r.date, year)}</span>}
      {r.eventId && <span className="meta-date">{t('secciones.recursos.item.event', { name: event?.title ?? missing })}</span>}
      {r.releaseId && <span className="meta-date">{t('secciones.recursos.item.release', { name: release?.name ?? missing })}</span>}
      {withPath && r.path && <code className="recursos-path">{r.path}</code>}
      <TagLinks tags={r.tags} />
    </div>
  )
}

/** Texto escrito aquí (notas y actas), tal cual, con sus saltos de línea; si es largo, plegado. */
export function BodyText({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  // Plegado a unas diez líneas (recursos.css): más largo que eso, con «Leer entero».
  const long = text.split('\n').length > 10 || text.length > 900
  return (
    <div className="recursos-body-wrap">
      <div id={id} className={long && !open ? 'recursos-body clamped' : 'recursos-body'}>
        {text}
      </div>
      {long && (
        <button type="button" className="btn btn-small btn-ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
          {open ? t('secciones.recursos.body.less') : t('secciones.recursos.body.more')}
        </button>
      )}
    </div>
  )
}

/** Rejilla de fichas: icono del tipo, título, tipo, para qué sirve y de dónde es. */
export function ResourceGrid({ resources, showProject }: { resources: Resource[]; showProject: boolean }) {
  const { projects } = useLookups()
  return (
    <ul className="recursos-grid">
      {resources.map((r) => {
        const project = r.projectId ? projects.get(r.projectId) : undefined
        return (
          <li key={r.id} className="recursos-tile">
            <div className="recursos-tile-icon" aria-hidden="true">
              <Icon name={RESOURCE_ICON[r.type]} size={26} />
            </div>
            <div className="recursos-tile-head">
              <h3 className="recursos-title">
                <ResourceTitle resource={r} project={project} />
              </h3>
              <EditResourceButton resource={r} />
            </div>
            <ResourceTypeTag type={r.type} />
            {r.description && <p className="item-detail">{r.description}</p>}
            <ResourceMeta resource={r} showProject={showProject} withPath={false} />
            <div className="recursos-tile-where">
              <ResourceWhere resource={r} project={project} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Filas (documentación): icono, título, tipo, descripción, de dónde es y, si lo hay, el texto. */
export function ResourceRows({ resources, showProject, showBody }: { resources: Resource[]; showProject: boolean; showBody?: boolean }) {
  const { projects } = useLookups()
  return (
    <ul className="recursos-rows">
      {resources.map((r) => {
        const project = r.projectId ? projects.get(r.projectId) : undefined
        const href = resourceHref(r, project)
        return (
          <li key={r.id} className="recursos-row">
            <span className="recursos-row-icon" aria-hidden="true">
              <Icon name={RESOURCE_ICON[r.type]} size={18} />
            </span>
            <div className="recursos-row-main">
              <div className="recursos-row-head">
                <h3 className="recursos-title">
                  <ResourceTitle resource={r} project={project} />
                </h3>
                <ResourceTypeTag type={r.type} />
                <EditResourceButton resource={r} />
              </div>
              {r.description && <p className="item-detail">{r.description}</p>}
              {showBody && r.body && <BodyText text={r.body} />}
              <ResourceMeta resource={r} showProject={showProject} withPath={!href || !!r.url} />
              {r.path && !href && <span className="muted small">{t('secciones.recursos.item.pathOnly')}</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Tabla (vista de lista de Recursos): en móvil, cada fila es una tarjeta. */
export function ResourceTable({ resources, showProject, caption }: { resources: Resource[]; showProject: boolean; caption: string }) {
  const fmt = useFormat()
  const year = yearOf(useToday())
  const { projects } = useLookups()
  const L = (k: 'resource' | 'type' | 'project' | 'date' | 'where') => t(`secciones.recursos.table.${k}`)
  return (
    <div className="table-wrap">
      <table className="table recursos-table">
        <caption className="visually-hidden">{t('secciones.recursos.table.caption', { name: caption })}</caption>
        <thead>
          <tr>
            <th scope="col">{L('resource')}</th>
            <th scope="col">{L('type')}</th>
            {showProject && <th scope="col">{L('project')}</th>}
            <th scope="col">{L('date')}</th>
            <th scope="col">{L('where')}</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => {
            const project = r.projectId ? projects.get(r.projectId) : undefined
            return (
              <tr key={r.id}>
                <th scope="row" className="recursos-table-name">
                  <div className="recursos-row-head">
                    <span className="recursos-title">{r.title}</span>
                    <EditResourceButton resource={r} />
                  </div>
                  {r.description && <p className="item-detail">{r.description}</p>}
                  {((!r.projectId && !showProject) || r.tags.length > 0) && (
                    <div className="item-meta">
                      {!r.projectId && !showProject && <span className="meta-date">{t('secciones.recursos.item.studio')}</span>}
                      <TagLinks tags={r.tags} />
                    </div>
                  )}
                </th>
                <td data-label={L('type')}>
                  <ResourceTypeTag type={r.type} />
                </td>
                {showProject && (
                  <td data-label={L('project')}>
                    {project ? <ProjectChip project={project} /> : <span className="meta-date">{t('secciones.recursos.item.studio')}</span>}
                  </td>
                )}
                <td data-label={L('date')} className="nowrap">
                  {r.date ? fmt.date(r.date, year) : <span className="muted">{t('secciones.recursos.table.noDate')}</span>}
                </td>
                <td data-label={L('where')} className="recursos-table-where">
                  <ResourceWhere resource={r} project={project} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Cuántos recursos hay de cada subsección, con enlace a ella (también las que no tienen ninguno). */
export function ResourceSummary({ section }: { section: ResourceSection }) {
  const data = useStudioData()
  const { scope } = useScope()
  const nav = useSectionNav(section)
  return (
    <nav aria-label={t('secciones.recursos.summary.title')}>
      <ul className="recursos-summary">
        {resourceCounts(data, section, scope).map(({ sub, count }) => {
          const child = nav.section.children.find((c) => c.id === sub)
          if (!child) return null
          return (
            <li key={sub}>
              <Link to={nav.href(child)}>
                <Icon name={subsectionIcon(section, sub)} size={16} />
                <span className="recursos-summary-text">
                  <span className="recursos-summary-label">{child.label}</span>
                  <span className={count ? 'recursos-summary-count' : 'recursos-summary-count none'}>{count ? tr(`secciones.${section}.count.${count === 1 ? 'one' : 'many'}`, { n: count }) : t('secciones.recursos.summary.none')}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
