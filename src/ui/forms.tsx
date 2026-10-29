// Formularios de edición: los campos de cada colección se describen en specs.ts y un único
// componente los pinta, los valida y los convierte antes de guardar.
import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { todayISO } from '../domain/dates'
import type { StudioData } from '../domain/types'
import { parseAmount } from '../i18n/format'
import { Field } from './components/Common'
import { Icon } from './components/Icon'
import { t, type MessageKey } from '../i18n'
import type { Draft, FieldSpec } from './specs'

export { SPECS, type Draft, type FieldSpec, type ListField, type Option } from './specs'

type Row = Record<string, string>

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

/** Céntimos → texto editable («12,50», «120»). */
export function centsToText(cents: unknown): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return ''
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  return `${cents < 0 ? '-' : ''}${whole}${frac ? `,${String(frac).padStart(2, '0')}` : ''}`
}

/** El borrador tal y como lo edita el formulario: etiquetas, números e importes como texto. */
export function toEditable(spec: FieldSpec[], entity: Draft): Draft {
  const out: Draft = { ...entity }
  for (const f of spec) {
    const v = entity[f.key]
    if (f.type === 'tags') out[f.key] = Array.isArray(v) ? v.join(', ') : String(v ?? '')
    else if (f.type === 'money') out[f.key] = centsToText(v)
    else if (f.type === 'number') out[f.key] = typeof v === 'number' ? String(v) : String(v ?? '')
    else if (f.type === 'list') out[f.key] = Array.isArray(v) ? (v as Draft[]).map((r) => ({ ...r })) : []
    else if (f.type === 'yesno') out[f.key] = v === true ? 'true' : v === false ? 'false' : ''
  }
  return out
}

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
const rowIsEmpty = (row: Row) => Object.values(row).every((v) => !String(v ?? '').trim())

/** Quita los textos vacíos y convierte etiquetas, números, importes y listas antes de guardar. */
export function normalizeDraft(spec: FieldSpec[], draft: Draft): Draft {
  const out: Draft = { ...draft }
  for (const f of spec) {
    const v = out[f.key]
    if (f.type === 'tags') {
      const list = Array.isArray(v) ? v : String(v ?? '').split(',')
      out[f.key] = list.map((s) => String(s).trim()).filter(Boolean)
    } else if (f.type === 'checkbox') {
      out[f.key] = !!v
    } else if (f.type === 'yesno') {
      // Sin decidir no es «no»: la clave se queda sin valor.
      if (v === true || v === 'true') out[f.key] = true
      else if (v === false || v === 'false') out[f.key] = false
      else delete out[f.key]
    } else if (f.type === 'multi') {
      out[f.key] = Array.isArray(v) ? v : []
    } else if (f.type === 'money') {
      const cents = typeof v === 'number' ? v : parseAmount(String(v ?? ''))
      if (cents === null || isEmpty(v)) delete out[f.key]
      else out[f.key] = cents
    } else if (f.type === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(',', '.'))
      if (isEmpty(v) || !Number.isFinite(n)) delete out[f.key]
      else out[f.key] = n
    } else if (f.type === 'list') {
      const rows = Array.isArray(v) ? (v as Row[]) : []
      out[f.key] = rows
        .filter((r) => !rowIsEmpty(r))
        .map((r) => {
          const clean: Record<string, string> = {}
          for (const [k, x] of Object.entries(r)) {
            const s = String(x ?? '').trim()
            if (s) clean[k] = s
          }
          return clean
        })
    } else if (typeof v === 'string') {
      const s = v.trim()
      if (s) out[f.key] = s
      else delete out[f.key]
    }
  }
  // Un desplegable vaciado deja la clave sin valor: fuera.
  for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key]
  return out
}

/** Pares de fechas que no pueden ir al revés: [inicio, fin, mensaje]. */
const DATE_PAIRS: [string, string, MessageKey][] = [
  ['date', 'endDate', 'errors.endBeforeStart'],
  ['startDate', 'endDate', 'errors.endBeforeStart'],
  ['from', 'to', 'errors.endBeforeStart'],
  ['startedAt', 'completedAt', 'errors.doneBeforeStart'],
]

