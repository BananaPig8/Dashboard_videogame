// Roadmap › Hitos: los hitos del ámbito, abiertos con fecha (del más cercano al más
// lejano), abiertos sin fecha y hechos. Cada uno abre su ficha en el editor común.
import { yearOf } from '../../../domain/dates'
import { roadmapMilestones, roadmapProgress } from '../../../domain/selectors'
import type { ISODate, StudioData, WorkItem } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { ConfidenceTag, Pill, PriorityTag, ProjectChip, StatusPill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { StepsProgress, useShowMore, WhenCell } from './comunes'

const CLOSED_LIMIT = 8

type Variant = 'dated' | 'undated' | 'closed'

function MilestoneRow({
  item,
  data,
  today,
  variant,
  showProject,
}: {
  item: WorkItem
  data: StudioData
  today: ISODate
  variant: Variant
  showProject: boolean
}) {
  const { openItem } = useUI()
  const canEdit = useCanEdit()
  const progress = roadmapProgress(data, item.id)
  const overdue = variant === 'dated' && !!item.dueDate && item.dueDate < today
  return (
    <li className="agenda-row roadmap-row">
      {variant !== 'undated' && <WhenCell date={variant === 'closed' ? item.completedAt : item.dueDate} today={today} year={yearOf(today)} />}
      <div className="agenda-main">
        <button type="button" className="item-title" onClick={() => openItem(item.id)}>
          {item.title}
        </button>
        <div className="item-meta">
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === item.projectId)} />}
          {overdue && (
            <Pill tone="danger" icon="clock">
              {t('secciones.roadmap.common.overdue')}
            </Pill>
          )}
          <ConfidenceTag confidence={item.confidence} compact />
          <TagLinks tags={item.tags} />
        </div>
        {/* Si el hito tiene pasos (lo que cuelga de él), su progreso. */}
        {progress.steps.length > 0 && <StepsProgress progress={progress} title={item.title} />}
      </div>
      <div className="item-side">
        <PriorityTag priority={item.priority} hideMedium />
        <StatusPill status={item.status} />
        {variant === 'undated' && canEdit && (
          <button
            type="button"
            className="btn btn-small btn-ghost"
            aria-label={t('secciones.roadmap.common.setDateFor', { title: item.title })}
            onClick={() => openItem(item.id)}
          >
            <Icon name="calendar" size={14} /> {t('secciones.roadmap.common.setDate')}
          </button>
        )}
      </div>
    </li>
  )
}

export function RoadmapHitos() {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const tag = useTagFilter()
  const { dated, undated, closed } = roadmapMilestones(data, scope, tag)
  const closedList = useShowMore(closed, CLOSED_LIMIT)
  const showProject = scope === null
  const newMilestone = { label: t('secciones.roadmap.hitos.create'), onClick: () => create('items', { kind: 'milestone', status: 'planned' }) }

  if (dated.length + undated.length + closed.length === 0)
    return (
      <Card>
        <Empty icon="flag" action={canEdit && !tag ? newMilestone : undefined}>
          {tag ? t('secciones.roadmap.hitos.noneTagged') : t('secciones.roadmap.hitos.none')}
        </Empty>
      </Card>
    )

  const row = (variant: Variant) => (i: WorkItem) => <MilestoneRow key={i.id} item={i} data={data} today={today} variant={variant} showProject={showProject} />
  return (
    <div className="roadmap-hitos">
      <div className="roadmap-col">
        <Card className="roadmap-area-dated" title={t('secciones.roadmap.hitos.datedTitle')} icon="flag" subtitle={t('secciones.roadmap.hitos.datedSubtitle')}>
          {dated.length ? (
            <ul className="agenda-list">{dated.map(row('dated'))}</ul>
          ) : (
            <Empty icon="calendar">
              {t('secciones.roadmap.hitos.datedEmpty')} {undated.length > 0 && t('secciones.roadmap.hitos.datedEmptyHint')}
            </Empty>
          )}
        </Card>
        <Card
          className="roadmap-area-closed"
          title={t('secciones.roadmap.hitos.closedTitle')}
          icon="checkCircle"
          subtitle={t('secciones.roadmap.hitos.closedSubtitle')}
        >
          {closed.length ? (
            <>
              <ul className="agenda-list">{closedList.shown.map(row('closed'))}</ul>
              {closedList.toggle}
            </>
          ) : (
            <Empty icon="flag">{t('secciones.roadmap.hitos.closedEmpty')}</Empty>
          )}
        </Card>
      </div>
      <div className="roadmap-col">
        <Card
          className="roadmap-area-undated"
          title={t('secciones.roadmap.hitos.undatedTitle')}
          icon="question"
          subtitle={t('secciones.roadmap.hitos.undatedSubtitle')}
        >
          {undated.length ? <ul className="agenda-list">{undated.map(row('undated'))}</ul> : <Empty>{t('secciones.roadmap.hitos.undatedEmpty')}</Empty>}
        </Card>
      </div>
    </div>
  )
}
