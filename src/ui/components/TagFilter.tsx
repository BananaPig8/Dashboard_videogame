// Las etiquetas son comunes a todo el estudio: cualquier sección acepta ?etiqueta= para
// enseñar solo lo que la lleva, y cada etiqueta enlaza a su página (todo lo que la lleva).
import { Link, useSearchParams } from 'react-router-dom'
import { t } from '../../i18n'
import { useScope } from '../context'
import { tagPath } from '../navigation'
import { Icon } from './Icon'

/** La etiqueta por la que se filtra (?etiqueta=), o null. */
export function useTagFilter(): string | null {
  const [params] = useSearchParams()
  return params.get('etiqueta') || null
}

/** Aviso «Solo lo que lleva #x» con «Quitar el filtro» y el enlace a la página de la etiqueta. */
export function TagFilterNotice() {
  const [params, setParams] = useSearchParams()
  const { href } = useScope()
  const tag = params.get('etiqueta')
  if (!tag) return null
  return (
    <div className="tag-filter" role="status">
      <Icon name="tag" size={14} />
      <span>{t('tagFilter.only', { tag })}</span>
      <button
        type="button"
        className="btn btn-small btn-ghost"
        onClick={() => {
          const next = new URLSearchParams(params)
          next.delete('etiqueta')
          setParams(next)
        }}
      >
        {t('tagFilter.clear')}
      </button>
      <Link to={href(tagPath(tag))}>{t('tagFilter.everything')}</Link>
    </div>
  )
}

/** Etiquetas como enlaces a su página. */
export function TagLinks({ tags }: { tags?: string[] }) {
  const { href } = useScope()
  if (!tags?.length) return null
  return (
    <span className="tag-links">
      {tags.map((tag) => (
        <Link key={tag} to={href(tagPath(tag))} className="tag-link">
          #{tag}
        </Link>
      ))}
    </span>
  )
}
