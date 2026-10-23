// Estado de revisión y publicación: cada ficha de tienda con su paso del recorrido (de sin
// empezar a la venta) y cada versión para jugadores con el suyo, en orden de fecha. Todo con
// su fiabilidad y sus fuentes: nada sale de una tienda.
import { LISTING_STATUSES } from '../../../domain/catalog'
import { LISTING_FLOW, compareReleases, hasTag, listingStep, listingsOf } from '../../../domain/selectors'
import type { StoreListing } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import {
  LISTING_STATUS_ICON,
  ListingRow,
  ManualNotice,
  NewButton,
  PublicacionPage,
  ReleaseStatusPill,
  ReleaseWhen,
  SourceLinks,
  listingName,
  releaseKindLabel,
  releaseName,
} from './comunes'

export function PublicacionEstado({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const listings = listingsOf(data, scope).filter((l) => hasTag(l, tag))
  const releases = data.releases.filter((r) => (scope === null || r.projectId === scope) && hasTag(r, tag)).sort(compareReleases)
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  return (
    <PublicacionPage
      embedded={embedded}
      actions={
        <>
          <NewButton collection="releases" label={t('secciones.publicacion.actions.newRelease')} />
          <NewButton collection="storeListings" label={t('secciones.publicacion.actions.newListing')} primary />
        </>
      }
    >
      <ManualNotice kind="stores" />
      <Card title={t('secciones.publicacion.estado.listings')} icon="globe" subtitle={t('secciones.publicacion.estado.listingsSub')}>
        {listings.length ? (
          <ul className="publicacion-list">
            {listings.map((l) => (
              <ListingRow key={l.id} listing={l} showProject={scope === null}>
                <ListingFlow listing={l} />
              </ListingRow>
            ))}
          </ul>
        ) : (
          <Empty
            icon="globe"
            action={canEdit && !tag ? { label: t('secciones.publicacion.actions.newListing'), onClick: () => create('storeListings') } : undefined}
          >
            {tag ? t('secciones.publicacion.emptyTag') : t('secciones.publicacion.estado.listingsEmpty')}
          </Empty>
        )}
      </Card>
      <Card title={t('secciones.publicacion.estado.releases')} icon="rocket" subtitle={t('secciones.publicacion.estado.releasesSub')}>
        {releases.length ? (
          <ol className="publicacion-list publicacion-timeline">
            {releases.map((r) => {
              const project = projects.get(r.projectId)
              return (
                <li key={r.id} className="publicacion-release">
                  <div className="publicacion-row-head">
                    <button type="button" className="item-title" onClick={() => edit({ collection: 'releases', id: r.id })}>
                      {releaseName(r)}
                    </button>
                    <span className="meta-date">{releaseKindLabel(r)}</span>
                    <ReleaseStatusPill status={r.status} />
                    <ConfidenceTag confidence={r.confidence} />
                  </div>
                  <div className="item-meta">
                    {scope === null && <ProjectChip project={project} />}
                    <ReleaseWhen release={r} />
                    <TagLinks tags={r.tags} />
                  </div>
                  <SourceLinks sources={r.sources} project={project} />
                </li>
              )
            })}
          </ol>
        ) : (
          <Empty
            icon="rocket"
            action={canEdit && !tag ? { label: t('secciones.publicacion.actions.newRelease'), onClick: () => create('releases') } : undefined}
          >
            {tag ? t('secciones.publicacion.emptyTag') : t('secciones.publicacion.estado.releasesEmpty')}
          </Empty>
        )}
      </Card>
    </PublicacionPage>
  )
}

/** El recorrido de una ficha: los pasos hechos, el de ahora (con icono y texto) y los que faltan. */
function ListingFlow({ listing: l }: { listing: StoreListing }) {
  const step = listingStep(l.status)
  return (
    <ol className="publicacion-flow" aria-label={t('secciones.publicacion.estado.flow', { name: listingName(l) })}>
      {LISTING_FLOW.map((s, k) => {
        const state = k < step ? 'done' : k === step ? 'current' : 'todo'
        const changes = k === step && l.status === 'changes_requested'
        return (
          <li key={s} className={`publicacion-step ${state}${changes ? ' changes' : ''}`} aria-current={state === 'current' ? 'step' : undefined}>
            <Icon name={state === 'done' ? 'checkCircle' : state === 'current' ? (changes ? 'alert' : LISTING_STATUS_ICON[s]) : 'circle'} size={14} />
            <span>{changes ? t('secciones.publicacion.estado.changes') : LISTING_STATUSES[s].label}</span>
            {state === 'current' && <span className="visually-hidden"> ({t('secciones.publicacion.estado.current')})</span>}
          </li>
        )
      })}
    </ol>
  )
}
