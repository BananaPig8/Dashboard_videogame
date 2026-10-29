// Piezas que comparten las vistas del Roadmap: la columna de la fecha, el progreso por
// pasos, las etiquetas de estado de fases y versiones y el «ver los restantes».
import { useState } from 'react'
import { PHASE_STATUSES, RELEASE_STATUSES } from '../../../domain/catalog'
import type { RoadmapProgress } from '../../../domain/selectors'
import type { ISODate, PhaseStatus, ReleaseStatus } from '../../../domain/types'
import { t } from '../../../i18n'
import { Pill } from '../../components/Badges'
import { Progress } from '../../components/Common'
import type { IconName } from '../../components/Icon'
import { useFormat } from '../../hooks'

const PHASE_ICON: Record<PhaseStatus, IconName> = { planned: 'calendar', done: 'checkCircle' }

export const PhaseStatusPill = ({ status }: { status: PhaseStatus }) => (
  <Pill tone={PHASE_STATUSES[status].tone} icon={PHASE_ICON[status]}>
    {PHASE_STATUSES[status].label}
  </Pill>
)

const RELEASE_ICON: Record<ReleaseStatus, IconName> = { idea: 'bulb', planned: 'calendar', in_progress: 'play', released: 'checkCircle', cancelled: 'xCircle' }

export const ReleaseStatusPill = ({ status }: { status: ReleaseStatus }) => (
  <Pill tone={RELEASE_STATUSES[status].tone} icon={RELEASE_ICON[status]}>
    {RELEASE_STATUSES[status].label}
  </Pill>
)

/** «Sin confirmar»: la fecha es una previsión. */
export const UnconfirmedPill = () => (
  <Pill tone="warning" icon="question" title={t('secciones.roadmap.common.unconfirmedHint')}>
    {t('secciones.roadmap.common.unconfirmed')}
  </Pill>
)

/** La fecha de una fila y, debajo, cuánto falta o cuánto hace. */
export function WhenCell({ date, today, year }: { date?: ISODate; today: ISODate; year: number }) {
  const fmt = useFormat()
  return (
    <div className="agenda-date">
      {date ? (
        <>
          <strong>{fmt.date(date, year)}</strong>
          <span className="muted small">{fmt.relative(date, today)}</span>
        </>
      ) : (
        <strong className="muted">{t('secciones.roadmap.common.noDate')}</strong>
      )}
    </div>
  )
}

/** «3 de 5 pasos hechos» con su barra; sin pasos lo dice (no hay un 0 % que valga). */
export function StepsProgress({ progress, title }: { progress: RoadmapProgress; title: string }) {
  if (progress.ratio === null) return <span className="meta-date">{t('secciones.roadmap.common.noSteps')}</span>
  const text =
    progress.total === 1
      ? t('secciones.roadmap.common.stepsOne', { done: progress.done })
      : t('secciones.roadmap.common.steps', { done: progress.done, total: progress.total })
  const cancelled =
    progress.cancelled === 0
      ? ''
      : progress.cancelled === 1
        ? t('secciones.roadmap.common.cancelledStepsOne')
        : t('secciones.roadmap.common.cancelledSteps', { n: progress.cancelled })
  return (
    <div className="roadmap-progress">
      <Progress
        ratio={progress.ratio}
        label={t('secciones.roadmap.common.progressOf', { title })}
        tone={progress.done === progress.total ? 'success' : 'info'}
      />
      <span className="meta-date">
        {text}
        {cancelled && ` · ${cancelled}`}
      </span>
    </div>
  )
}

/** Una lista larga: los primeros `limit` y un botón para ver el resto (y volver). */
export function useShowMore<T>(list: T[], limit: number) {
  const [all, setAll] = useState(false)
  const shown = all || list.length <= limit ? list : list.slice(0, limit)
  const toggle =
    list.length > limit ? (
      <button type="button" className="btn btn-small btn-ghost roadmap-more" aria-expanded={all} onClick={() => setAll(!all)}>
        {all ? t('secciones.roadmap.common.showLess') : t('secciones.roadmap.common.showAll', { n: list.length - limit })}
      </button>
    ) : null
  return { shown, toggle }
}
