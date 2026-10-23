// Panel: en el estudio («/»), lo importante de todos los juegos; en la ficha de un proyecto,
// su pestaña «Resumen». Sin ?ver=, los bloques personalizables de siempre; con ?ver= (las
// subsecciones), el modo foco: solo los bloques de esa vista (PANEL_FOCUS), a todo el ancho.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { yearOf } from '../../../domain/dates'
import { projectsInGroup } from '../../../domain/selectors'
import { t, tr } from '../../../i18n'
import { useStudioData } from '../../../data/store'
import { Icon } from '../../components/Icon'
import { SectionHeader, useSectionNav } from '../../components/SectionHeader'
import { useScope } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { PANEL_FOCUS } from '../../navigation'
import type { SectionPageProps } from '../registry'
import { CustomizePanel, FocusArea, ProjectSummaryTab, WidgetArea } from './PanelWidgets'
import './panel.css'

export default function PanelSection({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, project } = useScope()
  const today = useToday()
  const fmt = useFormat()
  const [params] = useSearchParams()
  const nav = useSectionNav('panel')
  const [customizing, setCustomizing] = useState(false)
  const ver = params.get('ver')
  const focus = ver ? PANEL_FOCUS[ver] : undefined
  const props = { data, scope, today, year: yearOf(today), fmt }
  const summary = nav.section.children.find((c) => c.value === null)!

  const date = fmt.longDate(today)
  const active = projectsInGroup(data, 'activos').length
  const subtitle = focus
    ? tr(`secciones.panel.views.${ver === 'proyectos' && scope ? 'proyectosOne' : ver}`)
    : scope
      ? t('secciones.panel.dateProject', { date })
      : t(active === 0 ? 'secciones.panel.dateActiveNone' : active === 1 ? 'secciones.panel.dateActiveOne' : 'secciones.panel.dateActiveOther', {
          date,
          n: active,
        })
  // En el modo foco, el título es el de la subsección (lo pone SectionHeader).
  const title = focus ? undefined : project ? t('secciones.panel.titleProject', { project: project.name }) : t('secciones.panel.title')

  const actions = focus ? (
    <Link to={nav.href(summary)} className="btn btn-ghost">
      <Icon name="chevronLeft" size={16} /> {t('secciones.panel.backToSummary')}
    </Link>
  ) : (
    <button type="button" className="btn btn-ghost" onClick={() => setCustomizing(true)}>
      <Icon name="layout" size={16} /> {t('actions.customize')}
    </button>
  )

  return (
    <div className={embedded ? 'stack' : 'page'}>
      <SectionHeader id="panel" embedded={embedded} title={title} subtitle={subtitle} actions={actions} />
      {focus ? <FocusArea ids={focus} {...props} /> : embedded ? <ProjectSummaryTab /> : <WidgetArea {...props} />}
      <CustomizePanel open={customizing} onClose={() => setCustomizing(false)} />
    </div>
  )
}
