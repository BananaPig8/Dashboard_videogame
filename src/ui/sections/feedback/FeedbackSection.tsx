// Feedback y pruebas: lo que dicen jugadores, ferias y pruebas. La faceta ?tipo= elige qué
// feedback (todo, comentarios, bugs, mejoras) y ?vista= cómo verlo (lista, priorización o
// cambios); las dos se combinan. Los informes de pruebas (?vista=informes) son una vista aparte.
import type { SectionPageProps } from '../registry'
import { FeedbackCambios } from './FeedbackCambios'
import { FeedbackInformes } from './FeedbackInformes'
import { FeedbackLista } from './FeedbackLista'
import { FeedbackPriorizacion } from './FeedbackPriorizacion'
import { useFeedbackQuery } from './comunes'
import './feedback.css'

export default function FeedbackSection({ embedded }: SectionPageProps) {
  const { vista } = useFeedbackQuery()
  if (vista === 'informes') return <FeedbackInformes embedded={embedded} />
  if (vista === 'priorizacion') return <FeedbackPriorizacion embedded={embedded} />
  if (vista === 'cambios') return <FeedbackCambios embedded={embedded} />
  return <FeedbackLista embedded={embedded} />
}
