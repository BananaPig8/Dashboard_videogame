// Todo el trabajo (tareas, funcionalidades, hitos, decisiones e incidencias), en lista o
// en tablero, con filtros que viven en la URL para poder volver atrás sin perderlos.
import { useSearchParams } from 'react-router-dom'
import { CONFIDENCES, KINDS, PRIORITIES, STATUSES, STATUS_ORDER } from '../../domain/catalog'
import { todayISO, yearOf } from '../../domain/dates'
import { useToday } from '../hooks'
import { isOpen, itemDate, itemsOf, matchesQuery, byPriority } from '../../domain/selectors'
import type { ItemStatus, StudioData, WorkItem } from '../../domain/types'
import { store, useStudioData } from '../../data/store'
import { AreaTag, KindIcon, PriorityTag, ProjectChip } from '../components/Badges'
import { Card, PageHeader } from '../components/Common'
import { Icon } from '../components/Icon'
import { ItemList } from '../components/ItemList'
import { useScope, useUI } from '../context'
import { plural } from '../util'
import { SaveViewButton } from '../components/SaveView'

const COLUMNS: { id: string; label: string; statuses: ItemStatus[] }[] = [
  { id: 'ideas', label: 'Ideas y por confirmar', statuses: ['idea', 'to_confirm'] },
  { id: 'todo', label: 'Por hacer', statuses: ['backlog', 'planned'] },
  { id: 'doing', label: 'En curso', statuses: ['in_progress'] },
  { id: 'review', label: 'En revisión', statuses: ['review'] },
  { id: 'stopped', label: 'Bloqueado o en pausa', statuses: ['blocked', 'paused'] },
  { id: 'done', label: 'Hecho', statuses: ['done'] },
]

export function filterItems(data: StudioData, scope: string | null, params: URLSearchParams): WorkItem[] {
  const estado = params.get('estado') ?? 'abiertos'
  const tipo = params.get('tipo')
  const area = params.get('area')
  const prioridad = params.get('prioridad')
  const fiabilidad = params.get('fiabilidad')
  const q = params.get('q') ?? ''
  return itemsOf(data, scope).filter(
    (i) =>
      (estado === 'todos' || (estado === 'abiertos' ? isOpen(i) : i.status === estado)) &&
      (!tipo || i.kind === tipo) &&
      (!area || i.areaId === area) &&
      (!prioridad || i.priority === prioridad) &&
      (!fiabilidad || i.confidence === fiabilidad) &&
      matchesQuery(i, q),
  )
}

const statusRank = new Map(STATUS_ORDER.map((s, n) => [s, n]))
const sortItems = (a: WorkItem, b: WorkItem) =>
  statusRank.get(a.status)! - statusRank.get(b.status)! || byPriority(a, b) || (itemDate(b) ?? '').localeCompare(itemDate(a) ?? '')

