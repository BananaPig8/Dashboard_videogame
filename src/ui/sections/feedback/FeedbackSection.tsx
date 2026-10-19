import { FeedbackPage } from '../../pages/Production'
import type { SectionPageProps } from '../registry'

// Provisional: feedback de siempre.
export default function FeedbackSection({ embedded }: SectionPageProps) {
  return <FeedbackPage embedded={embedded} />
}
