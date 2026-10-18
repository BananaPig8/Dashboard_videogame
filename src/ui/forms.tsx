// Formularios de edición, descritos como datos: cada tipo de elemento tiene su lista de
// campos y un único componente los pinta. Añadir un campo es añadir una línea.
import { useMemo, useState, type FormEvent } from 'react'
import {
  BUILD_CHANNELS,
  BUILD_STATUSES,
  CHECKLIST_TARGETS,
  CONFIDENCES,
  EVENT_STATUSES,
  EVENT_TYPES,
  FEEDBACK_ORIGINS,
  FEEDBACK_STATUSES,
  KINDS,
  PRIORITIES,
  RESOURCE_TYPES,
  STAGES,
  STATUSES,
  STATUS_ORDER,
  label,
} from '../domain/catalog'
import { todayISO } from '../domain/dates'
import type { StudioData } from '../domain/types'
import type { CollectionKey } from '../data/store'
import { Field } from './components/Common'

type Draft = Record<string, unknown>

export interface FieldSpec {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'checkbox' | 'tags' | 'url' | 'color' | 'multi'
  required?: boolean
  hint?: string
  /** Opciones de los desplegables; se calculan con los datos (proyectos, áreas…). */
  options?: (data: StudioData, draft: Draft) => { value: string; label: string }[]
  /** Opción vacía del desplegable (si el campo es opcional). */
  empty?: string
  show?: (draft: Draft) => boolean
  wide?: boolean
}

const fromTable = (table: Record<string, unknown>, order?: string[]) => () =>
  (order ?? Object.keys(table)).map((value) => ({ value, label: label(table as Record<string, string>, value) }))

const projectOptions = (data: StudioData) => data.projects.map((p) => ({ value: p.id, label: p.name }))
const areaOptions = (data: StudioData) => data.areas.map((a) => ({ value: a.id, label: a.name }))

