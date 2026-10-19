import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CONFIDENCES, SOURCE_TYPES } from '../domain/catalog'
import { todayISO } from '../domain/dates'
import { referencesTo, removeWithReferences, type Reference } from '../domain/references'
import type { Confidence, Member, SourceRef } from '../domain/types'
import { validateEntity } from '../domain/validate'
import { t, tr } from '../i18n'
import { store, useCanEdit, useStudioData, type CollectionKey } from '../data/store'
import { ExternalLink, Modal } from './components/Common'
import { Icon } from './components/Icon'
import { buildEntity, newDefaults, useScope, type EditorRequest } from './context'
import { EntityForm, SPECS } from './forms'
import { useNotify, useUndoable } from './feedback'
import { useFormat } from './hooks'
import { sourceHref } from './util'

type Row = Record<string, unknown>

/** El nombre con el que se reconoce un elemento (título, nombre o concepto). */
export function displayName(entity: Row | undefined): string {
  if (!entity) return ''
  return String(entity.title ?? entity.name ?? entity.description ?? entity.label ?? '')
}

/** «3 elementos», «1 build». */
export function countOf(k: CollectionKey, n: number): string {
  return `${n} ${tr(`collectionNames.${k}.${n === 1 ? 'one' : 'other'}`)}`
}

const joinList = (parts: string[]) => new Intl.ListFormat('es', { type: 'conjunction' }).format(parts)

/** Suma por colección (un evento puede estar citado desde varios campos de la misma). */
function tally(refs: Pick<Reference, 'from' | 'count'>[]): string {
  const sum = new Map<CollectionKey, number>()
  for (const r of refs) sum.set(r.from, (sum.get(r.from) ?? 0) + r.count)
  return joinList([...sum].map(([k, n]) => countOf(k, n)))
}

/** Qué pasará al borrar: lo que se va con él, lo que deja de apuntarle y lo que se queda sin proyecto. */
function deletionSummary(data: Parameters<typeof referencesTo>[0], k: CollectionKey, id: string): ReactNode[] {
  const refs = referencesTo(data, k, id)
  const lines: ReactNode[] = []
  const deleted = removeWithReferences(data, k, id).deleted.filter((x) => x !== `${k}:${id}`)
  if (deleted.length) {
    const byCollection = deleted.map((x) => ({ from: x.slice(0, x.indexOf(':')) as CollectionKey, count: 1 }))
    lines.push(t('editor.alsoDeleted', { list: tally(byCollection) }))
  }
  const kept = refs.filter((r) => r.field === 'projectId' && r.onDelete === 'unset')
  if (kept.length) lines.push(t('editor.keptWithoutProject', { list: tally(kept) }))
  const unlinked = refs.filter((r) => r.field !== 'projectId' && (r.onDelete === 'unset' || r.onDelete === 'pull'))
  if (unlinked.length) lines.push(t('editor.unlinked', { list: tally(unlinked) }))
  lines.push(t('editor.undoHint'))
  return lines
}

