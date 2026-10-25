// Ajustes › Estados personalizables: cómo se llaman los estados de las tareas en este estudio
// (data.studio.statusLabels). Cambia el nombre, no el significado: AppShell aplica los
// nombres a todo el catálogo (setCatalogLabels) y los cálculos siguen usando el estado.
import { useState } from 'react'
import { STATUS_ORDER, STATUSES } from '../../../domain/catalog'
import { cleanStatusLabels, duplicatedStatusLabels } from '../../../domain/selectors'
import type { ItemStatus } from '../../../domain/types'
import { t, tr } from '../../../i18n'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { Pill, STATUS_ICON } from '../../components/Badges'
import { Card } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useUndoable } from '../../feedback'
import { joinList } from './comunes'

type Labels = Partial<Record<ItemStatus, string>>

/** Los nombres de siempre (los del idioma, sin los del estudio). */
const defaultLabels = () => Object.fromEntries(STATUS_ORDER.map((k) => [k, tr(`catalog.status.${k}`)])) as Record<ItemStatus, string>

export function AjustesEstados() {
  const data = useStudioData()
  const canEdit = useCanEdit()
  const undoable = useUndoable()
  const saved: Labels = data.studio.statusLabels ?? {}
  // Sin borrador, se enseña lo guardado (así «Deshacer» se ve al momento).
  const [draft, setDraft] = useState<Labels | null>(null)
  const value = draft ?? saved
  const defaults = defaultLabels()
  const finalName = (k: ItemStatus) => value[k]?.trim() || defaults[k]
  const duplicated = duplicatedStatusLabels(Object.fromEntries(STATUS_ORDER.map((k) => [k, finalName(k)])) as Record<ItemStatus, string>)
  const customCount = Object.keys(cleanStatusLabels(saved, defaults) ?? {}).length

  const save = () => {
    if (duplicated.length) return
    undoable(t('secciones.ajustes.estados.saved'), () => store.updateStudio({ statusLabels: cleanStatusLabels(value, defaults) }))
    setDraft(null)
  }
  const reset = () => {
    undoable(t('secciones.ajustes.estados.resetDone'), () => store.updateStudio({ statusLabels: undefined }))
    setDraft(null)
  }

  return (
    <div className="stack">
      <p className="ajustes-note">
        <Icon name="info" size={16} />
        <span>{t('secciones.ajustes.estados.intro')}</span>
      </p>
      <Card
        title={t('secciones.ajustes.estados.card')}
        icon="edit"
        subtitle={`${t('secciones.ajustes.estados.cardHint')} · ${
          customCount ? t('secciones.ajustes.estados.customCount', { n: customCount }) : t('secciones.ajustes.estados.noneCustom')
        }`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="table-wrap">
            <table className="table ajustes-estados">
              <caption className="visually-hidden">{t('secciones.ajustes.estados.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('secciones.ajustes.estados.colStatus')}</th>
                  <th scope="col">{t('secciones.ajustes.estados.colName')}</th>
                  <th scope="col">{t('secciones.ajustes.estados.colMeaning')}</th>
                  <th scope="col">{t('secciones.ajustes.estados.colPreview')}</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ORDER.map((k) => {
                  const s = STATUSES[k]
                  const repeated = duplicated.includes(k)
                  return (
                    <tr key={k}>
                      <th scope="row">
                        <Pill tone={s.tone} icon={STATUS_ICON[k]}>
                          {defaults[k]}
                        </Pill>
                      </th>
                      <td data-label={t('secciones.ajustes.estados.colName')}>
                        <input
                          className="ajustes-status-input"
                          value={value[k] ?? ''}
                          placeholder={defaults[k]}
                          maxLength={40}
                          disabled={!canEdit}
                          aria-label={t('secciones.ajustes.estados.nameFor', { status: defaults[k] })}
                          aria-invalid={repeated || undefined}
                          onChange={(e) => setDraft({ ...value, [k]: e.target.value })}
                        />
                      </td>
                      <td data-label={t('secciones.ajustes.estados.colMeaning')}>
                        <span className="small">{t(`secciones.ajustes.estados.meaning.${k}`)}</span>{' '}
                        <span className="muted small nowrap">
                          <Icon name={s.open ? 'circle' : 'checkCircle'} size={12} />{' '}
                          {s.open ? t('secciones.ajustes.estados.open') : t('secciones.ajustes.estados.closed')}
                        </span>
                      </td>
                      <td data-label={t('secciones.ajustes.estados.colPreview')}>
                        <Pill tone={s.tone} icon={STATUS_ICON[k]}>
                          {finalName(k)}
                        </Pill>
                        {repeated && (
                          <span className="ajustes-error small">
                            <Icon name="alert" size={12} /> {t('secciones.ajustes.estados.repeated')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {duplicated.length > 0 && (
            <p className="ajustes-error" role="alert">
              <Icon name="alert" size={14} /> {t('secciones.ajustes.estados.duplicated', { list: joinList([...new Set(duplicated.map((k) => `«${finalName(k)}»`))]) })}
            </p>
          )}
          {canEdit ? (
            <div className="button-row ajustes-actions">
              <button type="submit" className="btn btn-primary" disabled={!draft || duplicated.length > 0}>
                {t('secciones.ajustes.estados.save')}
              </button>
              {draft && (
                <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                  {t('actions.cancel')}
                </button>
              )}
              {customCount > 0 && (
                <button type="button" className="btn btn-ghost" onClick={reset}>
                  {t('secciones.ajustes.estados.reset')}
                </button>
              )}
            </div>
          ) : (
            <p className="muted small">{t('secciones.ajustes.estados.readOnly')}</p>
          )}
        </form>
      </Card>
    </div>
  )
}
