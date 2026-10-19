// El panel vive ahora en sections/panel y la tarjeta de proyecto en sections/proyectos. Este
// fichero solo reexporta lo que aún importan otras páginas (Hoy, Ajustes); se puede borrar
// cuando ninguna lo use.
export {
  CustomizePanel,
  EventLine,
  ProjectSummaryTab,
  ReasonPill,
  WIDGETS,
  WidgetArea,
  WidgetOrderList,
  type WidgetProps,
} from '../sections/panel/PanelWidgets'
export { ProjectCard } from '../sections/proyectos/ProjectCard'
