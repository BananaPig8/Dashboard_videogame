// Prioridades de hoy: lo crítico, lo vencido, lo que vence, lo bloqueado, lo que impide seguir
// o espera a otra cosa, los hitos en riesgo y lo pendiente de entregas, eventos y fichas de
// tienda. Una fila por cosa, ordenadas por puntos (domain/secciones/panel-prioridades.ts), y
// las tareas se pueden terminar, repriorizar o asignar sin salir del Dashboard.
import type { ReactNode } from 'react'
import { PRIORITIES, type Tone } from '../../../../domain/catalog'
import { dashboardPriorities, PRIORITY_LIMIT, priorityHasData, type PriorityFlag, type PriorityRow } from '../../../../domain/selectors'
import type { Priority, StudioData, WorkItem } from '../../../../domain/types'
import { t } from '../../../../i18n'
import type { Formatter } from '../../../../i18n/format'
import { store, useCanEdit } from '../../../../data/store'
import { ConfidenceTag, KindIcon, Pill, PriorityTag, ProjectChip } from '../../../components/Badges'
import { Empty } from '../../../components/Common'
import { Icon, type IconName } from '../../../components/Icon'
import { AssigneeTag } from '../../../components/ItemList'
import { Popover } from '../../../components/Popover'
import { useScope, useUI } from '../../../context'
import { useUndoable } from '../../../feedback'
import { MoreLink, ScopedMore, type WidgetProps } from './comunes'
import './prioridades.css'

const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low']
const PRIORITY_ICON: Record<Priority, IconName> = { critical: 'alert', high: 'arrowUp', medium: 'minus', low: 'arrowDown' }

/** Lo que no es un elemento de trabajo: su icono y qué es (para el lector de pantalla). */
const TARGET_ICON: Record<'events' | 'releases' | 'storeListings', { icon: IconName; label: () => string; cls: string }> = {
  events: { icon: 'ticket', label: () => t('secciones.panel.prioridades.detail.event'), cls: 'kind-feature' },
  releases: { icon: 'rocket', label: () => t('secciones.panel.prioridades.detail.release'), cls: 'kind-milestone' },
  storeListings: { icon: 'globe', label: () => t('secciones.panel.prioridades.detail.listing'), cls: 'kind-decision' },
}

/** Tono, icono y texto de cada etiqueta de urgencia (nunca solo color). */
function flagView(f: PriorityFlag, fmt: Formatter, today: string): { tone: Tone; icon: IconName; text: string } {
  const soon = (days: number): Tone => (days <= 3 ? 'warning' : 'info')
  switch (f.kind) {
    case 'overdue':
      return { tone: 'danger', icon: 'clock', text: t('secciones.panel.prioridades.flag.overdue', { rel: fmt.relative(f.date, today) }) }
    case 'dueToday':
      return { tone: 'warning', icon: 'clock', text: t('secciones.panel.prioridades.flag.dueToday') }
    case 'dueSoon':
      return { tone: 'warning', icon: 'clock', text: t('secciones.panel.prioridades.flag.dueSoon', { rel: fmt.relative(f.date, today) }) }
    case 'critical':
      return { tone: 'danger', icon: 'alert', text: t('secciones.panel.prioridades.flag.critical') }
    case 'focus':
      return { tone: 'info', icon: 'sun', text: t('secciones.panel.prioridades.flag.focus') }
    case 'blocked':
      return { tone: 'danger', icon: 'lock', text: t('secciones.panel.prioridades.flag.blocked') }
    case 'issue':
      return { tone: 'danger', icon: 'bug', text: t('secciones.panel.prioridades.flag.issue') }
    case 'blocking':
      return {
        tone: 'warning',
        icon: 'link',
        text: f.n === 1 ? t('secciones.panel.prioridades.flag.blockingOne') : t('secciones.panel.prioridades.flag.blockingOther', { n: f.n }),
      }
    case 'waiting':
      return {
        tone: 'neutral',
        icon: 'pause',
        text: f.n === 1 ? t('secciones.panel.prioridades.flag.waitingOne') : t('secciones.panel.prioridades.flag.waitingOther', { n: f.n }),
      }
    case 'milestoneRisk':
      return { tone: f.late ? 'danger' : 'warning', icon: 'flag', text: t('secciones.panel.prioridades.flag.milestoneRisk') }
    case 'release':
      return { tone: soon(f.days), icon: 'rocket', text: t('secciones.panel.prioridades.flag.release', { rel: fmt.relative(f.date, today) }) }
    case 'registration':
      return { tone: soon(f.days), icon: 'ticket', text: t('secciones.panel.prioridades.flag.registration', { rel: fmt.relative(f.date, today) }) }
    case 'eventSteps':
      return {
        tone: 'warning',
        icon: 'list',
        text: f.missing === 1 ? t('secciones.panel.prioridades.flag.eventStepsOne') : t('secciones.panel.prioridades.flag.eventStepsOther', { n: f.missing }),
      }
    case 'listingChanges':
      return { tone: 'warning', icon: 'edit', text: t('secciones.panel.prioridades.flag.listingChanges') }
  }
}

