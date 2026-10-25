// Ajustes: el perfil del estudio, las preferencias de este navegador, las categorías y
// etiquetas, los nombres de los estados, las integraciones (ninguna aparenta estar conectada),
// la seguridad y la exportación e importación. Las subsecciones son la faceta ?seccion= de la
// URL (navigation.ts). Ajustes no tiene pestaña en la ficha de un proyecto: vale para todo el estudio.
import { useSearchParams } from 'react-router-dom'
import { SectionHeader } from '../../components/SectionHeader'
import type { SectionPageProps } from '../registry'
import { AjustesCategorias } from './AjustesCategorias'
import { AjustesDatos } from './AjustesDatos'
import { AjustesEstados } from './AjustesEstados'
import { AjustesEstudio } from './AjustesEstudio'
import { AjustesIntegraciones } from './AjustesIntegraciones'
import { AjustesPreferencias } from './AjustesPreferencias'
import { AjustesSeguridad } from './AjustesSeguridad'
import './ajustes.css'

export default function AjustesSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  const seccion = params.get('seccion')
  return (
    <div className={embedded ? 'ajustes-page' : 'page ajustes-page'}>
      <SectionHeader id="ajustes" embedded={embedded} />
      {seccion === 'preferencias' ? (
        <AjustesPreferencias />
      ) : seccion === 'categorias' ? (
        <AjustesCategorias />
      ) : seccion === 'estados' ? (
        <AjustesEstados />
      ) : seccion === 'integraciones' ? (
        <AjustesIntegraciones />
      ) : seccion === 'seguridad' ? (
        <AjustesSeguridad />
      ) : seccion === 'datos' ? (
        <AjustesDatos />
      ) : (
        <AjustesEstudio />
      )}
    </div>
  )
}
