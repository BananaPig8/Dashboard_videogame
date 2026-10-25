// Ajustes › Exportación e importación: lo que hay guardado, exportar una copia (JSON),
// importar otra (sustituye todo, tras confirmarlo) y los datos iniciales. Importar y volver a
// los iniciales se pueden deshacer desde su aviso.
import { useRef, useState } from 'react'
import { settingsCollectionCounts } from '../../../domain/selectors'
import { todayISO } from '../../../domain/dates'
import { t, tr } from '../../../i18n'
import { SEED_VERSION } from '../../../data/seed'
import { store, useCanEdit, useStoreMeta, useStoreStatus, useStudioData } from '../../../data/store'
import { Button, Card } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useNotify, useUndoable } from '../../feedback'
import { saveFile } from '../../files'
import { useFormat } from '../../hooks'
import { joinList } from './comunes'

export function AjustesDatos() {
  const data = useStudioData()
  const meta = useStoreMeta()
  const status = useStoreStatus()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const { toast, confirm } = useNotify()
  const undoable = useUndoable()
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { filled, empty } = settingsCollectionCounts(data)
  const seedNew = !status.remote && meta.seedVersion !== SEED_VERSION

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
      // Si el fichero no vale, no cambia nada; si vale, el aviso ofrece «Deshacer» (como useUndoable).
      const before = store.snapshot()
      const errors = store.replaceAll(raw)
      if (errors.length) {
        setImportErrors(errors)
        return
      }
      const after = store.getData()
      toast({
        message: t('secciones.ajustes.datos.importedFrom', { file: file.name }),
        action: {
          label: t('actions.undo'),
          onClick: () => {
            if (store.getData() !== after) toast({ message: t('feedbackMsg.cannotUndo'), tone: 'warning' })
            else {
              store.restore(before)
              toast({ message: t('feedbackMsg.undone'), tone: 'info' })
            }
          },
        },
      })
    } catch {
      setImportErrors([t('secciones.ajustes.datos.invalidJson')])
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="grid grid-2-1 ajustes-grid">
      <Card
        title={t('secciones.ajustes.datos.counts')}
        icon="layers"
        subtitle={status.remote ? t('secciones.ajustes.datos.countsClaude') : t('secciones.ajustes.datos.countsLocal')}
      >
        <dl className="data-counts">
          {filled.map(([k, n]) => (
            <div key={k}>
              <dt>{capitalize(tr(`collectionNames.${k}.other`))}</dt>
              <dd>{fmt.number(n)}</dd>
            </div>
          ))}
        </dl>
        {empty.length > 0 && (
          <p className="muted small">{t('secciones.ajustes.datos.emptyCollections', { list: joinList(empty.map((k) => tr(`collectionNames.${k}.other`))) })}</p>
        )}
        {!status.remote && (
          <p className="muted small">
            {t('secciones.ajustes.datos.seedLine', { version: meta.seedVersion })} ·{' '}
            {meta.savedAt ? t('secciones.ajustes.datos.savedAt', { date: fmt.dateTime(meta.savedAt) }) : t('secciones.ajustes.datos.notSaved')} ·{' '}
            {t('secciones.ajustes.datos.edited', { n: fmt.number(meta.edited.length) })}
          </p>
        )}
      </Card>

      <div className="stack">
        <Card title={t('secciones.ajustes.datos.export')} icon="download">
          <p className="small ajustes-lead">{t('secciones.ajustes.datos.exportHint')}</p>
          <button type="button" className="btn" onClick={download}>
            <Icon name="download" size={16} /> {t('secciones.ajustes.datos.exportButton')}
          </button>
        </Card>

        <Card title={t('secciones.ajustes.datos.import')} icon="upload">
          {canEdit ? (
            <>
              <p className="small ajustes-lead">{t('secciones.ajustes.datos.importHint')}</p>
              <Button
                className="btn"
                loading={importing}
                onClick={async () => {
                  if (
                    await confirm({
                      title: t('secciones.ajustes.datos.confirmImportTitle'),
                      message: t('secciones.ajustes.datos.confirmImportBody'),
                      confirmLabel: t('secciones.ajustes.datos.chooseFile'),
                    })
                  )
                    fileRef.current?.click()
                }}
              >
                <Icon name="upload" size={16} /> {t('secciones.ajustes.datos.importButton')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importFile(f)
                  e.target.value = ''
                }}
              />
              {importErrors.length > 0 && (
                <div className="notice notice-danger ajustes-import-errors" role="alert">
                  <strong>{t('secciones.ajustes.datos.importProblems', { n: importErrors.length })}</strong>
                  <ul>
                    {importErrors.slice(0, 12).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="muted small">{t('secciones.ajustes.datos.importReadOnly')}</p>
          )}
        </Card>

        <Card title={t('secciones.ajustes.datos.seed')} icon="git" subtitle={status.remote ? undefined : t('secciones.ajustes.datos.seedHint')}>
          {status.remote ? (
            <p className="muted small">{t('secciones.ajustes.datos.seedClaude')}</p>
          ) : (
            <>
              <p className={seedNew ? 'ajustes-note ajustes-note-warning' : 'ajustes-note'}>
                <Icon name={seedNew ? 'download' : 'checkCircle'} size={16} />
                <span>
                  {seedNew
                    ? t('secciones.ajustes.datos.seedNew', { version: SEED_VERSION })
                    : t('secciones.ajustes.datos.seedUpToDate', { version: SEED_VERSION })}
                </span>
              </p>
              {canEdit && (
                <div className="button-row">
                  {seedNew && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => undoable(t('secciones.ajustes.datos.seedUpdated'), () => store.applySeedUpdate())}
                    >
                      <Icon name="download" size={16} /> {t('secciones.ajustes.datos.seedUpdate')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger-ghost"
                    onClick={async () => {
                      if (
                        await confirm({
                          title: t('secciones.ajustes.datos.confirmResetTitle'),
                          message: t('secciones.ajustes.datos.confirmResetBody'),
                          confirmLabel: t('secciones.ajustes.datos.confirmResetOk'),
                          danger: true,
                        })
                      )
                        undoable(t('secciones.ajustes.datos.resetDone'), () => store.resetToSeed())
                    }}
                  >
                    {t('secciones.ajustes.datos.reset')}
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
