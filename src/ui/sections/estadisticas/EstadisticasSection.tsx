// Estadísticas: lo que dicen los datos del estudio, sin rellenar nada. Las subsecciones son
// la faceta ?vista= de la URL (navigation.ts): progreso (por defecto), tareas, hitos,
// tiempo, actividad, métricas de lanzamiento y comerciales. Valen para todo el estudio,
// con ?p= y dentro de la ficha de un proyecto.
import { useSearchParams } from 'react-router-dom'
import { t } from '../../../i18n'
import { useCanEdit } from '../../../data/store'
import { Icon } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import { EstadisticasActividad } from './EstadisticasActividad'
import { EstadisticasHitos } from './EstadisticasHitos'
import { EstadisticasMetricas } from './EstadisticasMetricas'
import { EstadisticasProgreso } from './EstadisticasProgreso'
import { EstadisticasTareas } from './EstadisticasTareas'
import { EstadisticasTiempo } from './EstadisticasTiempo'
import './estadisticas.css'

export default function EstadisticasSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  const vista = params.get('vista')
  const { project } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()

  // Lo que se apunta desde cada vista (progreso, tareas, hitos y actividad salen de lo que ya hay).
  const action =
    vista === 'lanzamiento'
      ? { label: t('secciones.estadisticas.actions.newMetric'), icon: 'plus' as const, run: () => create('metrics', { kind: 'wishlists' }) }
      : vista === 'comerciales'
        ? { label: t('secciones.estadisticas.actions.newMetric'), icon: 'plus' as const, run: () => create('metrics', { kind: 'units' }) }
        : vista === 'tiempo'
          ? { label: t('secciones.estadisticas.actions.logTime'), icon: 'clock' as const, run: () => create('timeEntries') }
          : null
  const actions =
    canEdit && action ? (
      <button type="button" className="btn btn-primary" onClick={action.run}>
        <Icon name={action.icon} size={16} /> {action.label}
      </button>
    ) : undefined

  // Solo lo que sale de los elementos de trabajo lleva etiquetas (?etiqueta=).
  const tagged = !vista || vista === 'tareas' || vista === 'hitos'

  return (
    <div className={embedded ? 'estadisticas-page' : 'page estadisticas-page'}>
      <SectionHeader
        id="estadisticas"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.estadisticas.subtitleIn', { project: project.name }) : undefined}
      />
      {tagged && <TagFilterNotice />}
      {vista === 'tareas' ? (
        <EstadisticasTareas />
      ) : vista === 'hitos' ? (
        <EstadisticasHitos />
      ) : vista === 'tiempo' ? (
        <EstadisticasTiempo />
      ) : vista === 'actividad' ? (
        <EstadisticasActividad />
      ) : vista === 'lanzamiento' ? (
        <EstadisticasMetricas group="launch" />
      ) : vista === 'comerciales' ? (
        <EstadisticasMetricas group="commercial" />
      ) : (
        <EstadisticasProgreso />
      )}
    </div>
  )
}
