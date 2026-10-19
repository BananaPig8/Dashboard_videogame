import { AgendaPage } from '../../pages/Production'
import type { SectionPageProps } from '../registry'

// Provisional: la agenda de siempre.
export default function CalendarioSection({ embedded }: SectionPageProps) {
  return <AgendaPage embedded={embedded} />
}
