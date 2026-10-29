// Roadmap › Versiones: lo que aún no ha salido a los jugadores (idea, prevista, en
// preparación), por fecha prevista, con si la fecha está confirmada, sus builds
// (build.releaseId) y lo que lleva (item.releaseId). Lo publicado vive en Publicación.
import { RELEASE_KINDS } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { roadmapReleases, type RoadmapRelease } from '../../../domain/selectors'
import type { ISODate, StudioData } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { BuildStatusPill, ConfidenceTag, KindIcon, Pill, ProjectChip, StatusPill } from '../../components/Badges'
import { Card, Empty, Progress } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { ReleaseStatusPill } from './comunes'

/** Cuántos elementos de una versión se enseñan (el resto, «y N más»). */
const ITEM_LIMIT = 6

function ReleaseBlock({ r, data, today, showProject }: { r: RoadmapRelease; data: StudioData; today: ISODate; showProject: boolean }) {
  const { edit, openItem, create } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const year = yearOf(today)
  const { release, builds, items, itemsDone, itemsTotal, confirmed, late } = r
  return (
    <li className="roadmap-release">
      <div className="roadmap-release-head">
        <h3>
          <button type="button" className="item-title" onClick={() => edit({ collection: 'releases', id: release.id })}>
            {release.name}
          </button>{' '}
          {release.version && <span className="version-tag">v{release.version}</span>}
        </h3>
        <ReleaseStatusPill status={release.status} />
      </div>
      <div className="item-meta">
        <span className="meta-date">{RELEASE_KINDS[release.kind]}</span>
        {showProject && <ProjectChip project={data.projects.find((p) => p.id === release.projectId)} />}
        {release.targetDate ? (
          <span className="meta-date">
            <Icon name="calendar" size={12} /> {t('secciones.roadmap.versiones.target', { date: fmt.date(release.targetDate, year) })} ·{' '}
            {fmt.relative(release.targetDate, today)}
          </span>
        ) : (
          <span className="meta-date">{t('secciones.roadmap.versiones.noTarget')}</span>
        )}
        {release.targetDate &&
          (confirmed ? (
            <Pill tone="success" icon="checkCircle">
              {t('secciones.roadmap.versiones.confirmed')}
            </Pill>
          ) : (
            <Pill tone="warning" icon="question" title={t('secciones.roadmap.common.unconfirmedHint')}>
              {t('secciones.roadmap.versiones.unconfirmed')}
            </Pill>
          ))}
        {late && (
          <Pill tone="danger" icon="clock" title={t('secciones.roadmap.versiones.lateHint')}>
            {t('secciones.roadmap.versiones.late')}
          </Pill>
        )}
        <ConfidenceTag confidence={release.confidence} compact />
        <TagLinks tags={release.tags} />
      </div>
      {release.notes && <p className="item-detail">{release.notes}</p>}
      <div className="roadmap-release-body">
        <section aria-label={t('secciones.roadmap.versiones.builds')}>
          <h4 className="subhead">{t('secciones.roadmap.versiones.builds')}</h4>
          {builds.length ? (
            <ul className="roadmap-step-list">
              {builds.map((b) => (
                <li key={b.id}>
                  <button type="button" className="item-title" onClick={() => edit({ collection: 'builds', id: b.id })}>
                    {b.name}
                  </button>
                  <span className="version-tag">v{b.version}</span>
                  <BuildStatusPill status={b.status} />
                  <ConfidenceTag confidence={b.confidence} compact />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('secciones.roadmap.versiones.buildsNone')}</p>
          )}
        </section>
        <section aria-label={t('secciones.roadmap.versiones.items')}>
          <h4 className="subhead">
            {t('secciones.roadmap.versiones.items')}
            {itemsTotal > 0 && ` · ${t('secciones.roadmap.versiones.itemsProgress', { done: itemsDone, total: itemsTotal })}`}
          </h4>
          {items.length ? (
            <>
              {itemsTotal > 0 && (
                <Progress
                  ratio={itemsDone / itemsTotal}
                  label={t('secciones.roadmap.common.progressOf', { title: release.name })}
                  tone={itemsDone === itemsTotal ? 'success' : 'info'}
                />
              )}
              <ul className="roadmap-step-list">
                {items.slice(0, ITEM_LIMIT).map((i) => (
                  <li key={i.id} className={i.status === 'done' || i.status === 'cancelled' ? 'closed' : undefined}>
                    <KindIcon kind={i.kind} />
                    <button type="button" className="item-title" onClick={() => openItem(i.id)}>
                      {i.title}
                    </button>
                    <StatusPill status={i.status} />
                  </li>
                ))}
              </ul>
              {items.length > ITEM_LIMIT && <p className="muted small">{t('secciones.roadmap.versiones.more', { n: items.length - ITEM_LIMIT })}</p>}
            </>
          ) : (
            <p className="muted small">{t('secciones.roadmap.versiones.itemsNone')}</p>
          )}
        </section>
      </div>
      {canEdit && (
        <div className="roadmap-release-actions">
          <button
            type="button"
            className="btn btn-small btn-ghost"
            aria-label={t('secciones.roadmap.versiones.addBuildTo', { name: release.name })}
            onClick={() => create('builds', { projectId: release.projectId, releaseId: release.id, ...(release.version ? { version: release.version } : {}) })}
          >
            <Icon name="box" size={14} /> {t('secciones.roadmap.versiones.addBuild')}
          </button>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            aria-label={t('secciones.roadmap.versiones.addItemTo', { name: release.name })}
            onClick={() => create('items', { projectId: release.projectId, releaseId: release.id })}
          >
            <Icon name="plus" size={14} /> {t('secciones.roadmap.versiones.addItem')}
          </button>
        </div>
      )}
    </li>
  )
}

export function RoadmapVersiones() {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const tag = useTagFilter()
  const { upcoming, released, cancelled } = roadmapReleases(data, today, scope, tag)
  const others = released + cancelled > 0 ? ` ${t('secciones.roadmap.versiones.others', { released, cancelled })}` : ''
  return (
    <Card title={t('secciones.roadmap.versiones.title')} icon="rocket" subtitle={t('secciones.roadmap.versiones.subtitle')}>
      {upcoming.length ? (
        <ul className="roadmap-releases">
          {upcoming.map((r) => (
            <ReleaseBlock key={r.release.id} r={r} data={data} today={today} showProject={scope === null} />
          ))}
        </ul>
      ) : (
        <Empty icon="rocket" action={canEdit && !tag ? { label: t('secciones.roadmap.versiones.create'), onClick: () => create('releases') } : undefined}>
          {tag ? t('secciones.roadmap.versiones.noneTagged') : t('secciones.roadmap.versiones.none')}
        </Empty>
      )}
      <p className="muted small roadmap-note">
        <Icon name="info" size={14} /> {t('secciones.roadmap.versiones.manual')}
        {others}
      </p>
    </Card>
  )
}
