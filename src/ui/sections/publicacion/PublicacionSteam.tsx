// Preparación de Steam: módulo manual. Las fichas de Steam apuntadas, lo que falta por
// apuntar (ficha, textos, capturas, logros), las listas de pasos para Steam y lo pendiente
// del área de Steam. Nada sale de Steamworks.
import { Link } from 'react-router-dom'
import { hasTag, listingsOf, pendingInAreas, publicationChecklists, steamGaps, type SteamGap, type SteamGaps } from '../../../domain/selectors'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ProjectChip } from '../../components/Badges'
import { ChecklistCard } from '../../components/ChecklistCard'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { useSectionNav } from '../../components/SectionHeader'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { yearOf } from '../../../domain/dates'
import type { SectionPageProps } from '../registry'
import { ListingRow, ManualNotice, NewButton, PublicacionPage, childOf } from './comunes'

/** El área de trabajo de Steam (de las del estudio); si el estudio la quita, no sale el bloque. */
const STEAM_AREA = 'steam'

export function PublicacionSteam({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const today = useToday()
  const listings = listingsOf(data, scope, 'steam').filter((l) => hasTag(l, tag))
  const lists = publicationChecklists(data, ['steam'], scope).filter((c) => hasTag(c, tag))
  const gaps = steamGaps(data, scope)
  const area = data.areas.find((a) => a.id === STEAM_AREA)
  const pending = area ? pendingInAreas(data, [area.id], scope).filter((i) => hasTag(i, tag)) : []
  const newListing = () => create('storeListings', { platform: 'steam' })
  const newList = () => create('checklists', { target: 'steam' })

  return (
    <PublicacionPage
      embedded={embedded}
      actions={
        <>
          <NewButton collection="checklists" defaults={{ target: 'steam' }} label={t('secciones.publicacion.actions.newChecklist')} />
          <NewButton collection="storeListings" defaults={{ platform: 'steam' }} label={t('secciones.publicacion.actions.newListing')} primary />
        </>
      }
    >
      <ManualNotice kind="steam" />
      <div className="grid grid-2">
        <div className="stack">
          <Card title={t('secciones.publicacion.steam.listings')} icon="globe">
            {listings.length ? (
              <ul className="publicacion-list">
                {listings.map((l) => (
                  <ListingRow key={l.id} listing={l} showProject={scope === null} />
                ))}
              </ul>
            ) : (
              <Empty icon="globe" action={canEdit && !tag ? { label: t('secciones.publicacion.actions.newSteamListing'), onClick: newListing } : undefined}>
                {tag ? t('secciones.publicacion.emptyTag') : t('secciones.publicacion.steam.listingsEmpty')}
              </Empty>
            )}
          </Card>
          <Card title={t('secciones.publicacion.steam.gaps')} icon="flag" subtitle={t('secciones.publicacion.steam.gapsSub')}>
            {gaps.length ? (
              <div className="publicacion-gaps">
                {gaps.map((g) => (
                  <ProjectGaps key={g.project.id} gaps={g} showProject={scope === null} />
                ))}
              </div>
            ) : (
              <Empty icon="flag">{t('secciones.publicacion.steam.gapsEmpty')}</Empty>
            )}
          </Card>
          {area && (
            <Card title={t('secciones.publicacion.steam.pending')} icon="flag" subtitle={t('secciones.publicacion.steam.pendingSub', { area: area.name })}>
              <ItemList
                items={pending}
                data={data}
                showProject={scope === null}
                detail="blocked"
                year={yearOf(today)}
                today={today}
                showTags
                empty={t('secciones.publicacion.steam.pendingEmpty')}
              />
            </Card>
          )}
        </div>
        <div className="stack">
          {lists.length ? (
            lists.map((c) => <ChecklistCard key={c.id} checklist={c} data={data} showProject={scope === null} />)
          ) : (
            <Card title={t('secciones.publicacion.steam.checklists')} icon="list">
              <Empty icon="list" action={canEdit && !tag ? { label: t('secciones.publicacion.actions.newChecklist'), onClick: newList } : undefined}>
                {tag ? t('secciones.publicacion.emptyTag') : t('secciones.publicacion.steam.checklistsEmpty')}
              </Empty>
            </Card>
          )}
        </div>
      </div>
    </PublicacionPage>
  )
}

const GAP_COLLECTION = { listing: 'storeListings', texts: 'storeTexts', screenshots: 'resources', achievements: 'achievements' } as const

function ProjectGaps({ gaps: g, showProject }: { gaps: SteamGaps; showProject: boolean }) {
  const { create } = useUI()
  const nav = useSectionNav('publicacion')
  const canEdit = useCanEdit()
  const defaults = (gap: SteamGap): Record<string, unknown> => {
    const projectId = g.project.id
    switch (gap) {
      case 'listing':
        return { projectId, platform: 'steam' }
      case 'texts':
        return { projectId, listingId: g.listings[0]?.id }
      case 'screenshots':
        return { projectId, type: 'screenshot' }
      case 'achievements':
        return { projectId }
    }
  }
  return (
    <div className="publicacion-gaps-project">
      {showProject && (
        <h3 className="publicacion-gaps-title">
          <ProjectChip project={g.project} />
        </h3>
      )}
      {g.missing.length === 0 ? (
        <p className="publicacion-ok">
          <Icon name="checkCircle" size={16} /> {t('secciones.publicacion.steam.gapsNone')}
        </p>
      ) : (
        <ul className="publicacion-gap-list">
          {g.missing.map((gap) => (
            <li key={gap}>
              <span className="publicacion-gap">
                <Icon name="circleDashed" size={16} /> {t(`secciones.publicacion.steam.gap.${gap}`)}
              </span>
              {canEdit &&
                (gap === 'texts' && !g.listings.length ? (
                  <span className="muted small">{t('secciones.publicacion.steam.needsListing')}</span>
                ) : (
                  <button type="button" className="btn btn-small" onClick={() => create(GAP_COLLECTION[gap], defaults(gap))}>
                    <Icon name="plus" size={14} /> {t(`secciones.publicacion.steam.gapAction.${gap}`)}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {g.draftTexts > 0 && (
        <p className="muted small">
          <Link to={nav.href(childOf('publicacion', 'descripciones'))}>
            {t(g.draftTexts === 1 ? 'secciones.publicacion.steam.drafts.one' : 'secciones.publicacion.steam.drafts.many', { n: g.draftTexts })}
          </Link>
        </p>
      )}
    </div>
  )
}
