// La página de una etiqueta (/etiquetas/<etiqueta>): todo lo que la lleva, agrupado por
// colección, en el ámbito de la URL (?p=). Cada elemento abre el editor; cada grupo enlaza a
// su sección filtrada por la etiqueta. Renombrar o fusionar: Ajustes › Categorías y etiquetas.
import { Link, useParams } from 'react-router-dom'
import { byTag, normalize, tagPageGroups, type TaggedEntry } from '../../../domain/selectors'
import type { StudioData } from '../../../domain/types'
import { t, tr } from '../../../i18n'
import { useStudioData, type CollectionKey } from '../../../data/store'
import { BuildStatusPill, EventStatusPill, FeedbackStatusPill, KindTag, ProjectChip, StatusPill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useDocumentTitle } from '../../components/SectionHeader'
import { TagLinks } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { isHidden, sectionById, settingsSection, tagPath, type SectionId } from '../../navigation'
import { usePreferences } from '../../prefs'
import { countsText } from '../ajustes/comunes'
import './etiquetas.css'

/** La sección (y subsección) donde se lista cada colección; allí ?etiqueta= filtra igual. */
const LISTED_IN: Partial<Record<CollectionKey, [SectionId, string?]>> = {
  projects: ['proyectos'],
  items: ['tareas'],
  builds: ['builds'],
  events: ['eventos'],
  feedback: ['feedback'],
  releases: ['roadmap', 'versiones'],
  achievements: ['publicacion', 'logros'],
}

/** El estado de un elemento, con su icono y su texto (solo en las colecciones que lo tienen). */
function EntryStatus({ data, entry }: { data: StudioData; entry: TaggedEntry }) {
  switch (entry.collection) {
    case 'items': {
      const i = data.items.find((x) => x.id === entry.id)
      return i ? (
        <>
          <KindTag kind={i.kind} />
          <StatusPill status={i.status} />
        </>
      ) : null
    }
    case 'builds': {
      const b = data.builds.find((x) => x.id === entry.id)
      return b ? <BuildStatusPill status={b.status} /> : null
    }
    case 'events': {
      const e = data.events.find((x) => x.id === entry.id)
      return e ? <EventStatusPill status={e.status} /> : null
    }
    case 'feedback': {
      const f = data.feedback.find((x) => x.id === entry.id)
      return f ? <FeedbackStatusPill status={f.status} /> : null
    }
    default:
      return null
  }
}

export default function EtiquetasPage() {
  const { tag = '' } = useParams()
  const data = useStudioData()
  const { scope, project, href } = useScope()
  const { edit } = useUI()
  const prefs = usePreferences()
  const groups = tagPageGroups(data, tag, scope)
  const total = Object.fromEntries(groups.map((g) => [g.collection, g.entries.length])) as Partial<Record<CollectionKey, number>>
  // Con un proyecto elegido: lo que la lleva en el resto del estudio, para no esconderlo sin decirlo.
  const all = scope ? (Object.entries(byTag(data, tag)).map(([k, list]) => [k as CollectionKey, list?.length ?? 0]) as [CollectionKey, number][]) : []
  const shown = groups.reduce((n, g) => n + g.entries.length, 0)
  const everywhere = all.reduce((n, [, c]) => n + c, 0) > shown ? countsText(all) : ''
  const ajustes = settingsSection()
  const categorias = ajustes.children.find((c) => c.id === 'categorias')!
  useDocumentTitle([`#${tag}`, tr('secciones.ajustes.etiquetas.crumb')])

  /** «Ver en Tareas»: la sección de la colección, con el filtro de la etiqueta y el ámbito. */
  const sectionLink = (k: CollectionKey) => {
    const where = LISTED_IN[k]
    if (!where) return undefined
    const s = sectionById(where[0])
    if (isHidden(s, prefs.hiddenSections)) return undefined
    const c = where[1] ? s.children.find((x) => x.id === where[1]) : undefined
    const params = new URLSearchParams(c?.to.split('?')[1] ?? '')
    params.set('etiqueta', tag)
    return { to: href(`${s.to}?${params}`), label: c ? `${s.label} › ${c.label}` : s.label }
  }

  return (
    <div className="page etiquetas-page">
      <header className="section-head">
        <div className="page-header">
          <div>
            <nav className="breadcrumb" aria-label={t('nav.breadcrumb')}>
              <ol>
                <li>
                  <Link to={ajustes.to}>{ajustes.label}</Link>
                </li>
                <li>
                  <Link to={categorias.to}>{categorias.label}</Link>
                </li>
                <li>
                  <span aria-current="page">#{tag}</span>
                </li>
              </ol>
            </nav>
            <h1>#{tag}</h1>
            {groups.length > 0 && <p className="page-subtitle">{t('secciones.ajustes.etiquetas.summary', { list: countsText(total) })}</p>}
          </div>
          <div className="page-actions">
            <Link to={categorias.to} className="btn">
              <Icon name="tag" size={16} /> {t('secciones.ajustes.etiquetas.manage')}
            </Link>
          </div>
        </div>
      </header>

      {project && (
        <p className="etiquetas-note">
          <Icon name="folder" size={16} />
          <span>
            {t('secciones.ajustes.etiquetas.scoped', { project: project.name })}{' '}
            {everywhere && t('secciones.ajustes.etiquetas.elsewhere', { list: everywhere })} <Link to={tagPath(tag)}>{t('secciones.ajustes.etiquetas.seeAll')}</Link>
          </span>
        </p>
      )}

      {groups.length === 0 ? (
        <Empty icon="tag">{project ? t('secciones.ajustes.etiquetas.emptyScoped', { project: project.name, tag }) : t('secciones.ajustes.etiquetas.empty', { tag })}</Empty>
      ) : (
        <div className="etiquetas-groups">
          {groups.map((g) => {
            const link = sectionLink(g.collection)
            const name = tr(`collectionNames.${g.collection}.other`)
            return (
              <Card
                key={g.collection}
                title={name.charAt(0).toUpperCase() + name.slice(1)}
                subtitle={t('secciones.ajustes.etiquetas.count', { n: g.entries.length })}
                action={
                  link && (
                    <Link to={link.to} className="btn btn-small btn-ghost">
                      {t('secciones.ajustes.etiquetas.inSection', { section: link.label })}
                    </Link>
                  )
                }
              >
                <ul className="etiquetas-list">
                  {g.entries.map((e) => {
                    const others = e.tags.filter((x) => normalize(x) !== normalize(tag))
                    const entryProject = !scope && e.collection !== 'projects' ? data.projects.find((p) => p.id === e.projectId) : undefined
                    return (
                      <li key={e.id}>
                        <button type="button" className="link-btn etiquetas-name" onClick={() => edit({ collection: e.collection, id: e.id })}>
                          {e.label}
                        </button>
                        <span className="etiquetas-meta">
                          <EntryStatus data={data} entry={e} />
                          {entryProject && <ProjectChip project={entryProject} />}
                          {others.length > 0 && (
                            <span className="etiquetas-also">
                              <span className="muted small">{t('secciones.ajustes.etiquetas.also')}</span> <TagLinks tags={others} />
                            </span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
