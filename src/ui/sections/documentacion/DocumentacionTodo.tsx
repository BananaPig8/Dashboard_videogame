// Toda la documentación: cuántos documentos hay de cada subsección, los documentos agrupados
// por subsección y, al lado, cómo van las decisiones y las reuniones que no tienen acta.
import { Link } from 'react-router-dom'
import { RESOURCE_TYPES } from '../../../domain/catalog'
import { decisionDate, decisionLog, decisions, hasTag, meetingsWithoutMinutes, resourceGroups, resourcesFor } from '../../../domain/selectors'
import { yearOf } from '../../../domain/dates'
import { useCanEdit, useStudioData } from '../../../data/store'
import { t } from '../../../i18n'
import { Card, Empty } from '../../components/Common'
import { ItemList } from '../../components/ItemList'
import { useSectionNav } from '../../components/SectionHeader'
import { useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import type { SectionPageProps } from '../registry'
import { RESOURCE_ICON, ResourceRows, ResourceSummary, subsectionIcon } from '../recursos/comunes'
import { DocumentacionPage, NewButton } from './comunes'
import { countDocs, useNewDocDefaults } from './DocumentacionLista'

export function DocumentacionTodo({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, href } = useScope()
  const { create, openItem } = useUI()
  const canEdit = useCanEdit()
  const tag = useTagFilter()
  const fmt = useFormat()
  const today = useToday()
  const year = yearOf(today)
  const nav = useSectionNav('documentacion')
  const childOf = (id: string) => nav.section.children.find((c) => c.id === id)
  const defaults = useNewDocDefaults(null)
  const label = t('secciones.documentacion.actions.new.todo')
  const showProject = scope === null

  const all = resourcesFor(data, 'documentacion', null, scope)
  const groups = resourceGroups(data, 'documentacion', scope)
    .map((g) => ({ ...g, resources: g.resources.filter((r) => hasTag(r, tag)) }))
    .filter((g) => g.resources.length > 0)
  const open = decisions(data, scope).open.filter((d) => hasTag(d, tag))
  const last = decisionLog(data, scope)
    .flatMap((m) => m.decisions)
    .find((d) => hasTag(d, tag) && decisionDate(d))
  const meetings = meetingsWithoutMinutes(data, today, scope).filter((m) => hasTag(m.event, tag))
  const decisionsChild = childOf('decisiones')
  const actasChild = childOf('actas')

  return (
    <DocumentacionPage
      embedded={embedded}
      intro={t('secciones.documentacion.intro.todo')}
      actions={<NewButton collection="resources" defaults={defaults} label={label} primary />}
    >
      {!tag && all.length > 0 && <ResourceSummary section="documentacion" />}
      <div className="grid grid-2-1">
        <div className="stack">
          {groups.length === 0 ? (
            <Card>
              <Empty icon="fileText" action={canEdit && !tag ? { label, onClick: () => create('resources', defaults) } : undefined}>
                {tag && all.length ? t('secciones.documentacion.emptyTag') : t('secciones.documentacion.empty.todo')}
              </Empty>
            </Card>
          ) : (
            groups.map((g) => {
              const child = g.sub ? childOf(g.sub) : undefined
              const name = child?.label ?? (g.type ? RESOURCE_TYPES[g.type] : g.key)
              return (
                <Card
                  key={g.key}
                  title={name}
                  icon={g.sub ? subsectionIcon('documentacion', g.sub) : g.type ? RESOURCE_ICON[g.type] : 'fileText'}
                  subtitle={countDocs(g.resources.length)}
                  action={
                    child ? (
                      <Link to={nav.href(child)} className="btn btn-small btn-ghost">
                        {t('secciones.recursos.group.see')}
                        <span className="visually-hidden"> · {name}</span>
                      </Link>
                    ) : undefined
                  }
                >
                  <ResourceRows resources={g.resources} showProject={showProject} showBody />
                  {g.type === 'doc' && (
                    <p className="muted small recursos-group-note">
                      <Link to={href('/recursos?tipo=documentos')}>{t('secciones.documentacion.group.doc')}</Link>
                    </p>
                  )}
                </Card>
              )
            })
          )}
        </div>
        <div className="stack">
          <Card
            title={t('secciones.documentacion.decisions.summary')}
            icon="scale"
            action={
              decisionsChild ? (
                <Link to={nav.href(decisionsChild)} className="btn btn-small btn-ghost">
                  {t('secciones.documentacion.decisions.summaryLog')}
                </Link>
              ) : undefined
            }
          >
            <p className="documentacion-summary-line">
              {open.length
                ? t(`secciones.documentacion.decisions.summaryOpen.${open.length === 1 ? 'one' : 'many'}`, { n: open.length })
                : t('secciones.documentacion.decisions.summaryNone')}
            </p>
            {open.length > 0 && <ItemList items={open} data={data} showProject={showProject} year={year} limit={4} />}
            {last && (
              <>
                <h3 className="subhead">{t('secciones.documentacion.decisions.summaryLast')}</h3>
                <p className="documentacion-last">
                  <button type="button" className="item-title" onClick={() => openItem(last.id)}>
                    {last.title}
                  </button>{' '}
                  <span className="meta-date">{fmt.date(decisionDate(last), year)}</span>
                </p>
              </>
            )}
          </Card>
          {meetings.length > 0 && (
            <Card title={t('secciones.documentacion.minutes.without')} icon="users">
              <p className="documentacion-summary-line">
                {t(`secciones.documentacion.decisions.summaryMeetings.${meetings.length === 1 ? 'one' : 'many'}`, { n: meetings.length })}
              </p>
              {actasChild && <Link to={nav.href(actasChild)}>{t('secciones.documentacion.decisions.summaryMeetingsLink')}</Link>}
            </Card>
          )}
        </div>
      </div>
    </DocumentacionPage>
  )
}
