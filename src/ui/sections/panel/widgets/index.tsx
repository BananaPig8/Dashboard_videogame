// El registro de bloques del Dashboard: icono, contenido y enlace de cada uno.
import { t, tr } from '../../../../i18n'
import type { Scope } from '../../../../domain/selectors'
import type { WidgetId } from '../../../prefs'
import { ScopedMore, type WidgetDef } from './comunes'
import { KpisBody } from './Kpis'
import { PrioritiesAction, PrioritiesBody } from './Prioridades'
import { ProjectsAction, ProjectsBody } from './Proyectos'
import { AgendaAction, AgendaBody } from './Agenda'
import { AttentionBody } from './Atencion'
import { ReleasesAction, ReleasesBody } from './Lanzamientos'
import { FeedbackAction, FeedbackBody } from './Feedback'
import { ActivityAction, RecentBody } from './Actividad'
import { BuildsBody } from './Builds'
import { DecisionsBody, EvolutionBody, ResourcesBody } from './Otros'

export const WIDGETS: Record<WidgetId, WidgetDef> = {
  kpis: { icon: 'activity', fixedWide: true, Body: KpisBody },
  priorities: { icon: 'flag', Body: PrioritiesBody, Action: PrioritiesAction },
  projects: { icon: 'folder', studioOnly: true, Body: ProjectsBody, Action: ProjectsAction },
  agenda: { icon: 'calendar', Body: AgendaBody, Action: AgendaAction },
  attention: { icon: 'alert', Body: AttentionBody },
  launch: { icon: 'rocket', Body: ReleasesBody, Action: ReleasesAction },
  feedback: { icon: 'message', Body: FeedbackBody, Action: FeedbackAction },
  activity: { icon: 'clock', Body: RecentBody, Action: ActivityAction },
  builds: { icon: 'box', Body: BuildsBody, Action: () => <ScopedMore to="/builds" label={t('secciones.panel.builds.all')} /> },
  evolution: { icon: 'activity', Body: EvolutionBody, Action: () => <ScopedMore to="/estadisticas?vista=actividad" label={t('secciones.panel.evolution.stats')} /> },
  decisions: { icon: 'scale', Body: DecisionsBody, Action: () => <ScopedMore to="/documentacion?tipo=decisiones" label={t('secciones.panel.decisions.log')} /> },
  resources: { icon: 'book', Body: ResourcesBody, Action: () => <ScopedMore to="/recursos" label={t('secciones.panel.resources.all')} /> },
}

/** El título de un bloque (el de proyectos, dentro de un proyecto, es el estado de ese proyecto). */
export function widgetTitle(id: WidgetId, scope: Scope): { title: string; subtitle: string } {
  if (id === 'projects' && scope) return { title: t('secciones.panel.projects.stateTitle'), subtitle: t('secciones.panel.projects.stateSubtitle') }
  return { title: tr(`widgets.${id}.title`), subtitle: tr(`widgets.${id}.subtitle`) }
}
