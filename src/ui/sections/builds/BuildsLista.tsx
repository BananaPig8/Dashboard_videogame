// Las builds de una subsección (?canal=), en una tabla por proyecto: qué versión es, en qué
// canal y estado está, dónde se descarga y para qué versión o evento es.
import { useSearchParams } from 'react-router-dom'
import { buildGroupDefaults, buildGroupOf, buildsInChannelGroup, hasTag, releaseLabel } from '../../../domain/selectors'
import type { Build, Project, StudioData } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { BuildChannelPill, BuildStatusPill, ConfidenceTag, ProjectChip } from '../../components/Badges'
import { Card, Empty, ExternalLink } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice, TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { yearOf } from '../../../domain/dates'
import type { SectionPageProps } from '../registry'

/** «Nada» para una celda: se ve una raya y se lee el texto. */
export function NoValue({ label }: { label: string }) {
  return (
    <>
      <span className="muted" aria-hidden="true">
        —
      </span>
      <span className="visually-hidden">{label}</span>
    </>
  )
}

export const countBuilds = (n: number) => t(n === 1 ? 'secciones.builds.list.count.one' : 'secciones.builds.list.count.many', { n })

export function BuildsLista({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, project } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const [params] = useSearchParams()
  const group = buildGroupOf(params.get('canal'))
  const tag = useTagFilter()
  const all = buildsInChannelGroup(data, group, scope)
  const builds = all.filter((b) => hasTag(b, tag))
  const key = group ?? 'todas'
  const projects = scope ? data.projects.filter((p) => p.id === scope) : data.projects.filter((p) => builds.some((b) => b.projectId === p.id))
  const newBuild = () => create('builds', buildGroupDefaults(group))

  const actions = canEdit ? (
    <button type="button" className="btn btn-primary" onClick={newBuild}>
      <Icon name="plus" size={16} /> {t('secciones.builds.actions.new')}
    </button>
  ) : undefined

  return (
    <div className={embedded ? 'builds-page' : 'page builds-page'}>
      <SectionHeader
        id="builds"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.builds.subtitleIn', { project: project.name }) : undefined}
      />
      <TagFilterNotice />
      <p className="builds-intro">{t(`secciones.builds.groups.${key}.intro`)}</p>
      {builds.length === 0 ? (
        <Card>
          <Empty icon="box" action={canEdit && !tag ? { label: t('secciones.builds.actions.new'), onClick: newBuild } : undefined}>
            {tag && all.length ? t('secciones.builds.groups.emptyTag') : t(`secciones.builds.groups.${key}.empty`)}
          </Empty>
        </Card>
      ) : (
        projects.map((p) => {
          const list = builds.filter((b) => b.projectId === p.id)
          return (
            <Card key={p.id} title={scope ? countBuilds(list.length) : p.name} icon="box" subtitle={scope ? undefined : countBuilds(list.length)}>
              {p.versions.length > 0 && (
                <p className="muted small builds-versions">
                  {t('secciones.builds.list.versions', { list: p.versions.map((v) => `${v.label} ${v.version}`).join(' · ') })}
                </p>
              )}
              {list.length ? (
                <BuildsTable builds={list} data={data} project={p} />
              ) : (
                <Empty icon="box" action={canEdit && !tag ? { label: t('secciones.builds.actions.new'), onClick: newBuild } : undefined}>
                  {tag && all.length ? t('secciones.builds.groups.emptyTag') : t(`secciones.builds.groups.${key}.empty`)}
                </Empty>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}

export function BuildsTable({ builds, data, project, showProject }: { builds: Build[]; data: StudioData; project?: Project; showProject?: boolean }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const releases = new Map(data.releases.map((r) => [r.id, r]))
  const events = new Map(data.events.map((e) => [e.id, e]))
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  const L = (k: 'build' | 'channel' | 'status' | 'date' | 'platforms' | 'where' | 'release' | 'event') => t(`secciones.builds.table.${k}`)
  return (
    <div className="table-wrap">
      <table className="table builds-table">
        <caption className="visually-hidden">{t('secciones.builds.list.caption', { project: project?.name ?? '' })}</caption>
        <thead>
          <tr>
            <th scope="col">{L('build')}</th>
            <th scope="col">{L('channel')}</th>
            <th scope="col">{L('status')}</th>
            <th scope="col">{L('date')}</th>
            <th scope="col">{L('platforms')}</th>
            <th scope="col">{L('where')}</th>
            <th scope="col">{L('release')}</th>
            <th scope="col">{L('event')}</th>
          </tr>
        </thead>
        <tbody>
          {builds.map((b) => {
            const release = b.releaseId ? releases.get(b.releaseId) : undefined
            const event = b.eventId ? events.get(b.eventId) : undefined
            return (
              <tr key={b.id}>
                <th scope="row" className="builds-name">
                  <div className="builds-name-head">
                    <button type="button" className="item-title" onClick={() => edit({ collection: 'builds', id: b.id })}>
                      {b.name}
                    </button>
                    <span className="version-tag">v{b.version}</span>
                    <ConfidenceTag confidence={b.confidence} compact />
                  </div>
                  {(showProject || b.tags?.length) && (
                    <div className="item-meta">
                      {showProject && <ProjectChip project={projects.get(b.projectId)} />}
                      <TagLinks tags={b.tags} />
                    </div>
                  )}
                  {b.notes && <p className="item-detail">{b.notes}</p>}
                </th>
                <td data-label={L('channel')}>
                  <BuildChannelPill channel={b.channel} />
                </td>
                <td data-label={L('status')}>
                  <BuildStatusPill status={b.status} />
                </td>
                <td data-label={L('date')} className="nowrap">
                  {b.date ? fmt.date(b.date, year) : <span className="muted">{t('secciones.builds.table.noDate')}</span>}
                </td>
                <td data-label={L('platforms')}>{b.platforms.length ? b.platforms.join(', ') : <NoValue label={t('secciones.builds.table.none')} />}</td>
                <td data-label={L('where')}>
                  {b.url ? (
                    <ExternalLink href={b.url}>{b.distribution ?? t('secciones.builds.table.open')}</ExternalLink>
                  ) : (
                    (b.distribution ?? <NoValue label={t('secciones.builds.table.none')} />)
                  )}
                </td>
                <td data-label={L('release')}>
                  {release ? (
                    <button type="button" className="link-btn" onClick={() => edit({ collection: 'releases', id: release.id })}>
                      {releaseLabel(release)}
                    </button>
                  ) : b.releaseId ? (
                    <span className="muted">{t('secciones.builds.table.missing')}</span>
                  ) : (
                    <NoValue label={t('secciones.builds.table.noRelease')} />
                  )}
                </td>
                <td data-label={L('event')}>
                  {event ? (
                    <button type="button" className="link-btn" onClick={() => edit({ collection: 'events', id: event.id })}>
                      {event.title}
                    </button>
                  ) : b.eventId ? (
                    <span className="muted">{t('secciones.builds.table.missing')}</span>
                  ) : (
                    <NoValue label={t('secciones.builds.table.noEvent')} />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
