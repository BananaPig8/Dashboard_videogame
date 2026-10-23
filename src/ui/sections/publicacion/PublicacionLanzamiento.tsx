// Checklist de lanzamiento: la próxima versión prevista, las listas de pasos para lanzar,
// sacar una demo o una actualización, y lo pendiente de las áreas de lanzamiento y demos.
import { hasTag, nextRelease, pendingInAreas, publicationChecklists, releasesWithContent } from '../../../domain/selectors'
import { useCanEdit, useStudioData } from '../../../data/store'
import { intlLocale, t } from '../../../i18n'
import { ChecklistCard } from '../../components/ChecklistCard'
import { Card, Empty } from '../../components/Common'
import { ItemList } from '../../components/ItemList'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { yearOf } from '../../../domain/dates'
import type { SectionPageProps } from '../registry'
import { NewButton, PublicacionPage } from './comunes'
import { ReleaseBlock } from './PublicacionVersiones'

/** Las áreas de trabajo de lanzar y de demos (de las del estudio); las que falten no salen. */
const LAUNCH_AREAS = ['release', 'demo']

export function PublicacionLanzamiento({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const today = useToday()
  const next = nextRelease(data, scope)
  const nextContent = next ? releasesWithContent(data, [next.kind], scope).find((c) => c.release.id === next.id) : undefined
  const lists = publicationChecklists(data, ['release', 'demo', 'update'], scope).filter((c) => hasTag(c, tag))
  const areas = data.areas.filter((a) => LAUNCH_AREAS.includes(a.id))
  const pending = areas.length
    ? pendingInAreas(
        data,
        areas.map((a) => a.id),
        scope,
      ).filter((i) => hasTag(i, tag))
    : []

  return (
    <PublicacionPage
      embedded={embedded}
      actions={
        <>
          <NewButton collection="releases" defaults={{ kind: 'launch' }} label={t('secciones.publicacion.actions.newRelease')} />
          <NewButton collection="checklists" defaults={{ target: 'release' }} label={t('secciones.publicacion.actions.newChecklist')} primary />
        </>
      }
    >
      <div className="grid grid-2">
        <div className="stack">
          <Card title={t('secciones.publicacion.lanzamiento.next')} icon="rocket">
            {nextContent ? (
              <ReleaseBlock content={nextContent} showProject={scope === null} as="div" />
            ) : (
              <Empty
                icon="rocket"
                action={canEdit ? { label: t('secciones.publicacion.actions.newRelease'), onClick: () => create('releases', { kind: 'launch' }) } : undefined}
              >
                {t('secciones.publicacion.lanzamiento.nextEmpty')}
              </Empty>
            )}
          </Card>
          {areas.length > 0 && (
            <Card
              title={t('secciones.publicacion.lanzamiento.pending')}
              icon="flag"
              subtitle={t('secciones.publicacion.lanzamiento.pendingSub', {
                areas: new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(areas.map((a) => `«${a.name}»`)),
              })}
            >
              <ItemList
                items={pending}
                data={data}
                showProject={scope === null}
                detail="blocked"
                year={yearOf(today)}
                today={today}
                showTags
                empty={t('secciones.publicacion.lanzamiento.pendingEmpty')}
              />
            </Card>
          )}
        </div>
        <div className="stack">
          {lists.length ? (
            lists.map((c) => <ChecklistCard key={c.id} checklist={c} data={data} showProject={scope === null} />)
          ) : (
            <Card title={t('secciones.publicacion.lanzamiento.checklists')} icon="list" subtitle={t('secciones.publicacion.lanzamiento.checklistsSub')}>
              <Empty
                icon="list"
                action={
                  canEdit && !tag
                    ? { label: t('secciones.publicacion.actions.newChecklist'), onClick: () => create('checklists', { target: 'release' }) }
                    : undefined
                }
              >
                {tag ? t('secciones.publicacion.emptyTag') : t('secciones.publicacion.lanzamiento.checklistsEmpty')}
              </Empty>
            </Card>
          )}
        </div>
      </div>
    </PublicacionPage>
  )
}
