// La pestaña «Demo y pruebas» de la ficha de un proyecto: sus demos (versiones y builds de
// demo), sus sesiones de prueba y lo que se dijo en ellas. Lee las mismas colecciones que
// Builds, Publicación y Feedback.
import { t } from '../../../i18n'
import { Empty } from '../../components/Common'
import { SectionHeader } from '../../components/SectionHeader'
import type { SectionPageProps } from '../registry'

export default function PruebasSection({ embedded }: SectionPageProps) {
  return (
    <div className={embedded ? 'stack' : 'page'}>
      <SectionHeader id="pruebas" embedded={embedded} />
      <Empty icon="clock">{t('section.inPreparation')}</Empty>
    </div>
  )
}
