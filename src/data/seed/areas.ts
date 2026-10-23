import type { Area } from '../../domain/types'

// Líneas de trabajo del estudio. Son las mismas para todos los proyectos, así un juego
// nuevo ya nace con sus etiquetas y el panel puede comparar proyectos por área.
export const DEFAULT_AREAS: Area[] = [
  { id: 'gameplay', name: 'Mecánicas y sistemas', color: '#4f7cff', description: 'Creación de juegos, empleados, economía, investigación, empresa y progresión por años.' },
  { id: 'balance', name: 'Equilibrio', color: '#2f9e8f', description: 'Dificultad, notas, costes, ingresos y lo que hacen los rivales.' },
  { id: 'camera-pacing', name: 'Cámara y ritmo', color: '#0ea5b7', description: 'Zoom y cámara, velocidad del reloj, ritmo de la partida y duración de la demo.' },
  { id: 'ui-ux', name: 'Interfaz y UX', color: '#7c5cff', description: 'Ventanas, menús, paneles y flujo de la interfaz.' },
  { id: 'onboarding', name: 'Tutoriales y onboarding', color: '#a855f7', description: 'Tutoriales guiados, ayudas «?» y que el juego no abrume al empezar.' },
  { id: 'polish', name: 'Pulido, feedback y accesibilidad', color: '#e05fa8', description: 'Pulido visual, legibilidad, fuentes, respuesta a las acciones y accesibilidad.' },
  { id: 'art-audio', name: 'Arte y audio', color: '#f08c3a', description: 'Pixel art, oficina isométrica, personajes, iconos, música y efectos.' },
  { id: 'demo', name: 'Demos y versiones de prueba', color: '#e8a400', description: 'Demos, versiones de prueba, descargas y lo que entra o no en cada una.' },
  { id: 'events', name: 'Ferias y eventos', color: '#d9534f', description: 'Ferias, festivales, presentaciones y sus materiales (stand, roll-up, QR, modo stand).' },
  { id: 'release', name: 'Lanzamientos y actualizaciones', color: '#3fa34d', description: 'Versiones, compilación, firma, publicación y planificación de lanzamientos.' },
  { id: 'steam', name: 'Steam', color: '#1b6fa8', description: 'Página de la tienda, imágenes, logros, inventario y objetos de Steam.' },
  { id: 'ranking-integrity', name: 'Recompensas y prevención de abusos', color: '#8a6d3b', description: 'Ranking, puntuaciones, recompensas, trampas y filtros.' },
  { id: 'dlc', name: 'DLC y contenido adicional', color: '#c2410c', description: 'DLC, expansiones, actualizaciones de contenido y ediciones.' },
  { id: 'localization', name: 'Idiomas', color: '#0f766e', description: 'Traducción, selector de idioma y fuentes de cada alfabeto.' },
  { id: 'marketing', name: 'Marketing y comunidad', color: '#db2777', description: 'Tráiler, key art, logo, Discord y comunicación.' },
  { id: 'tech', name: 'Tecnología y herramientas', color: '#64748b', description: 'Motor, port a Godot, pruebas, CI, herramientas de trabajo y repositorio.' },
  { id: 'ideas', name: 'Ideas y proyectos futuros', color: '#94a3b8', description: 'Ideas sin empezar, líneas por confirmar y proyectos nuevos.' },
]