export function WorkPage({ embedded }: { embedded?: boolean }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create } = useUI()
  const [params, setParams] = useSearchParams()
  const year = yearOf(useToday())
  const view = params.get('vista') === 'tablero' ? 'tablero' : 'lista'
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  // En el tablero se ven todas las columnas: el filtro de estado no se aplica.
  const listParams = view === 'tablero' ? new URLSearchParams({ ...Object.fromEntries(params), estado: 'todos' }) : params
  const items = filterItems(data, scope, listParams).sort(sortItems)
  const filtered = ['q', 'tipo', 'area', 'prioridad', 'fiabilidad'].some((k) => params.get(k)) || (params.get('estado') ?? 'abiertos') !== 'abiertos'

  return (
    <div className={embedded ? undefined : 'page'}>
      {!embedded && (
        <PageHeader
          title="Tareas y funcionalidades"
          subtitle="Tareas, funcionalidades, hitos, decisiones e incidencias"
          actions={
            <>
              <SaveViewButton suggestedName="Mi vista de trabajo" />
              <button type="button" className="btn btn-primary" onClick={() => create('items')}>
                <Icon name="plus" size={16} /> Nuevo elemento
              </button>
            </>
          }
        />
      )}
      <div className="filters" role="group" aria-label="Filtros">
        <input type="search" placeholder="Buscar…" value={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value)} aria-label="Buscar" />
        {view === 'lista' && (
          <select value={params.get('estado') ?? 'abiertos'} onChange={(e) => set('estado', e.target.value === 'abiertos' ? '' : e.target.value)} aria-label="Estado">
            <option value="abiertos">Abiertos</option>
            <option value="todos">Todos</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUSES[s].label}
              </option>
            ))}
          </select>
        )}
        <select value={params.get('tipo') ?? ''} onChange={(e) => set('tipo', e.target.value)} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {Object.entries(KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.plural}
            </option>
          ))}
        </select>
        <select value={params.get('area') ?? ''} onChange={(e) => set('area', e.target.value)} aria-label="Área">
          <option value="">Todas las áreas</option>
          {data.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select value={params.get('prioridad') ?? ''} onChange={(e) => set('prioridad', e.target.value)} aria-label="Prioridad">
          <option value="">Cualquier prioridad</option>
          {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
            <option key={p} value={p}>
              {PRIORITIES[p].label}
            </option>
          ))}
        </select>
        <select value={params.get('fiabilidad') ?? ''} onChange={(e) => set('fiabilidad', e.target.value)} aria-label="Fiabilidad del dato">
          <option value="">Cualquier fiabilidad</option>
          {Object.entries(CONFIDENCES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        {filtered && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setParams(view === 'tablero' ? { vista: 'tablero' } : {}, { replace: true })}>
            Quitar filtros
          </button>
        )}
        <span className="spacer" />
        <div className="segmented" role="group" aria-label="Vista">
          <button type="button" className={view === 'lista' ? 'active' : ''} onClick={() => set('vista', '')} aria-pressed={view === 'lista'}>
            <Icon name="list" size={15} /> Lista
          </button>
          <button type="button" className={view === 'tablero' ? 'active' : ''} onClick={() => set('vista', 'tablero')} aria-pressed={view === 'tablero'}>
            <Icon name="board" size={15} /> Tablero
          </button>
        </div>
      </div>
      <p className="muted small result-count">{plural(items.length, 'elemento', 'elementos')}</p>
      {view === 'lista' ? (
        <Card>
          <ItemList items={items} data={data} showProject={!scope} detail="description" year={year} empty="Ningún elemento con estos filtros." />
        </Card>
      ) : (
        <Board items={items} data={data} showProject={!scope} />
      )}
    </div>
  )
}

function Board({ items, data, showProject }: { items: WorkItem[]; data: StudioData; showProject: boolean }) {
  const { openItem } = useUI()
  const areas = new Map(data.areas.map((a) => [a.id, a]))
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  return (
    <div className="board">
      {COLUMNS.map((col) => {
        let list = items.filter((i) => col.statuses.includes(i.status))
        const total = list.length
        if (col.id === 'done') list = list.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 20)
        return (
          <section key={col.id} className="board-col" aria-label={col.label}>
            <h2>
              {col.label} <span className="tab-count">{total}</span>
            </h2>
            {list.map((i) => (
              <article key={i.id} className="board-card">
                <div className="board-card-head">
                  <KindIcon kind={i.kind} />
                  <button type="button" className="item-title" onClick={() => openItem(i.id)}>
                    {i.title}
                  </button>
                </div>
                <div className="item-meta">
                  {showProject && <ProjectChip project={projects.get(i.projectId)} />}
                  <AreaTag area={i.areaId ? areas.get(i.areaId) : undefined} />
                  <PriorityTag priority={i.priority} hideMedium />
                </div>
                <select
                  className="board-status"
                  value={i.status}
                  aria-label={`Estado de «${i.title}»`}
                  onChange={(e) => {
                    const status = e.target.value as ItemStatus
                    store.patch('items', i.id, {
                      status,
                      completedAt: status === 'done' ? (i.completedAt ?? todayISO()) : status === 'cancelled' ? i.completedAt : undefined,
                    })
                  }}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUSES[s].label}
                    </option>
                  ))}
                </select>
              </article>
            ))}
            {col.id === 'done' && total > list.length && <p className="list-more">y {total - list.length} más</p>}
          </section>
        )
      })}
    </div>
  )
}
