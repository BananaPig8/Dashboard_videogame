// Textos de la sección «Recursos». Cada sección tiene su fichero para poder trabajar en
// ellas por separado; es.ts los junta bajo `secciones.recursos`.
export const recursos = {
  title: 'Recursos',
  subtitle: 'Capturas, vídeos, imágenes, logos, documentos y material de referencia',
  subtitleIn: 'Capturas, vídeos, imágenes, logos, documentos y material de referencia de {project}',
  // Studio Hub no guarda archivos: lo dice siempre, para que nadie espere miniaturas ni subidas.
  manual:
    'Studio Hub no guarda archivos ni carga nada de fuera: cada recurso apunta a dónde está (un enlace o una ruta del repositorio del proyecto). Por eso no hay miniaturas, solo el icono de su tipo.',
  actions: {
    edit: 'Editar «{name}»',
    new: {
      todo: 'Nuevo recurso',
      capturas: 'Nueva captura',
      videos: 'Nuevo vídeo',
      imagenes: 'Nueva imagen',
      logos: 'Nuevo logo',
      documentos: 'Nuevo documento',
      enlaces: 'Nuevo enlace',
      arte: 'Nuevo recurso artístico',
      referencia: 'Nuevo archivo de referencia',
    },
  },
  // Lo que explica cada subsección (?tipo=) y lo que dice cuando está vacía.
  intro: {
    todo: 'Todo el material del estudio, por tipo: capturas, vídeos, imágenes, logos, documentos, enlaces, arte, referencias y material comercial.',
    capturas: 'Capturas del juego: para la tienda, la prensa, las redes o para comparar versiones.',
    videos: 'Vídeos: tráileres, gameplay, clips para redes y grabaciones de pruebas.',
    imagenes: 'Imágenes: key art, cápsulas, banners, fondos y cualquier imagen que no sea una captura ni un logo.',
    logos: 'Los logos del estudio y de cada juego, en sus variantes.',
    documentos: 'Documentos de cada proyecto: README, presentaciones, dosieres, ficheros de configuración…',
    enlaces: 'Enlaces externos que el estudio apunta a mano (son los mismos que en Documentación › Enlaces externos). Studio Hub no abre ni comprueba nada de fuera.',
    arte: 'Recursos artísticos: sprites, modelos, música, sonidos, fuentes y lo que se usa dentro del juego.',
    referencia: 'Archivos de referencia: inspiración, juegos parecidos, guías de estilo de otros, estudios de mercado…',
  },
  empty: {
    todo: 'Todavía no hay recursos apuntados. Apunta el primero con su enlace o su ruta en el repositorio.',
    capturas: 'No hay capturas apuntadas. Apunta dónde están (un enlace o una ruta del repositorio).',
    videos: 'No hay vídeos apuntados.',
    imagenes: 'No hay imágenes apuntadas.',
    logos: 'No hay logos apuntados.',
    documentos: 'No hay documentos apuntados.',
    enlaces: 'No hay enlaces apuntados.',
    arte: 'No hay recursos artísticos apuntados.',
    referencia: 'No hay archivos de referencia apuntados.',
  },
  emptyTag: 'Nada de esta vista lleva la etiqueta.',
  layout: {
    label: 'Cómo se ven los recursos',
    grid: 'Rejilla',
    list: 'Lista',
  },
  count: { one: '{n} recurso', many: '{n} recursos' },
  summary: {
    title: 'Por tipo',
    none: 'Nada apuntado',
    label: '{name}: {count}',
  },
  group: {
    see: 'Ver solo esto',
    seeLabel: 'Ver solo {name}',
    marketing: 'El material comercial se prepara en Publicación.',
    marketingLink: 'Ir a Materiales',
  },
  item: {
    studio: 'Del estudio',
    open: 'Abrir',
    inRepo: 'Ver en el repositorio',
    pathOnly: 'El proyecto no tiene repositorio apuntado: la ruta no se puede abrir desde aquí.',
    nowhere: 'Sin enlace ni ruta',
    written: 'Texto escrito aquí',
    event: 'De «{name}»',
    release: 'Para «{name}»',
    missing: 'ya no existe',
  },
  table: {
    caption: 'Recursos: {name}',
    resource: 'Recurso',
    type: 'Tipo',
    project: 'Proyecto',
    date: 'Fecha',
    where: 'Dónde está',
    noDate: 'Sin fecha',
  },
  body: {
    more: 'Leer entero',
    less: 'Plegar',
  },
} as const
