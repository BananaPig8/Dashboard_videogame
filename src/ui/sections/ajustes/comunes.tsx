// Piezas que comparten las vistas de Ajustes y la página de una etiqueta.
import type { CollectionKey } from '../../../data/store'
import { intlLocale } from '../../../i18n'
import { useSectionNav } from '../../components/SectionHeader'
import { countOf } from '../../Editor'

/** El enlace a una subsección de Ajustes («datos», «categorias»…) desde donde se esté. */
export function useAjustesHref(): (id: string) => string {
  const nav = useSectionNav('ajustes')
  return (id) => {
    const child = nav.section.children.find((c) => c.id === id)
    return child ? nav.href(child) : nav.rootHref
  }
}

/** «a, b y c». */
export const joinList = (parts: string[]) => new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(parts)

/** «3 elementos, 1 build y 2 eventos» (solo lo que tiene algo). */
export function countsText(counts: Partial<Record<CollectionKey, number>> | [CollectionKey, number][]): string {
  const list = Array.isArray(counts) ? counts : (Object.entries(counts) as [CollectionKey, number][])
  return joinList(list.filter(([, n]) => n > 0).map(([k, n]) => countOf(k, n)))
}
