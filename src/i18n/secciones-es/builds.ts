// Textos de la sección «Builds y versiones». Cada sección tiene su fichero para poder trabajar en
// ellas por separado; es.ts los junta bajo `secciones.builds`.
export const builds = {
  title: 'Builds y versiones',
  subtitle: 'Qué hay compilado, en qué canal y qué cambió en cada versión',
  subtitleIn: 'Qué hay compilado de {project}, en qué canal y qué cambió en cada versión',
  actions: {
    new: 'Nueva build',
    newIssue: 'Nueva incidencia',
    newIssueIn: 'Nueva incidencia en esta build',
    edit: 'Editar {name}',
  },
  // Lo que explica cada subsección (?canal=) y lo que dice cuando está vacía.
  groups: {
    todas: {
      intro: 'Todas las builds: juego completo, demos, demos de evento, playtests, betas e internas.',
      empty: 'Todavía no hay builds apuntadas. Apunta la primera: qué versión es, en qué canal está y dónde se puede descargar.',
    },
    desarrollo: {
      intro: 'Las builds internas y las que siguen en preparación, sean del canal que sean.',
      empty: 'No hay builds internas ni en preparación.',
    },
    pruebas: {
      intro: 'Las builds para pruebas con jugadores (playtest) y las betas.',
      empty: 'No hay builds de pruebas ni betas.',
    },
    demos: {
      intro: 'Las demos y las demos de evento (las que se llevan a una feria).',
      empty: 'No hay demos apuntadas.',
    },
    publicas: {
      intro: 'Las builds publicadas, de cualquier canal: las que pueden tener los jugadores.',
      empty: 'No hay ninguna build publicada.',
    },
    candidatas: {
      intro:
        'Una candidata al lanzamiento es una build que se da por buena para publicarla si las últimas pruebas no encuentran nada grave. Si sale bien, pasa a «Publicada»; si aparece un fallo, se arregla en otra build y esta queda «Sustituida».',
      empty: 'No hay ninguna build candidata. Cuando una build esté lista para salir, cambia su estado a «Candidata al lanzamiento».',
    },
    emptyTag: 'Ninguna build de esta vista lleva la etiqueta.',
  },
  list: {
    count: { one: '{n} build', many: '{n} builds' },
    versions: 'Versiones del proyecto: {list}',
    caption: 'Builds de {project}',
  },
  table: {
    build: 'Build',
    channel: 'Canal',
    status: 'Estado',
    date: 'Fecha',
    platforms: 'Plataformas',
    where: 'Dónde está',
    release: 'Versión para jugadores',
    event: 'Evento',
    open: 'Abrir',
    noDate: 'Sin fecha',
    none: 'Sin indicar',
    noRelease: 'Ninguna',
    noEvent: 'Ninguno',
    missing: 'Ya no existe',
  },
  // Historial de cambios (?vista=cambios).
  cambios: {
    intro: 'Lo que se hizo entre una build y la siguiente: los commits y PR del repositorio, lo que se terminó y lo que cada build dice que cambia.',
    sameDay: 'Las builds solo llevan fecha, sin hora: lo del mismo día cuenta para la build de ese día.',
    evolution: 'Evolución',
    evolutionSub: 'Commits y elementos terminados por semana',
    projectTitle: 'Historial por build',
    filters: {
      label: 'Filtros del historial',
      search: 'Buscar en el historial…',
      searchLabel: 'Buscar en el historial',
      area: 'Área',
      areaAll: 'Todas las áreas',
      git: 'Commits y PR',
    },
    count: {
      doneOne: '{n} elemento terminado',
      doneMany: '{n} elementos terminados',
      gitOne: '{n} registro de git',
      gitMany: '{n} registros de git',
    },
    stretch: {
      open: 'Después de la última build',
      openHint: 'Aún no hay ninguna build con estos cambios.',
      from: 'Desde el {from}',
      range: 'Del {from} al {to}',
      day: 'Solo ese día',
      until: 'Desde el principio hasta el {to}',
      changelog: 'Qué cambia en {build}',
      noChangelog: 'Ninguna de estas builds tiene apuntado qué cambia: ábrelas para apuntarlo.',
      noChangelogOne: '{build} no tiene apuntado qué cambia.',
      addChangelog: 'Apuntar qué cambia en {build}',
      nothing: 'Ni commits ni elementos terminados en este tramo.',
      nothingFiltered: 'Nada con estos filtros en este tramo.',
    },
    undated: 'Builds sin fecha (no se pueden colocar en el historial)',
    empty: 'Todavía no hay historial: ni builds con fecha, ni commits, ni elementos terminados.',
    emptyFiltered: 'Nada con estos filtros.',
  },
  // Incidencias por versión (?vista=incidencias).
  incidencias: {
    intro:
      'Las incidencias de cada build y el feedback que se vio con ella. Para colocar una incidencia en su build, ábrela y elige «Build en la que aparece».',
    noBuild: 'Sin build indicada',
    noBuildHint: 'Incidencias que no dicen en qué build aparecen.',
    open: 'Abiertas',
    noneOpen: 'Ninguna abierta.',
    closed: { one: '{n} resuelta', many: '{n} resueltas' },
    feedback: 'Feedback visto con esta build',
    count: {
      openOne: '{n} abierta',
      openMany: '{n} abiertas',
      feedback: '{n} de feedback',
    },
    empty: 'No hay incidencias apuntadas. Cuando aparezca un fallo, apúntalo como incidencia y di en qué build se vio.',
    emptyTag: 'Ninguna incidencia ni feedback lleva la etiqueta.',
  },
} as const
