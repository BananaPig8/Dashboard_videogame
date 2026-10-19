import { PublishPage } from '../../pages/Production'
import type { SectionPageProps } from '../registry'

// Provisional: publicación de siempre.
export default function PublicacionSection({ embedded }: SectionPageProps) {
  return <PublishPage embedded={embedded} />
}
