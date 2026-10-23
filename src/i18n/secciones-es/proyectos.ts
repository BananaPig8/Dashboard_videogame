// Textos de la sección «Proyectos». Cada sección tiene su fichero para poder trabajar en
// ellas por separado; es.ts los junta bajo `secciones.proyectos`.
export const proyectos = {
  title: 'Proyectos',
  subtitle: 'Todos los videojuegos del estudio, de la idea a la publicación',
  new: 'Nuevo proyecto',
  countsLabel: 'Proyectos por estado',
  countOne: '1 proyecto',
  countOther: '{n} proyectos',
  none: 'Aún no hay proyectos en el estudio. Añade el primero: de la idea a la publicación, con el mismo panel.',
  noneWithTag: 'Ningún proyecto lleva esta etiqueta.',
  // Los grupos de etapas (?estado=): qué son y qué pasa si no hay ninguno.
  groups: {
    activos: {
      title: 'Activos',
      hint: 'En desarrollo, del prototipo al lanzamiento.',
      empty: 'Ningún proyecto activo.',
      emptyHint: 'Un proyecto está activo desde que tiene prototipo hasta que se lanza.',
    },
    planificacion: {
      title: 'En planificación',
      hint: 'Ideas y conceptos que aún no se desarrollan.',
      empty: 'Ningún proyecto en planificación.',
      emptyHint: 'Aquí van las ideas y los conceptos: lo que se está pensando antes de prototipar.',
    },
    pausa: {
      title: 'En pausa',
      hint: 'Parados a propósito: no piden atención ni cuentan como activos.',
      empty: 'Ningún proyecto en pausa.',
      emptyHint:
        'Un proyecto en pausa está parado a propósito: no pide atención ni cuenta como activo. Para pausar uno, cambia su etapa a «En pausa» en su ficha.',
    },
    lanzados: {
      title: 'Lanzados',
      hint: 'Publicados y en mantenimiento.',
      empty: 'Ningún proyecto lanzado todavía.',
      emptyHint: 'Un proyecto pasa aquí cuando se publica (etapa «Publicado»); mientras se prepara el lanzamiento sigue entre los activos.',
    },
    archivados: {
      title: 'Archivados',
      hint: 'Cerrados: se guardan para consultar, sin avisos.',
      empty: 'Ningún proyecto archivado.',
      emptyHint: 'Archivar un proyecto lo cierra sin borrarlo: se puede consultar, pero no pide atención ni sale en el panel.',
    },
  },
  stages: {
    title: 'Etapas',
    subtitle: 'Cómo avanza un proyecto, y cuántos hay en cada etapa',
    count: '{n} en {stage}',
  },
  card: {
    open: 'Abiertas',
    blocked: 'Bloqueadas',
    toConfirm: 'Por confirmar',
    done: 'Hechas',
    lastActivity: 'Última actividad {when}',
    noActivity: 'Sin actividad registrada',
    commits: 'Commits de los últimos {n} días',
  },
} as const