/** Una lista de elementos que se pueden abrir («Espera a: A, B»). */
function ItemLinks({ items }: { items: WorkItem[] }) {
  const { openItem } = useUI()
  return (
    <>
      {items.map((i, n) => (
        <span key={i.id}>
          {n > 0 && ', '}
          <button type="button" className="link-btn prio-link" onClick={() => openItem(i.id)}>
            {i.title}
          </button>
        </span>
      ))}
    </>
  )
}

/** Lo que explica la fila debajo de las etiquetas: el motivo del bloqueo, a qué espera, qué falta… */
function rowDetails(row: PriorityRow): { icon: IconName; content: ReactNode }[] {
  const out: { icon: IconName; content: ReactNode }[] = []
  for (const f of row.flags) {
    if (f.kind === 'blocked') {
      const reason = row.item?.blockedReason?.trim()
      out.push({
        icon: 'lock',
        content: reason ? t('secciones.panel.prioridades.detail.blockedReason', { reason }) : t('secciones.panel.prioridades.detail.blockedNoReason'),
      })
    } else if (f.kind === 'waiting') {
      out.push({
        icon: 'pause',
        content: (
          <>
            {t('secciones.panel.prioridades.detail.waitingOn')} <ItemLinks items={row.waitingOn} />
          </>
        ),
      })
    } else if (f.kind === 'blocking') {
      out.push({
        icon: 'link',
        content: (
          <>
            {t('secciones.panel.prioridades.detail.blocking')} <ItemLinks items={row.blocking} />
          </>
        ),
      })
    } else if (f.kind === 'milestoneRisk') {
      const parts: string[] = []
      if (f.late) parts.push(t('secciones.panel.prioridades.detail.milestoneLate'))
      if (f.total > 0) parts.push(t('secciones.panel.prioridades.detail.milestoneOpen', { open: f.open, total: f.total }))
      if (f.stuck > 0)
        parts.push(
          f.stuck === 1 ? t('secciones.panel.prioridades.detail.milestoneStuckOne') : t('secciones.panel.prioridades.detail.milestoneStuckOther', { n: f.stuck }),
        )
      out.push({ icon: 'flag', content: parts.join(' · ') })
    } else if (f.kind === 'eventSteps') {
      out.push({ icon: 'list', content: t('secciones.panel.prioridades.detail.eventSteps', { done: f.total - f.missing, total: f.total }) })
    }
  }
  return out
}

/** Las fechas de la fila, escritas (las etiquetas ya dicen lo cerca que están). */
function rowDates(row: PriorityRow, fmt: Formatter, year: number): string[] {
  const out: string[] = []
  if (row.item?.dueDate) out.push(t('secciones.panel.prioridades.detail.due', { date: fmt.date(row.item.dueDate, year) }))
  for (const f of row.flags) {
    if (f.kind === 'release') out.push(t('secciones.panel.prioridades.detail.releaseDate', { date: fmt.date(f.date, year) }))
    if (f.kind === 'registration') out.push(t('secciones.panel.prioridades.detail.registrationDate', { date: fmt.date(f.date, year) }))
    if (f.kind === 'eventSteps') out.push(t('secciones.panel.prioridades.detail.eventDate', { date: fmt.date(f.date, year) }))
  }
  return out
}

const rowSel = (id: string) => `[data-prio-row="${CSS.escape(id)}"]`

/** Después de que una fila desaparezca (hecha), el foco pasa a la fila de al lado. */
function focusNeighbour(from: HTMLElement | null) {
  const li = from?.closest('li.prio-row')
  const next = (li?.nextElementSibling ?? li?.previousElementSibling) as HTMLElement | null
  const id = next?.dataset.prioRow
  if (!id) return
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`${rowSel(id)} .item-title`)?.focus())
}

/**
 * Tras cambiar la prioridad o a quién se asigna, la fila puede moverse o salir de las que se
 * enseñan (al bajar una crítica): el foco se queda en su «Más acciones» si sigue a la vista; si
 * no, pasa al título de la fila de al lado o a «Ver todas». Nunca cae en la página.
 */
