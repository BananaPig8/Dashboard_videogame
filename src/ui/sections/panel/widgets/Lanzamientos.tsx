// Lanzamientos: lo que falta para publicar, actualizar o sacar una demo.
import { Link } from 'react-router-dom'
import { checklistsOf, pendingInAreas } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { useCanEdit } from '../../../../data/store'
import { Empty, Progress } from '../../../components/Common'
import { ItemList } from '../../../components/ItemList'
import { useScope, useUI } from '../../../context'
import { ScopedMore, type WidgetProps } from './comunes'

export function PublishBody({ data, scope }: WidgetProps) {
  const { href } = useScope()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const lists = checklistsOf(data, scope)
  if (lists.length === 0)
    return (
      <Empty icon="rocket" action={canEdit ? { label: t('secciones.panel.publish.add'), onClick: () => create('checklists') } : undefined}>
        {t('secciones.panel.publish.empty')}
      </Empty>
    )
  return (
    <ul className="checklist-summary">
      {lists.map(({ checklist, done, total, ratio }) => {
        const next = checklist.items.find((i) => !i.done)
        return (
          <li key={checklist.id}>
            <div className="checklist-summary-head">
              <Link to={href('/publicacion?vista=lanzamiento')}>{checklist.title}</Link>
              <span className="muted small num">
                {done}/{total}
              </span>
            </div>
            <Progress ratio={ratio} label={checklist.title} tone={ratio === 1 ? 'success' : 'info'} />
            {next && <p className="muted small">{t('secciones.panel.publish.next', { label: next.label })}</p>}
          </li>
        )
      })}
    </ul>
  )
}

export function LaunchBody({ data, scope, year }: WidgetProps) {
  const steam = pendingInAreas(data, ['steam'], scope)
  const events = pendingInAreas(data, ['events', 'marketing'], scope)
  const release = pendingInAreas(data, ['release', 'demo'], scope)
  return (
    <>
      <h3 className="subhead">{t('secciones.panel.launch.steam', { n: steam.length })}</h3>
      <ItemList items={steam} data={data} showProject={!scope} limit={5} year={year} empty={t('secciones.panel.launch.steamNone')} />
      <h3 className="subhead">{t('secciones.panel.launch.events', { n: events.length })}</h3>
      <ItemList items={events} data={data} showProject={!scope} limit={4} year={year} empty={t('secciones.panel.launch.eventsNone')} />
      <h3 className="subhead">{t('secciones.panel.launch.release', { n: release.length })}</h3>
      <ItemList items={release} data={data} showProject={!scope} limit={4} year={year} empty={t('secciones.panel.launch.releaseNone')} />
    </>
  )
}

export function ReleasesBody(p: WidgetProps) {
  return (
    <>
      <PublishBody {...p} />
      <div className="subsection">
        <LaunchBody {...p} />
      </div>
    </>
  )
}

export function ReleasesAction() {
  return <ScopedMore to="/publicacion" label={t('secciones.panel.launch.link')} />
}
