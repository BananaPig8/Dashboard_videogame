// Documentación: lo escrito del estudio (?tipo=): diseño, documentación técnica, notas, guías y
// enlaces (recursos según RESOURCE_SECTIONS.documentacion), las actas de las reuniones y, como
// vista aparte, las decisiones importantes. Sin ?tipo= (o con uno desconocido), todo.
import { useSearchParams } from 'react-router-dom'
import { resourceTypesFor } from '../../../domain/selectors'
import type { SectionPageProps } from '../registry'
import { DocumentacionActas } from './DocumentacionActas'
import { DocumentacionDecisiones } from './DocumentacionDecisiones'
import { DocumentacionLista } from './DocumentacionLista'
import { DocumentacionTodo } from './DocumentacionTodo'

export default function DocumentacionSection({ embedded }: SectionPageProps) {
  const [params] = useSearchParams()
  const tipo = params.get('tipo')
  if (tipo === 'decisiones') return <DocumentacionDecisiones embedded={embedded} />
  if (tipo === 'actas') return <DocumentacionActas embedded={embedded} />
  if (tipo && resourceTypesFor('documentacion', tipo)) return <DocumentacionLista key={tipo} embedded={embedded} sub={tipo} />
  return <DocumentacionTodo embedded={embedded} />
}
