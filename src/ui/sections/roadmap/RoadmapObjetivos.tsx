// Roadmap › Objetivos: cada objetivo con su progreso, que sale SOLO de lo que cuelga de él
// (parentId): pasos hechos sobre el total, sin los descartados. Sin pasos, no hay porcentaje.
import { yearOf } from '../../../domain/dates'
import { roadmapGoals, type RoadmapGoal } from '../../../domain/selectors'
import type { StudioData } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { ConfidenceTag, KindIcon, PriorityTag, ProjectChip, StatusPill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { DueTag } from '../../components/ItemList'
import { TagLinks, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import { StepsProgress } from './comunes'

/** Hasta cuántos pasos se enseñan desplegados de entrada. */
const OPEN_STEPS = 6

function GoalRow({ g, data, showProject }: { g: RoadmapGoal; data: StudioData; showProject: boolean }) {
  const { openItem, create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const { goal, progress } = g
  return (
    <li className="roadmap-goal">
      <div className="roadmap-goal-head">
        <h3>
          <button type="button" className="item-title" onClick={() => openItem(goal.id)}>
            {goal.title}
          </button>
        </h3>
        <div className="item-side">
          <PriorityTag priority={goal.priority} hideMedium />
          <StatusPill status={goal.status} />
        </div>
      </div>
      {goal.description && <p className="item-detail">{goal.description}</p>}
      <div className="item-meta">
        {showProject && <ProjectChip project={data.projects.find((p) => p.id === goal.projectId)} />}
        <DueTag item={goal} today={today} year={yearOf(today)} />
        <ConfidenceTag confidence={goal.confidence} compact />
        <TagLinks tags={goal.tags} />
      </div>
      <StepsProgress progress={progress} title={goal.title} />
      {progress.steps.length > 0 && (
        <details className="roadmap-steps" open={progress.steps.length <= OPEN_STEPS}>
          <summary>{t('secciones.roadmap.objetivos.steps', { n: progress.steps.length })}</summary>
          <ul className="roadmap-step-list">
            {progress.steps.map((s) => (
              <li key={s.id} className={s.status === 'done' || s.status === 'cancelled' ? 'closed' : undefined}>
                <KindIcon kind={s.kind} />
                <button type="button" className="item-title" onClick={() => openItem(s.id)}>
                  {s.title}
                </button>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {canEdit && (
        <div>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            aria-label={t('secciones.roadmap.objetivos.addStepTo', { title: goal.title })}
            onClick={() => create('items', { kind: 'task', projectId: goal.projectId, parentId: goal.id })}
          >
            <Icon name="plus" size={14} /> {t('secciones.roadmap.objetivos.addStep')}
          </button>
        </div>
      )}
    </li>
  )
}

export function RoadmapObjetivos() {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const { open, closed } = roadmapGoals(data, scope, tag)
  const showProject = scope === null
  const newGoal = { label: t('secciones.roadmap.objetivos.create'), onClick: () => create('items', { kind: 'goal', status: 'planned' }) }

  if (open.length + closed.length === 0)
    return (
      <Card>
        <Empty icon="target" action={canEdit && !tag ? newGoal : undefined}>
          {tag ? t('secciones.roadmap.objetivos.noneTagged') : t('secciones.roadmap.objetivos.none')}
        </Empty>
      </Card>
    )

  return (
    <>
      <Card title={t('secciones.roadmap.objetivos.openTitle')} icon="target" subtitle={t('secciones.roadmap.objetivos.howTo')}>
        {open.length ? (
          <ul className="roadmap-goals">
            {open.map((g) => (
              <GoalRow key={g.goal.id} g={g} data={data} showProject={showProject} />
            ))}
          </ul>
        ) : (
          <Empty icon="target" action={canEdit && !tag ? newGoal : undefined}>
            {t('secciones.roadmap.objetivos.openEmpty')}
          </Empty>
        )}
      </Card>
      {closed.length > 0 && (
        <Card title={t('secciones.roadmap.objetivos.closedTitle')} icon="checkCircle">
          <ul className="roadmap-goals">
            {closed.map((g) => (
              <GoalRow key={g.goal.id} g={g} data={data} showProject={showProject} />
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
