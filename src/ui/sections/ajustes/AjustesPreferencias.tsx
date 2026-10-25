// Ajustes › Preferencias: lo de quien usa este navegador (aspecto, idioma y región, el panel,
// las vistas guardadas, las secciones de la barra lateral y quién eres). No va con los datos
// del estudio: cada persona tiene las suyas (ui/prefs.ts).
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_TIME_ZONE, nowISODateTime } from '../../../domain/dates'
import { LOCALES, t } from '../../../i18n'
import { makeFormatter, type DateFormat } from '../../../i18n/format'
import { Card, Field, FieldGroup } from '../../components/Common'
import { Icon, type IconName } from '../../components/Icon'
import { MePicker, useMe } from '../../components/MePicker'
import { useFormat } from '../../hooks'
import { allSections } from '../../navigation'
import { ACCENTS, resolvedTheme, resolveAccent, updatePreferences, usePreferences, type Density, type ThemePref, type WidgetId } from '../../prefs'
import { WidgetOrderList } from '../panel/PanelWidgets'

const DATE_FORMATS: DateFormat[] = ['short', 'numeric', 'long', 'iso']

/** Una fecha de ejemplo para enseñar cada formato. */
const SAMPLE_DATE = '2026-10-18'

function timeZones(): string[] {
  const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  return list.includes(DEFAULT_TIME_ZONE) ? list : [DEFAULT_TIME_ZONE, ...list]
}

export function AjustesPreferencias() {
  return (
    <>
      <div className="grid grid-2 ajustes-grid">
        <Apariencia />
        <Region />
      </div>
      <div className="grid grid-2 ajustes-grid">
        <BarraLateral />
        <div className="stack">
          <QuienEres />
          <VistasGuardadas />
        </div>
      </div>
      <Panel />
    </>
  )
}

