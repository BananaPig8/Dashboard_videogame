// Prioridades de hoy: lo crítico, lo vencido, lo que vence y lo que impide seguir.
import { blockedItems, pausedItems, todayItems } from '../../../../domain/selectors'
import { t } from '../../../../i18n'
import { ItemList } from '../../../components/ItemList'
import { ReasonPill, ScopedMore, type WidgetProps } from './comunes'

export function TodayBody({ data, scope, today, year, focus }: WidgetProps) {
  const entries = todayItems(data, today, scope)
  const reasons = new Map(entries.map((e) => [e.item.id, e.reason]))
  return (
    <ItemList
      items={entries.map((e) => e.item)}
      data={data}
      showProject={!scope}
      limit={focus ? undefined : 7}
      year={year}
      hideStatus
      empty={t('secciones.panel.today.empty')}
      aside={(item) => <ReasonPill reason={reasons.get(item.id)!} />}
    />
  )
}

export function BlockedBody({ data, scope, year }: WidgetProps) {
  const blocked = blockedItems(data, scope)
  const paused = pausedItems(data, scope)
  return (
    <>
      <ItemList items={blocked} data={data} showProject={!scope} detail="blocked" year={year} empty={t('secciones.panel.blocked.none')} />
      {paused.length > 0 && (
        <details className="subsection">
          <summary>
            {t('secciones.panel.blocked.paused', { n: paused.length })} <span className="muted small">{t('secciones.panel.blocked.pausedHint')}</span>
          </summary>
          <ItemList items={paused} data={data} showProject={!scope} detail="blocked" year={year} />
        </details>
      )}
    </>
  )
}

export function PrioritiesBody(p: WidgetProps) {
  return (
    <>
      <TodayBody {...p} />
      <div className="subsection">
        <BlockedBody {...p} />
      </div>
    </>
  )
}

export function PrioritiesAction() {
  return <ScopedMore to="/tareas?vista=hoy" label={t('secciones.panel.today.plan')} />
}
