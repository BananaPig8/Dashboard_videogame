// Ajustes › Perfil del estudio: nombre, lema y moneda (ISO 4217). Cambiar la moneda no
// convierte los importes, y se avisa antes. Al lado, lo que lleva el estudio.
import { useMemo, useState } from 'react'
import { allTags, currencyOptions, isCurrencyCode, studioAmountCounts } from '../../../domain/selectors'
import { intlLocale, t } from '../../../i18n'
import { store, useCanEdit, useStudioData } from '../../../data/store'
import { Card, Field, Stat } from '../../components/Common'
import { Icon } from '../../components/Icon'
import { useNotify, useUndoable } from '../../feedback'
import { useFormat } from '../../hooks'
import { countsText, useAjustesHref } from './comunes'

interface Draft {
  name: string
  tagline: string
  currency: string
}

/** «EUR — Euro» (el nombre, si el navegador lo sabe). */
function currencyLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(intlLocale(), { type: 'currency' }).of(code)
    return name && name !== code ? `${code} — ${name.charAt(0).toUpperCase()}${name.slice(1)}` : code
  } catch {
    return code
  }
}

export function AjustesEstudio() {
  const data = useStudioData()
  const canEdit = useCanEdit()
  const fmt = useFormat()
  const { confirm } = useNotify()
  const undoable = useUndoable()
  const ajustesHref = useAjustesHref()
  const studio = data.studio
  const current = isCurrencyCode(studio.currency) ? studio.currency! : 'EUR'
  // Sin borrador, el formulario enseña lo guardado (así «Deshacer» se ve al momento).
  const [draft, setDraft] = useState<Draft | null>(null)
  const value: Draft = draft ?? { name: studio.name, tagline: studio.tagline ?? '', currency: current }
  const set = (changes: Partial<Draft>) => setDraft({ ...value, ...changes })
  const options = useMemo(() => currencyOptions(current).map((code) => ({ code, label: currencyLabel(code) })), [current])
  const amounts = studioAmountCounts(data)
  const amountList = countsText({ transactions: amounts.transactions, budgets: amounts.budgets })
  const tags = allTags(data).length
  const activeProjects = data.projects.filter((p) => p.stage !== 'archived').length
  const activeMembers = data.members.filter((m) => m.active).length

  const save = async () => {
    const changedCurrency = value.currency !== current
    if (changedCurrency && amountList) {
      const ok = await confirm({
        title: t('secciones.ajustes.estudio.confirmCurrencyTitle', { from: current, to: value.currency }),
        message: t('secciones.ajustes.estudio.confirmCurrencyBody', { list: amountList, from: current, to: value.currency }),
        confirmLabel: t('secciones.ajustes.estudio.confirmCurrencyOk'),
      })
      if (!ok) return
    }
    undoable(t('secciones.ajustes.estudio.saved'), () =>
      store.updateStudio({
        name: value.name.trim() || t('secciones.ajustes.estudio.namePlaceholder'),
        tagline: value.tagline.trim() || undefined,
        currency: value.currency,
      }),
    )
    setDraft(null)
  }

  return (
    <div className="grid grid-2-1 ajustes-grid">
      <Card title={t('secciones.ajustes.estudio.profile')} icon="home" subtitle={t('secciones.ajustes.estudio.profileHint')}>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="span-2">
            <Field label={t('secciones.ajustes.estudio.name')}>
              <input
                value={value.name}
                placeholder={t('secciones.ajustes.estudio.namePlaceholder')}
                onChange={(e) => set({ name: e.target.value })}
                disabled={!canEdit}
                autoComplete="organization"
              />
            </Field>
          </div>
          <div className="span-2">
            <Field label={t('secciones.ajustes.estudio.tagline')}>
              <input value={value.tagline} onChange={(e) => set({ tagline: e.target.value })} disabled={!canEdit} />
            </Field>
          </div>
          <div className="span-2">
            <Field label={t('secciones.ajustes.estudio.currency')} hint={t('secciones.ajustes.estudio.currencyHint')}>
              <select value={value.currency} onChange={(e) => set({ currency: e.target.value })} disabled={!canEdit}>
                {options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="span-2 ajustes-note ajustes-note-warning">
            <Icon name="alert" size={16} />
            <span>
              {t('secciones.ajustes.estudio.currencyWarning')}{' '}
              {amountList
                ? t('secciones.ajustes.estudio.currencyAmounts', { list: amountList, currency: current })
                : t('secciones.ajustes.estudio.currencyNoAmounts')}
            </span>
          </p>
          {canEdit ? (
            <div className="span-2 button-row">
              <button type="submit" className="btn btn-primary" disabled={!draft}>
                {t('actions.save')}
              </button>
              {draft && (
                <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                  {t('actions.cancel')}
                </button>
              )}
            </div>
          ) : (
            <p className="span-2 muted small">{t('secciones.ajustes.estudio.readOnly')}</p>
          )}
        </form>
      </Card>

      <Card title={t('secciones.ajustes.estudio.summary')} icon="layers" subtitle={t('secciones.ajustes.estudio.summaryHint')}>
        <div className="stats ajustes-stats">
          <Stat
            label={t('secciones.ajustes.estudio.projects')}
            value={fmt.number(data.projects.length)}
            hint={t('secciones.ajustes.estudio.projectsHint', { active: fmt.number(activeProjects) })}
            to="/proyectos"
            icon="folder"
          />
          <Stat label={t('secciones.ajustes.estudio.members')} value={fmt.number(activeMembers)} to="/equipo" icon="users" />
          <Stat label={t('secciones.ajustes.estudio.areas')} value={fmt.number(data.areas.length)} to={ajustesHref('categorias')} icon="list" />
          <Stat label={t('secciones.ajustes.estudio.tags')} value={fmt.number(tags)} to={ajustesHref('categorias')} icon="tag" />
        </div>
      </Card>
    </div>
  )
}
