// Qué página pinta cada sección. Cada una vive en su carpeta (sections/<sección>/) y se
// carga cuando se abre. La misma página sirve para todo el estudio y, con `embedded`,
// como pestaña de la ficha de un proyecto (el ámbito sale de la URL: useScope()).
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { SectionId } from '../navigation'

export interface SectionPageProps {
  /** Dentro de la ficha de un proyecto: sin cabecera grande. */
  embedded?: boolean
}

export const SECTION_PAGES: Record<SectionId, LazyExoticComponent<ComponentType<SectionPageProps>>> = {
  panel: lazy(() => import('./panel/PanelSection')),
  proyectos: lazy(() => import('./proyectos/ProyectosSection')),
  tareas: lazy(() => import('./tareas/TareasSection')),
  roadmap: lazy(() => import('./roadmap/RoadmapSection')),
  calendario: lazy(() => import('./calendario/CalendarioSection')),
  builds: lazy(() => import('./builds/BuildsSection')),
  publicacion: lazy(() => import('./publicacion/PublicacionSection')),
  feedback: lazy(() => import('./feedback/FeedbackSection')),
  eventos: lazy(() => import('./eventos/EventosSection')),
  documentacion: lazy(() => import('./documentacion/DocumentacionSection')),
  recursos: lazy(() => import('./recursos/RecursosSection')),
  equipo: lazy(() => import('./equipo/EquipoSection')),
  finanzas: lazy(() => import('./finanzas/FinanzasSection')),
  estadisticas: lazy(() => import('./estadisticas/EstadisticasSection')),
  ajustes: lazy(() => import('./ajustes/AjustesSection')),
}
