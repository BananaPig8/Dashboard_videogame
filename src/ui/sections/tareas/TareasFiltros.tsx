// Los filtros finos de Tareas (búsqueda, estado, tipo, área, persona, prioridad y
// fiabilidad). Viven en la URL para poder volver atrás, guardar la vista o compartirla.
// En el móvil se pliegan detrás de un botón (la búsqueda queda siempre a la vista).
import { useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CONFIDENCES, KINDS, PRIORITIES, STATUSES, STATUS_ORDER, TASK_KINDS } from '../../../domain/catalog'
import { TASK_NOBODY, taskPeople } from '../../../domain/selectors'
import type { ItemKind, Priority } from '../../../domain/types'
import { t } from '../../../i18n'
import { useStudioData } from '../../../data/store'
import { Icon } from '../../components/Icon'
import { FINE_FILTERS, type TaskParams } from './comunes'

const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low']
const KIND_OPTIONS: ItemKind[] = [...TASK_KINDS, 'goal']

export function TareasFiltros({ vista, filtro, filtered }: Pick<TaskParams, 'vista' | 'filtro' | 'filtered'>) {
  const data = useStudioData()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const clear = () => {
    const next = new URLSearchParams(params)
    for (const k of FINE_FILTERS) next.delete(k)
    setParams(next, { replace: true })
  }
  const people = taskPeople(data)
  const showStatus = !vista && filtro !== 'bloqueadas' && filtro !== 'vencidas'
  // Los que están puestos y se ven (el estado no cuenta en el tablero, ni la persona en «Mis tareas»).
  const active = FINE_FILTERS.filter((k) => k !== 'q' && params.get(k) && (k !== 'estado' || showStatus) && (k !== 'persona' || filtro !== 'mias')).length
  const value = (k: string) => params.get(k) ?? ''

  return (
    <div className={open ? 'tareas-filters open' : 'tareas-filters'}>
      <div className="filters" role="group" aria-label={t('secciones.tareas.filters.label')}>
        <input
          type="search"
          placeholder={t('secciones.tareas.filters.search')}
          value={value('q')}
          onChange={(e) => set('q', e.target.value)}
          aria-label={t('secciones.tareas.filters.searchLabel')}
        />
        <button type="button" className="btn btn-small tareas-filters-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
          <Icon name="layers" size={14} /> {active ? t('secciones.tareas.filters.showActive', { n: active }) : t('secciones.tareas.filters.show')}
        </button>
        <div className="tareas-filters-more" id={panelId}>
          {showStatus && (
            <select
              value={value('estado') || 'abiertos'}
              onChange={(e) => set('estado', e.target.value === 'abiertos' ? '' : e.target.value)}
              aria-label={t('secciones.tareas.filters.status')}
            >
              <option value="abiertos">{t('secciones.tareas.filters.statusOpen')}</option>
              <option value="todos">{t('secciones.tareas.filters.statusAll')}</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUSES[s].label}
                </option>
              ))}
            </select>
          )}
          <select value={value('tipo')} onChange={(e) => set('tipo', e.target.value)} aria-label={t('secciones.tareas.filters.kind')}>
            <option value="">{t('secciones.tareas.filters.kindAll')}</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {TASK_KINDS.includes(k) ? KINDS[k].plural : t('secciones.tareas.filters.kindRoadmap', { name: KINDS[k].plural })}
              </option>
            ))}
          </select>
          {data.areas.length > 0 && (
            <select value={value('area')} onChange={(e) => set('area', e.target.value)} aria-label={t('secciones.tareas.filters.area')}>
              <option value="">{t('secciones.tareas.filters.areaAll')}</option>
              {data.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {/* «Mis tareas» ya dice quién: el filtro de persona sobra ahí. Sin equipo no hay a quién elegir. */}
          {filtro !== 'mias' && people.length > 0 && (
            <select value={value('persona')} onChange={(e) => set('persona', e.target.value)} aria-label={t('secciones.tareas.filters.person')}>
              <option value="">{t('secciones.tareas.filters.personAll')}</option>
              <option value={TASK_NOBODY}>{t('secciones.tareas.filters.personNobody')}</option>
              {people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.active ? m.name : t('secciones.tareas.filters.personGone', { name: m.name })}
                </option>
              ))}
            </select>
          )}
          <select value={value('prioridad')} onChange={(e) => set('prioridad', e.target.value)} aria-label={t('secciones.tareas.filters.priority')}>
            <option value="">{t('secciones.tareas.filters.priorityAll')}</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITIES[p].label}
              </option>
            ))}
          </select>
          <select value={value('fiabilidad')} onChange={(e) => set('fiabilidad', e.target.value)} aria-label={t('secciones.tareas.filters.confidence')}>
            <option value="">{t('secciones.tareas.filters.confidenceAll')}</option>
            {Object.entries(CONFIDENCES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          {filtered && (
            <button type="button" className="btn btn-small btn-ghost" onClick={clear}>
              <Icon name="close" size={14} /> {t('secciones.tareas.filters.clear')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
