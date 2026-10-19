import { DashboardPage, ProjectSummaryTab } from '../../pages/Overview'
import type { SectionPageProps } from '../registry'

// Provisional: el panel de siempre; en la ficha de un proyecto, su resumen.
export default function PanelSection({ embedded }: SectionPageProps) {
  return embedded ? <ProjectSummaryTab /> : <DashboardPage />
}
