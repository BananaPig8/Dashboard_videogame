// Roadmap › Fases: por proyecto, las etapas del ciclo de vida en orden (de la idea a
// publicado) con la actual (la de la ficha del proyecto) y las fases apuntadas con sus fechas.
import { STAGES } from '../../../domain/catalog'
import { yearOf } from '../../../domain/dates'
import { roadmapPhaseLate, roadmapPhases, type RoadmapProjectPhases, type RoadmapStageState } from '../../../domain/selectors'
import type { ISODate, Phase } from '../../../domain/types'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Pill } from '../../components/Badges'
import { Card, Empty } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import type { Tone } from '../../../domain/catalog'
import { PhaseStatusPill } from './comunes'

const STATE: Record<RoadmapStageState, { tone: Tone; icon: IconName }> = {
  current: { tone: 'info', icon: 'play' },
  done: { tone: 'success', icon: 'checkCircle' },
  planned: { tone: 'info', icon: 'calendar' },
  past: { tone: 'muted', icon: 'history' },
  ahead: { tone: 'muted', icon: 'circleDashed' },
  unknown: { tone: 'muted', icon: 'question' },
}

function PhaseRow({ phase, today }: { phase: Phase; today: ISODate }) {
  const { edit } = useUI()
  const fmt = useFormat()
  const year = yearOf(today)
  const from = phase.startDate && fmt.date(phase.startDate, year)
  const to = phase.endDate && fmt.date(phase.endDate, year)
  const dates =
    from && to
      ? t('secciones.roadmap.fases.range', { from, to })
      : from
        ? t('secciones.roadmap.fases.from', { date: from })
        : to
          ? t('secciones.roadmap.fases.until', { date: to })
          : t('secciones.roadmap.fases.noDates')
  const late = roadmapPhaseLate(phase, today)
  return (
    <li className="roadmap-phase">
      <button type="button" className="item-title" onClick={() => edit({ collection: 'phases', id: phase.id })}>
        {phase.title || t('secciones.roadmap.fases.unnamed', { stage: STAGES[phase.stage].label })}
      </button>
      <span className="meta-date">{dates}</span>
      <span className="roadmap-phase-pills">
        <PhaseStatusPill status={phase.status} />
        {late && (
          <Pill tone="warning" icon="clock" title={t('secciones.roadmap.fases.lateHint')}>
            {t('secciones.roadmap.fases.late')}
          </Pill>
        )}
      </span>
    </li>
  )
}

function ProjectPhases({ r, showName, today }: { r: RoadmapProjectPhases; showName: boolean; today: ISODate }) {
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const { project, stages, count } = r
  const actions = canEdit && (
    <>
      <button
        type="button"
        className="btn btn-small btn-ghost"
        aria-label={t('secciones.roadmap.fases.changeStageFor', { project: project.name })}
        onClick={() => edit({ collection: 'projects', id: project.id })}
      >
        <Icon name="edit" size={14} /> <span className="hide-narrow">{t('secciones.roadmap.fases.changeStage')}</span>
      </button>
      <button
        type="button"
        className="btn btn-small"
        aria-label={t('secciones.roadmap.fases.addFor', { project: project.name })}
        onClick={() => create('phases', { projectId: project.id, stage: project.stage })}
      >
        <Icon name="plus" size={14} /> {t('secciones.roadmap.fases.add')}
      </button>
    </>
  )
  const subtitle = count === 1 ? t('secciones.roadmap.fases.phasesCountOne') : count > 1 ? t('secciones.roadmap.fases.phasesCount', { n: count }) : undefined
  return (
    <Card
      title={showName ? project.name : t('secciones.roadmap.fases.stagesOf', { project: project.name })}
      icon="layers"
      subtitle={subtitle}
      action={actions || undefined}
    >
      {count === 0 && (
        <p className="roadmap-note">
          <Icon name="info" size={14} /> {t('secciones.roadmap.fases.noPhases')}
        </p>
      )}
      <ol className="roadmap-stages" aria-label={t('secciones.roadmap.fases.stagesOf', { project: project.name })}>
        {stages.map((s) => (
          <li key={s.stage} className={`roadmap-stage state-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
            <span className="roadmap-stage-name">{STAGES[s.stage].label}</span>
            <Pill tone={STATE[s.state].tone} icon={STATE[s.state].icon}>
              {t(`secciones.roadmap.fases.states.${s.state}`)}
            </Pill>
            {s.phases.length > 0 && (
              <ul className="roadmap-phases">
                {s.phases.map((p) => (
                  <PhaseRow key={p.id} phase={p} today={today} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function RoadmapFases() {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const list = roadmapPhases(data, scope)
  if (list.length === 0)
    return (
      <Card>
        <Empty icon="folder" action={canEdit ? { label: t('quick.project'), onClick: () => create('projects') } : undefined}>
          {t('secciones.roadmap.fases.noProjects')}
        </Empty>
      </Card>
    )
  return (
    <>
      {list.map((r) => (
        <ProjectPhases key={r.project.id} r={r} showName={scope === null} today={today} />
      ))}
      <p className="muted small roadmap-note">
        <Icon name="info" size={14} /> {t('secciones.roadmap.fases.hint')}
      </p>
    </>
  )
}
