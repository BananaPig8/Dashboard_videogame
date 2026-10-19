import { useSearchParams } from 'react-router-dom'
import { TodayPage } from '../../pages/Today'
import { WorkPage } from '../../pages/Work'
import type { SectionPageProps } from '../registry'

// Provisional: Hoy y Tareas de siempre.
export default function TareasSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  return params.get('vista') === 'hoy' ? <TodayPage /> : <WorkPage embedded={embedded} />
}
