// Actividad reciente: lo último que se ha hecho.
import { activityOf, panelRecentDone } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { ItemList } from '../../../components/ItemList'
import { ActivityList, ScopedMore, type WidgetProps } from './comunes'

export function RecentBody({ data, scope, year, focus }: WidgetProps) {
  const done = panelRecentDone(data, scope)
  const list = <ItemList items={done} data={data} showProject={!scope} limit={focus ? 20 : 7} hideStatus year={year} empty={t('secciones.panel.recent.none')} />
  if (!focus) return list
  return (
    <div className="grid grid-2">
      <div className="panel-column">
        <h3 className="subhead">{t('secciones.panel.recent.done')}</h3>
        {list}
      </div>
      <div className="panel-column">
        <h3 className="subhead">{t('secciones.panel.recent.code')}</h3>
        <ActivityList activity={activityOf(data, scope).slice(0, 15)} data={data} showProject={!scope} year={year} />
      </div>
    </div>
  )
}

export function ActivityAction() {
  return <ScopedMore to="/?ver=actividad" label={t('secciones.panel.recent.history')} />
}
