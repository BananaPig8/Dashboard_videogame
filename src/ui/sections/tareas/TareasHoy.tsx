// Plan de hoy (vista aparte de Tareas, ?vista=hoy): lo que toca hoy con su motivo, lo que
// se puede añadir al día y lo bloqueado. «Solo lo mío» es el filtro ?persona=<yo>, el mismo
// que el de la lista, así se conserva al pasar a otras vistas.
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { yearOf } from '../../../domain/dates'
import { TASK_NOBODY, taskTodayPlan } from '../../../domain/selectors'
import { t } from '../../../i18n'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { Card } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { ItemList } from '../../components/ItemList'
import { useMe } from '../../components/MePicker'
import { SectionHeader, useSectionNav } from '../../components/SectionHeader'
import { newDefaults, saveDraft, useScope } from '../../context'
import { useUndoable } from '../../feedback'
import { useFormat, useToday } from '../../hooks'
import { ReasonPill } from './comunes'

export function TareasHoy({ embedded }: { embedded?: boolean }) {
  const data = useStudioData()
  const canEdit = useCanEdit()
  const { scope, project } = useScope()
  const today = useToday()
  const year = yearOf(today)
  const fmt = useFormat()
  const undoable = useUndoable()
  const me = useMe()
  const nav = useSectionNav('tareas')
  const [params, setParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const persona = params.get('persona')
  const onlyMine = !!me && persona === me.id
  // Si viene filtrado por otra persona (desde la lista), se dice y se puede quitar.
  const other =
    persona && !onlyMine
      ? persona === TASK_NOBODY
        ? t('secciones.tareas.hoy.onlyNobody')
        : t('secciones.tareas.hoy.onlyPerson', { name: data.members.find((m) => m.id === persona)?.name ?? persona })
      : null
  const plan = taskTodayPlan(data, today, scope, persona)
  const reasons = new Map(plan.entries.map((e) => [e.item.id, e.reason]))
  const count = plan.entries.length === 1 ? t('secciones.tareas.hoy.countOne') : t('secciones.tareas.hoy.countMany', { n: plan.entries.length })
  const subtitle = project
    ? t('secciones.tareas.hoy.subtitleIn', { date: fmt.longDate(today), project: project.name, count })
    : t('secciones.tareas.hoy.subtitle', { date: fmt.longDate(today), count })
  const mias = nav.section.children.find((c) => c.id === 'mias')!

  const setPersona = (value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set('persona', value)
    else next.delete('persona')
    setParams(next, { replace: true })
  }

  const quickAdd = (e: FormEvent) => {
    e.preventDefault()
    const clean = title.trim()
    if (!clean) return
    // Con el filtro de persona puesto, lo nuevo es de esa persona (así sale en la lista).
    const assignee = persona === TASK_NOBODY ? { assigneeId: undefined } : persona && data.members.some((m) => m.id === persona) ? { assigneeId: persona } : {}
    saveDraft('items', { ...newDefaults('items', data, scope), ...assignee, title: clean, status: 'planned', focusDate: today }, data)
    setTitle('')
  }

  const toggle = me && (
    <button type="button" className="btn btn-ghost tareas-toggle" aria-pressed={onlyMine} title={t('secciones.tareas.hoy.onlyMineHint', { name: me.name })} onClick={() => setPersona(onlyMine ? null : me.id)}>
      <Icon name={onlyMine ? 'checkCircle' : 'user'} size={16} /> {t('secciones.tareas.hoy.onlyMine')}
    </button>
  )

  return (
    <div className={embedded ? 'tareas-page' : 'page tareas-page'}>
      <SectionHeader id="tareas" embedded={embedded} subtitle={subtitle} actions={toggle} />
      {embedded && <p className="page-subtitle">{subtitle}</p>}
      {other && (
        <div className="tag-filter" role="status">
          <Icon name="user" size={14} />
          <span>{other}</span>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setPersona(null)}>
            {t('secciones.tareas.hoy.showAll')}
          </button>
        </div>
      )}
      {!me && data.members.some((m) => m.active) && (
        <p className="muted small">
          <Icon name="user" size={14} /> <Link to={nav.href(mias)}>{t('secciones.tareas.hoy.whoAreYou')}</Link>
        </p>
      )}
      <div className="grid grid-2-1">
        <Card title={t('secciones.tareas.hoy.listTitle')} icon="sun" subtitle={t('secciones.tareas.hoy.listSubtitle')}>
          {canEdit && (
            <form className="quick-add" onSubmit={quickAdd}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  !data.projects.length
                    ? t('secciones.tareas.hoy.needProject')
                    : project
                      ? t('secciones.tareas.hoy.addPlaceholderIn', { project: project.name })
                      : t('secciones.tareas.hoy.addPlaceholder')
                }
                aria-label={t('secciones.tareas.hoy.addLabel')}
                disabled={!data.projects.length}
              />
              <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                <Icon name="plus" size={16} /> {t('secciones.tareas.hoy.add')}
              </button>
            </form>
          )}
          <ItemList
            items={plan.entries.map((e) => e.item)}
            data={data}
            showProject={!scope && !embedded}
            showAssignee={!onlyMine}
            year={year}
            hideStatus
            empty={onlyMine ? t('secciones.tareas.hoy.emptyMine') : t('secciones.tareas.hoy.empty')}
            aside={(item) => (
              <>
                <ReasonPill reason={reasons.get(item.id)!} />
                {canEdit && item.focusDate === today && (
                  <button
                    type="button"
                    className="icon-btn small"
                    title={t('secciones.tareas.hoy.remove')}
                    aria-label={t('secciones.tareas.hoy.removeLabel', { title: item.title })}
                    onClick={() => store.patch('items', item.id, { focusDate: undefined })}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="icon-btn small"
                    title={t('secciones.tareas.hoy.done')}
                    aria-label={t('secciones.tareas.hoy.doneLabel', { title: item.title })}
                    onClick={() =>
                      undoable(t('secciones.tareas.hoy.doneToast'), () => store.patch('items', item.id, { status: 'done', completedAt: today, focusDate: undefined }))
                    }
                  >
                    <Icon name="check" size={14} />
                  </button>
                )}
              </>
            )}
          />
        </Card>
        <Card title={t('secciones.tareas.hoy.pickTitle')} icon="list" subtitle={t('secciones.tareas.hoy.pickSubtitle')}>
          <ItemList
            items={plan.candidates}
            data={data}
            showProject={!scope && !embedded}
            showAssignee={!onlyMine}
            year={year}
            limit={25}
            empty={t('secciones.tareas.hoy.pickEmpty')}
            aside={(item) =>
              canEdit && (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  aria-label={t('secciones.tareas.hoy.addTodayLabel', { title: item.title })}
                  onClick={() => store.patch('items', item.id, { focusDate: today })}
                >
                  <Icon name="plus" size={14} /> {t('secciones.tareas.hoy.addToday')}
                </button>
              )
            }
          />
        </Card>
      </div>
      {plan.blocked.length > 0 && (
        <Card title={t('secciones.tareas.hoy.blockedTitle')} icon="lock" subtitle={t('secciones.tareas.hoy.blockedSubtitle')}>
          <ItemList items={plan.blocked} data={data} showProject={!scope && !embedded} showAssignee={!onlyMine} detail="blocked" year={year} />
        </Card>
      )}
    </div>
  )
}
