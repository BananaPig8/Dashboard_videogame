// Recursos: el material del estudio (capturas, vídeos, imágenes, logos, documentos, enlaces,
// arte, referencias y material comercial). Cada subsección (?tipo=) junta los tipos que dice
// el catálogo (RESOURCE_SECTIONS.recursos); se ven en rejilla o en lista (?mostrar=lista).
// Studio Hub no guarda archivos: cada recurso apunta a dónde está.
import { Link, useSearchParams } from 'react-router-dom'
import { hasTag, resourceDefaultType, resourceGroups, resourcesFor, resourceTypesFor } from '../../../domain/selectors'
import { RESOURCE_TYPES } from '../../../domain/catalog'
import type { Resource } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t, tr } from '../../../i18n'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { SectionHeader, useSectionNav } from '../../components/SectionHeader'
import { TagFilterNotice, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import { countResources, RESOURCE_ICON, ResourceGrid, ResourceSummary, ResourceTable, subsectionIcon } from './comunes'

type Layout = 'grid' | 'list'

export default function RecursosSection({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, project, href } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const nav = useSectionNav('recursos')
  const [params, setParams] = useSearchParams()
  const tag = useTagFilter()
  // Una subsección que no es de recursos (?tipo= desconocido) enseña todo.
  const raw = params.get('tipo')
  const sub = raw && resourceTypesFor('recursos', raw) ? raw : null
  const key = sub ?? 'todo'
  const layout: Layout = params.get('mostrar') === 'lista' ? 'list' : 'grid'
  const showProject = scope === null
  const all = resourcesFor(data, 'recursos', sub, scope)
  const shown = all.filter((r) => hasTag(r, tag))
  const newLabel = tr(`secciones.recursos.actions.new.${key}`)
  const newResource = () => create('resources', { type: resourceDefaultType('recursos', sub) })

  const setLayout = (next: Layout) => {
    const p = new URLSearchParams(params)
    if (next === 'list') p.set('mostrar', 'lista')
    else p.delete('mostrar')
    setParams(p, { replace: true })
  }

  const actions = canEdit ? (
    <button type="button" className="btn btn-primary" onClick={newResource}>
      <Icon name="plus" size={16} /> {newLabel}
    </button>
  ) : undefined

  const empty = (
    <Empty icon={sub ? subsectionIcon('recursos', sub) : 'image'} action={canEdit && !tag ? { label: newLabel, onClick: newResource } : undefined}>
      {tag && all.length ? t('secciones.recursos.emptyTag') : tr(`secciones.recursos.empty.${key}`)}
    </Empty>
  )

  const view = (list: Resource[], caption: string) =>
    layout === 'grid' ? <ResourceGrid resources={list} showProject={showProject} /> : <ResourceTable resources={list} showProject={showProject} caption={caption} />

  const childOf = (id: string) => nav.section.children.find((c) => c.id === id)

  return (
    <div className={embedded ? 'recursos-page' : 'page recursos-page'}>
      <SectionHeader
        id="recursos"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.recursos.subtitleIn', { project: project.name }) : undefined}
      />
      <TagFilterNotice />
      <p className="recursos-intro">{tr(`secciones.recursos.intro.${key}`)}</p>
      <p className="banner recursos-manual" role="note">
        <Icon name="info" size={16} />
        <span>{t('secciones.recursos.manual')}</span>
      </p>

      {!sub && !tag && all.length > 0 && <ResourceSummary section="recursos" />}

      {shown.length > 0 && (
        <div className="recursos-toolbar">
          <span className="muted small" role="status">
            {countResources(shown.length)}
          </span>
          <div className="segmented" role="group" aria-label={t('secciones.recursos.layout.label')}>
            {(['grid', 'list'] as const).map((l) => (
              <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)}>
                <Icon name={l === 'grid' ? 'layout' : 'list'} size={14} />
                {t(`secciones.recursos.layout.${l}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <Card>{empty}</Card>
      ) : sub ? (
        <Card title={childOf(sub)?.label} icon={subsectionIcon('recursos', sub)} subtitle={countResources(shown.length)}>
          {view(shown, childOf(sub)?.label ?? '')}
        </Card>
      ) : (
        resourceGroups(data, 'recursos', scope)
          .map((g) => ({ ...g, resources: g.resources.filter((r) => hasTag(r, tag)) }))
          .filter((g) => g.resources.length > 0)
          .map((g) => {
            const child = g.sub ? childOf(g.sub) : undefined
            const name = child?.label ?? (g.type ? RESOURCE_TYPES[g.type] : g.key)
            return (
              <Card
                key={g.key}
                title={name}
                icon={g.sub ? subsectionIcon('recursos', g.sub) : g.type ? RESOURCE_ICON[g.type] : 'image'}
                subtitle={countResources(g.resources.length)}
                action={
                  child ? (
                    <Link to={nav.href(child)} className="btn btn-small btn-ghost">
                      {t('secciones.recursos.group.see')}
                      <span className="visually-hidden"> · {name}</span>
                    </Link>
                  ) : undefined
                }
              >
                {view(g.resources, name)}
                {g.type === 'marketing' && (
                  <p className="muted small recursos-group-note">
                    {t('secciones.recursos.group.marketing')} <Link to={href('/publicacion?vista=materiales')}>{t('secciones.recursos.group.marketingLink')}</Link>
                  </p>
                )}
              </Card>
            )
          })
      )}
    </div>
  )

}
