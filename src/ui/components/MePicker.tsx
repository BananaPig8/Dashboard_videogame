// «¿Quién eres?»: la persona del equipo que usa este navegador (para «Mis tareas», el plan
// de hoy y asignar lo nuevo). Se guarda en las preferencias de este navegador.
import { useState } from 'react'
import { t } from '../../i18n'
import { useCanEdit, useStudioData } from '../../data/store'
import type { Member } from '../../domain/types'
import { useUI } from '../context'
import { updatePreferences, usePreferences } from '../prefs'
import { Icon } from './Icon'

/** La persona elegida como «yo», si sigue existiendo. */
export function useMe(): Member | undefined {
  const data = useStudioData()
  const { meId } = usePreferences()
  return meId ? data.members.find((m) => m.id === meId) : undefined
}

export function MePicker({ compact }: { compact?: boolean }) {
  const data = useStudioData()
  const canEdit = useCanEdit()
  const { create } = useUI()
  const me = useMe()
  const active = data.members.filter((m) => m.active)
  const [choice, setChoice] = useState(me?.id ?? active[0]?.id ?? '')
  return (
    <div className={compact ? 'me-picker compact' : 'me-picker'}>
      <p>
        <Icon name="users" size={16} /> {active.length ? t('me.question') : t('me.noMembers')}
      </p>
      {active.length > 0 && (
        <div className="me-picker-row">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label={t('me.select')}>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-small btn-primary" disabled={!choice} onClick={() => updatePreferences({ meId: choice })}>
            {t('me.thisIsMe')}
          </button>
        </div>
      )}
      {canEdit && (
        <button type="button" className="btn btn-small btn-ghost" onClick={() => create('members')}>
          <Icon name="plus" size={14} /> {active.length ? t('me.addSomeone') : t('me.createMine')}
        </button>
      )}
      {me && (
        <button type="button" className="btn btn-small btn-ghost" onClick={() => updatePreferences({ meId: undefined })}>
          {t('me.forget', { name: me.name })}
        </button>
      )}
    </div>
  )
}
