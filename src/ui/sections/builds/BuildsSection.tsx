// Builds y versiones: lo compilado de cada proyecto por canal (?canal=: desarrollo, pruebas,
// demos, públicas, candidatas) y dos vistas aparte (?vista=): el historial de cambios entre
// builds y las incidencias de cada versión.
import { useSearchParams } from 'react-router-dom'
import type { SectionPageProps } from '../registry'
import { BuildsCambios } from './BuildsCambios'
import { BuildsIncidencias } from './BuildsIncidencias'
import { BuildsLista } from './BuildsLista'
import './builds.css'

export default function BuildsSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  const vista = params.get('vista')
  if (vista === 'cambios') return <BuildsCambios embedded={embedded} />
  if (vista === 'incidencias') return <BuildsIncidencias embedded={embedded} />
  return <BuildsLista embedded={embedded} />
}
