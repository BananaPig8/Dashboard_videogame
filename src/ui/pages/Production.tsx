// Agenda, builds, publicación, feedback, decisiones y recursos. Cada pantalla vale para
// todo el estudio o para un proyecto (embedded = dentro de la ficha del proyecto).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BUILD_CHANNELS,
  CHECKLIST_TARGETS,
  EVENT_TYPES,
  FEEDBACK_ORIGINS,
  FEEDBACK_STATUSES,
  RESOURCE_TYPES,
  STATUSES,
} from '../../domain/catalog'
import { yearOf } from '../../domain/dates'
import {
  checklistsOf,
  decisions,
  feedbackToPrioritize,
  itemDate,
  pausedItems,
  pendingInAreas,
  staleEvents,
  type Scope,
} from '../../domain/selectors'
import type { Build, Checklist, FeedbackStatus, Project, StudioData, StudioEvent } from '../../domain/types'
import { newId, store, useStudioData } from '../../data/store'
import {
  BuildChannelPill,
  BuildStatusPill,
  ConfidenceTag,
  EventStatusPill,
  FeedbackStatusPill,
  Pill,
  PriorityTag,
  ProjectChip,
  StatusPill,
} from '../components/Badges'
import { Card, Empty, ExternalLink, PageHeader, Progress } from '../components/Common'
import { Icon } from '../components/Icon'
import { ItemList } from '../components/ItemList'
import { useScope, useUI } from '../context'
import { sourceHref } from '../util'
import { useFormat, useToday } from '../hooks'
import { useNotify } from '../feedback'

interface PageProps {
  embedded?: boolean
}

/** Año de hoy, para no repetirlo en las fechas de este año. */
const useYear = () => yearOf(useToday())
const ofScope = <T extends { projectId?: string }>(list: T[], scope: Scope, includeStudio = true) =>
  list.filter((x) => scope === null || x.projectId === scope || (includeStudio && !x.projectId))

function Header({ embedded, title, subtitle, onNew, newLabel }: { embedded?: boolean; title: string; subtitle: string; onNew: () => void; newLabel: string }) {
  const action = (
    <button type="button" className="btn btn-primary" onClick={onNew}>
      <Icon name="plus" size={16} /> {newLabel}
    </button>
  )
  if (embedded) return <div className="embedded-actions">{action}</div>
  return <PageHeader title={title} subtitle={subtitle} actions={action} />
}

// ——— Agenda ———————————————————————————————————————————————————————————————

