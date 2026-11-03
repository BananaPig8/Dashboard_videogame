// Textos de la sección «Panel del estudio». Cada sección tiene su fichero para poder trabajar en
// ellas por separado; es.ts los junta bajo `secciones.panel`. Los bloques del Dashboard tienen
// además los suyos (panel-*.ts), bajo `secciones.panel.<parte>`.
import { panel_actividad } from './panel-actividad'
import { panel_cabecera } from './panel-cabecera'
import { panel_prioridades } from './panel-prioridades'
import { panel_tarjetas } from './panel-tarjetas'

export const panel = {
  cabecera: panel_cabecera,
  prioridades: panel_prioridades,
  tarjetas: panel_tarjetas,
  actividad: panel_actividad,
  title: 'Panel del estudio',
  subtitle: 'Lo importante de todos los juegos, de un vistazo',
  titleProject: 'Panel · {project}',
  dateActiveNone: '{date} · ningún proyecto activo',
  dateActiveOne: '{date} · 1 proyecto activo',
  dateActiveOther: '{date} · {n} proyectos activos',
  dateProject: '{date} · lo importante de este proyecto',
  backToSummary: 'Volver al resumen',
  // Qué enseña cada subsección (?ver=), debajo del título.
  views: {
    actividad: 'Todo lo que pasa en el estudio: los cambios hechos aquí, las fechas de los datos y el historial del código, con filtros',
    fechas: 'Fechas límite, hitos, eventos, inscripciones, versiones y recordatorios de los próximos 60 días',
    prioritarias: 'Lo crítico, lo vencido y lo que vence, lo bloqueado y lo que espera, los hitos en riesgo y las entregas, inscripciones y eventos de los próximos 14 días',
    proyectos: 'Cómo va cada juego: etapa, salud, cifras y actividad',
    proyectosOne: 'Cómo va este juego: etapa, salud, cifras y actividad',
    alertas: 'Qué proyecto pide atención y por qué, con todos los avisos de hoy',
  },
  about: {
    title: 'De qué va',
    empty: 'Este proyecto aún no tiene descripción.',
    write: 'Escribir la descripción',
  },
  attention: {
    none: 'Ningún proyecto pide atención ahora mismo.',
    upToDate: 'Al día: {names}',
    alertsAll: 'Todos los avisos de hoy ({n})',
    alertsNone: 'Nada vencido, bloqueado ni a punto de llegar: no hay avisos hoy.',
  },
  today: {
    plan: 'Planificar el día',
  },
  projects: {
    new: 'Nuevo proyecto',
    add: 'Añadir un videojuego',
    addHint: 'De la idea a la publicación, con el mismo panel.',
    all: 'Todos los proyectos',
    stateTitle: 'Estado del proyecto',
    stateSubtitle: 'Su etapa, su salud y lo que tiene abierto',
    whyTitle: 'Por qué está así',
    whyNone: 'Nada pide atención en este proyecto ahora mismo.',
  },
  agenda: {
    empty: 'No hay fechas en los próximos 60 días.',
    add: 'Añadir una fecha',
    more: 'Ver {n} más en el calendario',
    stale: '¿Se celebró? Actualiza su estado',
    undated: 'Previstos sin fecha confirmada',
    unconfirmed: 'Fecha sin confirmar',
    until: 'hasta el {date}',
  },
  launch: {
    link: 'Publicación',
  },
  builds: {
    all: 'Todas',
    empty: 'No hay builds registradas.',
    add: 'Registrar una build',
    open: 'Abrir {name}',
  },
  evolution: {
    stats: 'Estadísticas',
    last7: 'Commits en los últimos 7 días',
    previous: '(semana anterior: {n})',
    doneTotal: 'Elementos terminados en total',
    commits: 'Commits registrados',
  },
  decisions: {
    log: 'Registro',
    open: 'Por decidir ({n})',
    taken: 'Últimas tomadas',
    none: 'Sin decisiones registradas.',
  },
  resources: {
    all: 'Todos',
    empty: 'Sin recursos.',
    add: 'Añadir un recurso',
  },
} as const
