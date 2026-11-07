// La pestaña «Historial» de la ficha de un proyecto: su registro de cambios entero, con los
// filtros de siempre. Es el mismo bloque que Panel › Actividad reciente (?ver=actividad), con
// el proyecto como ámbito: no hay un historial aparte que pueda contar otra cosa.
import { yearOf } from '../../../domain/dates'
import { useStudioData } from '../../../data/store'
import { useDocumentTitle } from '../../components/SectionHeader'
import { useScope } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { sectionById } from '../../navigation'
import { FocusArea } from '../panel/WidgetArea'
import { usePanelPeriod } from '../panel/periodo'
import type { SectionPageProps } from '../registry'

export default function HistorialSection({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, project } = useScope()
  const today = useToday()
  const fmt = useFormat()
  const { period } = usePanelPeriod()
  useDocumentTitle([sectionById('historial').label, project?.name])
  return (
    <div className={embedded ? 'stack' : 'page'}>
      <FocusArea ids={['activity']} data={data} scope={scope} today={today} year={yearOf(today)} fmt={fmt} period={period} />
    </div>
  )
}
