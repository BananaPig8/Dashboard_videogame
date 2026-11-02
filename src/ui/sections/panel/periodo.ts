// El periodo del Dashboard va en la URL (?periodo=hoy|7d|30d|personalizado, con ?desde= y
// ?hasta= en el personalizado): se puede guardar como vista y compartir.
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PERIOD, PERIOD_IDS, periodRange, previousPeriod, type Period, type PeriodId } from '../../../domain/selectors'
import { isValidISODate } from '../../../domain/dates'
import { useToday } from '../../hooks'

export function usePanelPeriod(): { period: Period; previous: Period; setPeriod: (id: PeriodId, custom?: { from?: string; to?: string }) => void } {
  const [params, setParams] = useSearchParams()
  const today = useToday()
  const raw = params.get('periodo')
  const id = PERIOD_IDS.includes(raw as PeriodId) ? (raw as PeriodId) : DEFAULT_PERIOD
  const date = (k: string) => {
    const v = params.get(k)
    return v && isValidISODate(v) ? v : undefined
  }
  const period = periodRange(id, today, { from: date('desde'), to: date('hasta') })
  const setPeriod = (next: PeriodId, custom?: { from?: string; to?: string }) =>
    setParams(
      (p) => {
        const out = new URLSearchParams(p)
        if (next === DEFAULT_PERIOD) out.delete('periodo')
        else out.set('periodo', next)
        out.delete('desde')
        out.delete('hasta')
        if (next === 'personalizado') {
          if (custom?.from) out.set('desde', custom.from)
          if (custom?.to) out.set('hasta', custom.to)
        }
        return out
      },
      { replace: true },
    )
  return { period, previous: previousPeriod(period), setPeriod }
}
