import { useRef, useState } from 'react'
import { CONFIDENCES } from '../../domain/catalog'
import { formatDateTime, todayISO } from '../../domain/dates'
import { store, useStoreMeta, useStudioData } from '../../data/store'
import { SEED_VERSION } from '../../data/seed'
import { AreaTag, Pill } from '../components/Badges'
import { Card, Field, PageHeader } from '../components/Common'
import { Icon } from '../components/Icon'
import { getTheme, setTheme, type Theme } from '../theme'

export function SettingsPage() {
  const data = useStudioData()
  const meta = useStoreMeta()
  const [name, setName] = useState(data.studio.name)
  const [tagline, setTagline] = useState(data.studio.tagline ?? '')
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studio-hub-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File) => {
    setMessage('')
    try {
      const raw = JSON.parse(await file.text())
      const errors = store.replaceAll(raw)
      setImportErrors(errors)
      if (!errors.length) setMessage(`Datos importados de «${file.name}».`)
    } catch {
      setImportErrors(['El fichero no es un JSON válido.'])
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

  return (
    <div className="page">
      <PageHeader title="Ajustes y datos" subtitle="El estudio, el aspecto y dónde viven los datos" />
      <div className="grid grid-2">
        <Card title="El estudio" icon="home">
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              store.updateStudio({ name: name.trim() || 'Mi estudio', tagline: tagline.trim() || undefined })
              setMessage('Estudio guardado.')
            }}
          >
            <div className="span-2">
              <Field label="Nombre del estudio">
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
            <div className="span-2">
              <Field label="Lema o descripción corta">
                <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </Field>
            </div>
            <div>
              <button type="submit" className="btn btn-primary">
                Guardar
              </button>
            </div>
          </form>
        </Card>
        <Card title="Aspecto" icon="moon">
          <div className="segmented" role="group" aria-label="Tema">
            {(
              [
                ['auto', 'Como el sistema'],
                ['light', 'Claro'],
                ['dark', 'Oscuro'],
              ] as [Theme, string][]
            ).map(([t, l]) => (
              <button
                key={t}
                type="button"
                className={theme === t ? 'active' : ''}
                aria-pressed={theme === t}
                onClick={() => {
                  setTheme(t)
                  setThemeState(t)
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="muted small">Se recuerda en este navegador.</p>
        </Card>
      </div>

      {message && (
        <p className="notice" role="status">
          <Icon name="check" size={16} /> {message}
        </p>
      )}

      <Card title="Datos" icon="box" subtitle="Se guardan en este navegador; expórtalos para tener copia o llevarlos a otro equipo">
        <dl className="data-counts">
          {counts.map(([l, n]) => (
            <div key={l}>
              <dt>{l}</dt>
              <dd>{n}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">
          Datos iniciales: versión {meta.seedVersion}
          {meta.savedAt ? ` · último guardado: ${formatDateTime(meta.savedAt)}` : ' · aún sin cambios guardados'} · {meta.edited.length} elementos editados a mano.
        </p>
        <div className="button-row">
          <button type="button" className="btn" onClick={download}>
            <Icon name="download" size={16} /> Exportar copia (JSON)
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Importar copia
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f && window.confirm('Importar sustituye todos los datos actuales. ¿Seguir?')) importFile(f)
              e.target.value = ''
            }}
          />
          {meta.seedVersion !== SEED_VERSION && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                store.applySeedUpdate()
                setMessage('Datos iniciales actualizados. Lo que habías editado a mano se ha respetado.')
              }}
            >
              Traer los datos iniciales nuevos ({SEED_VERSION})
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => {
              if (window.confirm('Esto borra tus cambios y vuelve a los datos iniciales. ¿Seguir? (Exporta antes una copia si la quieres.)')) {
                store.resetToSeed()
                setMessage('Datos iniciales restaurados.')
              }
            }}
          >
            Volver a los datos iniciales
          </button>
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
            Nada de ventas, jugadores, fechas de ferias ni estados de Steam se da por bueno sin fuente: lo que no se ha podido comprobar sale como «Sin confirmar» o
            «Por confirmar».
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
