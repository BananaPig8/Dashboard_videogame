// Cabecera del Dashboard. En el estudio («/», también con ?p=): saludo, fecha y nombre del
// estudio; «Crear» y «Personalizar»; debajo de las subsecciones, qué se ve (proyecto y
// periodo) y los accesos rápidos (en móvil van en el menú «Más», junto a «Crear»). En la ficha de un proyecto, solo el
// periodo y «Personalizar». En el modo foco (?ver=), el título de la vista y «Volver».
import { useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { nowISODateTime } from '../../../domain/dates'
import { PERIOD_IDS, isProjectClosed, panelGreeting, projectSummaries, projectsInGroup, type Period, type PeriodId } from '../../../domain/selectors'
import { t, tr } from '../../../i18n'
import type { Formatter } from '../../../i18n/format'
import { useCanEdit, useStudioData } from '../../../data/store'
import { HealthPill } from '../../components/Badges'
import { Icon, type IconName } from '../../components/Icon'
import { useMe } from '../../components/MePicker'
import { Popover } from '../../components/Popover'
import { SectionHeader, useSectionNav } from '../../components/SectionHeader'
import { useScope, useUI } from '../../context'
import { useFormat, useToday } from '../../hooks'
import { dashboardCreate, PANEL_FOCUS } from '../../navigation'
import { usePreferences } from '../../prefs'
import { openSearch } from '../../search'
import { usePanelPeriod } from './periodo'

/** La hora («HH:mm») en la zona horaria del estudio; se pone al día cada minuto. */
function useStudioTime(): string {
  const { timeZone } = usePreferences()
  const [time, setTime] = useState(() => nowISODateTime(timeZone).slice(11, 16))
  useEffect(() => {
    const tick = () => setTime(nowISODateTime(timeZone).slice(11, 16))
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [timeZone])
  return time
}

/** «Del 27 oct al 2 nov», «Hoy, 2 nov» o, en el personalizado, con los días que abarca. */
export function periodText(p: Period, fmt: Formatter, today: string): string {
  const year = Number(today.slice(0, 4))
  const date = (d: string) => fmt.date(d, year)
  if (p.from === p.to) return t(p.to === today ? 'secciones.panel.cabecera.period.today' : 'secciones.panel.cabecera.period.day', { date: date(p.to) })
  return t(p.id === 'personalizado' ? 'secciones.panel.cabecera.period.rangeDays' : 'secciones.panel.cabecera.period.range', {
    from: date(p.from),
    to: date(p.to),
    n: p.days,
  })
}

/** Saludo (con el nombre de «Quién soy», si lo hay), fecha larga y nombre del estudio. */
function Greeting() {
  const data = useStudioData()
  const me = useMe()
  const fmt = useFormat()
  const today = useToday()
  const greeting = tr(`secciones.panel.cabecera.greeting.${panelGreeting(useStudioTime())}`)
  return (
    <>
      <span className="panel-hello">{me ? t('secciones.panel.cabecera.greeting.withName', { greeting, name: me.name }) : greeting}</span>
      {' · '}
      <span>{fmt.longDate(today)}</span>
      {data.studio.name && (
        <>
          {' · '}
          <span className="panel-studio">{data.studio.name}</span>
        </>
      )}
    </>
  )
}

/** Todo el estudio o un proyecto (cambia ?p=, como el de la barra superior). */
function ProjectPicker() {
  const data = useStudioData()
  const { scope, setScope } = useScope()
  return (
    <label className="panel-field">
      <span className="panel-field-label">{t('secciones.panel.cabecera.project')}</span>
      <select value={scope ?? ''} onChange={(e) => setScope(e.target.value || null)}>
        <option value="">{t('topbar.wholeStudio')}</option>
        {projectsInGroup(data, null).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Hoy, 7 días, 30 días o dos fechas; siempre dice qué días abarca. */
export function PeriodPicker() {
  const { period, setPeriod } = usePanelPeriod()
  const fmt = useFormat()
  const today = useToday()
  const rangeId = useId()
  const custom = period.id === 'personalizado'
  return (
    <div className="panel-period" role="group" aria-label={t('secciones.panel.cabecera.period.label')}>
      <label className="panel-field">
        <span className="panel-field-label">{t('secciones.panel.cabecera.period.label')}</span>
        <select
          value={period.id}
          aria-describedby={rangeId}
          onChange={(e) => {
            const next = e.target.value as PeriodId
            // El personalizado empieza con las fechas que se estaban viendo.
            setPeriod(next, next === 'personalizado' ? { from: period.from, to: period.to } : undefined)
          }}
        >
          {PERIOD_IDS.map((id) => (
            <option key={id} value={id}>
              {tr(`secciones.panel.cabecera.period.${id}`)}
            </option>
          ))}
        </select>
      </label>
      {custom && (
        <>
          {/* Ninguna de las dos después de hoy: lo que no ha pasado no se cuenta (periodRange también lo recorta). */}
          <label className="panel-field">
            <span className="panel-field-label">{t('secciones.panel.cabecera.period.from')}</span>
            <input type="date" value={period.from} max={period.to} onChange={(e) => setPeriod('personalizado', { from: e.target.value || undefined, to: period.to })} />
          </label>
          <label className="panel-field">
            <span className="panel-field-label">{t('secciones.panel.cabecera.period.to')}</span>
            <input
              type="date"
              value={period.to}
              min={period.from}
              max={today}
              onChange={(e) => setPeriod('personalizado', { from: period.from, to: e.target.value || undefined })}
            />
          </label>
        </>
      )}
      <span className="panel-range" id={rangeId} aria-live="polite">
        <Icon name="calendar" size={14} />
        {periodText(period, fmt, today)}
      </span>
    </div>
  )
}

/**
 * Cómo está cada juego, en una línea y arriba del todo (también en el móvil, sin bajar): su
 * nombre, que lleva a su ficha, y su salud (la de Proyectos y «Necesita atención»), de lo que más
 * pide atención a lo que menos. En todo el estudio, sin los proyectos archivados; con ?p=, ese.
 */
function GamesHealth() {
  const data = useStudioData()
  const today = useToday()
  const { scope } = useScope()
  const labelId = useId()
  const list = projectSummaries(data, today).filter((s) => (scope ? s.project.id === scope : !isProjectClosed(data.studio, s.project)))
  if (list.length === 0) return null
  return (
    <div className="panel-health">
      <span className="panel-health-label" id={labelId}>
        {t('secciones.panel.cabecera.health.label')}
      </span>
      <ul aria-labelledby={labelId}>
        {list.map((s) => (
          <li key={s.project.id}>
            <Link to={`/proyectos/${s.project.slug}`} className="panel-health-name">
              <span className="dot" style={{ background: s.project.color }} aria-hidden="true" />
              {s.project.name}
            </Link>
            <HealthPill level={s.health.level} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** El botón principal: lo que se crea a diario, con los mismos formularios que «Nuevo». */
function CreateMenu() {
  const { hiddenSections } = usePreferences()
  const { create } = useUI()
  return (
    <Popover
      label={t('secciones.panel.cabecera.createMenu')}
      className="panel-create-menu"
      trigger={(p) => (
        <button type="button" className="btn btn-primary" onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup="menu">
          <Icon name="plus" size={16} /> {t('secciones.panel.cabecera.create')}
          <Icon name="chevronDown" size={14} />
        </button>
      )}
    >
      {(close) =>
        dashboardCreate(hiddenSections).map((q) => (
          <button
            key={q.id}
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              close()
              create(q.collection, q.defaults)
            }}
          >
            <Icon name={q.icon} size={16} /> {q.label}
          </button>
        ))
      }
    </Popover>
  )
}

interface Shortcut {
  id: string
  icon: IconName
  to?: string
  onClick?: () => void
}

/** Crear tarea, crear proyecto, registrar una nota, el Calendario y el buscador (lo que se puede aquí). */
function useShortcuts(): Shortcut[] {
  const { hiddenSections } = usePreferences()
  const canEdit = useCanEdit()
  const { create } = useUI()
  const { href } = useScope()
  const list: Shortcut[] = []
  if (canEdit) {
    list.push({ id: 'task', icon: 'check', onClick: () => create('items', { kind: 'task' }) })
    list.push({ id: 'project', icon: 'folder', onClick: () => create('projects') })
    if (!hiddenSections.includes('documentacion')) list.push({ id: 'note', icon: 'sticky', onClick: () => create('resources', { type: 'note' }) })
  }
  if (!hiddenSections.includes('calendario')) list.push({ id: 'calendar', icon: 'calendar', to: href('/calendario') })
  list.push({ id: 'search', icon: 'search', onClick: () => openSearch() })
  return list
}

const shortcutLabel = (s: Shortcut) => tr(`secciones.panel.cabecera.shortcuts.${s.id}`)

/** Los accesos rápidos como botones (en pantallas anchas). */
function ShortcutButtons() {
  const list = useShortcuts()
  return (
    <div className="panel-shortcuts" role="group" aria-label={t('secciones.panel.cabecera.shortcuts.label')}>
      {list.map((s) =>
        s.to ? (
          <Link key={s.id} to={s.to} className="btn btn-small btn-ghost">
            <Icon name={s.icon} size={14} /> {shortcutLabel(s)}
          </Link>
        ) : (
          <button key={s.id} type="button" className="btn btn-small btn-ghost" onClick={s.onClick}>
            <Icon name={s.icon} size={14} /> {shortcutLabel(s)}
          </button>
        ),
      )}
    </div>
  )
}

/** Los mismos accesos en un menú «Más», junto a «Crear» (en móvil). */
function ShortcutMenu() {
  const list = useShortcuts()
  return (
    <div className="panel-shortcuts-more">
      <Popover
        label={t('secciones.panel.cabecera.shortcuts.moreLabel')}
        trigger={(p) => (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={p.toggle}
            aria-expanded={p['aria-expanded']}
            aria-haspopup="menu"
            aria-label={t('secciones.panel.cabecera.shortcuts.moreLabel')}
          >
            {t('secciones.panel.cabecera.shortcuts.more')} <Icon name="chevronDown" size={14} />
          </button>
        )}
      >
        {(close) =>
          list.map((s) =>
            s.to ? (
              <Link key={s.id} to={s.to} role="menuitem" className="menu-item" onClick={close}>
                <Icon name={s.icon} size={16} /> {shortcutLabel(s)}
              </Link>
            ) : (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  close()
                  s.onClick?.()
                }}
              >
                <Icon name={s.icon} size={16} /> {shortcutLabel(s)}
              </button>
            ),
          )
        }
      </Popover>
    </div>
  )
}

function CustomizeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-ghost" onClick={onClick}>
      <Icon name="layout" size={16} /> {t('actions.customize')}
    </button>
  )
}

export function PanelHeader({ embedded, onCustomize }: { embedded?: boolean; onCustomize: () => void }) {
  const { scope, project } = useScope()
  const canEdit = useCanEdit()
  const [params] = useSearchParams()
  const nav = useSectionNav('panel')
  const ver = params.get('ver')
  const focus = ver ? PANEL_FOCUS[ver] : undefined

  // Modo foco: el título es el de la subsección (lo pone SectionHeader) y se vuelve al resumen.
  if (focus) {
    const summary = nav.section.children.find((c) => c.value === null)!
    return (
      <SectionHeader
        id="panel"
        embedded={embedded}
        subtitle={tr(`secciones.panel.views.${ver === 'proyectos' && scope ? 'proyectosOne' : ver}`)}
        actions={
          <Link to={nav.href(summary)} className="btn btn-ghost">
            <Icon name="chevronLeft" size={16} /> {t('secciones.panel.backToSummary')}
          </Link>
        }
      />
    )
  }

  // En la ficha de un proyecto: la cabecera es la del proyecto; aquí, el periodo y «Personalizar».
  if (embedded)
    return (
      <SectionHeader
        id="panel"
        embedded
        actions={
          <>
            <PeriodPicker />
            <CustomizeButton onClick={onCustomize} />
          </>
        }
      />
    )

  return (
    <>
      <SectionHeader
        id="panel"
        title={project ? t('secciones.panel.titleProject', { project: project.name }) : t('secciones.panel.title')}
        subtitle={<Greeting />}
        actions={
          <>
            <CustomizeButton onClick={onCustomize} />
            <ShortcutMenu />
            {canEdit && <CreateMenu />}
          </>
        }
      />
      <GamesHealth />
      <div className="panel-toolbar">
        <div className="panel-filters" role="group" aria-label={t('secciones.panel.cabecera.filters')}>
          <ProjectPicker />
          <PeriodPicker />
        </div>
        <ShortcutButtons />
      </div>
    </>
  )
}
