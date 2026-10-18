// Etiquetas de estado. Nunca solo color: cada una lleva icono y texto, y el color sale
// del tono del catálogo (el mismo en toda la aplicación).
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
import { tr } from '../../i18n'
import { Icon, type IconName } from './Icon'

export function Pill({ tone = 'neutral', icon, children, title }: { tone?: Tone; icon?: IconName; children: ReactNode; title?: string }) {
  return (
    <span className={`pill tone-${tone}`} title={title}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

export const STATUS_ICON: Record<ItemStatus, IconName> = {
  idea: 'bulb',
  backlog: 'circleDashed',
  planned: 'calendar',
  in_progress: 'play',
  review: 'eye',
  blocked: 'lock',
  paused: 'pause',
  to_confirm: 'question',
  done: 'checkCircle',
  cancelled: 'xCircle',
}

export const StatusPill = ({ status }: { status: ItemStatus }) => (
  <Pill tone={STATUSES[status].tone} icon={STATUS_ICON[status]}>
    {STATUSES[status].label}
  </Pill>
)

const STAGE_ICON: Record<ProjectStage, IconName> = {
  idea: 'bulb',
  concept: 'edit',
  prototype: 'circleDashed',
  preproduction: 'layout',
  production: 'play',
  polish: 'star',
  release: 'rocket',
  live: 'checkCircle',
  paused: 'pause',
  archived: 'box',
}

export const StagePill = ({ stage }: { stage: ProjectStage }) => (
  <Pill tone={STAGES[stage].tone} icon={STAGE_ICON[stage]}>
    {STAGES[stage].label}
  </Pill>
)

const PRIORITY_ICON: Record<Priority, IconName> = { critical: 'alert', high: 'arrowUp', medium: 'minus', low: 'arrowDown' }

export function PriorityTag({ priority, hideMedium }: { priority: Priority; hideMedium?: boolean }) {
  if (hideMedium && (priority === 'medium' || priority === 'low')) return null
  return (
    <span className={`priority priority-${priority}`} title={PRIORITIES[priority].label}>
      <Icon name={PRIORITY_ICON[priority]} size={12} />
      {PRIORITIES[priority].label}
    </span>
  )
}

export const KIND_ICON: Record<ItemKind, IconName> = {
  task: 'check',
  feature: 'star',
  milestone: 'flag',
  decision: 'scale',
  issue: 'bug',
}

export function KindIcon({ kind }: { kind: ItemKind }) {
  return (
    <span className={`kind-icon kind-${kind}`} title={KINDS[kind].label} role="img" aria-label={KINDS[kind].label}>
      <Icon name={KIND_ICON[kind]} size={14} />
    </span>
  )
}

export const KindTag = ({ kind }: { kind: ItemKind }) => (
  <Pill tone={KINDS[kind].tone} icon={KIND_ICON[kind]}>
    {KINDS[kind].label}
  </Pill>
)

export function AreaTag({ area }: { area?: Area }) {
  if (!area) return null
  return (
    <span className="area-tag" title={area.description}>
      <span className="dot" style={{ background: area.color }} aria-hidden="true" />
      {area.name}
    </span>
  )
}

export function ProjectChip({ project }: { project?: Project }) {
  if (!project) return null
  return (
    <span className="project-chip" title={project.name}>
      <span className="dot" style={{ background: project.color }} aria-hidden="true" />
      {project.name}
    </span>
  )
}

const CONFIDENCE_ICON: Record<Confidence, IconName> = { verified: 'checkCircle', inferred: 'info', to_confirm: 'question' }

export function ConfidenceTag({ confidence, compact }: { confidence: Confidence; compact?: boolean }) {
  if (compact && confidence === 'verified') return null
  const c = CONFIDENCES[confidence]
  return (
    <Pill tone={c.tone} icon={CONFIDENCE_ICON[confidence]} title={c.hint}>
      {c.label}
    </Pill>
  )
}

const CHANNEL_ICON: Record<BuildChannel, IconName> = { full: 'box', demo: 'play', event: 'flag', playtest: 'eye', beta: 'circleDashed', internal: 'lock' }

export const BuildChannelPill = ({ channel }: { channel: BuildChannel }) => (
  <Pill tone={BUILD_CHANNELS[channel].tone} icon={CHANNEL_ICON[channel]}>
    {BUILD_CHANNELS[channel].label}
  </Pill>
)

const BUILD_STATUS_ICON: Record<BuildStatus, IconName> = {
  in_progress: 'play',
  ready: 'check',
  published: 'checkCircle',
  superseded: 'history',
  withdrawn: 'xCircle',
  to_confirm: 'question',
}

export const BuildStatusPill = ({ status }: { status: BuildStatus }) => (
  <Pill tone={BUILD_STATUSES[status].tone} icon={BUILD_STATUS_ICON[status]}>
    {BUILD_STATUSES[status].label}
  </Pill>
)

const EVENT_STATUS_ICON: Record<EventStatus, IconName> = { idea: 'bulb', planned: 'calendar', confirmed: 'checkCircle', done: 'check', cancelled: 'xCircle' }

export const EventStatusPill = ({ status }: { status: EventStatus }) => (
  <Pill tone={EVENT_STATUSES[status].tone} icon={EVENT_STATUS_ICON[status]}>
    {EVENT_STATUSES[status].label}
  </Pill>
)

const FEEDBACK_STATUS_ICON: Record<FeedbackStatus, IconName> = { new: 'bell', triaged: 'eye', planned: 'calendar', addressed: 'checkCircle', wont_do: 'xCircle' }

export const FeedbackStatusPill = ({ status }: { status: FeedbackStatus }) => (
  <Pill tone={FEEDBACK_STATUSES[status].tone} icon={FEEDBACK_STATUS_ICON[status]}>
    {FEEDBACK_STATUSES[status].label}
  </Pill>
)

export const HEALTH: Record<HealthLevel, { readonly label: string; tone: Tone; icon: IconName }> = {
  on_track: { get label() { return tr('catalog.health.on_track') }, tone: 'success', icon: 'checkCircle' },
  attention: { get label() { return tr('catalog.health.attention') }, tone: 'warning', icon: 'alert' },
  urgent: { get label() { return tr('catalog.health.urgent') }, tone: 'danger', icon: 'alert' },
  idle: { get label() { return tr('catalog.health.idle') }, tone: 'muted', icon: 'pause' },
}

export const HealthPill = ({ level }: { level: HealthLevel }) => (
  <Pill tone={HEALTH[level].tone} icon={HEALTH[level].icon}>
    {HEALTH[level].label}
  </Pill>
)
