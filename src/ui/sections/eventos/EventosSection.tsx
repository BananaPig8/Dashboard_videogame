import { SectionHeader } from '../../components/SectionHeader'
import { Empty } from '../../components/Common'
import type { SectionPageProps } from '../registry'

// Provisional: la sección aún no tiene contenido.
export default function EventosSection({ embedded }: SectionPageProps) {
  return (
    <div className={embedded ? undefined : 'page'}>
      <SectionHeader id="eventos" embedded={embedded} />
      <Empty icon="info">En preparación.</Empty>
    </div>
  )
}
