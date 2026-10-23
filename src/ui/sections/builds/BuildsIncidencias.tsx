// Incidencias por versión: las incidencias de cada build (abiertas y resueltas) y el feedback
// que se vio con ella; al final, las que no dicen en qué build aparecen.
import { FEEDBACK_KINDS, FEEDBACK_ORIGINS } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { hasTag, issuesByBuild, type BuildIssues } from '../../../domain/selectors'
import type { Feedback, FeedbackKind } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { BuildChannelPill, BuildStatusPill, ConfidenceTag, FeedbackStatusPill, Pill, ProjectChip } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice, TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'

const FEEDBACK_KIND_ICON: Record<FeedbackKind, IconName> = { comment: 'message', bug: 'bug', request: 'star' }

export function BuildsIncidencias({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, project } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const groups = issuesByBuild(data, scope, (x) => hasTag(x, tag))
  const anyAtAll = tag ? issuesByBuild(data, scope).length > 0 : groups.length > 0
  const newIssue = () => create('items', { kind: 'issue', priority: 'high' })

  const actions = canEdit ? (
    <button type="button" className="btn btn-primary" onClick={newIssue}>
      <Icon name="plus" size={16} /> {t('secciones.builds.actions.newIssue')}
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
      <p className="builds-intro">{t('secciones.builds.incidencias.intro')}</p>
      {groups.length === 0 ? (
        <Card>
          <Empty icon="bug" action={canEdit && !tag ? { label: t('secciones.builds.actions.newIssue'), onClick: newIssue } : undefined}>
            {anyAtAll ? t('secciones.builds.incidencias.emptyTag') : t('secciones.builds.incidencias.empty')}
          </Empty>
        </Card>
      ) : (
        <div className="builds-issues">
          {groups.map((g) => (
            <IssueGroup key={g.build?.id ?? 'sin-build'} group={g} showProject={scope === null} />
          ))}
        </div>
      )}
    </div>
  )
}

function IssueGroup({ group: g, showProject }: { group: BuildIssues; showProject: boolean }) {
  const data = useStudioData()
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const today = useToday()
  const year = yearOf(today)
  const b = g.build
  const summary = [
    t(g.open.length === 1 ? 'secciones.builds.incidencias.count.openOne' : 'secciones.builds.incidencias.count.openMany', { n: g.open.length }),
    g.closed.length > 0 &&
      t(g.closed.length === 1 ? 'secciones.builds.incidencias.closed.one' : 'secciones.builds.incidencias.closed.many', { n: g.closed.length }),
    g.feedback.length > 0 && t('secciones.builds.incidencias.count.feedback', { n: g.feedback.length }),
  ]
    .filter(Boolean)
    .join(' · ')
  const action =
    b && canEdit ? (
      <button
        type="button"
        className="btn btn-small btn-ghost"
        onClick={() => create('items', { kind: 'issue', priority: 'high', projectId: b.projectId, buildId: b.id })}
      >
        <Icon name="plus" size={14} /> {t('secciones.builds.actions.newIssueIn')}
      </button>
    ) : undefined
  return (
    <Card title={b ? b.name : t('secciones.builds.incidencias.noBuild')} icon={b ? 'box' : 'bug'} subtitle={summary} action={action}>
      {b ? (
        <div className="item-meta builds-issue-build">
          <span className="version-tag">v{b.version}</span>
          <BuildChannelPill channel={b.channel} />
          <BuildStatusPill status={b.status} />
          {b.date && <span className="meta-date">{fmt.date(b.date, year)}</span>}
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === b.projectId)} />}
          <button
            type="button"
            className="icon-btn small"
            onClick={() => edit({ collection: 'builds', id: b.id })}
            aria-label={t('secciones.builds.actions.edit', { name: b.name })}
            title={t('secciones.builds.actions.edit', { name: b.name })}
          >
            <Icon name="edit" size={14} />
          </button>
        </div>
      ) : (
        <p className="muted small">{t('secciones.builds.incidencias.noBuildHint')}</p>
      )}
      <h3 className="subhead">{t('secciones.builds.incidencias.open')}</h3>
      <ItemList
        items={g.open}
        data={data}
        showProject={showProject && !b}
        detail="blocked"
        year={year}
        today={today}
        showTags
        empty={t('secciones.builds.incidencias.noneOpen')}
      />
      {g.feedback.length > 0 && (
        <>
          <h3 className="subhead">{t('secciones.builds.incidencias.feedback')}</h3>
          <ul className="item-list">
            {g.feedback.map((f) => (
              <FeedbackRow key={f.id} feedback={f} />
            ))}
          </ul>
        </>
      )}
      {g.closed.length > 0 && (
        <details className="subsection builds-closed">
          <summary>
            {t(g.closed.length === 1 ? 'secciones.builds.incidencias.closed.one' : 'secciones.builds.incidencias.closed.many', { n: g.closed.length })}
          </summary>
          <ItemList items={g.closed} data={data} showProject={showProject && !b} year={year} showTags />
        </details>
      )}
    </Card>
  )
}

function FeedbackRow({ feedback: f }: { feedback: Feedback }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  return (
    <li className="item-row">
      <div className="item-main">
        <button type="button" className="item-title" onClick={() => edit({ collection: 'feedback', id: f.id })}>
          {f.title}
        </button>
        {f.detail && <p className="item-detail">{f.detail}</p>}
        <div className="item-meta">
          {f.kind && (
            <Pill tone={FEEDBACK_KINDS[f.kind].tone} icon={FEEDBACK_KIND_ICON[f.kind]}>
              {FEEDBACK_KINDS[f.kind].label}
            </Pill>
          )}
          <span className="meta-date">
            {FEEDBACK_ORIGINS[f.origin]}
            {f.originDetail ? ` · ${f.originDetail}` : ''}
          </span>
          {f.receivedAt && <span className="meta-date">{fmt.date(f.receivedAt, year)}</span>}
          <ConfidenceTag confidence={f.confidence} compact />
          <TagLinks tags={f.tags} />
        </div>
      </div>
      <div className="item-side">
        <FeedbackStatusPill status={f.status} />
      </div>
    </li>
  )
}
