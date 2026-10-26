// La lista de feedback de una subsección (?tipo=), agrupada por estado. En Bugs se juntan el
// feedback que es un bug y las incidencias de Tareas, sin repetir: las que un bug enlaza salen
// dentro de él.
import { useState, type ReactNode } from 'react'
import { FEEDBACK_STATUSES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import {
  bugEntryId,
  bugEntryOpen,
  feedbackBugs,
  feedbackByStatus,
  feedbackFiltered,
  feedbackList,
  feedbackTipoDefaults,
  type BugEntry,
} from '../../../domain/selectors'
import type { WorkItem } from '../../../domain/types'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { ConfidenceTag, KindTag, ProjectChip, StatusPill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { TagLinks } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { FEEDBACK_STATUS_ICON, FeedbackFiltros, FeedbackPage, FeedbackRow, ImpactTag, useFeedbackQuery } from './comunes'

export function FeedbackLista({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const { tipo, query } = useFeedbackQuery()
  const key = tipo ?? 'todo'
  const showProject = scope === null
  const newFeedback = () => create('feedback', feedbackTipoDefaults(tipo))
  // Sin filtros finos ni etiqueta: ¿hay algo en esta subsección?
  const base = { scope, tipo }
  const any = tipo === 'bugs' ? feedbackBugs(data, base).length > 0 : feedbackList(data, base).length > 0
  const filtered = feedbackFiltered(query) || !!query.tag

  const empty = (
    <Card>
      <Empty icon="message" action={canEdit && !any ? { label: t('secciones.feedback.actions.new'), onClick: newFeedback } : undefined}>
        {any && filtered ? t('secciones.feedback.list.emptyFiltered') : t(`secciones.feedback.tipos.${key}.empty`)}
      </Empty>
    </Card>
  )

  let body
  if (tipo === 'bugs') {
    const entries = feedbackBugs(data, query)
    const open = entries.filter(bugEntryOpen)
    const closed = entries.filter((e) => !bugEntryOpen(e))
    body = entries.length ? (
      <>
        {open.length > 0 && <BugGroup title={t('secciones.feedback.bugs.open')} icon="bug" entries={open} showProject={showProject} />}
        {closed.length > 0 && (
          <BugGroup
            title={t('secciones.feedback.bugs.closed')}
            icon="checkCircle"
            entries={closed}
            showProject={showProject}
            folded={open.length > 0 && closed.length > FOLD_AFTER}
          />
        )}
      </>
    ) : (
      empty
    )
  } else {
    const groups = feedbackByStatus(feedbackList(data, query))
    const anyOpen = groups.some((g) => FEEDBACK_STATUSES[g.status].open)
    body = groups.length
      ? groups.map((g) => (
          <Group
            key={g.status}
            title={FEEDBACK_STATUSES[g.status].label}
            icon={FEEDBACK_STATUS_ICON[g.status]}
            subtitle={t(g.list.length === 1 ? 'secciones.feedback.count.one' : 'secciones.feedback.count.many', { n: g.list.length })}
            folded={anyOpen && !FEEDBACK_STATUSES[g.status].open && g.list.length > FOLD_AFTER}
          >
            <ul className="item-list">
              {g.list.map((f) => (
                <FeedbackRow key={f.id} feedback={f} showProject={showProject} showStatus={false} />
              ))}
            </ul>
          </Group>
        ))
      : empty
  }

  return (
    <FeedbackPage embedded={embedded} tipo={tipo} intro={<p>{t(`secciones.feedback.tipos.${key}.intro`)}</p>}>
      <FeedbackFiltros query={query} />
      {body}
    </FeedbackPage>
  )
}

/** Lo ya atendido se pliega si es largo y hay algo abierto (se despliega con un clic). */
const FOLD_AFTER = 8

function Group({ folded, children, ...card }: { title: string; icon: IconName; subtitle: string; folded?: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(!!folded)
  return (
    <Card {...card} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}>
      {children}
    </Card>
  )
}

function BugGroup({
  title,
  icon,
  entries,
  showProject,
  folded,
}: {
  title: string
  icon: 'bug' | 'checkCircle'
  entries: BugEntry[]
  showProject: boolean
  folded?: boolean
}) {
  const fb = entries.filter((e) => e.type === 'feedback').length
  const issues = entries.length - fb
  const subtitle = [
    fb > 0 && t(fb === 1 ? 'secciones.feedback.count.one' : 'secciones.feedback.count.many', { n: fb }),
    issues > 0 && t(issues === 1 ? 'secciones.feedback.bugs.issues.one' : 'secciones.feedback.bugs.issues.many', { n: issues }),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Group title={title} icon={icon} subtitle={subtitle} folded={folded}>
      <ul className="item-list">
        {entries.map((e) =>
          e.type === 'feedback' ? (
            <FeedbackRow key={bugEntryId(e)} feedback={e.feedback} showProject={showProject} />
          ) : (
            <IssueRow key={bugEntryId(e)} item={e.item} showProject={showProject} />
          ),
        )}
      </ul>
    </Group>
  )
}

/** Una incidencia de Tareas que ningún bug enlaza: se abre en su editor de siempre. */
export function IssueRow({ item: i, showProject }: { item: WorkItem; showProject: boolean }) {
  const data = useStudioData()
  const { openItem, edit } = useUI()
  const fmt = useFormat()
  const year = yearOf(useToday())
  const build = i.buildId ? data.builds.find((b) => b.id === i.buildId) : undefined
  const date = i.completedAt ?? i.createdAt
  return (
    <li className="item-row feedback-row">
      <div className="item-main">
        <button type="button" className="item-title" onClick={() => openItem(i.id)}>
          {i.title}
        </button>
        {i.description && <p className="item-detail">{i.description}</p>}
        <div className="item-meta">
          <KindTag kind="issue" />
          <span className="meta-date">{t('secciones.feedback.bugs.fromTasks')}</span>
          {date && <span className="meta-date">{fmt.date(date, year)}</span>}
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === i.projectId)} />}
          <ConfidenceTag confidence={i.confidence} compact />
          <TagLinks tags={i.tags} />
        </div>
        {build && (
          <div className="linked">
            <span className="muted small">{t('secciones.feedback.row.build')}</span>
            <button type="button" className="chip-btn" onClick={() => edit({ collection: 'builds', id: build.id })}>
              <Icon name="box" size={12} /> {build.name} <span className="version-tag">v{build.version}</span>
            </button>
          </div>
        )}
      </div>
      <div className="item-side">
        <ImpactTag impact={i.priority} priority />
        <StatusPill status={i.status} />
      </div>
    </li>
  )
}
