// (Por hacer en la parte 5: la vista aparte de Proyectos que da nombre al fichero.)
import { SectionHeader } from '../../../components/SectionHeader'
import type { SectionPageProps } from '../../registry'

export default function Vista({ embedded }: SectionPageProps) {
  return (
    <div className={embedded ? 'stack' : 'page'}>
      <SectionHeader id="proyectos" embedded={embedded} />
    </div>
  )
}
