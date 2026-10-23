// Piezas comunes de las vistas de Publicación: la cabecera de la página, el aviso de que todo
// se apunta a mano, las etiquetas de estado (fichas, versiones, logros, textos), las fuentes
// y las listas de recursos.
import type { ReactNode } from 'react'
import {
  ACHIEVEMENT_STATUSES,
  LISTING_KINDS,
  LISTING_STATUSES,
  RELEASE_KINDS,
  RELEASE_STATUSES,
  RESOURCE_TYPES,
  SOURCE_TYPES,
  STORE_PLATFORMS,
  STORE_TEXT_STATUSES,
} from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { releaseLate } from '../../../domain/selectors'
import type { AchievementStatus, ListingStatus, Project, Release, ReleaseStatus, Resource, SourceRef, StoreListing, StoreText } from '../../../domain/types'
import { useCanEdit, useStudioData, type CollectionKey } from '../../../data/store'
import { intlLocale, t } from '../../../i18n'
import { ConfidenceTag, Pill, ProjectChip } from '../../components/Badges'
import { ExternalLink } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice, TagLinks } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { sourceHref } from '../../util'

/** La página de una vista: cabecera de la sección, aviso de etiqueta y el contenido. */
export function PublicacionPage({ embedded, actions, children }: { embedded?: boolean; actions?: ReactNode; children: ReactNode }) {
  const { project } = useScope()
  return (
    <div className={embedded ? 'publicacion-page' : 'page publicacion-page'}>
      <SectionHeader
        id="publicacion"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.publicacion.subtitleIn', { project: project.name }) : undefined}
      />
      <TagFilterNotice />
      {children}
    </div>
  )
}

/** Botón de crear (solo si se puede editar). */
export function NewButton({
  collection,
  defaults,
  label,
  primary,
}: {
  collection: CollectionKey
  defaults?: Record<string, unknown>
  label: string
  primary?: boolean
}) {
  const { create } = useUI()
  if (!useCanEdit()) return null
  return (
    <button type="button" className={primary ? 'btn btn-primary' : 'btn'} onClick={() => create(collection, defaults)}>
      <Icon name="plus" size={16} /> {label}
    </button>
  )
}

/** Aviso fijo: nada de esto está conectado a una tienda; lo apunta el estudio. */
export function ManualNotice({ kind }: { kind: 'steam' | 'stores' | 'achievements' }) {
  return (
    <p className="banner publicacion-manual" role="note">
      <Icon name="info" size={16} />
      <span>{t(`secciones.publicacion.manual.${kind}`)}</span>
    </p>
  )
}

// ——— Estados ——————————————————————————————————————————————————————————————

const LISTING_ICON: Record<ListingStatus, IconName> = {
  not_started: 'circleDashed',
  draft: 'edit',
  in_review: 'eye',
  changes_requested: 'alert',
  approved: 'checkCircle',
  coming_soon: 'calendar',
  released: 'rocket',
}

export const ListingStatusPill = ({ status }: { status: ListingStatus }) => (
  <Pill tone={LISTING_STATUSES[status].tone} icon={LISTING_ICON[status]}>
    {LISTING_STATUSES[status].label}
  </Pill>
)

export const LISTING_STATUS_ICON = LISTING_ICON

const RELEASE_ICON: Record<ReleaseStatus, IconName> = { idea: 'bulb', planned: 'calendar', in_progress: 'play', released: 'checkCircle', cancelled: 'xCircle' }

export const ReleaseStatusPill = ({ status }: { status: ReleaseStatus }) => (
  <Pill tone={RELEASE_STATUSES[status].tone} icon={RELEASE_ICON[status]}>
    {RELEASE_STATUSES[status].label}
  </Pill>
)

const ACHIEVEMENT_ICON: Record<AchievementStatus, IconName> = { idea: 'bulb', designed: 'edit', implemented: 'check', in_store: 'trophy' }

export const AchievementStatusPill = ({ status }: { status: AchievementStatus }) => (
  <Pill tone={ACHIEVEMENT_STATUSES[status].tone} icon={ACHIEVEMENT_ICON[status]}>
    {ACHIEVEMENT_STATUSES[status].label}
  </Pill>
)

export const StoreTextStatusPill = ({ status }: { status: StoreText['status'] }) => (
  <Pill tone={STORE_TEXT_STATUSES[status].tone} icon={status === 'final' ? 'checkCircle' : 'edit'}>
    {STORE_TEXT_STATUSES[status].label}
  </Pill>
)

// ——— Fichas y versiones ———————————————————————————————————————————————————

/** «Steam · Juego». */
export const listingName = (l: Pick<StoreListing, 'platform' | 'kind'>) => `${STORE_PLATFORMS[l.platform]} · ${LISTING_KINDS[l.kind]}`

/** «Actualización 1.1 (1.1.0)». */
export const releaseName = (r: Release) => (r.version ? `${r.name} (${r.version})` : r.name)

