// El historial: día a día, lo terminado y cada commit o PR, con la evolución semanal.
import { useSearchParams } from 'react-router-dom'
import { yearOf } from '../../domain/dates'
import { activityOf, itemsOf, matchesQuery, normalize, weeklyEvolution } from '../../domain/selectors'
import type { Activity, WorkItem } from '../../domain/types'
import { useStudioData } from '../../data/store'
import { AreaTag, KindIcon, ProjectChip } from '../components/Badges'
import { Card, Empty, PageHeader } from '../components/Common'
import { WeeklyChart } from '../components/Charts'
import { Icon } from '../components/Icon'
import { useScope, useUI } from '../context'
import { plural } from '../util'
import { useFormat, useToday } from '../hooks'
import { usePreferences } from '../prefs'
import { SaveViewButton } from '../components/SaveView'

export function HistoryPage({ embedded }: { embedded?: boolean }) {
  const data = useStudioData()
  const { scope } = useScope()
  const { openItem } = useUI()
  const today = useToday()
  const year = yearOf(today)
  const fmt = useFormat()
  const { weekStart } = usePreferences()
  // Los filtros van en la URL: así se pueden guardar como vista y no se pierden al volver.
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const area = params.get('area') ?? ''
  const showCommits = params.get('git') !== '0'
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const nq = normalize(q.trim())
  const activity = activityOf(data, scope).filter(
    (a) => (!area || a.areaId === area) && (!nq || normalize(`${a.title} ${a.ref ?? ''}`).includes(nq)),
  )
  const done = itemsOf(data, scope).filter((i) => i.status === 'done' && i.completedAt && (!area || i.areaId === area) && matchesQuery(i, q))

  const days = new Map<string, { items: WorkItem[]; activity: Activity[] }>()
  const day = (d: string) => {
    if (!days.has(d)) days.set(d, { items: [], activity: [] })
    return days.get(d)!
  }
  for (const i of done) day(i.completedAt!).items.push(i)
  if (showCommits) for (const a of activity) day(a.at.slice(0, 10)).activity.push(a)
  const ordered = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const areas = new Map(data.areas.map((a) => [a.id, a]))
  const projects = new Map(data.projects.map((p) => [p.id, p]))

  return (
    <div className={embedded ? undefined : 'page'}>
      {!embedded && <PageHeader title="Historial" subtitle="Todo lo que se ha hecho, con su fecha y su fuente" actions={<SaveViewButton suggestedName="Historial filtrado" />} />}
      <Card title="Evolución" icon="activity" subtitle="Commits y elementos terminados por semana">
        <WeeklyChart buckets={weeklyEvolution(data, today, 8, scope, weekStart)} year={year} />
      </Card>
      <div className="filters" role="group" aria-label="Filtros del historial">
        <input type="search" placeholder="Buscar en el historial…" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Buscar en el historial" />
        <select value={area} onChange={(e) => set('area', e.target.value)} aria-label="Área">
          <option value="">Todas las áreas</option>
          {data.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="check-field">
          <input type="checkbox" checked={showCommits} onChange={(e) => set('git', e.target.checked ? '' : '0')} /> Commits y PR
        </label>
        <span className="spacer" />
        <span className="muted small">
          {plural(done.length, 'elemento terminado', 'elementos terminados')} · {plural(activity.length, 'registro', 'registros')} de git
        </span>
      </div>
      {ordered.length === 0 && (
        <Card>
          <Empty icon="history">Nada con estos filtros.</Empty>
        </Card>
      )}
      <ol className="history">
        {ordered.map(([d, { items, activity: acts }]) => (
          <li key={d} className="history-day">
            <h2 className="history-date">{fmt.longDate(d)}</h2>
            {items.length > 0 && (
              <ul className="history-items">
                {items.map((i) => (
                  <li key={i.id}>
                    <KindIcon kind={i.kind} />
                    <button type="button" className="item-title" onClick={() => openItem(i.id)}>
                      {i.title}
                    </button>
                    <AreaTag area={i.areaId ? areas.get(i.areaId) : undefined} />
                    {scope === null && <ProjectChip project={projects.get(i.projectId)} />}
                  </li>
                ))}
              </ul>
            )}
            {acts.length > 0 && (
              <details className="history-git" open={items.length === 0}>
                <summary>
                  <Icon name="git" size={14} /> {plural(acts.length, 'registro de git', 'registros de git')}
                </summary>
                <ul>
                  {acts.map((a) => (
                    <li key={a.id}>
                      <span className="muted small nowrap">{fmt.time(a.at)}</span>
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer noopener" className="git-ref">
                          {a.ref}
                        </a>
                      ) : (
                        <span className="git-ref">{a.ref}</span>
                      )}
                      <span className={a.type === 'merge' ? 'git-merge' : undefined}>{a.title}</span>
                      {a.note && <span className="muted small">({a.note})</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
