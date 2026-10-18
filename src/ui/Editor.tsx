import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CONFIDENCES, SOURCE_TYPES } from '../domain/catalog'
import { formatDate, todayISO } from '../domain/dates'
import type { SourceRef, WorkItem } from '../domain/types'
import { store, useStudioData, type CollectionKey } from '../data/store'
import { ExternalLink, Modal } from './components/Common'
import { Icon } from './components/Icon'
import { newDefaults, saveDraft, useScope, type EditorRequest } from './context'
import { EntityForm, SPECS } from './forms'
import { sourceHref } from './util'

const TITLES: Partial<Record<CollectionKey, [string, string]>> = {
  items: ['Nuevo elemento', 'Elemento'],
  builds: ['Nueva build', 'Build'],
  events: ['Nuevo evento o fecha', 'Evento'],
  feedback: ['Nuevo feedback', 'Feedback'],
  resources: ['Nuevo recurso', 'Recurso'],
  checklists: ['Nueva lista', 'Lista'],
  projects: ['Nuevo proyecto', 'Proyecto'],
}

export function EditorModal({ request, onClose }: { request: EditorRequest; onClose: () => void }) {
  const data = useStudioData()
  const { scope } = useScope()
  const navigate = useNavigate()
  const spec = SPECS[request.collection] ?? []
  const existing = request.id ? (data[request.collection] as { id: string }[]).find((x) => x.id === request.id) : undefined
  const initial = useMemo(
    () => (existing ? { ...existing } : { ...newDefaults(request.collection, data, scope), ...request.defaults }),
    // Solo al abrir: si los datos cambian mientras se edita, el borrador manda.
    [request],
  ) as Record<string, unknown>
  const [sources, setSources] = useState<SourceRef[]>(() => (initial.sources as SourceRef[]) ?? [])
  const formId = `form-${request.collection}`
  const [title, editTitle] = TITLES[request.collection] ?? ['Nuevo', 'Editar']

  if (request.id && !existing) {
    return (
      <Modal open title="No encontrado" onClose={onClose}>
        <p>Este elemento ya no existe.</p>
      </Modal>
    )
  }

  const project = data.projects.find((p) => p.id === (initial.projectId as string))

  const submit = (draft: Record<string, unknown>) => {
    const withSources = 'sources' in initial ? { ...draft, sources } : draft
    const id = saveDraft(request.collection, withSources, data)
    onClose()
    if (request.collection === 'projects' && !existing) navigate(`/proyectos/${id}`)
  }

  const remove = () => {
    if (!existing) return
    const what = request.collection === 'projects' ? 'este proyecto y todo lo suyo' : 'este elemento'
    if (window.confirm(`¿Borrar ${what}? No se puede deshacer (salvo importando una copia).`)) {
      store.remove(request.collection, existing.id)
      onClose()
      if (request.collection === 'projects') navigate('/')
    }
  }

  return (
    <Modal
      open
      side
      wide
      title={existing ? `${editTitle}: ${String((existing as Record<string, unknown>).title ?? (existing as Record<string, unknown>).name ?? '')}` : title}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <button type="button" className="btn btn-danger-ghost" onClick={remove}>
              <Icon name="trash" size={16} /> Borrar
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn btn-primary">
            Guardar
          </button>
        </>
      }
    >
      {request.collection === 'items' && existing && <ItemFacts item={existing as WorkItem} />}
      <EntityForm spec={spec} initial={initial} data={data} onSubmit={submit} formId={formId} />
      {'sources' in initial && <SourcesEditor sources={sources} onChange={setSources} projectRepo={project} />}
    </Modal>
  )
}

function ItemFacts({ item }: { item: WorkItem }) {
  const c = CONFIDENCES[item.confidence]
  return (
    <div className={`facts tone-soft-${c.tone}`}>
      <strong>{c.label}.</strong> {c.hint}
    </div>
  )
}

function SourcesEditor({
  sources,
  onChange,
  projectRepo,
}: {
  sources: SourceRef[]
  onChange: (s: SourceRef[]) => void
  projectRepo?: Parameters<typeof sourceHref>[1]
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<SourceRef>({ type: 'manual', ref: '', date: todayISO() })
  return (
    <section className="sources">
      <h3>Fuentes</h3>
      {sources.length === 0 && <p className="muted">Sin fuentes.</p>}
      <ul>
        {sources.map((s, k) => {
          const href = sourceHref(s, projectRepo)
          return (
            <li key={`${s.type}-${s.ref}-${k}`}>
              <span className="source-type">{SOURCE_TYPES[s.type]}</span>
              {href ? <ExternalLink href={href}>{s.ref}</ExternalLink> : <span>{s.ref}</span>}
              {s.date && <span className="muted">{formatDate(s.date)}</span>}
              {s.note && <span className="muted">· {s.note}</span>}
              <button type="button" className="icon-btn small" aria-label="Quitar fuente" onClick={() => onChange(sources.filter((_, i) => i !== k))}>
                <Icon name="close" size={14} />
              </button>
            </li>
          )
        })}
      </ul>
      {adding ? (
        <div className="source-add">
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as SourceRef['type'] })} aria-label="Tipo de fuente">
            {Object.entries(SOURCE_TYPES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input placeholder="Hash, #PR, documento o nota" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} aria-label="Referencia" />
          <input type="url" placeholder="Enlace (opcional)" value={draft.url ?? ''} onChange={(e) => setDraft({ ...draft, url: e.target.value || undefined })} aria-label="Enlace" />
          <button
            type="button"
            className="btn btn-small"
            disabled={!draft.ref.trim()}
            onClick={() => {
              onChange([...sources, { ...draft, ref: draft.ref.trim() }])
              setDraft({ type: 'manual', ref: '', date: todayISO() })
              setAdding(false)
            }}
          >
            Añadir
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} /> Añadir fuente
        </button>
      )}
    </section>
  )
}