export function AgendaPage({ embedded }: PageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create, edit, openItem } = useUI()
  const today = useToday()
  const fmt = useFormat()
  const year = yearOf(today)
  const events = ofScope(data.events, scope)
  const dues = data.items.filter((i) => (scope === null || i.projectId === scope) && i.dueDate && STATUSES[i.status].open)
  type Row = { date: string; event?: StudioEvent; dueId?: string; title: string; kind: string; status?: StudioEvent['status']; project?: Project; confirmed: boolean }
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  const rows: Row[] = [
    ...events
      .filter((e) => e.date)
      .map((e) => ({ date: e.date!, event: e, title: e.title, kind: EVENT_TYPES[e.type], status: e.status, project: projects.get(e.projectId ?? ''), confirmed: e.dateConfirmed })),
    ...dues.map((i) => ({ date: i.dueDate!, dueId: i.id, title: i.title, kind: 'Fecha límite', project: projects.get(i.projectId), confirmed: true })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const future = rows.filter((r) => r.date >= today)
  const past = rows.filter((r) => r.date < today).reverse()
  const undated = events.filter((e) => !e.date && e.status !== 'cancelled')
  const stale = new Set(staleEvents(data, today, scope).map((e) => e.id))

  const byMonth = new Map<string, Row[]>()
  for (const r of future) {
    const k = r.date.slice(0, 7)
    byMonth.set(k, [...(byMonth.get(k) ?? []), r])
  }

  const RowView = ({ r }: { r: Row }) => (
    <li className="agenda-row">
      <div className="agenda-date">
        <strong>{fmt.date(r.date, year)}</strong>
        <span className="muted small">{r.confirmed ? fmt.relative(r.date, today) : 'sin confirmar'}</span>
      </div>
      <div className="agenda-main">
        <button type="button" className="item-title" onClick={() => (r.event ? edit({ collection: 'events', id: r.event.id }) : openItem(r.dueId!))}>
          {r.title}
        </button>
        <div className="item-meta">
          <span className="meta-date">{r.kind}</span>
          {r.event?.location && <span className="meta-date">{r.event.location}</span>}
          {scope === null && <ProjectChip project={r.project} />}
          {r.event && stale.has(r.event.id) && <Pill tone="warning">¿Se celebró?</Pill>}
        </div>
        {r.event?.notes && <p className="item-detail">{r.event.notes}</p>}
      </div>
      {r.status && <EventStatusPill status={r.status} />}
    </li>
  )

  return (
    <div className={embedded ? undefined : 'page'}>
      <Header embedded={embedded} title="Agenda" subtitle="Ferias, festivales, presentaciones, entregas y fechas límite" onNew={() => create('events')} newLabel="Nuevo evento" />
      <div className="grid grid-2-1">
        <Card title="Próximamente" icon="calendar">
          {future.length === 0 ? (
            <Empty icon="calendar">No hay fechas por delante. Añade ferias, entregas o fechas límite.</Empty>
          ) : (
            [...byMonth.entries()].map(([month, list]) => (
              <div key={month} className="month-group">
                <h3 className="subhead">{fmt.monthYear(month)}</h3>
                <ul className="agenda-list">
                  {list.map((r) => (
                    <RowView key={`${r.event?.id ?? r.dueId}`} r={r} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </Card>
        <div className="stack">
          <Card title="Sin fecha confirmada" icon="question">
            {undated.length === 0 ? (
              <Empty>Todo lo previsto tiene fecha.</Empty>
            ) : (
              <ul className="agenda-list">
                {undated.map((e) => (
                  <li key={e.id} className="agenda-row">
                    <div className="agenda-main">
                      <button type="button" className="item-title" onClick={() => edit({ collection: 'events', id: e.id })}>
                        {e.title}
                      </button>
                      <div className="item-meta">
                        <span className="meta-date">{EVENT_TYPES[e.type]}</span>
                        {scope === null && <ProjectChip project={projects.get(e.projectId ?? '')} />}
                        <ConfidenceTag confidence={e.confidence} compact />
                      </div>
                      {e.notes && <p className="item-detail">{e.notes}</p>}
                    </div>
                    <EventStatusPill status={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Ya pasado" icon="history">
            {past.length === 0 ? <Empty>Nada en el pasado.</Empty> : <ul className="agenda-list">{past.slice(0, 15).map((r) => <RowView key={`${r.event?.id ?? r.dueId}`} r={r} />)}</ul>}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ——— Builds ———————————————————————————————————————————————————————————————

export function BuildsPage({ embedded }: PageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create, edit } = useUI()
  const fmt = useFormat()
  const year = useYear()
  const builds = ofScope(data.builds, scope, false).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.name.localeCompare(b.name))
  const projects = data.projects.filter((p) => scope === null || p.id === scope)
  return (
    <div className={embedded ? undefined : 'page'}>
      <Header embedded={embedded} title="Builds y versiones" subtitle="Juego completo, demos, demos de feria y betas: qué hay compilado y dónde" onNew={() => create('builds')} newLabel="Nueva build" />
      {projects.map((p) => {
        const list = builds.filter((b) => b.projectId === p.id)
        return (
          <Card key={p.id} title={scope ? 'Builds' : p.name} icon="box" subtitle={p.versions.map((v) => `${v.label} ${v.version}`).join(' · ')}>
            {list.length === 0 ? (
              <Empty icon="box">Sin builds registradas.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Build</th>
                      <th>Canal</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Plataformas</th>
                      <th>Dónde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((b: Build) => (
                      <tr key={b.id}>
                        <td data-label="Build">
                          <button type="button" className="item-title" onClick={() => edit({ collection: 'builds', id: b.id })}>
                            {b.name}
                          </button>{' '}
                          <span className="version-tag">v{b.version}</span>
                          {b.notes && <p className="item-detail">{b.notes}</p>}
                        </td>
                        <td data-label="Canal">
                          <BuildChannelPill channel={b.channel} />
                        </td>
                        <td data-label="Estado">
                          <BuildStatusPill status={b.status} />
                        </td>
                        <td className="nowrap" data-label="Fecha">{b.date ? fmt.date(b.date, year) : '—'}</td>
                        <td data-label="Plataformas">{b.platforms.join(', ') || '—'}</td>
                        <td data-label="Dónde">{b.url ? <ExternalLink href={b.url}>{b.distribution ?? 'Abrir'}</ExternalLink> : (b.distribution ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )
      })}
      <p className="muted small">Canales: {Object.values(BUILD_CHANNELS).map((c) => c.label).join(', ')}.</p>
    </div>
  )
}

// ——— Publicación ———————————————————————————————————————————————————————————

function ChecklistCard({ checklist, data, showProject }: { checklist: Checklist; data: StudioData; showProject: boolean }) {
  const { edit } = useUI()
  const { confirm } = useNotify()
  const [label, setLabel] = useState('')
  const project = data.projects.find((p) => p.id === checklist.projectId)
  const done = checklist.items.filter((i) => i.done).length
  const save = (items: Checklist['items']) => store.upsert('checklists', { ...checklist, items })
  return (
    <Card
      id={checklist.id}
      title={checklist.title}
      icon="rocket"
      subtitle={`${CHECKLIST_TARGETS[checklist.target]} · ${done}/${checklist.items.length}`}
      action={
        <>
          {done > 0 && checklist.target === 'update' && (
            <button
              type="button"
              className="btn btn-small btn-ghost"
              title="Desmarca todos los pasos para la siguiente versión"
              onClick={async () => {
                if (await confirm({ title: '¿Empezar una versión nueva?', message: 'Se desmarcan todos los pasos de esta lista.', confirmLabel: 'Desmarcar todo' }))
                  save(checklist.items.map((i) => ({ ...i, done: false })))
              }}
            >
              Empezar de nuevo
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Editar lista" onClick={() => edit({ collection: 'checklists', id: checklist.id })}>
            <Icon name="edit" size={16} />
          </button>
        </>
      }
    >
      {showProject && <ProjectChip project={project} />}
      {checklist.description && <p className="muted">{checklist.description}</p>}
      <Progress ratio={checklist.items.length ? done / checklist.items.length : 0} label={checklist.title} tone={done === checklist.items.length ? 'success' : 'info'} />
      <ul className="checklist">
        {checklist.items.map((it) => (
          <li key={it.id} className={it.done ? 'done' : undefined}>
            <label>
              <input type="checkbox" checked={it.done} onChange={() => save(checklist.items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))} />
              <span>{it.label}</span>
            </label>
            {(it.note || it.sources?.length) && (
              <div className="checklist-note">
                {it.note && <span>{it.note}</span>}
                {it.sources?.map((s, k) => {
                  const href = sourceHref(s, project)
                  return href ? (
                    <ExternalLink key={k} href={href}>
                      {s.ref}
                    </ExternalLink>
                  ) : (
                    <span key={k} className="muted">
                      {s.ref}
                    </span>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              className="icon-btn small"
              aria-label={`Quitar el paso «${it.label}»`}
              onClick={async () => {
                if (await confirm({ title: `¿Quitar el paso «${it.label}»?`, confirmLabel: 'Quitar', danger: true }))
                  save(checklist.items.filter((x) => x.id !== it.id))
              }}
            >
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!label.trim()) return
          save([...checklist.items, { id: newId('paso'), label: label.trim(), done: false }])
          setLabel('')
        }}
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Añadir un paso…" aria-label="Nuevo paso" />
        <button type="submit" className="btn btn-small" disabled={!label.trim()}>
          Añadir
        </button>
      </form>
    </Card>
  )
}

export function PublishPage({ embedded }: PageProps) {
  const data = useStudioData()
  const year = useYear()
  const { scope } = useScope()
  const { create } = useUI()
  const lists = checklistsOf(data, scope)
  const pending = pendingInAreas(data, ['steam', 'release', 'demo', 'events'], scope)
  return (
    <div className={embedded ? undefined : 'page'}>
      <Header embedded={embedded} title="Publicar y actualizar" subtitle="Los pasos para publicar en Steam, sacar una versión o llevar el juego a una feria" onNew={() => create('checklists')} newLabel="Nueva lista" />
      <div className="grid grid-2">
        {lists.map(({ checklist }) => (
          <ChecklistCard key={checklist.id} checklist={checklist} data={data} showProject={scope === null} />
        ))}
        {lists.length === 0 && (
          <Card>
            <Empty icon="rocket">Sin listas. Crea una para publicar en Steam, sacar una demo o preparar una feria.</Empty>
          </Card>
        )}
      </div>
      <Card title="Pendiente para publicar, demos y ferias" icon="flag" subtitle="Elementos abiertos de Steam, lanzamientos, demos y eventos">
        <ItemList items={pending} data={data} showProject={scope === null} detail="blocked" year={year} empty="Nada pendiente." />
      </Card>
    </div>
  )
}

// ——— Feedback ——————————————————————————————————————————————————————————————

export function FeedbackPage({ embedded }: PageProps) {
  const data = useStudioData()
  const year = useYear()
  const fmt = useFormat()
  const { scope } = useScope()
  const { create, edit, openItem } = useUI()
  const open = feedbackToPrioritize(data, scope)
  const closed = ofScope(data.feedback, scope, false)
    .filter((f) => !FEEDBACK_STATUSES[f.status].open)
    .sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? ''))
  const items = new Map(data.items.map((i) => [i.id, i]))
  const projects = new Map(data.projects.map((p) => [p.id, p]))

  const List = ({ list }: { list: typeof open }) => (
    <ul className="item-list">
      {list.map((f) => (
        <li key={f.id} className="item-row">
          <div className="item-main">
            <button type="button" className="item-title" onClick={() => edit({ collection: 'feedback', id: f.id })}>
              {f.title}
            </button>
            {f.detail && <p className="item-detail">{f.detail}</p>}
            <div className="item-meta">
              <span className="meta-date">{FEEDBACK_ORIGINS[f.origin]}{f.originDetail ? ` · ${f.originDetail}` : ''}</span>
              {f.receivedAt && <span className="meta-date">{fmt.date(f.receivedAt, year)}</span>}
              {scope === null && <ProjectChip project={projects.get(f.projectId)} />}
              <ConfidenceTag confidence={f.confidence} compact />
            </div>
            {f.linkedItemIds.length > 0 && (
              <div className="linked">
                <span className="muted small">Lo resuelve:</span>
                {f.linkedItemIds.map((id) => {
                  const it = items.get(id)
                  return it ? (
                    <button key={id} type="button" className="chip-btn" onClick={() => openItem(id)}>
                      {it.title} <StatusPill status={it.status} />
                    </button>
                  ) : null
                })}
              </div>
            )}
          </div>
          <div className="item-side">
            <PriorityTag priority={f.impact} hideMedium />
            <select
              value={f.status}
              aria-label={`Estado de «${f.title}»`}
              onChange={(e) => store.patch('feedback', f.id, { status: e.target.value as FeedbackStatus })}
            >
              {Object.entries(FEEDBACK_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <div className={embedded ? undefined : 'page'}>
      <Header embedded={embedded} title="Feedback" subtitle="Lo que dicen jugadores, ferias y pruebas, y qué mejoras priorizar" onNew={() => create('feedback')} newLabel="Nuevo feedback" />
      <Card title="Por priorizar" icon="message" subtitle="Abierto, de más a menos impacto">
        {open.length ? <List list={open} /> : <Empty icon="message">Nada abierto. Apunta aquí lo que te digan en ferias, Discord o pruebas.</Empty>}
      </Card>
      <Card title="Atendido" icon="check" subtitle="Resuelto o descartado">
        {closed.length ? <List list={closed} /> : <Empty>Nada todavía.</Empty>}
      </Card>
      <p className="muted small">
        Estados: {Object.values(FEEDBACK_STATUSES).map((s) => s.label).join(' → ')}. <FeedbackStatusPill status="new" /> es lo que aún no se ha mirado.
      </p>
    </div>
  )
}

// ——— Decisiones ————————————————————————————————————————————————————————————

export function DecisionsPage({ embedded }: PageProps) {
  const data = useStudioData()
  const year = useYear()
  const fmt = useFormat()
  const { scope } = useScope()
  const { create, openItem } = useUI()
  const { open, taken } = decisions(data, scope)
  const parked = pausedItems(data, scope)
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  return (
    <div className={embedded ? undefined : 'page'}>
      <Header
        embedded={embedded}
        title="Decisiones"
        subtitle="Lo decidido, lo que queda por decidir y lo que se aparcó"
        onNew={() => create('items', { kind: 'decision', status: 'to_confirm' })}
        newLabel="Nueva decisión"
      />
      <div className="grid grid-2-1">
        <Card title="Registro de decisiones" icon="scale" subtitle="De la más reciente a la más antigua">
          {taken.length === 0 ? (
            <Empty>Sin decisiones registradas.</Empty>
          ) : (
            <ol className="timeline">
              {taken.map((d) => (
                <li key={d.id}>
                  <span className="timeline-date">{fmt.date(itemDate(d), year)}</span>
                  <div>
                    <button type="button" className="item-title" onClick={() => openItem(d.id)}>
                      {d.title}
                    </button>
                    {d.decisionOutcome && <p className="item-detail">{d.decisionOutcome}</p>}
                    <div className="item-meta">
                      {scope === null && <ProjectChip project={projects.get(d.projectId)} />}
                      <ConfidenceTag confidence={d.confidence} compact />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <div className="stack">
          <Card title="Por decidir" icon="question">
            <ItemList items={open} data={data} showProject={scope === null} detail="decision" year={year} empty="Nada pendiente de decidir." />
          </Card>
          <Card title="Aparcado por una decisión" icon="pause" subtitle="Hecho o empezado y apagado a propósito">
            <ItemList items={parked} data={data} showProject={scope === null} detail="blocked" year={year} empty="Nada aparcado." />
          </Card>
        </div>
      </div>
    </div>
  )
}

// ——— Recursos ——————————————————————————————————————————————————————————————

export function ResourcesPage({ embedded }: PageProps) {
  const data = useStudioData()
  const { scope } = useScope()
  const { create, edit } = useUI()
  const resources = ofScope(data.resources, scope)
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  const types = Object.keys(RESOURCE_TYPES).filter((t) => resources.some((r) => r.type === t)) as (keyof typeof RESOURCE_TYPES)[]
  return (
    <div className={embedded ? undefined : 'page'}>
      <Header embedded={embedded} title="Documentos y recursos" subtitle="Documentación, guías, herramientas y enlaces que hay que tener a mano" onNew={() => create('resources')} newLabel="Nuevo recurso" />
      {resources.length === 0 && (
        <Card>
          <Empty icon="book">Sin recursos todavía.</Empty>
        </Card>
      )}
      <div className="grid grid-2">
        {types.map((t) => (
          <Card key={t} title={RESOURCE_TYPES[t]} icon="book">
            <ul className="resource-list">
              {resources
                .filter((r) => r.type === t)
                .map((r) => {
                  const project = projects.get(r.projectId ?? '')
                  const url = r.url ?? (r.path && project?.repoUrl ? `${project.repoUrl}/blob/main/${r.path}` : undefined)
                  return (
                    <li key={r.id}>
                      <div className="resource-head">
                        {url ? <ExternalLink href={url}>{r.title}</ExternalLink> : <strong>{r.title}</strong>}
                        <button type="button" className="icon-btn small" aria-label={`Editar ${r.title}`} onClick={() => edit({ collection: 'resources', id: r.id })}>
                          <Icon name="edit" size={14} />
                        </button>
                      </div>
                      {r.description && <p className="item-detail">{r.description}</p>}
                      <div className="item-meta">
                        {r.path && <code>{r.path}</code>}
                        {scope === null && <ProjectChip project={project} />}
                      </div>
                    </li>
                  )
                })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}

/** Enlace a la ficha de un proyecto, para las vistas de estudio. */
export function ProjectLink({ project }: { project: Project }) {
  return <Link to={`/proyectos/${project.slug}`}>{project.name}</Link>
}