export const SPECS: Partial<Record<CollectionKey, FieldSpec[]>> = {
  items: [
    { key: 'title', label: 'Título', type: 'text', required: true, wide: true },
    { key: 'projectId', label: 'Proyecto', type: 'select', required: true, options: projectOptions },
    { key: 'kind', label: 'Tipo', type: 'select', required: true, options: fromTable(KINDS) },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(STATUSES, STATUS_ORDER) },
    { key: 'priority', label: 'Prioridad', type: 'select', required: true, options: fromTable(PRIORITIES, ['critical', 'high', 'medium', 'low']) },
    { key: 'areaId', label: 'Área', type: 'select', empty: 'Sin área', options: areaOptions },
    { key: 'confidence', label: 'Fiabilidad del dato', type: 'select', required: true, options: fromTable(CONFIDENCES) },
    { key: 'description', label: 'Descripción', type: 'textarea', wide: true },
    {
      key: 'blockedReason',
      label: 'Qué lo bloquea o qué falta para retomarlo',
      type: 'textarea',
      wide: true,
      show: (d) => ['blocked', 'paused', 'to_confirm', 'review'].includes(String(d.status)) || !!d.blockedReason,
    },
    {
      key: 'decisionOutcome',
      label: 'Lo decidido (o las opciones, si sigue abierta)',
      type: 'textarea',
      wide: true,
      show: (d) => d.kind === 'decision' || !!d.decisionOutcome,
    },
    { key: 'dueDate', label: 'Fecha límite', type: 'date' },
    { key: 'focusDate', label: 'Para hacer el día', type: 'date', hint: 'Lo que tenga la fecha de hoy sale en «Hoy».' },
    { key: 'startedAt', label: 'Empezado', type: 'date' },
    { key: 'completedAt', label: 'Terminado', type: 'date', show: (d) => d.status === 'done' || d.status === 'cancelled' || !!d.completedAt },
    { key: 'tags', label: 'Etiquetas', type: 'tags', hint: 'Separadas por comas.', wide: true },
  ],
  builds: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true },
    { key: 'projectId', label: 'Proyecto', type: 'select', required: true, options: projectOptions },
    { key: 'version', label: 'Versión', type: 'text', required: true },
    { key: 'channel', label: 'Canal', type: 'select', required: true, options: fromTable(BUILD_CHANNELS) },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(BUILD_STATUSES) },
    { key: 'date', label: 'Fecha', type: 'date' },
    { key: 'platforms', label: 'Plataformas', type: 'tags', hint: 'Windows, Linux, macOS…' },
    { key: 'distribution', label: 'Dónde está', type: 'text', hint: 'GitHub Releases, Steam (rama beta), itch.io…' },
    { key: 'url', label: 'Enlace', type: 'url', wide: true },
    { key: 'confidence', label: 'Fiabilidad del dato', type: 'select', required: true, options: fromTable(CONFIDENCES) },
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
  ],
  events: [
    { key: 'title', label: 'Nombre', type: 'text', required: true, wide: true },
    { key: 'projectId', label: 'Proyecto', type: 'select', empty: 'Todo el estudio', options: projectOptions },
    { key: 'type', label: 'Tipo', type: 'select', required: true, options: fromTable(EVENT_TYPES) },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(EVENT_STATUSES) },
    { key: 'date', label: 'Fecha', type: 'date' },
    { key: 'endDate', label: 'Hasta', type: 'date' },
    { key: 'dateConfirmed', label: 'Fecha confirmada', type: 'checkbox' },
    { key: 'location', label: 'Lugar', type: 'text' },
    { key: 'confidence', label: 'Fiabilidad del dato', type: 'select', required: true, options: fromTable(CONFIDENCES) },
    { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
  ],
  feedback: [
    { key: 'title', label: 'Qué se ha dicho', type: 'text', required: true, wide: true },
    { key: 'projectId', label: 'Proyecto', type: 'select', required: true, options: projectOptions },
    { key: 'origin', label: 'Origen', type: 'select', required: true, options: fromTable(FEEDBACK_ORIGINS) },
    { key: 'originDetail', label: 'Dónde o quién', type: 'text', hint: 'Feria, Discord, prueba con amigos…' },
    { key: 'receivedAt', label: 'Recibido', type: 'date' },
    { key: 'status', label: 'Estado', type: 'select', required: true, options: fromTable(FEEDBACK_STATUSES) },
    { key: 'impact', label: 'Impacto', type: 'select', required: true, options: fromTable(PRIORITIES, ['critical', 'high', 'medium', 'low']) },
    { key: 'confidence', label: 'Fiabilidad del dato', type: 'select', required: true, options: fromTable(CONFIDENCES) },
    { key: 'detail', label: 'Detalle', type: 'textarea', wide: true },
    {
      key: 'linkedItemIds',
      label: 'Elementos que lo resuelven',
      type: 'multi',
      wide: true,
      hint: 'Ctrl o Cmd + clic para elegir varios.',
      options: (data, d) =>
        data.items
          .filter((i) => i.projectId === d.projectId)
          .map((i) => ({ value: i.id, label: `${i.title} (${label(STATUSES, i.status)})` })),
    },
  ],
  resources: [
    { key: 'title', label: 'Título', type: 'text', required: true, wide: true },
    { key: 'projectId', label: 'Proyecto', type: 'select', empty: 'Todo el estudio', options: projectOptions },
    { key: 'type', label: 'Tipo', type: 'select', required: true, options: fromTable(RESOURCE_TYPES) },
    { key: 'url', label: 'Enlace', type: 'url', wide: true },
    { key: 'path', label: 'Ruta en el repositorio', type: 'text', wide: true },
    { key: 'description', label: 'Para qué sirve', type: 'textarea', wide: true },
    { key: 'tags', label: 'Etiquetas', type: 'tags', wide: true },
  ],
  checklists: [
    { key: 'title', label: 'Título', type: 'text', required: true, wide: true },
    { key: 'projectId', label: 'Proyecto', type: 'select', required: true, options: projectOptions },
    { key: 'target', label: 'Para', type: 'select', required: true, options: fromTable(CHECKLIST_TARGETS) },
    { key: 'description', label: 'Descripción', type: 'textarea', wide: true },
  ],
  projects: [
    { key: 'name', label: 'Nombre', type: 'text', required: true, wide: true },
    { key: 'stage', label: 'Etapa', type: 'select', required: true, options: fromTable(STAGES) },
    { key: 'color', label: 'Color', type: 'color' },
    { key: 'tagline', label: 'En una frase', type: 'text', wide: true },
    { key: 'description', label: 'Descripción', type: 'textarea', wide: true },
    { key: 'nextGoal', label: 'Objetivo inmediato', type: 'text', wide: true },
    { key: 'engine', label: 'Motor', type: 'text' },
    { key: 'engineVersion', label: 'Versión del motor', type: 'text' },
    { key: 'genre', label: 'Género', type: 'text' },
    { key: 'startedAt', label: 'Empezado', type: 'date' },
    { key: 'platforms', label: 'Plataformas', type: 'tags', wide: true },
    { key: 'repoUrl', label: 'Repositorio', type: 'url', wide: true },
    { key: 'tags', label: 'Etiquetas', type: 'tags', wide: true },
  ],
}

