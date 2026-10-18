import { useState } from 'react'
import { formatLongDate, parseISODate, todayISO } from '../../domain/dates'
import { blockedItems, byPriority, isActionable, itemsOf, todayItems, type TodayReason } from '../../domain/selectors'
import { store, useStudioData } from '../../data/store'
import { Pill } from '../components/Badges'
import { Card, PageHeader } from '../components/Common'
import { Icon } from '../components/Icon'
import { ItemList } from '../components/ItemList'
import { newDefaults, saveDraft, useScope } from '../context'
import { plural } from '../util'

const REASON: Record<TodayReason, { label: string; tone: 'danger' | 'warning' | 'info' | 'progress' | 'accent' }> = {
  overdue: { label: 'Vencida', tone: 'danger' },
  due: { label: 'Vence hoy', tone: 'warning' },
  focus: { label: 'Para hoy', tone: 'info' },
  in_progress: { label: 'En curso', tone: 'progress' },
  review: { label: 'En revisión', tone: 'accent' },
}

export function TodayPage() {
  const data = useStudioData()
  const { scope, project } = useScope()
  const today = todayISO()
  const year = parseISODate(today).getFullYear()
  const [title, setTitle] = useState('')
  const entries = todayItems(data, today, scope)
  const reasons = new Map(entries.map((e) => [e.item.id, e.reason]))
  const inToday = new Set(entries.map((e) => e.item.id))
  const candidates = itemsOf(data, scope)
    .filter((i) => isActionable(i) && !inToday.has(i.id))
    .sort(byPriority)
  const blocked = blockedItems(data, scope)

  const quickAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    saveDraft('items', { ...newDefaults('items', data, scope), title: t, status: 'planned', focusDate: today }, data)
    setTitle('')
  }

  return (
    <div className="page">
      <PageHeader title="Hoy" subtitle={`${formatLongDate(today)}${project ? ` · ${project.name}` : ''} · ${plural(entries.length, 'cosa', 'cosas')} en la lista`} />
      <div className="grid grid-2-1">
        <Card title="La lista de hoy" icon="sun" subtitle="Vencido, lo que vence hoy, lo marcado y lo que está en marcha">
          <form className="quick-add" onSubmit={quickAdd}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={data.projects.length ? `Añadir una tarea para hoy${project ? ` en ${project.name}` : ''}…` : 'Crea antes un proyecto'}
              aria-label="Nueva tarea para hoy"
              disabled={!data.projects.length}
            />
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              <Icon name="plus" size={16} /> Añadir
            </button>
          </form>
          <ItemList
            items={entries.map((e) => e.item)}
            data={data}
            showProject={!scope}
            year={year}
            hideStatus
            empty="Nada para hoy todavía: elige algo de la columna de la derecha."
            aside={(item) => {
              const r = REASON[reasons.get(item.id)!]
              return (
                <>
                  <Pill tone={r.tone}>{r.label}</Pill>
                  {item.focusDate === today && (
                    <button type="button" className="icon-btn small" title="Quitar de hoy" aria-label={`Quitar «${item.title}» de hoy`} onClick={() => store.patch('items', item.id, { focusDate: undefined })}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn small"
                    title="Marcar como hecho"
                    aria-label={`Marcar «${item.title}» como hecho`}
                    onClick={() => store.patch('items', item.id, { status: 'done', completedAt: today, focusDate: undefined })}
                  >
                    <Icon name="check" size={14} />
                  </button>
                </>
              )
            }}
          />
        </Card>
        <Card title="Elegir qué hacer" icon="list" subtitle="Lo abierto, por prioridad">
          <ItemList
            items={candidates}
            data={data}
            showProject={!scope}
            year={year}
            limit={25}
            empty="No hay nada abierto."
            aside={(item) => (
              <button type="button" className="btn btn-small btn-ghost" onClick={() => store.patch('items', item.id, { focusDate: today })}>
                <Icon name="plus" size={14} /> Hoy
              </button>
            )}
          />
        </Card>
      </div>
      {blocked.length > 0 && (
        <Card title="Bloqueado" icon="lock" subtitle="Antes de empezar el día: ¿se puede desbloquear algo?">
          <ItemList items={blocked} data={data} showProject={!scope} detail="blocked" year={year} />
        </Card>
      )}
    </div>
  )
}