function keepFocus(rowId: string) {
  const li = document.querySelector<HTMLElement>(rowSel(rowId))
  const next = (li?.nextElementSibling ?? li?.previousElementSibling) as HTMLElement | null
  const neighbour = next?.dataset.prioRow
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const a = document.activeElement
      if (a && a !== document.body && a.isConnected) return
      const target =
        document.querySelector<HTMLElement>(`${rowSel(rowId)} .prio-more`) ??
        (neighbour ? document.querySelector<HTMLElement>(`${rowSel(neighbour)} .item-title`) : null) ??
        document.querySelector<HTMLElement>('.prio-all a') ??
        document.querySelector<HTMLElement>('.prio-list .item-title')
      target?.focus()
    }),
  )
}

/** Terminar, cambiar la prioridad, asignar o editar un elemento de trabajo, sin salir del panel. */
function ItemActions({ item, data, today }: { item: WorkItem; data: StudioData; today: string }) {
  const { openItem } = useUI()
  const undoable = useUndoable()
  const rowId = `items:${item.id}`
  const people = data.members.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const current = <span className="visually-hidden"> {t('secciones.panel.prioridades.actions.current')}</span>
  const setPriority = (priority: Priority) => {
    if (priority === item.priority) return
    keepFocus(rowId)
    undoable(
      t('secciones.panel.prioridades.actions.priorityToast', { title: item.title, priority: PRIORITIES[priority].label }),
      () => store.patch('items', item.id, { priority }),
      { returnFocus: `${rowSel(rowId)} .prio-more` },
    )
  }
  const assign = (assigneeId: string | undefined) => {
    if (assigneeId === item.assigneeId) return
    const name = data.members.find((m) => m.id === assigneeId)?.name
    keepFocus(rowId)
    undoable(
      name
        ? t('secciones.panel.prioridades.actions.assignedToast', { title: item.title, name })
        : t('secciones.panel.prioridades.actions.unassignedToast', { title: item.title }),
      () => store.patch('items', item.id, { assigneeId }),
      { returnFocus: `${rowSel(rowId)} .prio-more` },
    )
  }
  return (
    <div className="prio-actions">
      <button
        type="button"
        className="btn btn-small btn-ghost prio-done"
        title={t('secciones.panel.prioridades.actions.done')}
        aria-label={t('secciones.panel.prioridades.actions.doneLabel', { title: item.title })}
        onClick={(e) => {
          focusNeighbour(e.currentTarget)
          // Al deshacer, la fila vuelve y el foco, a su «Hecho».
          undoable(
            t('secciones.panel.prioridades.actions.doneToast', { title: item.title }),
            () => store.patch('items', item.id, { status: 'done', completedAt: today, focusDate: undefined }),
            { returnFocus: `${rowSel(rowId)} .prio-done` },
          )
        }}
      >
        <Icon name="checkCircle" size={14} />
        <span className="prio-done-text">{t('secciones.panel.prioridades.actions.doneShort')}</span>
      </button>
      <Popover
        label={t('secciones.panel.prioridades.actions.menu', { title: item.title })}
        className="prio-menu"
        trigger={({ toggle, ...aria }) => (
          <button
            type="button"
            className="icon-btn small prio-more"
            title={t('secciones.panel.prioridades.actions.more')}
            aria-label={t('secciones.panel.prioridades.actions.moreLabel', { title: item.title })}
            onClick={toggle}
            {...aria}
          >
            <Icon name="chevronDown" size={14} />
          </button>
        )}
      >
        {(close) => (
          <>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                close()
                openItem(item.id)
              }}
            >
              <Icon name="edit" size={14} /> {t('actions.edit')}
            </button>
            <div className="menu-sep" role="separator" />
            <div role="group" aria-label={t('secciones.panel.prioridades.actions.priority')}>
              <div className="prio-menu-label" aria-hidden="true">
                {t('secciones.panel.prioridades.actions.priority')}
              </div>
              {PRIORITY_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    close()
                    setPriority(p)
                  }}
                >
                  <span className={`priority-${p} prio-menu-icon`}>
                    <Icon name={PRIORITY_ICON[p]} size={14} />
                  </span>
                  {PRIORITIES[p].label}
                  {p === item.priority && (
                    <>
                      <Icon name="check" size={14} className="prio-current" />
                      {current}
                    </>
                  )}
                </button>
              ))}
            </div>
            {people.length > 0 && (
              <>
                <div className="menu-sep" role="separator" />
                <div role="group" aria-label={t('secciones.panel.prioridades.actions.assign')}>
                  <div className="prio-menu-label" aria-hidden="true">
                    {t('secciones.panel.prioridades.actions.assign')}
                  </div>
                  {[...people.map((m) => ({ id: m.id as string | undefined, name: m.name })), { id: undefined, name: t('secciones.tareas.assignee.nobody') }].map(
                    (m) => (
                      <button
                        key={m.id ?? '-'}
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => {
                          close()
                          assign(m.id)
                        }}
                      >
                        <Icon name="user" size={14} />
                        {m.name}
                        {m.id === item.assigneeId && (
                          <>
                            <Icon name="check" size={14} className="prio-current" />
                            {current}
                          </>
                        )}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}
          </>
        )}
      </Popover>
    </div>
  )
}

