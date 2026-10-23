// Tareas: el trabajo de todos los proyectos (tareas, funcionalidades, hitos, decisiones e
// incidencias) en lista, tablero o calendario, y el plan de hoy. Las subsecciones son
// facetas de la URL (?vista=, ?filtro=) y se combinan («Mis tareas» en el tablero); los
// filtros finos (?q=, ?tipo=, ?area=, ?persona=…) también viven en la URL.
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { compareTasks, filterTasks, TASK_NOBODY } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import { Card } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { MePicker, useMe } from '../../components/MePicker'
import { SaveViewButton } from '../../components/SaveView'
import { SectionHeader, useSectionNav } from '../../components/SectionHeader'
import { TagFilterNotice } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { updatePreferences } from '../../prefs'
import type { SectionPageProps } from '../registry'
import { countLabel, useTaskParams, ViewSwitch } from './comunes'
import { TareasCalendario } from './TareasCalendario'
import { TareasFiltros } from './TareasFiltros'
import { TareasHoy } from './TareasHoy'
import { TareasLista } from './TareasLista'
import { TareasTablero } from './TareasTablero'
import './tareas.css'

export default function TareasSection({ embedded }: SectionPageProps) {
  const [params, setParams] = useSearchParams()
  // Las URL antiguas del panel (?estado=blocked) son la subsección «Bloqueadas».
  const legacyBlocked = params.get('estado') === 'blocked' && !params.has('filtro')
  useEffect(() => {
    if (!legacyBlocked) return
    const next = new URLSearchParams(params)
    next.delete('estado')
    next.set('filtro', 'bloqueadas')
    setParams(next, { replace: true })
  }, [legacyBlocked, params, setParams])
  if (params.get('vista') === 'hoy') return <TareasHoy embedded={embedded} />
  return <TareasTrabajo embedded={embedded} />
}

function TareasTrabajo({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { create } = useUI()
  const canEdit = useCanEdit()
  const me = useMe()
  const { project } = useScope()
  const nav = useSectionNav('tareas')
  const { vista, filtro, query, filtered } = useTaskParams()
  const items = filterTasks(data, query).sort(compareTasks)
  // «Mis tareas» sin saber quién soy: no hay lista posible, se pregunta.
  const needMe = filtro === 'mias' && !me
  const viewName = nav.active
    .filter((c) => c.value !== null)
    .map((c) => c.label)
    .join(' · ')
  // Lo nuevo hereda lo que se está mirando: el tipo y la persona del filtro.
  const persona = query.persona && query.persona !== TASK_NOBODY && data.members.some((m) => m.id === query.persona) ? query.persona : undefined
  const defaults = { kind: query.tipo ?? 'task', ...(persona ? { assigneeId: persona } : {}) }

  const actions = (
    <>
      {!embedded && <SaveViewButton suggestedName={t('secciones.tareas.actions.viewName', { view: viewName || t('secciones.tareas.title') })} />}
      {canEdit && (
        <button type="button" className="btn btn-primary" onClick={() => create('items', defaults)}>
          <Icon name="plus" size={16} /> {t('secciones.tareas.actions.new')}
        </button>
      )}
    </>
  )

  return (
    <div className={embedded ? 'tareas-page' : 'page tareas-page'}>
      <SectionHeader
        id="tareas"
        embedded={embedded}
        actions={actions}
        subtitle={project ? t('secciones.tareas.subtitleIn', { project: project.name }) : undefined}
      />
      <div className="tareas-toolbar">
        <ViewSwitch />
        {!needMe && (
          <p className="muted small tareas-count" aria-live="polite">
            {countLabel(items.length)}
          </p>
        )}
      </div>
      {!needMe && <TareasFiltros vista={vista} filtro={filtro} filtered={filtered} />}
      <TagFilterNotice />
      {filtro === 'mias' && me && (
        <p className="muted small tareas-me">
          <Icon name="user" size={14} /> {t('secciones.tareas.me.showing', { name: me.name })}{' '}
          <button type="button" className="link-btn" onClick={() => updatePreferences({ meId: undefined })}>
            {t('me.forget', { name: me.name })}
          </button>
        </p>
      )}
      {needMe ? (
        <Card title={t('me.select')} icon="user">
          <p className="tareas-note">{t('secciones.tareas.me.intro')}</p>
          {/* La clave lo vuelve a montar al crear a alguien: así sale elegida esa persona. */}
          <MePicker key={data.members.length} />
        </Card>
      ) : vista === 'tablero' ? (
        <TareasTablero items={items} filtro={filtro} filtered={filtered} embedded={embedded} />
      ) : vista === 'calendario' ? (
        <TareasCalendario items={items} filtro={filtro} embedded={embedded} />
      ) : (
        <TareasLista items={items} filtro={filtro} filtered={filtered} embedded={embedded} />
      )}
    </div>
  )
}
