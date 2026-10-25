// Una subsección de documentos (?tipo=diseno, tecnica, notas, guias o enlaces): los recursos de
// sus tipos según el catálogo, con su texto si está escrito aquí (notas).
import { hasTag, resourceDefaultType, resourcesFor } from '../../../domain/selectors'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t, tr } from '../../../i18n'
import { Card, Empty } from '../../components/Common'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { ResourceRows, subsectionIcon } from '../recursos/comunes'
import { DocumentacionPage, NewButton } from './comunes'

export const countDocs = (n: number) => t(n === 1 ? 'secciones.documentacion.count.one' : 'secciones.documentacion.count.many', { n })

/** Valores de partida de un documento nuevo desde una subsección (las notas y actas, con la fecha de hoy). */
export function useNewDocDefaults(sub: string | null): Record<string, unknown> {
  const today = useToday()
  const type = resourceDefaultType('documentacion', sub)
  return type === 'note' || type === 'minutes' ? { type, date: today } : { type }
}

export function DocumentacionLista({ embedded, sub }: SectionPageProps & { sub: string }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const defaults = useNewDocDefaults(sub)
  const label = tr(`secciones.documentacion.actions.new.${sub}`)
  const all = resourcesFor(data, 'documentacion', sub, scope)
  const shown = all.filter((r) => hasTag(r, tag))
  const icon = subsectionIcon('documentacion', sub)
  return (
    <DocumentacionPage
      embedded={embedded}
      intro={tr(`secciones.documentacion.intro.${sub}`)}
      actions={<NewButton collection="resources" defaults={defaults} label={label} primary />}
    >
      <Card title={countDocs(shown.length)} icon={icon}>
        {shown.length ? (
          <ResourceRows resources={shown} showProject={scope === null} showBody />
        ) : (
          <Empty icon={icon} action={canEdit && !tag ? { label, onClick: () => create('resources', defaults) } : undefined}>
            {tag && all.length ? t('secciones.documentacion.emptyTag') : tr(`secciones.documentacion.empty.${sub}`)}
          </Empty>
        )}
      </Card>
    </DocumentacionPage>
  )
}
