// Una lista de pasos (lanzamiento, Steam, feria…): marcar, añadir y quitar pasos. La usan
// Publicación, Eventos y el Panel.
import { useState } from 'react'
import { CHECKLIST_TARGETS } from '../../domain/catalog'
import type { Checklist, StudioData } from '../../domain/types'
import { newId, store, useCanEdit } from '../../data/store'
import { useUI } from '../context'
import { useNotify } from '../feedback'
import { sourceHref } from '../util'
import { ProjectChip } from './Badges'
import { Card, ExternalLink, Progress } from './Common'
import { Icon } from './Icon'

export function ChecklistCard({ checklist, data, showProject }: { checklist: Checklist; data: StudioData; showProject: boolean }) {
  const { edit } = useUI()
  const { confirm } = useNotify()
  const canEdit = useCanEdit()
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
          {canEdit && done > 0 && checklist.target === 'update' && (
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
          {canEdit && (
            <button type="button" className="icon-btn" aria-label="Editar lista" onClick={() => edit({ collection: 'checklists', id: checklist.id })}>
              <Icon name="edit" size={16} />
            </button>
          )}
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
              <input type="checkbox" checked={it.done} disabled={!canEdit} onChange={() => save(checklist.items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))} />
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
            {canEdit && (
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
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
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
      )}
    </Card>
  )
}
