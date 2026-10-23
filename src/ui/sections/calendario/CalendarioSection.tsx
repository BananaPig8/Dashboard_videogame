// Calendario: todas las fechas del estudio (secciones/calendario.ts) en un mes (?mes=AAAA-MM),
// con lo atrasado, lo próximo y lo que no tiene fecha confirmada al lado. Las subsecciones son
// la faceta ?tipo= (navigation.ts) y eligen los tipos de fecha (CALENDAR_SECTION_KINDS).
// Cada entrada abre su elemento; se puede descargar la vista como .ics para importarla.
import { useSearchParams } from 'react-router-dom'
import {
  allCalendarEntries,
  calendarEntries,
  calendarKindsFor,
  calendarMonthParam,
  calendarOverdue,
  calendarTentative,
  calendarUndated,
  calendarWithTag,
  upcomingEntries,
} from '../../../domain/selectors'
import { t, tr } from '../../../i18n'
import { useCanEdit, useStudioData } from '../../../data/store'
import type { CollectionKey } from '../../../data/store'
import { Card, Empty } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { MonthCalendar, monthGrid, monthStart } from '../../components/MonthCalendar'
import { SectionHeader, useSectionNav } from '../../components/SectionHeader'
import { TagFilterNotice, useTagFilter } from '../../components/TagFilter'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { usePreferences } from '../../prefs'
import type { SectionPageProps } from '../registry'
import { CalendarioExportar } from './CalendarioExportar'
import { EntryRow, ShortList, UndatedRow } from './CalendarioFilas'
import './calendario.css'

/** Cuántos días por delante enseña «Lo próximo». */
const UPCOMING_DAYS = 60
const UPCOMING_LIMIT = 8
const OVERDUE_LIMIT = 5
const UNCONFIRMED_LIMIT = 5

interface CreateOption {
  id: string
  label: string
  icon: IconName
  collection: CollectionKey
  defaults?: Record<string, unknown>
}

/** Qué se puede añadir desde cada subsección; el primero es el principal. */
function createOptions(tipo: string | null): CreateOption[] {
  const event: CreateOption =
    tipo === 'festivales'
      ? { id: 'festival', label: t('secciones.calendario.create.festival'), icon: 'star', collection: 'events', defaults: { type: 'festival' } }
      : { id: 'event', label: t('secciones.calendario.create.event'), icon: 'ticket', collection: 'events' }
  const meeting: CreateOption = {
    id: 'meeting',
    label: t('secciones.calendario.create.meeting'),
    icon: 'users',
    collection: 'events',
    defaults: { type: 'meeting' },
  }
  const delivery: CreateOption = {
    id: 'delivery',
    label: t('secciones.calendario.create.delivery'),
    icon: 'box',
    collection: 'events',
    defaults: { type: 'delivery' },
  }
  const reminder: CreateOption = { id: 'reminder', label: t('secciones.calendario.create.reminder'), icon: 'bell', collection: 'reminders' }
  const base = [event, meeting, delivery, reminder]
  const first = (o: CreateOption) => [o, ...base.filter((x) => x !== o)]
  switch (tipo) {
    case 'limites':
      return [
        { id: 'deadline', label: t('secciones.calendario.create.deadline'), icon: 'clock', collection: 'events', defaults: { type: 'deadline' } },
        ...base,
      ]
    case 'publicacion':
      return [{ id: 'release', label: t('secciones.calendario.create.release'), icon: 'rocket', collection: 'releases' }, ...base]
    case 'entregas':
      return first(delivery)
    case 'reuniones':
      return first(meeting)
    case 'recordatorios':
      return first(reminder)
    default:
      return base
  }
}

const EMPTY_KEYS = ['limites', 'entregas', 'eventos', 'festivales', 'reuniones', 'publicacion', 'recordatorios']

