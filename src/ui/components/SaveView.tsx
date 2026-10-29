// «Guardar vista»: guarda la pantalla con sus filtros (la URL) para volver con un clic
// desde la barra lateral o la paleta.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { t } from '../../i18n'
import { newId } from '../../data/store'
import { useNotify } from '../feedback'
import { updatePreferences, usePreferences } from '../prefs'
import { Field, Modal } from './Common'
import { Icon } from './Icon'

export function SaveViewButton({ suggestedName }: { suggestedName: string }) {
  const location = useLocation()
  const { savedViews } = usePreferences()
  const { toast } = useNotify()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(suggestedName)
  const path = location.pathname + location.search
  const existing = savedViews.find((v) => v.path === path)

  const save = () => {
    const clean = name.trim()
    if (!clean) return
    updatePreferences((p) => ({ savedViews: [...p.savedViews, { id: newId('vista'), name: clean, path, createdAt: new Date().toISOString() }] }))
    setOpen(false)
    toast(t('feedbackMsg.viewSaved'))
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setName(suggestedName)
          setOpen(true)
        }}
        disabled={!!existing}
        title={existing ? `Ya está guardada como «${existing.name}»` : undefined}
      >
        <Icon name="bookmark" size={16} /> {existing ? existing.name : t('actions.saveView')}
      </button>
      <Modal
        open={open}
        small
        title={t('actions.saveView')}
        onClose={() => setOpen(false)}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              {t('actions.cancel')}
            </button>
            <button type="submit" form="save-view" className="btn btn-primary" disabled={!name.trim()}>
              {t('actions.save')}
            </button>
          </>
        }
      >
        <form
          id="save-view"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label={t('saveView.name')} hint={t('saveView.nameHint')}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </form>
      </Modal>
    </>
  )
}
