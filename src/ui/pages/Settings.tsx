// Ajustes: el estudio, el aspecto (tema, acento, densidad), el panel, idioma y región,
// las vistas guardadas y los datos. Lo de aspecto, panel, región y vistas se guarda en
// este navegador; lo del estudio y los datos, con los datos.
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONFIDENCES } from '../../domain/catalog'
import { DEFAULT_TIME_ZONE, nowISODateTime, todayISO } from '../../domain/dates'
import { LOCALES, t } from '../../i18n'
import { makeFormatter, type DateFormat } from '../../i18n/format'
import { SEED_VERSION } from '../../data/seed'
import { store, useCanEdit, useStoreMeta, useStoreStatus, useStudioData } from '../../data/store'
import { AreaTag, Pill } from '../components/Badges'
import { Button, Card, Field, FieldGroup, PageHeader } from '../components/Common'
import { Icon } from '../components/Icon'
import { useNotify } from '../feedback'
import { saveFile } from '../files'
import { useFormat } from '../hooks'
import { ACCENTS, resolvedTheme, resolveAccent, updatePreferences, usePreferences, type Density, type ThemePref, type WidgetId } from '../prefs'
import { WidgetOrderList } from './Overview'

const DATE_FORMATS: { id: DateFormat; label: string }[] = [
  { id: 'short', label: 'Corta' },
  { id: 'numeric', label: 'Numérica' },
  { id: 'long', label: 'Larga' },
  { id: 'iso', label: 'ISO' },
]

function timeZones(): string[] {
  const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  return list.includes(DEFAULT_TIME_ZONE) ? list : [DEFAULT_TIME_ZONE, ...list]
}

