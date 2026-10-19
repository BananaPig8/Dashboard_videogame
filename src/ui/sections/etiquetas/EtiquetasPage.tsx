// Provisional: todo lo que lleva una etiqueta (lo termina la sección Ajustes › Categorías y etiquetas).
import { useParams } from 'react-router-dom'
import { byTag } from '../../../domain/selectors'
import { useStudioData } from '../../../data/store'
import { PageHeader } from '../../components/Common'
import { useScope } from '../../context'

export default function EtiquetasPage() {
  const { tag = '' } = useParams()
  const data = useStudioData()
  const { scope } = useScope()
  const found = byTag(data, tag, scope)
  return (
    <div className="page">
      <PageHeader title={`#${tag}`} />
      <ul>
        {Object.entries(found).map(([k, list]) => (
          <li key={k}>
            {k}: {list?.length}
          </li>
        ))}
      </ul>
    </div>
  )
}
