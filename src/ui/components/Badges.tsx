import type { ReactNode } from 'react'
import {
  BUILD_CHANNELS,
  BUILD_STATUSES,
  CONFIDENCES,
  EVENT_STATUSES,
  FEEDBACK_STATUSES,
  KINDS,
  PRIORITIES,
  STAGES,
  STATUSES,
  type Tone,
} from '../../domain/catalog'
import type {
  Area,
  BuildChannel,
  BuildStatus,
  Confidence,
  EventStatus,
  FeedbackStatus,
  ItemKind,
  ItemStatus,
  Priority,
  Project,
  ProjectStage,
} from '../../domain/types'
import type { HealthLevel } from '../../domain/selectors'
import { Icon, type IconName } from './Icon'

export function Pill({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`pill tone-${tone}`} title={title}>
      {children}
    </span>
  )
}

export const StatusPill = ({ status }: { status: ItemStatus }) => <Pill tone={STATUSES[status].tone}>{STATUSES[status].label}</Pill>

export const StagePill = ({ stage }: { stage: ProjectStage }) => <Pill tone={STAGES[stage].tone}>{STAGES[stage].label}</Pill>

export function PriorityTag({ priority, hideMedium }: { priority: Priority; hideMedium?: boolean }) {
  if (hideMedium && (priority === 'medium' || priority === 'low')) return null
  return (
    <span className={`priority priority-${priority}`} title={`Prioridad ${PRIORITIES[priority].label.toLowerCase()}`}>
      {PRIORITIES[priority].label}
    </span>
  )
}

const KIND_ICON: Record<ItemKind, IconName> = {
  task: 'check',
  feature: 'star',
  milestone: 'flag',
  decision: 'scale',
  issue: 'bug',
}

export function KindIcon({ kind }: { kind: ItemKind }) {
  return (
    <span className={`kind-icon kind-${kind}`} title={KINDS[kind].label}>
      <Icon name={KIND_ICON[kind]} size={14} />
    </span>
  )
}

export const KindTag = ({ kind }: { kind: ItemKind }) => (
  <Pill tone={KINDS[kind].tone}>
    <Icon name={KIND_ICON[kind]} size={12} /> {KINDS[kind].label}
  </Pill>
)

export function AreaTag({ area }: { area?: Area }) {
  if (!area) return null
  return (
    <span className="area-tag" title={area.description}>
      <span className="dot" style={{ background: area.color }} />
      {area.name}
    </span>
  )
}

export function ProjectChip({ project }: { project?: Project }) {
  if (!project) return null
  return (
    <span className="project-chip" title={project.name}>
      <span className="dot" style={{ background: project.color }} />
      {project.name}
    </span>
  )
}

export function ConfidenceTag({ confidence, compact }: { confidence: Confidence; compact?: boolean }) {
  if (compact && confidence === 'verified') return null
  const c = CONFIDENCES[confidence]
  return (
    <Pill tone={c.tone} title={c.hint}>
      {c.label}
    </Pill>
  )
}

export const BuildChannelPill = ({ channel }: { channel: BuildChannel }) => (
  <Pill tone={BUILD_CHANNELS[channel].tone}>{BUILD_CHANNELS[channel].label}</Pill>
)
export const BuildStatusPill = ({ status }: { status: BuildStatus }) => (
  <Pill tone={BUILD_STATUSES[status].tone}>{BUILD_STATUSES[status].label}</Pill>
)
export const EventStatusPill = ({ status }: { status: EventStatus }) => (
  <Pill tone={EVENT_STATUSES[status].tone}>{EVENT_STATUSES[status].label}</Pill>
)
export const FeedbackStatusPill = ({ status }: { status: FeedbackStatus }) => (
  <Pill tone={FEEDBACK_STATUSES[status].tone}>{FEEDBACK_STATUSES[status].label}</Pill>
)

export const HEALTH: Record<HealthLevel, { label: string; tone: Tone }> = {
  on_track: { label: 'Al día', tone: 'success' },
  attention: { label: 'Pide atención', tone: 'warning' },
  urgent: { label: 'Atención inmediata', tone: 'danger' },
  idle: { label: 'Parado', tone: 'muted' },
}

export const HealthPill = ({ level }: { level: HealthLevel }) => <Pill tone={HEALTH[level].tone}>{HEALTH[level].label}</Pill>
