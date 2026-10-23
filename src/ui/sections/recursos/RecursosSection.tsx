import { ResourcesPage } from '../../pages/Production'
import type { SectionPageProps } from '../registry'

// Provisional: recursos de siempre.
export default function RecursosSection({ embedded }: SectionPageProps) {
  return <ResourcesPage embedded={embedded} />
}