export function SettingsPage() {
  const data = useStudioData()
  const meta = useStoreMeta()
  const status = useStoreStatus()
  const canEdit = useCanEdit()
  const prefs = usePreferences()
  const fmt = useFormat()
  const { toast, confirm } = useNotify()
  const [name, setName] = useState(data.studio.name)
  const [tagline, setTagline] = useState(data.studio.tagline ?? '')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const zones = useMemo(timeZones, [])
  const theme = resolvedTheme(prefs.theme)
  const sample = '2026-10-18'

  const download = async () => {
    const result = await saveFile(`studio-hub-${todayISO()}.json`, store.exportJSON())
    if (result === 'saved') toast(t('feedbackMsg.exported'))
    else if (result === 'unavailable') toast({ message: t('feedbackMsg.exportUnavailable'), tone: 'danger' })
  }

  const importFile = async (file: File) => {
    setImporting(true)
    setImportErrors([])
    try {
      const raw = JSON.parse(await file.text())
      const errors = store.replaceAll(raw)
      setImportErrors(errors)
      if (!errors.length) toast(`${t('feedbackMsg.imported')} («${file.name}»)`)
    } catch {
      setImportErrors(['El fichero no es un JSON válido.'])
    } finally {
      setImporting(false)
    }
  }

  const counts: [string, number][] = [
    ['Proyectos', data.projects.length],
    ['Elementos de trabajo', data.items.length],
    ['Builds', data.builds.length],
    ['Eventos', data.events.length],
    ['Feedback', data.feedback.length],
    ['Recursos', data.resources.length],
    ['Listas de publicación', data.checklists.length],
    ['Registros de git', data.activity.length],
  ]

  const order = prefs.widgets.order
  const hidden = new Set(prefs.widgets.hidden)
  const moveWidget = (id: WidgetId, delta: number) => {
    const n = order.indexOf(id)
    const m = n + delta
    if (m < 0 || m >= order.length) return
    const next = [...order]
    ;[next[n], next[m]] = [next[m], next[n]]
    updatePreferences((p) => ({ widgets: { ...p.widgets, order: next } }))
  }
  const toggleWidget = (id: WidgetId) =>
    updatePreferences((p) => ({
      widgets: { ...p.widgets, hidden: p.widgets.hidden.includes(id) ? p.widgets.hidden.filter((x) => x !== id) : [...p.widgets.hidden, id] },
    }))

  return (
    <div className="page">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="grid grid-2">
        <Card title={t('settings.appearance')} icon="palette" subtitle={t('settings.savedLocally')}>
          <FieldGroup label={t('settings.theme')}>
            <div className="segmented" role="group" aria-label={t('settings.theme')}>
              {(
                [
                  ['dark', t('settings.themeDark'), 'moon'],
                  ['light', t('settings.themeLight'), 'sun'],
                  ['system', t('settings.themeSystem'), 'layout'],
                ] as [ThemePref, string, 'moon' | 'sun' | 'layout'][]
              ).map(([id, label, icon]) => (
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
              <label className={prefs.accent.startsWith('#') ? 'swatch-btn active' : 'swatch-btn'}>
                <input
                  type="color"
                  value={prefs.accent.startsWith('#') ? prefs.accent : resolveAccent(prefs.accent, theme).color}
                  onChange={(e) => updatePreferences({ accent: e.target.value })}
                  aria-label={t('settings.accentCustom')}
                  style={{ width: 22, height: 22, padding: 0, border: 0, borderRadius: '50%' }}
                />
                {t('settings.accentCustom')}
              </label>
            </div>
          </FieldGroup>
          <FieldGroup label={t('settings.density')}>
            <div className="segmented" role="group" aria-label={t('settings.density')}>
              {(
                [
                  ['comfortable', t('settings.densityComfortable')],
                  ['compact', t('settings.densityCompact')],
                ] as [Density, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" className={prefs.density === id ? 'active' : ''} aria-pressed={prefs.density === id} onClick={() => updatePreferences({ density: id })}>
                  {label}
                </button>
              ))}
            </div>
          </FieldGroup>
        </Card>

        <Card title={t('settings.region')} icon="globe" subtitle={t('settings.savedLocally')}>
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
            <Field label={t('settings.timeZone')} hint={`${t('settings.timeZoneHint')} Ahora: ${fmt.dateTime(nowISODateTime(prefs.timeZone))}`}>
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
                  <option key={d.id} value={d.id}>
                    {d.label} — {makeFormatter({ locale: LOCALES[prefs.locale].intl, dateFormat: d.id, hourCycle: prefs.hourCycle, noDate: '' }).date(sample)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('settings.hourCycle')}>
              <select value={prefs.hourCycle} onChange={(e) => updatePreferences({ hourCycle: e.target.value === 'h12' ? 'h12' : 'h23' })}>
                <option value="h23">24 horas (17:30)</option>
                <option value="h12">12 horas (5:30 p. m.)</option>
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
      </div>

      <div className="grid grid-2">
        <Card
          title={t('customize.title')}
          icon="layout"
          subtitle={t('customize.intro')}
          action={
            <button type="button" className="btn btn-small btn-ghost" onClick={() => updatePreferences((p) => ({ widgets: { ...p.widgets, hidden: [] } }))}>
              Mostrar todo
            </button>
          }
        >
          <WidgetOrderList order={order} hidden={hidden} onMove={moveWidget} onToggle={toggleWidget} />
        </Card>

        <div className="stack">
          <Card title={t('settings.savedViews')} icon="bookmark">
            {prefs.savedViews.length === 0 ? (
              <p className="muted">{t('settings.savedViewsEmpty')}</p>
            ) : (
              <ul className="view-list">
                {prefs.savedViews.map((v) => (
                  <li key={v.id}>
                    <Icon name="bookmark" size={15} />
                    <input
                      aria-label="Nombre de la vista"
                      value={v.name}
                      onChange={(e) => updatePreferences((p) => ({ savedViews: p.savedViews.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)) }))}
                    />
                    <Link to={v.path} className="btn btn-small btn-ghost">
                      Abrir
                    </Link>
                    <button
                      type="button"
                      className="icon-btn small"
                      aria-label={`Borrar la vista «${v.name}»`}
                      onClick={() => updatePreferences((p) => ({ savedViews: p.savedViews.filter((x) => x.id !== v.id) }))}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="El estudio" icon="home">
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault()
                store.updateStudio({ name: name.trim() || 'Mi estudio', tagline: tagline.trim() || undefined })
                toast(t('feedbackMsg.saved'))
              }}
            >
              <div className="span-2">
                <Field label="Nombre del estudio">
                  <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
                </Field>
              </div>
              <div className="span-2">
                <Field label="Lema o descripción corta">
                  <input value={tagline} onChange={(e) => setTagline(e.target.value)} disabled={!canEdit} />
                </Field>
              </div>
              {canEdit && (
                <div>
                  <button type="submit" className="btn btn-primary">
                    {t('actions.save')}
                  </button>
                </div>
              )}
            </form>
          </Card>
        </div>
      </div>

      <Card
        title="Datos"
        icon="box"
        subtitle={status.remote ? t('remote.dataCardSubtitle') : 'Se guardan en este navegador; exporta una copia para tenerla a salvo o llevarla a otro equipo'}
      >
        <dl className="data-counts">
          {counts.map(([l, n]) => (
            <div key={l}>
              <dt>{l}</dt>
              <dd>{fmt.number(n)}</dd>
            </div>
          ))}
        </dl>
        {!status.remote && (
          <p className="muted small">
            Datos iniciales: versión {meta.seedVersion}
            {meta.savedAt ? ` · último guardado: ${fmt.dateTime(meta.savedAt)}` : ' · aún sin cambios guardados'} · {meta.edited.length} elementos editados a mano.
          </p>
        )}
        <div className="button-row">
          <button type="button" className="btn" onClick={download}>
            <Icon name="download" size={16} /> Exportar copia (JSON)
          </button>
          {canEdit && (
            <Button
              className="btn"
              loading={importing}
              onClick={async () => {
                if (await confirm({ title: '¿Importar una copia?', message: 'Sustituye todos los datos actuales por los del fichero.', confirmLabel: 'Elegir fichero' }))
                  fileRef.current?.click()
              }}
            >
              <Icon name="upload" size={16} /> Importar copia
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importFile(f)
              e.target.value = ''
            }}
          />
          {!status.remote && meta.seedVersion !== SEED_VERSION && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                store.applySeedUpdate()
                toast('Datos iniciales actualizados. Lo editado a mano se ha respetado.')
              }}
            >
              Traer los datos iniciales nuevos ({SEED_VERSION})
            </button>
          )}
          {!status.remote && (
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={async () => {
                if (
                  await confirm({
                    title: '¿Volver a los datos iniciales?',
                    message: 'Se pierden los cambios hechos en este navegador. Exporta antes una copia si la quieres.',
                    confirmLabel: 'Volver a los iniciales',
                    danger: true,
                  })
                ) {
                  store.resetToSeed()
                  toast('Datos iniciales restaurados.')
                }
              }}
            >
              Volver a los datos iniciales
            </button>
          )}
        </div>
        {importErrors.length > 0 && (
          <div className="notice notice-danger" role="alert">
            <strong>No se ha importado: el fichero tiene {importErrors.length} problemas.</strong>
            <ul>
              {importErrors.slice(0, 12).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid grid-2">
        <Card title="Fiabilidad de los datos" icon="question" subtitle="Cada dato dice de dónde sale">
          <ul className="legend-list">
            {Object.entries(CONFIDENCES).map(([k, c]) => (
              <li key={k}>
                <Pill tone={c.tone}>{c.label}</Pill> {c.hint}
              </li>
            ))}
          </ul>
          <p className="muted small">
            Nada de ventas, jugadores, fechas de ferias ni estados de Steam se da por bueno sin fuente: lo que no se ha podido comprobar sale como «Sin confirmar» o «Por
            confirmar».
          </p>
        </Card>
        <Card title="Áreas de trabajo" icon="list" subtitle="Las mismas para todos los proyectos">
          <ul className="area-list">
            {data.areas.map((a) => (
              <li key={a.id}>
                <AreaTag area={a} />
                <span className="muted small">{a.description}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
