// Lo que pone una cifra del Dashboard en la lista a la que lleva (Builds, Eventos y Feedback),
// para que la lista dé la misma cifra: unas fechas (?desde=&hasta=) y, en todo el estudio, sin
// los proyectos archivados (?archivados=no). La lista lo dice y deja verlo todo con un botón.
import { useSearchParams } from 'react-router-dom'
import { CLOSED_PARAM, CLOSED_PARAM_OFF } from '../../../domain/selectors'
import { isValidISODate } from '../../../domain/dates'
import { t } from '../../../i18n'
import { Icon } from '../../components/Icon'
import { useScope } from '../../context'
import { useFormat, useToday } from '../../hooks'

export interface PanelListFilter {
  desde: string | null
  hasta: string | null
  sinArchivados: boolean
  /** ¿Hay algo de esto puesto? */
  active: boolean
}

const dateParam = (v: string | null) => (v && isValidISODate(v) ? v : null)

/**
 * Lo que la URL pide de esto. `dates`: si la lista entiende ?desde=&hasta= (Builds sí; Eventos y
 * Feedback, no: allí esos parámetros no se leen).
 */
export function usePanelListFilter(dates = false): PanelListFilter {
  const [params] = useSearchParams()
  const { scope } = useScope()
  const desde = dates ? dateParam(params.get('desde')) : null
  const hasta = dates ? dateParam(params.get('hasta')) : null
  const sinArchivados = !scope && params.get(CLOSED_PARAM) === CLOSED_PARAM_OFF
  return { desde, hasta, sinArchivados, active: !!(desde || hasta || sinArchivados) }
}

/** «Solo con fecha del 29 oct al 4 nov · sin los proyectos archivados. Ver todo». */
export function PanelFilterNotice({ filter }: { filter: PanelListFilter }) {
  const [params, setParams] = useSearchParams()
  const fmt = useFormat()
  const year = Number(useToday().slice(0, 4))
  if (!filter.active) return null
  const date = (d: string) => fmt.date(d, year)
  const parts: string[] = []
  if (filter.desde && filter.hasta)
    parts.push(
      filter.desde === filter.hasta
        ? t('secciones.panel.cabecera.listFilter.day', { date: date(filter.desde) })
        : t('secciones.panel.cabecera.listFilter.dates', { from: date(filter.desde), to: date(filter.hasta) }),
    )
  else if (filter.desde) parts.push(t('secciones.panel.cabecera.listFilter.from', { from: date(filter.desde) }))
  else if (filter.hasta) parts.push(t('secciones.panel.cabecera.listFilter.to', { to: date(filter.hasta) }))
  if (filter.sinArchivados) parts.push(t('secciones.panel.cabecera.listFilter.noArchived'))
  const clear = () => {
    const next = new URLSearchParams(params)
    next.delete('desde')
    next.delete('hasta')
    next.delete(CLOSED_PARAM)
    setParams(next, { replace: true })
  }
  return (
    <div className="tag-filter" role="status">
      <Icon name="layers" size={14} />
      <span>{t('secciones.panel.cabecera.listFilter.only', { list: parts.join(' · ') })}</span>
      <button type="button" className="btn btn-small btn-ghost" onClick={clear}>
        {t('secciones.panel.cabecera.listFilter.clear')}
      </button>
    </div>
  )
}