function Apariencia() {
  const prefs = usePreferences()
  const theme = resolvedTheme(prefs.theme)
  const themes: [ThemePref, string, IconName][] = [
    ['dark', t('settings.themeDark'), 'moon'],
    ['light', t('settings.themeLight'), 'sun'],
    ['system', t('settings.themeSystem'), 'layout'],
  ]
  const densities: [Density, string][] = [
    ['comfortable', t('settings.densityComfortable')],
    ['compact', t('settings.densityCompact')],
  ]
  const custom = prefs.accent.startsWith('#')
  return (
    <Card title={t('settings.appearance')} icon="palette" subtitle={t('secciones.ajustes.preferencias.savedHere')}>
      <FieldGroup label={t('settings.theme')}>
        <div className="segmented" role="group" aria-label={t('settings.theme')}>
          {themes.map(([id, label, icon]) => (
            <button key={id} type="button" className={prefs.theme === id ? 'active' : ''} aria-pressed={prefs.theme === id} onClick={() => updatePreferences({ theme: id })}>
              <Icon name={icon} size={15} /> {label}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label={t('settings.accent')}>
        <div className="swatches" role="group" aria-label={t('settings.accent')}>
          {Object.entries(ACCENTS).map(([id, a]) => (
            <button key={id} type="button" className="swatch-btn" aria-pressed={prefs.accent === id} onClick={() => updatePreferences({ accent: id })}>
              <span className="swatch-dot" style={{ background: a[theme] }} aria-hidden="true" />
              {a.name}
            </button>
          ))}
          <label className={custom ? 'swatch-btn active' : 'swatch-btn'}>
            <input
              type="color"
              className="ajustes-color"
              value={custom ? prefs.accent : resolveAccent(prefs.accent, theme).color}
              onChange={(e) => updatePreferences({ accent: e.target.value })}
              aria-label={t('settings.accentCustom')}
            />
            {t('settings.accentCustom')}
          </label>
        </div>
      </FieldGroup>
      <FieldGroup label={t('settings.density')}>
        <div className="segmented" role="group" aria-label={t('settings.density')}>
          {densities.map(([id, label]) => (
            <button key={id} type="button" className={prefs.density === id ? 'active' : ''} aria-pressed={prefs.density === id} onClick={() => updatePreferences({ density: id })}>
              {label}
            </button>
          ))}
        </div>
      </FieldGroup>
    </Card>
  )
}

function Region() {
  const prefs = usePreferences()
  const fmt = useFormat()
  const zones = useMemo(timeZones, [])
  return (
    <Card title={t('settings.region')} icon="globe" subtitle={t('secciones.ajustes.preferencias.savedHere')}>
      <div className="settings-grid">
        <Field label={t('settings.language')}>
          <select value={prefs.locale} onChange={(e) => updatePreferences({ locale: e.target.value as typeof prefs.locale })}>
            {Object.entries(LOCALES).map(([id, l]) => (
              <option key={id} value={id}>
                {l.name}
              </option>
            ))}
            <option value="en" disabled>
              {t('settings.languageSoon')}
            </option>
          </select>
        </Field>
        <Field
          label={t('settings.timeZone')}
          hint={`${t('settings.timeZoneHint')} ${t('secciones.ajustes.preferencias.now', { time: fmt.dateTime(nowISODateTime(prefs.timeZone)) })}`}
        >
          <select value={prefs.timeZone} onChange={(e) => updatePreferences({ timeZone: e.target.value })}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('settings.dateFormat')}>
          <select value={prefs.dateFormat} onChange={(e) => updatePreferences({ dateFormat: e.target.value as DateFormat })}>
            {DATE_FORMATS.map((d) => (
              <option key={d} value={d}>
                {t(`secciones.ajustes.preferencias.dateFormats.${d}`)} —{' '}
                {makeFormatter({ locale: LOCALES[prefs.locale].intl, dateFormat: d, hourCycle: prefs.hourCycle, noDate: '' }).date(SAMPLE_DATE)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('settings.hourCycle')}>
          <select value={prefs.hourCycle} onChange={(e) => updatePreferences({ hourCycle: e.target.value === 'h12' ? 'h12' : 'h23' })}>
            <option value="h23">{t('secciones.ajustes.preferencias.hour24')}</option>
            <option value="h12">{t('secciones.ajustes.preferencias.hour12')}</option>
          </select>
        </Field>
        <Field label={t('settings.weekStart')}>
          <select value={prefs.weekStart} onChange={(e) => updatePreferences({ weekStart: e.target.value === '0' ? 0 : 1 })}>
            <option value="1">{t('settings.monday')}</option>
            <option value="0">{t('settings.sunday')}</option>
          </select>
        </Field>
      </div>
    </Card>
  )
}

/** Casillas para las secciones opcionales (navigation.ts); las demás, siempre visibles. */
function BarraLateral() {
  const prefs = usePreferences()
  const sections = allSections()
  const hidden = new Set(prefs.hiddenSections)
  const hiddenCount = sections.filter((s) => s.optional && hidden.has(s.id)).length
  const toggle = (id: string) =>
    updatePreferences((p) => ({ hiddenSections: p.hiddenSections.includes(id) ? p.hiddenSections.filter((x) => x !== id) : [...p.hiddenSections, id] }))
  return (
    <Card
      title={t('secciones.ajustes.preferencias.sidebar')}
      icon="panelLeft"
      subtitle={hiddenCount ? t('secciones.ajustes.preferencias.hiddenCount', { n: hiddenCount }) : t('secciones.ajustes.preferencias.noneHidden')}
      action={
        hiddenCount > 0 && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => updatePreferences({ hiddenSections: [] })}>
            {t('secciones.ajustes.preferencias.showAll')}
          </button>
        )
      }
    >
      <p className="muted small ajustes-lead">{t('secciones.ajustes.preferencias.sidebarHint')}</p>
      <ul className="ajustes-checks">
        {sections.map((s) => (
          <li key={s.id}>
            <label className={s.optional ? undefined : 'ajustes-fixed'}>
              <input type="checkbox" checked={!s.optional || !hidden.has(s.id)} disabled={!s.optional} onChange={() => toggle(s.id)} />
              <Icon name={s.icon} size={15} />
              <span>{s.label}</span>
              {!s.optional && (
                <span className="muted small">
                  <Icon name="lock" size={12} /> {t('secciones.ajustes.preferencias.alwaysVisible')}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function QuienEres() {
  const me = useMe()
  return (
    <Card title={t('secciones.ajustes.preferencias.me')} icon="user" subtitle={t('secciones.ajustes.preferencias.meHint')}>
      {me && (
        <p className="ajustes-note">
          <Icon name="checkCircle" size={16} />
          <span>{t('secciones.ajustes.preferencias.meNow', { name: me.name })}</span>
        </p>
      )}
      <MePicker />
    </Card>
  )
}

function VistasGuardadas() {
  const prefs = usePreferences()
  return (
    <Card title={t('settings.savedViews')} icon="bookmark" subtitle={t('secciones.ajustes.preferencias.savedHere')}>
      {prefs.savedViews.length === 0 ? (
        <p className="muted small">{t('secciones.ajustes.preferencias.savedViewsEmpty')}</p>
      ) : (
        <ul className="view-list">
          {prefs.savedViews.map((v) => (
            <li key={v.id}>
              <Icon name="bookmark" size={15} />
              <input
                aria-label={t('secciones.ajustes.preferencias.viewName')}
                value={v.name}
                onChange={(e) => updatePreferences((p) => ({ savedViews: p.savedViews.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)) }))}
              />
              <Link to={v.path} className="btn btn-small btn-ghost">
                {t('secciones.ajustes.preferencias.openView')}
              </Link>
              <button
                type="button"
                className="icon-btn small"
                aria-label={t('secciones.ajustes.preferencias.deleteView', { name: v.name })}
                title={t('secciones.ajustes.preferencias.deleteView', { name: v.name })}
                onClick={() => updatePreferences((p) => ({ savedViews: p.savedViews.filter((x) => x.id !== v.id) }))}
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Panel() {
  const prefs = usePreferences()
  const order = prefs.widgets.order
  const hidden = new Set(prefs.widgets.hidden)
  const move = (id: WidgetId, delta: number) => {
    const n = order.indexOf(id)
    const m = n + delta
    if (m < 0 || m >= order.length) return
    const next = [...order]
    ;[next[n], next[m]] = [next[m], next[n]]
    updatePreferences((p) => ({ widgets: { ...p.widgets, order: next } }))
  }
  const toggle = (id: WidgetId) =>
    updatePreferences((p) => ({
      widgets: { ...p.widgets, hidden: p.widgets.hidden.includes(id) ? p.widgets.hidden.filter((x) => x !== id) : [...p.widgets.hidden, id] },
    }))
  return (
    <Card
      title={t('customize.title')}
      icon="layout"
      subtitle={t('customize.intro')}
      action={
        hidden.size > 0 && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => updatePreferences((p) => ({ widgets: { ...p.widgets, hidden: [] } }))}>
            {t('secciones.ajustes.preferencias.panelShowAll')}
          </button>
        )
      }
    >
      <WidgetOrderList order={order} hidden={hidden} onMove={move} onToggle={toggle} />
    </Card>
  )
}
