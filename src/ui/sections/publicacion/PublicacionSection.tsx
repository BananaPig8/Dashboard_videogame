// Publicación: lo que hace falta para publicar y actualizar cada juego. Cada subsección es
// una vista (?vista=): Steam, lanzamiento, material, descripciones, capturas, logros,
// actualizaciones y DLC, y el estado de revisión. Nada está conectado a una tienda: todo lo
// apunta el estudio a mano, y las vistas lo dicen.
import { useSearchParams } from 'react-router-dom'
import type { SectionPageProps } from '../registry'
import { PublicacionDescripciones } from './PublicacionDescripciones'
import { PublicacionEstado } from './PublicacionEstado'
import { PublicacionLanzamiento } from './PublicacionLanzamiento'
import { PublicacionLogros } from './PublicacionLogros'
import { PublicacionCapturas, PublicacionMateriales } from './PublicacionMaterial'
import { PublicacionSteam } from './PublicacionSteam'
import { PublicacionVersiones } from './PublicacionVersiones'
import './publicacion.css'

export default function PublicacionSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  switch (params.get('vista')) {
    case 'lanzamiento':
      return <PublicacionLanzamiento embedded={embedded} />
    case 'materiales':
      return <PublicacionMateriales embedded={embedded} />
    case 'descripciones':
      return <PublicacionDescripciones embedded={embedded} />
    case 'capturas':
      return <PublicacionCapturas embedded={embedded} />
    case 'logros':
      return <PublicacionLogros embedded={embedded} />
    case 'dlc':
      return <PublicacionVersiones embedded={embedded} />
    case 'estado':
      return <PublicacionEstado embedded={embedded} />
    default:
      return <PublicacionSteam embedded={embedded} />
  }
}