const validUrl = (text: string) => {
  try {
    const u = new URL(text.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** El problema de un campo, o nada. */
function fieldError(f: FieldSpec, v: unknown): string | undefined {
  const empty = isEmpty(v)
  if (f.required && empty) return t('errors.required')
  if (empty) return undefined
  switch (f.type) {
    case 'url':
      return validUrl(String(v)) ? undefined : t('errors.url')
    case 'time':
      return CLOCK.test(String(v).trim()) ? undefined : t('errors.time')
    case 'money': {
      const cents = typeof v === 'number' ? v : parseAmount(String(v))
      return cents === null || cents < 0 ? t('errors.amount') : undefined
    }
    case 'number': {
      const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
      if (!Number.isFinite(n)) return t('errors.number')
      if (f.integer && !Number.isInteger(n)) return t('errors.integer')
      if (f.min !== undefined && n < f.min) return t('errors.min', { min: f.min })
      if (f.max !== undefined && n > f.max) return t('errors.max', { max: f.max })
      return undefined
    }
    case 'list': {
      const rows = (Array.isArray(v) ? (v as Row[]) : []).filter((r) => !rowIsEmpty(r))
      for (const [i, row] of rows.entries())
        for (const sf of f.fields ?? []) {
          const x = String(row[sf.key] ?? '').trim()
          if (sf.required && !x) return t('errors.listRow', { n: i + 1, problem: t('errors.listMissing', { field: sf.label }) })
          if (sf.type === 'url' && x && !validUrl(x)) return t('errors.listRow', { n: i + 1, problem: t('errors.listUrl', { field: sf.label }) })
        }
      if (f.required && !rows.length) return t('errors.required')
      return undefined
    }
    default:
      return undefined
  }
}

/** Problemas de un borrador, por campo (vacío si se puede guardar). */
export function validateDraft(spec: FieldSpec[], draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {}
  const visible = spec.filter((f) => !f.show || f.show(draft))
  for (const f of visible) {
    const e = fieldError(f, draft[f.key])
    if (e) errors[f.key] = e
  }
  const keys = new Set(visible.map((f) => f.key))
  for (const [a, b, msg] of DATE_PAIRS) {
    const from = draft[a]
    const to = draft[b]
    if (keys.has(a) && keys.has(b) && !errors[b] && typeof from === 'string' && typeof to === 'string' && from && to && to < from) errors[b] = t(msg)
  }
  // La hora de fin, si es el mismo día.
  const { time, endTime, date, endDate } = draft
  if (keys.has('endTime') && !errors.endTime && typeof time === 'string' && typeof endTime === 'string' && time && endTime && (!endDate || endDate === date) && endTime < time)
    errors.endTime = t('errors.endTimeBeforeStart')
  return errors
}

/**
 * Al cambiar de proyecto, lo que apuntaba a cosas del proyecto anterior (builds, eventos,
 * versiones…) se vacía si ya no se puede elegir.
 */
export function dropForeign(spec: FieldSpec[], draft: Draft, data: StudioData): Draft {
  const next = { ...draft }
  for (const f of spec) {
    if (!f.sameProject || !f.options || isEmpty(next[f.key])) continue
    const allowed = new Set(f.options(data, next).map((o) => o.value))
    const v = next[f.key]
    if (Array.isArray(v)) next[f.key] = v.filter((x) => allowed.has(String(x)))
    else if (!allowed.has(String(v))) delete next[f.key]
  }
  return next
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
  const [draft, setDraft] = useState<Draft>(() => toEditable(spec, initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tried, setTried] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const currency = data.studio.currency ?? 'EUR'
  const set = (key: string, value: unknown) =>
    setDraft((d) => {
      let next: Draft = { ...d, [key]: value }
      // Al dar algo por hecho se apunta el día; al reabrirlo se quita.
      if (key === 'status' && value === 'done' && !d.completedAt) next.completedAt = todayISO()
      if (key === 'status' && value !== 'done' && value !== 'cancelled') delete next.completedAt
      if (key === 'projectId') next = dropForeign(spec, next, data)
      if (tried) setErrors(validateDraft(spec, next))
      return next
    })
  const visible = useMemo(() => spec.filter((f) => !f.show || f.show(draft)), [spec, draft])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const found = validateDraft(spec, draft)
    setErrors(found)
    setTried(true)
    if (Object.keys(found).length) {
      // Lleva el foco al primer campo con problemas.
      const first = spec.find((f) => found[f.key])
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first.key}"]`)?.focus()
      return
    }
    onSubmit(normalizeDraft(spec, draft))
  }

  const errorCount = Object.keys(errors).length

  return (
    <form id={formId} ref={formRef} className="form-grid" onSubmit={submit} noValidate>
      {errorCount > 0 && (
        <div className="span-2 error-summary" role="alert">
          <Icon name="alert" size={16} /> {t('errors.formSummary', { n: errorCount })}
        </div>
      )}
      {visible.map((f) => {
        const value = draft[f.key]
        const fieldId = `${formId}-${f.key}`
        const error = errors[f.key]
        const common = {
          id: fieldId,
          name: f.key,
          required: f.required,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${fieldId}-error` : undefined,
        }
        const text = (type: string, extra: Record<string, unknown> = {}) => (
          <input type={type} {...common} {...extra} value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value)} />
        )
        let control
        switch (f.type) {
          case 'textarea':
            control = <textarea {...common} rows={3} value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value)} />
            break
          case 'select':
          case 'yesno':
            control = (
              <select {...common} value={String(value ?? '')} onChange={(e) => set(f.key, e.target.value || undefined)}>
                {(f.empty !== undefined || !value) && <option value="">{f.empty ?? t('forms.choose')}</option>}
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
            control = text('date')
            break
          case 'time':
            control = text('time')
            break
          case 'number':
            control = text('number', { inputMode: f.integer ? 'numeric' : 'decimal', min: f.min, max: f.max, step: f.integer ? 1 : 'any' })
            break
          case 'money':
            control = text('text', { inputMode: 'decimal', autoComplete: 'off', placeholder: '0,00' })
            break
          case 'color':
            control = <input type="color" {...common} value={String(value ?? '#7c6cf0')} onChange={(e) => set(f.key, e.target.value)} />
            break
          case 'url':
            control = text('url', { placeholder: 'https://…' })
            break
          case 'list':
            return (
              <div key={f.key} className="span-2">
                <ListEditor spec={f} rows={(value as Row[]) ?? []} onChange={(rows) => set(f.key, rows)} error={error} fieldId={fieldId} />
              </div>
            )
          default:
            control = text('text')
        }
        const labelText = (f.type === 'money' ? `${f.label} (${currency})` : f.label) + (f.required ? ' *' : '')
        return (
          <div key={f.key} className={f.wide ? 'span-2' : undefined}>
            {f.type === 'checkbox' ? (
              <label className="check-field">
                {control} {f.label}
              </label>
            ) : (
              <Field label={labelText} hint={f.hint} error={error} id={fieldId}>
                {control}
              </Field>
            )}
          </div>
        )
      })}
    </form>
  )
}

/** Filas con varias columnas (versiones, enlaces…): se añaden y se quitan. */
function ListEditor({ spec, rows, onChange, error, fieldId }: { spec: FieldSpec; rows: Row[]; onChange: (rows: Row[]) => void; error?: string; fieldId: string }) {
  const fields = spec.fields ?? []
  const edit = (i: number, key: string, value: string) => onChange(rows.map((r, k) => (k === i ? { ...r, [key]: value } : r)))
  return (
    <fieldset className="list-field" aria-describedby={error ? `${fieldId}-error` : undefined}>
      <legend className="field-label">{spec.label + (spec.required ? ' *' : '')}</legend>
      {rows.length === 0 && <p className="muted small">{t('forms.emptyList')}</p>}
      {rows.map((row, i) => (
        <div key={i} className="list-row" style={{ '--cols': fields.length } as CSSProperties}>
          {fields.map((sf, k) => (
            <input
              key={sf.key}
              type={sf.type}
              name={i === 0 && k === 0 ? spec.key : undefined}
              aria-label={t('forms.rowField', { field: sf.label, n: i + 1 })}
              placeholder={sf.label + (sf.required ? ' *' : '')}
              value={row[sf.key] ?? ''}
              onChange={(e) => edit(i, sf.key, e.target.value)}
            />
          ))}
          <button type="button" className="icon-btn small" aria-label={t('forms.removeRow', { n: i + 1 })} onClick={() => onChange(rows.filter((_, k) => k !== i))}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" name={rows.length ? undefined : spec.key} className="btn btn-small btn-ghost" onClick={() => onChange([...rows, {}])}>
          <Icon name="plus" size={14} /> {t('forms.addRow')}
        </button>
      </div>
      {error && (
        <span className="field-error" id={`${fieldId}-error`}>
          <Icon name="alert" size={12} /> {error}
        </span>
      )}
    </fieldset>
  )
}
