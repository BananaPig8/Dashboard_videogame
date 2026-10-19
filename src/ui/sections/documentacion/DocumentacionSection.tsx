import { useSearchParams } from 'react-router-dom'
import { DecisionsPage, ResourcesPage } from '../../pages/Production'
import type { SectionPageProps } from '../registry'

// Provisional: decisiones y recursos de siempre.
export default function DocumentacionSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  return params.get('tipo') === 'decisiones' ? <DecisionsPage embedded={embedded} /> : <ResourcesPage embedded={embedded} />
}