export default function CalendarioSection({ embedded }: SectionPageProps) {
  const data = useStudioData()
  const { scope, project } = useScope()
  const { create, edit } = useUI()
  const canEdit = useCanEdit()
  const today = useToday()
  const fmt = useFormat()
  const { weekStart } = usePreferences()
  const nav = useSectionNav('calendario')
  const tag = useTagFilter()
  const [params, setParams] = useSearchParams()
  const tipo = params.get('tipo')
  const kinds = calendarKindsFor(tipo)
  const ofKinds = <T extends { kind: string }>(list: T[]) => (kinds ? list.filter((e) => kinds.includes(e.kind as never)) : list)
  const showProject = scope === null

  // El mes que se ve (?mes=AAAA-MM; sin él, el de hoy) y sus fechas.
  const month = calendarMonthParam(params.get('mes'), today)
  const days = monthGrid(month, weekStart)
  const monthEntries = calendarWithTag(data, calendarEntries(data, { from: days[0], to: days[days.length - 1], scope, kinds }), tag)
  const setMonth = (m: string) => {
    const next = new URLSearchParams(params)
    if (m === monthStart(today)) next.delete('mes')
    else next.set('mes', m.slice(0, 7))
    setParams(next)
  }

  const anything = calendarWithTag(data, ofKinds(allCalendarEntries(data, scope)), tag).length > 0
  const overdue = calendarWithTag(data, calendarOverdue(data, today, scope, kinds), tag)
  const upcoming = calendarWithTag(data, ofKinds(upcomingEntries(data, today, UPCOMING_DAYS, scope)), tag)
  const tentative = calendarWithTag(data, calendarTentative(data, today, scope, kinds), tag)
  const undated = calendarWithTag(data, calendarUndated(data, scope, kinds), tag)

  const options = createOptions(tipo)
  const chosen = nav.active.find((c) => c.value !== null)
  const what = [project?.name ?? data.studio.name, chosen?.label].filter(Boolean).join(' · ')
  const emptyText = tag
    ? t('secciones.calendario.empty.tagged')
    : tipo && EMPTY_KEYS.includes(tipo)
      ? tr(`secciones.calendario.empty.${tipo}`)
      : t('secciones.calendario.empty.todo')

  return (
    <div className={embedded ? 'calendario-page' : 'page calendario-page'}>
      <SectionHeader id="calendario" embedded={embedded} />
      {canEdit && (
        <div className="calendario-toolbar" role="group" aria-label={t('secciones.calendario.create.group')}>
          {options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              className={i === 0 ? 'btn btn-small btn-primary' : 'btn btn-small'}
              onClick={() => create(o.collection, o.defaults)}
            >
              <Icon name={o.icon} size={14} /> {o.label}
            </button>
          ))}
        </div>
      )}
      <TagFilterNotice />
      {!anything && (
        <Empty
          icon="calendar"
          action={
            canEdit && !tag ? { label: options[0].label, icon: options[0].icon, onClick: () => create(options[0].collection, options[0].defaults) } : undefined
          }
        >
          {emptyText}
        </Empty>
      )}
      <div className="grid grid-2-1 calendario-grid">
        <Card title={t('secciones.calendario.month.title')} icon="calendar" className="calendario-month">
          <MonthCalendar
            month={month}
            entries={monthEntries}
            today={today}
            onOpen={(e) => edit(e.target)}
            onMonth={setMonth}
            caption={t('secciones.calendario.month.caption', { month: fmt.monthYear(month) })}
          />
        </Card>
        <div className="stack">
          {overdue.length > 0 && (
            <Card
              title={t('secciones.calendario.overdue.title')}
              icon="alert"
              subtitle={t('secciones.calendario.overdue.subtitle')}
              className="calendario-overdue"
            >
              <ShortList list={overdue} limit={OVERDUE_LIMIT} render={(e) => <EntryRow key={e.id} entry={e} data={data} showProject={showProject} />} />
            </Card>
          )}
          <Card title={t('secciones.calendario.upcoming.title')} icon="clock" subtitle={t('secciones.calendario.upcoming.subtitle', { days: UPCOMING_DAYS })}>
            {upcoming.length ? (
              <ShortList list={upcoming} limit={UPCOMING_LIMIT} render={(e) => <EntryRow key={e.id} entry={e} data={data} showProject={showProject} />} />
            ) : (
              <Empty icon="calendar">{t('secciones.calendario.upcoming.empty', { days: UPCOMING_DAYS })}</Empty>
            )}
          </Card>
          <Card title={t('secciones.calendario.unconfirmed.title')} icon="question" subtitle={t('secciones.calendario.unconfirmed.subtitle')}>
            {tentative.length + undated.length === 0 ? (
              <Empty>{t('secciones.calendario.unconfirmed.none')}</Empty>
            ) : (
              <>
                {tentative.length > 0 && (
                  <div>
                    <h3 className="subhead">{t('secciones.calendario.unconfirmed.tentative')}</h3>
                    <ShortList
                      list={tentative}
                      limit={UNCONFIRMED_LIMIT}
                      render={(e) => <EntryRow key={e.id} entry={e} data={data} showProject={showProject} />}
                    />
                  </div>
                )}
                {undated.length > 0 && (
                  <div>
                    <h3 className="subhead">{t('secciones.calendario.unconfirmed.undated')}</h3>
                    <ShortList
                      list={undated}
                      limit={UNCONFIRMED_LIMIT}
                      render={(u) => <UndatedRow key={u.id} item={u} data={data} showProject={showProject} />}
                    />
                  </div>
                )}
              </>
            )}
          </Card>
          <CalendarioExportar data={data} scope={scope} kinds={kinds} tag={tag} what={what} />
        </div>
      </div>
    </div>
  )
}