/** Cuándo sale una versión: publicada, prevista (sin confirmar, con retraso) o sin fecha. */
export function ReleaseWhen({ release: r }: { release: Release }) {
  const fmt = useFormat()
  const today = useToday()
  const year = yearOf(today)
  if (r.releasedAt) return <span className="meta-date">{t('secciones.publicacion.release.released', { date: fmt.date(r.releasedAt, year) })}</span>
  if (!r.targetDate) return <span className="meta-date muted">{t('secciones.publicacion.release.noDate')}</span>
  return (
    <>
      <span className="meta-date">{t('secciones.publicacion.release.target', { date: fmt.date(r.targetDate, year) })}</span>
      {!r.targetConfirmed && (
        <Pill tone="warning" icon="question">
          {t('secciones.publicacion.release.unconfirmed')}
        </Pill>
      )}
      {releaseLate(r, today) && (
        <Pill tone="danger" icon="clock">
          {t('secciones.publicacion.release.late')}
        </Pill>
      )}
    </>
  )
}

export const releaseKindLabel = (r: Release) => RELEASE_KINDS[r.kind]

/** Las fuentes de un dato, con su enlace si lo hay. */
export function SourceLinks({ sources, project }: { sources: SourceRef[]; project?: Project }) {
  if (!sources.length) return <span className="muted small">{t('secciones.publicacion.listing.noSources')}</span>
  return (
    <span className="publicacion-sources">
      <span className="muted small">{t('secciones.publicacion.listing.sources')}</span>
      {sources.map((s, k) => {
        const href = sourceHref(s, project)
        return (
          <span key={k} className="publicacion-source" title={s.note}>
            <span className="source-type">{SOURCE_TYPES[s.type]}</span> {href ? <ExternalLink href={href}>{s.ref}</ExternalLink> : s.ref}
          </span>
        )
      })}
    </span>
  )
}

/** Nombre de un idioma en el idioma de la interfaz («español (es)»); si no se conoce, el código. */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([intlLocale()], { type: 'language' }).of(code)
    return name && name !== code ? `${name} (${code})` : code
  } catch {
    return code
  }
}

// ——— Recursos ———————————————————————————————————————————————————————————————

/** Lista de recursos (material, capturas, vídeos): enlace, para qué es, fecha, ruta y etiquetas. */
export function ResourceRows({ resources, showProject }: { resources: Resource[]; showProject: boolean }) {
  const data = useStudioData()
  const { edit } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  return (
    <ul className="resource-list publicacion-resources">
      {resources.map((r) => {
        const project = r.projectId ? projects.get(r.projectId) : undefined
        const url = r.url ?? (r.path && project?.repoUrl ? `${project.repoUrl.replace(/\/$/, '')}/blob/main/${r.path}` : undefined)
        return (
          <li key={r.id}>
            <div className="resource-head">
              {url ? <ExternalLink href={url}>{r.title}</ExternalLink> : <strong>{r.title}</strong>}
              {canEdit && (
                <button
                  type="button"
                  className="icon-btn small"
                  aria-label={t('secciones.publicacion.actions.edit', { name: r.title })}
                  title={t('secciones.publicacion.actions.edit', { name: r.title })}
                  onClick={() => edit({ collection: 'resources', id: r.id })}
                >
                  <Icon name="edit" size={14} />
                </button>
              )}
            </div>
            {r.description && <p className="item-detail">{r.description}</p>}
            <div className="item-meta">
              <span className="meta-date">{RESOURCE_TYPES[r.type]}</span>
              {r.date && <span className="meta-date">{fmt.date(r.date, year)}</span>}
              {r.path && <code>{r.path}</code>}
              {showProject && (project ? <ProjectChip project={project} /> : <span className="meta-date">{t('secciones.publicacion.resources.studio')}</span>)}
              <TagLinks tags={r.tags} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Una ficha de tienda: estado, fiabilidad, App ID y enlace (solo si existen), versión, notas y fuentes. */
export function ListingRow({ listing: l, showProject, children }: { listing: StoreListing; showProject: boolean; children?: ReactNode }) {
  const data = useStudioData()
  const { edit } = useUI()
  const project = data.projects.find((p) => p.id === l.projectId)
  const release = l.releaseId ? data.releases.find((r) => r.id === l.releaseId) : undefined
  return (
    <li className="publicacion-listing">
      <div className="publicacion-row-head">
        <button type="button" className="item-title" onClick={() => edit({ collection: 'storeListings', id: l.id })}>
          {listingName(l)}
        </button>
        <ListingStatusPill status={l.status} />
        <ConfidenceTag confidence={l.confidence} />
      </div>
      <div className="item-meta">
        {showProject && <ProjectChip project={project} />}
        {l.appId ? (
          <span className="meta-date">
            {t('secciones.publicacion.listing.appId')} <code>{l.appId}</code>
          </span>
        ) : (
          <span className="meta-date muted">{t('secciones.publicacion.listing.noAppId')}</span>
        )}
        {l.url && (
          <span className="meta-date">
            <ExternalLink href={l.url}>{t('secciones.publicacion.listing.page')}</ExternalLink>
          </span>
        )}
        {release && <span className="meta-date">{t('secciones.publicacion.listing.release', { name: releaseName(release) })}</span>}
        <TagLinks tags={l.tags} />
      </div>
      {children}
      {l.notes && <p className="item-detail">{l.notes}</p>}
      <SourceLinks sources={l.sources} project={project} />
    </li>
  )
}
