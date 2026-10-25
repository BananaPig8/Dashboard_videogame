// Eventos del sector: ferias, festivales, premios y presentaciones. La faceta ?tipo= elige
// qué eventos y ?vista= qué mirar de ellos (la agenda, las inscripciones, los materiales de
// los próximos o el seguimiento de los pasados); las dos se combinan.
import type { SectionPageProps } from '../registry'
import { EventosInscripciones } from './EventosInscripciones'
import { EventosLista } from './EventosLista'
import { EventosMateriales } from './EventosMateriales'
import { EventosSeguimiento } from './EventosSeguimiento'
import { useEventosQuery } from './comunes'
import './eventos.css'

export default function EventosSection({ embedded }: SectionPageProps) {
  const { vista } = useEventosQuery()
  if (vista === 'inscripciones') return <EventosInscripciones embedded={embedded} />
  if (vista === 'materiales') return <EventosMateriales embedded={embedded} />
  if (vista === 'seguimiento') return <EventosSeguimiento embedded={embedded} />
  return <EventosLista embedded={embedded} />
}
