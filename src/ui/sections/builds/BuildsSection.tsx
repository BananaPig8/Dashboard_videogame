import { useSearchParams } from 'react-router-dom'
import { HistoryPage } from '../../pages/History'
import { BuildsPage } from '../../pages/Production'
import type { SectionPageProps } from '../registry'

// Provisional: builds e historial de siempre.
export default function BuildsSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  return params.get('vista') === 'cambios' ? <HistoryPage embedded={embedded} /> : <BuildsPage embedded={embedded} />
}
