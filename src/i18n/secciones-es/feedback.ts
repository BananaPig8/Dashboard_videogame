// Textos de la sección «Feedback y pruebas». Cada sección tiene su fichero para poder trabajar en
// ellas por separado; es.ts los junta bajo `secciones.feedback`.
export const feedback = {
  title: 'Feedback y pruebas',
  subtitle: 'Lo que dicen jugadores, ferias y pruebas, y qué se ha cambiado por ello',
  subtitleIn: 'Lo que dicen de {project} jugadores, ferias y pruebas, y qué se ha cambiado por ello',
  unclassified: 'Sin clasificar',
  impact: 'Impacto: {level}',
  priority: 'Prioridad: {level}',
  count: { one: '{n} de feedback', many: '{n} de feedback' },
  actions: {
    new: 'Nuevo feedback',
  },
  row: {
    from: 'Viene de:',
    build: 'Visto con:',
    solvedBy: 'Lo resuelve:',
    missing: 'Un elemento que ya no existe',
    received: 'Recibido el {date}',
  },
  filters: {
    label: 'Filtros del feedback',
    search: 'Buscar en el feedback…',
    searchLabel: 'Buscar en el feedback',
    status: 'Estado',
    statusAll: 'Todos los estados',
    statusOpen: 'Por atender',
    statusClosed: 'Atendido',
    impact: 'Impacto',
    impactAll: 'Cualquier impacto',
    origin: 'Origen',
    originAll: 'Cualquier origen',
    unclassified: 'Sin clasificar ({n})',
    clear: 'Quitar filtros',
  },
  list: {
    emptyFiltered: 'Nada con estos filtros.',
  },
  // Lo que explica cada subsección (?tipo=) y lo que dice cuando está vacía.
  tipos: {
    todo: {
      intro:
        'Todo lo apuntado, agrupado por estado: qué se dijo, qué es, de dónde viene, con qué build se vio y qué elementos de trabajo lo resuelven. Lo que aún no dice si es un comentario, un bug o una mejora sale como «Sin clasificar».',
      empty: 'Todavía no hay feedback apuntado. Apunta aquí lo que te digan en ferias, en Discord o en las pruebas con jugadores.',
    },
    comentarios: {
      intro: 'Los comentarios: opiniones e impresiones que no son un fallo ni piden un cambio concreto.',
      empty: 'No hay comentarios apuntados. Al apuntar un feedback, elige «Comentario» en «Qué es».',
    },
    bugs: {
      intro:
        'Los bugs juntan dos cosas: el feedback marcado como «Bug» y las incidencias apuntadas en Tareas. No se repite nada: si un feedback enlaza una incidencia en «Elementos que lo resuelven», sale una sola vez, en el feedback, con la incidencia debajo. El impacto del feedback y la prioridad de la incidencia van en la misma escala.',
      empty: 'No hay bugs: ni feedback marcado como «Bug» ni incidencias apuntadas en Tareas.',
    },
    mejoras: {
      intro: 'Las mejoras pedidas: lo que jugadores o el estudio proponen cambiar o añadir.',
      empty: 'No hay mejoras pedidas. Al apuntar un feedback, elige «Mejora pedida» en «Qué es».',
    },
  },
  bugs: {
    open: 'Por atender',
    closed: 'Atendido',
    issues: { one: '{n} incidencia de Tareas', many: '{n} incidencias de Tareas' },
    fromTasks: 'Apuntada en Tareas',
  },
  // Priorización (?vista=priorizacion).
  priorizacion: {
    intro:
      'El feedback abierto, por impacto y estado. Primero lo nuevo y lo revisado, de más a menos impacto; después lo ya planificado. Cada casilla del cuadro filtra la lista.',
    tipo: {
      comentarios: 'Solo los comentarios.',
      bugs: 'Solo los bugs. Las incidencias de Tareas que ningún bug enlaza salen aparte, al final: su estado se cambia en Tareas.',
      mejoras: 'Solo las mejoras pedidas.',
    },
    matrix: 'Impacto × estado',
    matrixHint: 'Cuánto feedback abierto hay en cada casilla',
    matrixCaption: 'Feedback abierto por impacto (filas) y estado (columnas)',
    impactCol: 'Impacto',
    cell: '{n} con impacto {impact} y estado {status}',
    queue: 'Por orden de prioridad',
    empty: {
      todo: 'Nada por priorizar: no hay feedback abierto con estos filtros.',
      comentarios: 'Ningún comentario abierto con estos filtros.',
      bugs: 'Ningún bug abierto con estos filtros.',
      mejoras: 'Ninguna mejora pedida abierta con estos filtros.',
    },
    issues: 'Incidencias de Tareas que ningún bug enlaza',
    issuesHint: 'Abiertas, de más a menos prioridad. Si una sale de un feedback, enlázala desde él y saldrá allí.',
    issuesEmpty: 'Ninguna incidencia abierta sin feedback.',
  },
  quick: {
    label: 'Cambiar el estado de «{title}»',
    move: 'Pasar «{title}» a {status}',
    done: '«{title}» pasa a {status}',
  },
  // Cambios por el feedback (?vista=cambios).
  cambios: {
    intro:
      'Lo que se ha cambiado por el feedback: el feedback con elementos de trabajo que lo resuelven («Elementos que lo resuelven»). Ya cambió cuando todo lo enlazado está hecho; está en marcha mientras quede algo abierto.',
    bugs: 'Solo el feedback marcado como «Bug» (las incidencias de Tareas no son feedback).',
    stats: {
      changed: 'Ya cambió',
      inProgress: 'En marcha',
      unlinked: 'Abierto, sin nada que lo resuelva',
    },
    unlinked: {
      one: '{n} de feedback abierto aún no tiene elementos que lo resuelvan.',
      many: '{n} de feedback abierto aún no tienen elementos que lo resuelvan.',
      link: 'Ver la priorización',
    },
    empty: 'Ningún feedback tiene todavía elementos que lo resuelvan. Ábrelo y elige las tareas o funcionalidades en «Elementos que lo resuelven».',
    changed: 'Lo que ya cambió',
    changedHint: 'Todo lo enlazado está hecho; del cambio más reciente al más antiguo',
    changedEmpty: 'Nada cambiado todavía con estos filtros.',
    inProgress: 'En marcha',
    inProgressHint: 'Queda algo abierto de lo que lo resuelve',
    inProgressEmpty: 'Nada en marcha con estos filtros.',
    none: 'Enlazado, pero sin nada hecho',
    noneHint: 'Lo enlazado se descartó o ya no existe',
    progress: '{done} de {total} hechos',
    changedAt: 'Cambiado el {date}',
    missing: 'Enlaces a elementos que ya no existen: {n}',
    canClose: 'Todo lo que lo resuelve está hecho, pero sigue como «{status}».',
    close: 'Marcar como resuelto',
  },
  // Informes de pruebas (?vista=informes).
  informes: {
    new: 'Nueva prueba',
    intro:
      'Cada prueba con jugadores: cuándo, cómo, cuántas personas, con qué build y en qué evento, con su resumen y el feedback que salió de ella. Lo concreto que se vio se apunta como feedback de la prueba.',
    empty: 'No hay pruebas apuntadas. Apunta cada prueba con jugadores (con amigos, cerrada, en una feria…) y el feedback que salga de ella.',
    emptyTag: 'Ninguna prueba lleva la etiqueta.',
    loose: 'Feedback de pruebas sin prueba apuntada',
    looseHint: 'Dice venir de una prueba con jugadores, pero no de cuál. Ábrelo y elige la prueba para que salga en su informe.',
    noDate: 'Sin fecha',
    people: { one: '{n} persona', many: '{n} personas', none: 'Personas sin apuntar' },
    edit: 'Editar {title}',
    build: 'Build:',
    event: 'Evento:',
    missing: 'ya no existe',
    noBuild: 'sin indicar',
    noSummary: 'Sin resumen apuntado.',
    feedback: 'Feedback de esta prueba ({n})',
    addFeedback: 'Añadir feedback',
    noFeedback: 'Ningún feedback apuntado de esta prueba.',
  },
} as const
