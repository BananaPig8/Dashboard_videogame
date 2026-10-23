// Actualizaciones y DLC: las versiones para jugadores (actualizaciones, parches, DLC y
// expansiones; aparte, el lanzamiento y las demos) con sus builds, lo que entra en cada una
// y sus fichas de tienda.
import { hasTag, releasesWithContent, type ReleaseContent } from '../../../domain/selectors'
import type { ReleaseKind } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { BuildChannelPill, BuildStatusPill, ConfidenceTag, ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { yearOf } from '../../../domain/dates'
import type { SectionPageProps } from '../registry'
import {
  ListingStatusPill,
  NewButton,
  PublicacionPage,
  ReleaseStatusPill,
  ReleaseWhen,
  SourceLinks,
  listingName,
  releaseKindLabel,
  releaseName,
} from './comunes'

const UPDATES: ReleaseKind[] = ['update', 'patch', 'dlc', 'expansion']
const LAUNCHES: ReleaseKind[] = ['launch', 'demo']

export function PublicacionVersiones({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const updates = releasesWithContent(data, UPDATES, scope).filter((r) => hasTag(r.release, tag))
  const launches = releasesWithContent(data, LAUNCHES, scope).filter((r) => hasTag(r.release, tag))
  return (
    <PublicacionPage
      embedded={embedded}
      actions={<NewButton collection="releases" defaults={{ kind: 'update' }} label={t('secciones.publicacion.actions.newRelease')} primary />}
    >
      <Card title={t('secciones.publicacion.dlc.updates')} icon="layers">
        {updates.length ? (
          <ul className="publicacion-releases">
            {updates.map((c) => (
              <ReleaseBlock key={c.release.id} content={c} showProject={scope === null} />
            ))}
          </ul>
        ) : (
          <Empty
            icon="layers"
            action={
              canEdit && !tag ? { label: t('secciones.publicacion.actions.newRelease'), onClick: () => create('releases', { kind: 'update' }) } : undefined
            }
          >
            {tag ? t('secciones.publicacion.emptyTag') : t('secciones.publicacion.dlc.updatesEmpty')}
          </Empty>
        )}
      </Card>
      <Card title={t('secciones.publicacion.dlc.launches')} icon="rocket">
        {launches.length ? (
          <ul className="publicacion-releases">
            {launches.map((c) => (
              <ReleaseBlock key={c.release.id} content={c} showProject={scope === null} />
            ))}
          </ul>
        ) : (
          <Empty
            icon="rocket"
            action={
              canEdit && !tag ? { label: t('secciones.publicacion.actions.newRelease'), onClick: () => create('releases', { kind: 'launch' }) } : undefined
            }
          >
            {tag ? t('secciones.publicacion.emptyTag') : t('secciones.publicacion.dlc.launchesEmpty')}
          </Empty>
        )}
      </Card>
    </PublicacionPage>
  )
}

/** Una versión para jugadores con sus builds, sus elementos y sus fichas de tienda. */
export function ReleaseBlock({ content: c, showProject, as = 'li' }: { content: ReleaseContent; showProject: boolean; as?: 'li' | 'div' }) {
  const data = useStudioData()
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const r = c.release
  const project = data.projects.find((p) => p.id === r.projectId)
  const Tag = as
  return (
    <Tag className="publicacion-release">
      <div className="publicacion-row-head">
        <h3>
          <button type="button" className="item-title" onClick={() => edit({ collection: 'releases', id: r.id })}>
            {releaseName(r)}
          </button>
        </h3>
        <span className="meta-date">{releaseKindLabel(r)}</span>
        <ReleaseStatusPill status={r.status} />
        <ConfidenceTag confidence={r.confidence} />
      </div>
      <div className="item-meta">
        {showProject && <ProjectChip project={project} />}
        <ReleaseWhen release={r} />
        <TagLinks tags={r.tags} />
      </div>
      {r.notes && <p className="item-detail">{r.notes}</p>}
      <SourceLinks sources={r.sources} project={project} />
      <div className="publicacion-release-parts">
        <div>
          <h4 className="subhead">{t('secciones.publicacion.content.builds')}</h4>
          {c.builds.length ? (
            <ul className="publicacion-mini">
              {c.builds.map((b) => (
                <li key={b.id}>
                  <button type="button" className="link-btn" onClick={() => edit({ collection: 'builds', id: b.id })}>
                    {b.name}
                  </button>
                  <span className="version-tag">v{b.version}</span>
                  <BuildChannelPill channel={b.channel} />
                  <BuildStatusPill status={b.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('secciones.publicacion.content.noBuilds')}</p>
          )}
        </div>
        {c.listings.length > 0 && (
          <div>
            <h4 className="subhead">{t('secciones.publicacion.content.listings')}</h4>
            <ul className="publicacion-mini">
              {c.listings.map((l) => (
                <li key={l.id}>
                  <button type="button" className="link-btn" onClick={() => edit({ collection: 'storeListings', id: l.id })}>
                    {listingName(l)}
                  </button>
                  <ListingStatusPill status={l.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <h4 className="subhead">{t('secciones.publicacion.content.items')}</h4>
      {c.items.length ? (
        <ItemList items={c.items} data={data} year={yearOf(today)} today={today} limit={8} />
      ) : (
        <p className="muted small">{t('secciones.publicacion.content.noItems')}</p>
      )}
      {canEdit && (
        <div className="button-row publicacion-release-actions">
          <button type="button" className="btn btn-small btn-ghost" onClick={() => create('builds', { projectId: r.projectId, releaseId: r.id })}>
            <Icon name="plus" size={14} /> {t('secciones.publicacion.actions.addBuild')}
          </button>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => create('items', { projectId: r.projectId, releaseId: r.id, kind: 'feature' })}
          >
            <Icon name="plus" size={14} /> {t('secciones.publicacion.actions.addItem')}
          </button>
        </div>
      )}
    </Tag>
  )
}