/** Quita los textos vacíos y convierte las etiquetas en listas antes de guardar. */
export function normalizeDraft(spec: FieldSpec[], draft: Draft): Draft {
  const out: Draft = { ...draft }
  for (const f of spec) {
    const v = out[f.key]
    if (f.type === 'tags') {
      const list = Array.isArray(v) ? v : String(v ?? '').split(',')
      out[f.key] = list.map((s) => String(s).trim()).filter(Boolean)
    } else if (f.type === 'checkbox') {
      out[f.key] = !!v
    } else if (f.type === 'multi') {
      out[f.key] = Array.isArray(v) ? v : []
    } else if (typeof v === 'string') {
      const t = v.trim()
      if (t) out[f.key] = t
      else delete out[f.key]
    }
  }
  return out
}

export function EntityForm({
  spec,
  initial,
  data,
  onSubmit,
  formId,
}: {
  spec: FieldSpec[]
  initial: Draft
  data: StudioData
  onSubmit: (draft: Draft) => void
  formId: string
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    ...initial,
    ...Object.fromEntries(spec.filter((f) => f.type === 'tags').map((f) => [f.key, ((initial[f.key] as string[]) ?? []).join(', ')])),
  }))
  const set = (key: string, value: unknown) =>
    setDraft((d) => {
      const next = { ...d, [key]: value }
      // Al dar algo por hecho se apunta el día; al reabrirlo se quita.
      if (key === 'status' && value === 'done' && !d.completedAt) next.completedAt = todayISO()
      if (key === 'status' && value !== 'done' && value !== 'cancelled') delete next.completedAt
      return next
    })
  const visible = useMemo(() => spec.filter((f) => !f.show || f.show(draft)), [spec, draft])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(normalizeDraft(spec, draft))
  }

  return (
    <form id={formId} className="form-grid" onSubmit={submit}>
      {visible.map((f) => {
        const value = draft[f.key]
        const common = { name: f.key, required: f.required }
        let control
        switch (f.type) {
          case 'textarea':
            control = <textarea {...common} rows={3} value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value)} />
            break
          case 'select':
            control = (
              <select {...common} value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value || undefined)}>
                {(f.empty !== undefined || !value) && <option value="">{f.empty ?? 'Elige…'}</option>}
                {f.options?.(data, draft).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )
            break
          case 'multi':
            control = (
              <select
                {...common}
                multiple
                size={6}
                value={(value as string[]) ?? []}
                onChange={(e) => set(f.key, [...e.target.selectedOptions].map((o) => o.value))}
              >
                {f.options?.(data, draft).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )
            break
          case 'checkbox':
            control = <input type="checkbox" {...common} checked={!!value} onChange={(e) => set(f.key, e.target.checked)} />
            break
          case 'date':
            control = <input type="date" {...common} value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value)} />
            break
          case 'color':
            control = <input type="color" {...common} value={String(value ?? '#4f46e5')} onChange={(e) => set(f.key, e.target.value)} />
            break
          case 'url':
            control = <input type="url" {...common} value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value)} placeholder="https://…" />
            break
          default:
            control = <input type="text" {...common} value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value)} />
        }
        return (
          <div key={f.key} className={f.wide ? 'span-2' : undefined}>
            {f.type === 'checkbox' ? (
              <label className="check-field">
                {control} {f.label}
              </label>
            ) : (
              <Field label={f.label + (f.required ? ' *' : '')} hint={f.hint}>
                {control}
              </Field>
            )}
          </div>
        )
      })}
    </form>
  )
}