export function EditorModal({ request, onClose }: { request: EditorRequest; onClose: () => void }) {
  const data = useStudioData()
  const { scope } = useScope()
  const navigate = useNavigate()
  const { toast, confirm } = useNotify()
  const undoable = useUndoable()
  const canEdit = useCanEdit()
  const k = request.collection
  const spec = SPECS[k] ?? []
  const existing = request.id ? (data[k] as unknown as Row[]).find((x) => x.id === request.id) : undefined
  const initial = useMemo(
    () => (existing ? { ...existing } : { ...newDefaults(k, data, scope), ...request.defaults }),
    // Solo al abrir: si los datos cambian mientras se edita, el borrador manda.
    [request],
  ) as Row
  const [sources, setSources] = useState<SourceRef[]>(() => (initial.sources as SourceRef[]) ?? [])
  const [problems, setProblems] = useState<string[]>([])
  const formId = `form-${k}`
  const name = displayName(existing)
  const title = existing ? (name ? `${tr(`editor.titles.${k}.edit`)}: ${name}` : tr(`editor.titles.${k}.edit`)) : tr(`editor.titles.${k}.new`)

  if (request.id && !existing) {
    return (
      <Modal open title={t('editor.notFound')} onClose={onClose}>
        <p>{t('editor.notFoundBody')}</p>
      </Modal>
    )
  }

  const project = data.projects.find((p) => p.id === (initial.projectId as string))

  const submit = (draft: Row) => {
    const entity = buildEntity(k, 'sources' in initial ? { ...draft, sources } : draft, data)
    // Las mismas reglas que al cargar los datos: lo que no pasa, no se guarda.
    const found = validateEntity(k, entity, data)
    setProblems(found)
    if (found.length) return
    store.upsert(k, entity as never)
    onClose()
    toast(existing ? t('feedbackMsg.saved') : t('feedbackMsg.created'))
    if (k === 'projects' && !existing) navigate(`/proyectos/${String(entity.slug)}`)
  }

  const remove = async () => {
    if (!existing) return
    const id = String(existing.id)
    const blocked = referencesTo(data, k, id).filter((r) => r.onDelete === 'block')
    if (blocked.length) {
      // A una persona con trabajo no se la borra: se marca que ya no sigue.
      if (k === 'members' && (existing as unknown as Member).active) {
        const ok = await confirm({ title: t('editor.blockedTitle', { name }), message: t('editor.blockedMember', { list: tally(blocked) }), confirmLabel: t('editor.deactivate') })
        if (!ok) return
        onClose()
        undoable(t('editor.deactivated'), () => store.upsert('members', { ...(existing as unknown as Member), active: false }))
      } else toast({ message: t('editor.blocked', { list: tally(blocked) }), tone: 'warning' })
      return
    }
    const isProject = k === 'projects'
    const ok = await confirm({
      title: isProject ? t('editor.deleteProjectTitle', { name }) : t('editor.deleteTitle', { name }),
      message: (
        <>
          {deletionSummary(data, k, id).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </>
      ),
      confirmLabel: t('actions.delete'),
      danger: true,
    })
    if (!ok) return
    onClose()
    // Primero se sale de la ficha del proyecto (a la lista); luego se borra (con «Deshacer»).
    if (isProject) navigate('/proyectos')
    undoable(t('feedbackMsg.deleted'), () => store.remove(k, id))
  }

  return (
    <Modal
      open
      side
      wide
      title={title}
      onClose={onClose}
      footer={
        !canEdit ? (
          <>
            <span className="muted small">{t('feedbackMsg.readOnly')}</span>
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              {t('actions.close')}
            </button>
          </>
        ) : (
          <>
            {existing && (
              <button type="button" className="btn btn-danger-ghost" onClick={remove}>
                <Icon name="trash" size={16} /> {t('actions.delete')}
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              {t('actions.cancel')}
            </button>
            <button type="submit" form={formId} className="btn btn-primary">
              {t('actions.save')}
            </button>
          </>
        )
      }
    >
      {existing && typeof existing.confidence === 'string' && <ConfidenceFacts confidence={existing.confidence as Confidence} />}
      {problems.length > 0 && (
        <div className="error-summary" role="alert">
          <Icon name="alert" size={16} /> {t('errors.saveRefused')}
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <fieldset className="readonly-fieldset" disabled={!canEdit}>
        <EntityForm spec={spec} initial={initial} data={data} onSubmit={submit} formId={formId} />
        {'sources' in initial && <SourcesEditor sources={sources} onChange={setSources} projectRepo={project} />}
      </fieldset>
    </Modal>
  )
}

function ConfidenceFacts({ confidence }: { confidence: Confidence }) {
  const c = CONFIDENCES[confidence]
  if (!c) return null
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
  const fmt = useFormat()
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
              {s.date && <span className="muted">{fmt.date(s.date)}</span>}
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
