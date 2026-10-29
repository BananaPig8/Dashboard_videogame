// Descripciones: los textos de cada ficha de tienda por idioma (borrador o definitivo), con
// su número de caracteres. Studio Hub no conoce los límites de cada tienda y no los inventa.
import { STORE_TEXT_KINDS } from '../../../domain/catalog'
import { listingsOf, storeTextsByListing, textLength, type ListingTexts } from '../../../domain/selectors'
import type { StoreText } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useScope, useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import { ListingStatusPill, NewButton, PublicacionPage, StoreTextStatusPill, languageName, listingName } from './comunes'

export function PublicacionDescripciones({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const groups = storeTextsByListing(data, scope)
  const hasListings = listingsOf(data, scope).length > 0
  return (
    <PublicacionPage
      embedded={embedded}
      actions={
        hasListings ? (
          <NewButton collection="storeTexts" label={t('secciones.publicacion.actions.newText')} primary />
        ) : (
          <NewButton collection="storeListings" label={t('secciones.publicacion.actions.newListing')} primary />
        )
      }
    >
      <p className="publicacion-intro">
        {t('secciones.publicacion.descripciones.intro')} <span className="muted">{t('secciones.publicacion.descripciones.limits')}</span>
      </p>
      {groups.length === 0 ? (
        <Card>
          <Empty
            icon="fileText"
            action={canEdit ? { label: t('secciones.publicacion.actions.newListing'), onClick: () => create('storeListings') } : undefined}
          >
            {t('secciones.publicacion.descripciones.noListings')}
          </Empty>
        </Card>
      ) : (
        groups.map((g) => <ListingTextsCard key={g.listing?.id ?? `sin-ficha-${g.projectId}`} group={g} showProject={scope === null} />)
      )}
    </PublicacionPage>
  )
}

function ListingTextsCard({ group: g, showProject }: { group: ListingTexts; showProject: boolean }) {
  const data = useStudioData()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const project = data.projects.find((p) => p.id === g.projectId)
  const total = g.languages.reduce((n, l) => n + l.texts.length, 0)
  const l = g.listing
  const add =
    l && canEdit && total > 0 ? (
      <button type="button" className="btn btn-small" onClick={() => create('storeTexts', { projectId: l.projectId, listingId: l.id })}>
        <Icon name="plus" size={14} /> {t('secciones.publicacion.actions.addText')}
      </button>
    ) : undefined
  return (
    <Card
      title={l ? listingName(l) : t('secciones.publicacion.descripciones.orphans')}
      icon="fileText"
      subtitle={
        total ? t(total === 1 ? 'secciones.publicacion.descripciones.texts.one' : 'secciones.publicacion.descripciones.texts.many', { n: total }) : undefined
      }
      action={add}
    >
      <div className="item-meta publicacion-card-meta">
        {showProject && <ProjectChip project={project} />}
        {l ? (
          <>
            <ListingStatusPill status={l.status} />
            <ConfidenceTag confidence={l.confidence} compact />
          </>
        ) : (
          <span className="muted small">{t('secciones.publicacion.descripciones.orphansHint')}</span>
        )}
      </div>
      {g.languages.length === 0 ? (
        <Empty
          icon="fileText"
          action={
            l && canEdit
              ? { label: t('secciones.publicacion.actions.addText'), onClick: () => create('storeTexts', { projectId: l.projectId, listingId: l.id }) }
              : undefined
          }
        >
          {t('secciones.publicacion.descripciones.empty')}
        </Empty>
      ) : (
        g.languages.map((lang) => (
          <section key={lang.language} className="publicacion-lang" aria-label={languageName(lang.language)}>
            <h3 className="subhead">{languageName(lang.language)}</h3>
            <ul className="publicacion-texts">
              {lang.texts.map((x) => (
                <TextRow key={x.id} text={x} />
              ))}
            </ul>
          </section>
        ))
      )}
    </Card>
  )
}

function TextRow({ text: x }: { text: StoreText }) {
  const { edit } = useUI()
  const n = textLength(x.text)
  const kind = STORE_TEXT_KINDS[x.kind]
  return (
    <li className="publicacion-text">
      <div className="publicacion-row-head">
        <h4>
          <button type="button" className="item-title" onClick={() => edit({ collection: 'storeTexts', id: x.id })}>
            {kind}
          </button>
        </h4>
        <StoreTextStatusPill status={x.status} />
        <span className="meta-date">
          {t(n === 1 ? 'secciones.publicacion.descripciones.chars.one' : 'secciones.publicacion.descripciones.chars.many', { n })}
        </span>
      </div>
      <div
        className="publicacion-text-body"
        tabIndex={0}
        role="region"
        aria-label={t('secciones.publicacion.descripciones.textRegion', { kind, language: x.language })}
        lang={x.language}
      >
        {x.text}
      </div>
    </li>
  )
}
