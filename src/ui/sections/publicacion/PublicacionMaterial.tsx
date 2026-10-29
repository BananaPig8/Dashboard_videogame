// Material para publicar: el material comercial (y lo que hay para prensa) y las capturas y
// vídeos. Son recursos del estudio (Recursos) vistos desde Publicación.
import { Link } from 'react-router-dom'
import { RESOURCE_SECTIONS } from '../../../domain/catalog'
import { hasTag, pressKit, publicationResources } from '../../../domain/selectors'
import type { Resource, ResourceType } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { Card, Empty } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { useSectionNav } from '../../components/SectionHeader'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import { NewButton, PublicacionPage, ResourceRows, childOf } from './comunes'

export function PublicacionMateriales({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, href } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const marketing = publicationResources(data, RESOURCE_SECTIONS.publicacion.materiales, scope).filter((r) => hasTag(r, tag))
  const kit = pressKit(data, scope)
  const nav = useSectionNav('publicacion')
  const capturas = nav.href(childOf('publicacion', 'capturas'))
  // Cada parte del kit de prensa, con adónde ir a verla (Recursos o Capturas y vídeos).
  const rows: { key: 'logos' | 'images' | 'screenshots' | 'videos'; icon: IconName; list: Resource[]; to: string }[] = [
    { key: 'logos', icon: 'star', list: kit.logos, to: href(childOf('recursos', 'logos').to) },
    { key: 'images', icon: 'image', list: kit.images, to: href(childOf('recursos', 'imagenes').to) },
    { key: 'screenshots', icon: 'image', list: kit.screenshots, to: capturas },
    { key: 'videos', icon: 'video', list: kit.videos, to: capturas },
  ]
  const tagged = kit.tagged.filter((r) => hasTag(r, tag))
  return (
    <PublicacionPage
      embedded={embedded}
      actions={<NewButton collection="resources" defaults={{ type: 'marketing' }} label={t('secciones.publicacion.actions.newMarketing')} primary />}
    >
      <div className="grid grid-2-1">
        <Card title={t('secciones.publicacion.materiales.marketing')} icon="star" subtitle={t('secciones.publicacion.materiales.marketingSub')}>
          {marketing.length ? (
            <ResourceRows resources={marketing} showProject={scope === null} />
          ) : (
            <Empty
              icon="star"
              action={
                canEdit && !tag
                  ? { label: t('secciones.publicacion.actions.newMarketing'), onClick: () => create('resources', { type: 'marketing' }) }
                  : undefined
              }
            >
              {tag ? t('secciones.publicacion.emptyTag') : t('secciones.publicacion.materiales.marketingEmpty')}
            </Empty>
          )}
        </Card>
        <Card title={t('secciones.publicacion.materiales.press')} icon="message" subtitle={t('secciones.publicacion.materiales.pressSub')}>
          <ul className="publicacion-kit">
            {rows.map(({ key, icon, list, to }) => (
              <li key={key}>
                <Icon name={icon} size={16} />
                <span className="publicacion-kit-label">{t(`secciones.publicacion.materiales.kit.${key}`)}</span>
                {list.length ? (
                  <Link to={to}>
                    {t('secciones.publicacion.materiales.see', { n: list.length })}
                    <span className="visually-hidden"> · {t(`secciones.publicacion.materiales.kit.${key}`)}</span>
                  </Link>
                ) : (
                  <span className="muted small">{t('secciones.publicacion.materiales.none')}</span>
                )}
              </li>
            ))}
          </ul>
          <h3 className="subhead">{t('secciones.publicacion.materiales.tagged')}</h3>
          {tagged.length ? (
            <ResourceRows resources={tagged} showProject={scope === null} />
          ) : (
            <p className="muted small">{t('secciones.publicacion.materiales.taggedEmpty')}</p>
          )}
          <p className="muted small">{t('secciones.publicacion.materiales.pressHint')}</p>
        </Card>
      </div>
    </PublicacionPage>
  )
}

export function PublicacionCapturas({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const all = publicationResources(data, RESOURCE_SECTIONS.publicacion.capturas, scope).filter((r) => hasTag(r, tag))
  const groups: { type: ResourceType; title: string; empty: string; icon: IconName; label: string }[] = [
    {
      type: 'screenshot',
      title: t('secciones.publicacion.capturas.screenshots'),
      empty: t('secciones.publicacion.capturas.screenshotsEmpty'),
      icon: 'image',
      label: t('secciones.publicacion.actions.newScreenshot'),
    },
    {
      type: 'video',
      title: t('secciones.publicacion.capturas.videos'),
      empty: t('secciones.publicacion.capturas.videosEmpty'),
      icon: 'video',
      label: t('secciones.publicacion.actions.newVideo'),
    },
  ]
  return (
    <PublicacionPage
      embedded={embedded}
      actions={
        <>
          <NewButton collection="resources" defaults={{ type: 'video' }} label={t('secciones.publicacion.actions.newVideo')} />
          <NewButton collection="resources" defaults={{ type: 'screenshot' }} label={t('secciones.publicacion.actions.newScreenshot')} primary />
        </>
      }
    >
      <div className="grid grid-2">
        {groups.map((g) => {
          const list = all.filter((r) => r.type === g.type)
          return (
            <Card key={g.type} title={g.title} icon={g.icon}>
              {list.length ? (
                <ResourceRows resources={list} showProject={scope === null} />
              ) : (
                <Empty icon={g.icon} action={canEdit && !tag ? { label: g.label, onClick: () => create('resources', { type: g.type }) } : undefined}>
                  {tag ? t('secciones.publicacion.emptyTag') : g.empty}
                </Empty>
              )}
            </Card>
          )
        })}
      </div>
    </PublicacionPage>
  )
}
