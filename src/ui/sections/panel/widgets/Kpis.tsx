// Indicadores: las cifras del estudio o del proyecto.
import { blockedItems, currentBuilds, feedbackToPrioritize, isActionable, itemsOf, overdueItems, panelToConfirm, projectsInGroup, todayItems, undatedEvents, upcomingEntries } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { Stat } from '../../../components/Common'
import { useScope } from '../../../context'
import { UPCOMING_DAYS, type WidgetProps } from './comunes'

export function KpisBody({ data, scope, today }: WidgetProps) {
  const { href } = useScope()
  const items = itemsOf(data, scope)
  const blocked = blockedItems(data, scope).length
  const overdue = overdueItems(data, today, scope).length
  const confirm = panelToConfirm(data, scope)
  const next = upcomingEntries(data, today, UPCOMING_DAYS, scope).length
  const undated = undatedEvents(data, scope).length
  const builds = currentBuilds(data, scope).filter((b) => b.status === 'published' || b.status === 'ready').length
  const feedback = feedbackToPrioritize(data, scope).length
  const active = projectsInGroup(data, 'activos').length
  return (
    <div className="stats">
      {!scope && <Stat label={t('secciones.panel.kpis.activeProjects')} value={active} icon="folder" to={href('/proyectos?estado=activos')} />}
      <Stat
        label={t('secciones.panel.kpis.open')}
        value={items.filter(isActionable).length}
        hint={t('secciones.panel.kpis.openHint')}
        icon="list"
        to={href('/tareas')}
      />
      <Stat label={t('secciones.panel.kpis.today')} value={todayItems(data, today, scope).length} tone="info" icon="sun" to={href('/tareas?vista=hoy')} />
      <Stat label={t('secciones.panel.kpis.overdue')} value={overdue} tone={overdue ? 'danger' : 'neutral'} icon="clock" to={href('/tareas?filtro=vencidas')} />
      <Stat
        label={t('secciones.panel.kpis.blocked')}
        value={blocked}
        tone={blocked ? 'danger' : 'neutral'}
        icon="lock"
        to={href('/tareas?filtro=bloqueadas')}
      />
      <Stat
        label={t('secciones.panel.kpis.toConfirm')}
        value={confirm.status}
        hint={
          confirm.unverified
            ? t(confirm.unverified === 1 ? 'secciones.panel.kpis.unverifiedOne' : 'secciones.panel.kpis.unverifiedOther', { n: confirm.unverified })
            : undefined
        }
        tone={confirm.status ? 'warning' : 'neutral'}
        icon="question"
        to={href('/tareas?estado=to_confirm')}
      />
      <Stat
        label={t('secciones.panel.kpis.upcoming')}
        value={next}
        hint={
          undated
            ? t(undated === 1 ? 'secciones.panel.kpis.undatedOne' : 'secciones.panel.kpis.undatedOther', { n: undated })
            : t('secciones.panel.kpis.upcomingHint')
        }
        icon="calendar"
        to={href('/calendario')}
      />
      <Stat label={t('secciones.panel.kpis.builds')} value={builds} icon="box" to={href('/builds')} />
      <Stat label={t('secciones.panel.kpis.feedback')} value={feedback} icon="message" to={href('/feedback?vista=priorizacion')} />
    </div>
  )
}