function PriorityRowView({ row, data, today, year, fmt, showProject, canEdit }: { row: PriorityRow; data: StudioData; today: string; year: number; fmt: Formatter; showProject: boolean; canEdit: boolean }) {
  const { edit } = useUI()
  const details = rowDetails(row)
  const dates = rowDates(row, fmt, year)
  const other = row.target.collection === 'items' ? undefined : TARGET_ICON[row.target.collection]
  return (
    <li className="item-row prio-row" data-prio-row={row.id}>
      {row.item ? (
        <KindIcon kind={row.item.kind} />
      ) : (
        other && (
          <span className={`kind-icon ${other.cls}`} role="img" aria-label={other.label()} title={other.label()}>
            <Icon name={other.icon} size={14} />
          </span>
        )
      )}
      <div className="item-main">
        <button type="button" className="item-title" onClick={() => edit({ collection: row.target.collection, id: row.target.id })}>
          {row.title}
        </button>
        <div className="prio-flags">
          {row.flags.map((f) => {
            const v = flagView(f, fmt, today)
            return (
              <Pill key={f.kind} tone={v.tone} icon={v.icon}>
                {v.text}
              </Pill>
            )
          })}
          {/* Un elemento de trabajo por confirmar lo dice como en el resto de la aplicación; una
              versión o un evento, que su fecha es la prevista. */}
          {!row.confirmed &&
            (row.item ? (
              <ConfidenceTag confidence="to_confirm" />
            ) : (
              <Pill tone="warning" icon="question">
                {t('secciones.panel.agenda.unconfirmed')}
              </Pill>
            ))}
        </div>
        {details.length > 0 && (
          <ul className="prio-details">
            {details.map((d, n) => (
              <li key={n}>
                <Icon name={d.icon} size={12} />
                <span>{d.content}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="item-meta">
          {showProject && <ProjectChip project={data.projects.find((p) => p.id === row.projectId)} />}
          {row.item && <AssigneeTag item={row.item} data={data} />}
          {row.item?.priority === 'high' && <PriorityTag priority="high" />}
          {dates.map((d) => (
            <span key={d} className="meta-date">
              {d}
            </span>
          ))}
        </div>
      </div>
      {canEdit && row.item && <ItemActions item={row.item} data={data} today={today} />}
    </li>
  )
}

export function PrioritiesBody({ data, scope, today, year, fmt, focus }: WidgetProps) {
  const { href } = useScope()
  const canEdit = useCanEdit()
  const rows = dashboardPriorities(data, today, scope)
  if (rows.length === 0)
    return priorityHasData(data, scope) ? (
      <Empty icon="checkCircle">
        <strong>{t('secciones.panel.prioridades.empty')}</strong> {t('secciones.panel.prioridades.emptyHint')}
      </Empty>
    ) : (
      <Empty icon="list">{t('secciones.panel.prioridades.noData')}</Empty>
    )
  const shown = focus ? rows : rows.slice(0, PRIORITY_LIMIT)
  return (
    <>
      <ul className="item-list prio-list">
        {shown.map((row) => (
          <PriorityRowView key={row.id} row={row} data={data} today={today} year={year} fmt={fmt} showProject={!scope} canEdit={canEdit} />
        ))}
      </ul>
      {rows.length > shown.length && (
        <div className="prio-all">
          <MoreLink to={href('/?ver=prioritarias')} label={t('secciones.panel.prioridades.all', { n: rows.length })} />
        </div>
      )}
      {focus && (
        <details className="subsection prio-how">
          <summary>{t('secciones.panel.prioridades.how.title')}</summary>
          <p>{t('secciones.panel.prioridades.how.intro')}</p>
          <ul>
            <li>{t('secciones.panel.prioridades.how.impact')}</li>
            <li>{t('secciones.panel.prioridades.how.deadline')}</li>
            <li>{t('secciones.panel.prioridades.how.urgency')}</li>
            <li>{t('secciones.panel.prioridades.how.dependencies')}</li>
          </ul>
          <p>{t('secciones.panel.prioridades.how.risk')}</p>
        </details>
      )}
    </>
  )
}

export function PrioritiesAction() {
  return <ScopedMore to="/tareas?vista=hoy" label={t('secciones.panel.today.plan')} />
}
