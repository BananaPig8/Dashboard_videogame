// Piezas que comparten las vistas de Tareas: la consulta que sale de la URL, el
// conmutador Lista / Tablero / Calendario y el motivo de cada cosa del plan de hoy.
import { Link, useSearchParams } from 'react-router-dom'
import { CONFIDENCES, KINDS, PRIORITIES, type Tone } from '../../../domain/catalog'
import { taskFilterOf, type TaskFilter, type TaskQuery, type TodayReason } from '../../../domain/selectors'
import type { Confidence, ItemKind, Priority } from '../../../domain/types'
import { t } from '../../../i18n'
import { Pill } from '../../components/Badges'
import { Icon, type IconName } from '../../components/Icon'
import { useMe } from '../../components/MePicker'
import { useSectionNav } from '../../components/SectionHeader'
import { useScope } from '../../context'
import { useToday } from '../../hooks'

export type TaskView = 'tablero' | 'calendario' | null

/** Los filtros finos de la página (parámetros propios, no subsecciones). */
export const FINE_FILTERS = ['q', 'estado', 'tipo', 'area', 'persona', 'prioridad', 'fiabilidad'] as const

const oneOf = <K extends string>(table: Record<K, unknown>, v: string | null): K | null => (v && v in table ? (v as K) : null)

export interface TaskParams {
  vista: TaskView
  filtro: TaskFilter | null
  query: TaskQuery
  /** ¿Hay algún filtro fino aplicado? (para «Quitar filtros» y los vacíos). */
  filtered: boolean
}

/**
 * La consulta de la URL: la vista (?vista=), la subsección (?filtro=, o el antiguo
 * ?estado=blocked) y los filtros finos. En el tablero y el calendario se ven todos los
 * estados, así que el filtro de estado solo vale en la lista.
 */
export function useTaskParams(): TaskParams {
  const [params] = useSearchParams()
  const { scope } = useScope()
  const today = useToday()
  const me = useMe()
  const v = params.get('vista')
  const vista: TaskView = v === 'tablero' || v === 'calendario' ? v : null
  const filtro = taskFilterOf(params.get('filtro'), params.get('estado'))
  // En «Bloqueadas» y «Vencidas» el estado ya está decidido.
  const fixedStatus = filtro === 'bloqueadas' || filtro === 'vencidas'
  const estado = vista ? 'todos' : fixedStatus ? null : params.get('estado')
  const query: TaskQuery = {
    scope,
    filtro,
    meId: me?.id,
    today,
    estado,
    tipo: oneOf<ItemKind>(KINDS, params.get('tipo')),
    area: params.get('area'),
    prioridad: oneOf<Priority>(PRIORITIES, params.get('prioridad')),
    fiabilidad: oneOf<Confidence>(CONFIDENCES, params.get('fiabilidad')),
    persona: filtro === 'mias' ? null : params.get('persona'),
    etiqueta: params.get('etiqueta'),
    q: params.get('q'),
  }
  const filtered =
    !!(query.q || query.tipo || query.area || query.prioridad || query.fiabilidad || query.persona) || (!vista && !!estado && estado !== 'abiertos')
  return { vista, filtro, query, filtered }
}

const VIEWS: { id: 'lista' | 'tablero' | 'calendario'; icon: IconName }[] = [
  { id: 'lista', icon: 'list' },
  { id: 'tablero', icon: 'board' },
  { id: 'calendario', icon: 'calendar' },
]

/** Lista / Tablero / Calendario: enlaces a las subsecciones (conservan el filtro y el ámbito). */
export function ViewSwitch() {
  const nav = useSectionNav('tareas')
  return (
    <nav className="tareas-views" aria-label={t('secciones.tareas.views.label')}>
      <ul>
        {VIEWS.map((v) => {
          const child = nav.section.children.find((c) => c.id === v.id)!
          const on = nav.active.includes(child)
          return (
            <li key={v.id}>
              <Link to={nav.href(child)} className={on ? 'active' : undefined} aria-current={on ? 'true' : undefined}>
                <Icon name={v.icon} size={15} /> {t(`secciones.tareas.views.${v.id}`)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const REASON: Record<TodayReason, { tone: Tone; icon: IconName }> = {
  overdue: { tone: 'danger', icon: 'clock' },
  due: { tone: 'warning', icon: 'clock' },
  focus: { tone: 'info', icon: 'sun' },
  in_progress: { tone: 'info', icon: 'play' },
  review: { tone: 'special', icon: 'eye' },
}

/** Por qué está algo en la lista de hoy. */
export function ReasonPill({ reason }: { reason: TodayReason }) {
  return (
    <Pill tone={REASON[reason].tone} icon={REASON[reason].icon}>
      {t(`secciones.tareas.hoy.reasons.${reason}`)}
    </Pill>
  )
}

/** «N tareas». */
export const countLabel = (n: number) => (n === 1 ? t('secciones.tareas.count.one', { n }) : t('secciones.tareas.count.many', { n }))
