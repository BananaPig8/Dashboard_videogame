// Roadmap: hacia dónde va cada proyecto. Las subsecciones son la faceta ?vista= de la URL
// (navigation.ts): hitos (por defecto), fases, objetivos, versiones previstas y la línea
// temporal. Todas valen para todo el estudio, con ?p= y dentro de la ficha de un proyecto.
import { useSearchParams } from 'react-router-dom'
import { t } from '../../../i18n'
import { useCanEdit } from '../../../data/store'
import { Icon } from '../../components/Icon'
import { SectionHeader } from '../../components/SectionHeader'
import { TagFilterNotice } from '../../components/TagFilter'
import { useUI } from '../../context'
import type { SectionPageProps } from '../registry'
import { RoadmapFases } from './RoadmapFases'
import { RoadmapHitos } from './RoadmapHitos'
import { RoadmapLinea } from './RoadmapLinea'
import { RoadmapObjetivos } from './RoadmapObjetivos'
import { RoadmapVersiones } from './RoadmapVersiones'
import './roadmap.css'

export default function RoadmapSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  const vista = params.get('vista')
  const { create } = useUI()
  const canEdit = useCanEdit()

  // Lo que se crea desde cada vista (la línea temporal junta de todo: no crea nada en concreto).
  const action =
    vista === 'fases'
      ? { label: t('secciones.roadmap.actions.newPhase'), run: () => create('phases') }
      : vista === 'objetivos'
        ? { label: t('secciones.roadmap.actions.newGoal'), run: () => create('items', { kind: 'goal', status: 'planned' }) }
        : vista === 'versiones'
          ? { label: t('secciones.roadmap.actions.newRelease'), run: () => create('releases') }
          : vista === 'linea'
            ? null
            : { label: t('secciones.roadmap.actions.newMilestone'), run: () => create('items', { kind: 'milestone', status: 'planned' }) }
  const actions =
    canEdit && action ? (
      <button type="button" className="btn btn-primary" onClick={action.run}>
        <Icon name="plus" size={16} /> {action.label}
      </button>
    ) : undefined

  return (
    <div className={embedded ? 'roadmap-page' : 'page roadmap-page'}>
      <SectionHeader id="roadmap" embedded={embedded} actions={actions} />
      {/* Las fases no llevan etiquetas: ahí el filtro no aplica. */}
      {vista !== 'fases' && <TagFilterNotice />}
      {vista === 'fases' ? (
        <RoadmapFases />
      ) : vista === 'objetivos' ? (
        <RoadmapObjetivos />
      ) : vista === 'versiones' ? (
        <RoadmapVersiones />
      ) : vista === 'linea' ? (
        <RoadmapLinea />
      ) : (
        <RoadmapHitos />
      )}
    </div>
  )
}
