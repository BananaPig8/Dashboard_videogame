// La campana de la barra superior: lo vencido, lo que vence hoy, las ferias que se acercan,
// los bloqueos importantes y el feedback sin revisar. Se calculan de los datos (no hay
// servicio de avisos); «leído» se recuerda en este navegador.
import { useMemo } from 'react'
import { notificationsFor, type StudioNotification } from '../domain/selectors'
import { t, type MessageKey } from '../i18n'
import { SEED_VERSION } from '../data/seed'
import { store, useStoreMeta, useStudioData } from '../data/store'
import { Icon, type IconName } from './components/Icon'
import { Popover } from './components/Popover'
import { useUI } from './context'
import { useFormat, useToday } from './hooks'
import { updatePreferences, usePreferences } from './prefs'
import { useNotify } from './feedback'

const ICON: Record<StudioNotification['kind'], IconName> = {
  overdue: 'clock',
  dueToday: 'clock',
  eventSoon: 'calendar',
  eventStale: 'question',
  blocked: 'lock',
  newFeedback: 'message',
  reminder: 'bell',
  registrationSoon: 'ticket',
  releaseSoon: 'rocket',
  releaseLate: 'question',
  budgetOver: 'wallet',
}

const TITLE: Record<StudioNotification['kind'], MessageKey> = {
  overdue: 'notifications.overdue',
  dueToday: 'notifications.dueToday',
  eventSoon: 'notifications.eventSoon',
  eventStale: 'notifications.eventStale',
  blocked: 'notifications.blocked',
  newFeedback: 'notifications.newFeedback',
  reminder: 'notifications.reminder',
  registrationSoon: 'notifications.registrationSoon',
  releaseSoon: 'notifications.releaseSoon',
  releaseLate: 'notifications.releaseLate',
  budgetOver: 'notifications.budgetOver',
}

/** Los avisos que hablan de una fecha prevista: sin confirmar, cambian de texto (no la dan por cierta). */
const UNCONFIRMED: Partial<Record<StudioNotification['kind'], MessageKey>> = {
  eventSoon: 'notifications.unconfirmed.eventSoon',
  eventStale: 'notifications.unconfirmed.eventStale',
  registrationSoon: 'notifications.unconfirmed.registrationSoon',
  releaseSoon: 'notifications.unconfirmed.releaseSoon',
  releaseLate: 'notifications.unconfirmed.releaseLate',
}

/** El texto de un aviso (campana y Panel): «{title}, {when}», o su versión sin confirmar. */
export function notificationText(n: StudioNotification, when: string): string {
  const key = (!n.confirmed && UNCONFIRMED[n.kind]) || TITLE[n.kind]
  return t(key, { title: n.title, when })
}

export function NotificationsMenu() {
  const data = useStudioData()
  const meta = useStoreMeta()
  const prefs = usePreferences()
  const today = useToday()
  const fmt = useFormat()
  const { edit } = useUI()
  const { toast } = useNotify()
  const list = useMemo(() => notificationsFor(data, today), [data, today])
  const read = new Set(prefs.readNotifications)
  const seedUpdate = meta.seedVersion !== SEED_VERSION
  const unread = list.filter((n) => !read.has(n.id)).length + (seedUpdate ? 1 : 0)

  const markAll = () => updatePreferences((p) => ({ readNotifications: [...new Set([...p.readNotifications, ...list.map((n) => n.id)])] }))

  return (
    <Popover
      kind="dialog"
      label={t('notifications.title')}
      className="notif-panel"
      trigger={(p) => (
        <button
          type="button"
          className="icon-btn"
          onClick={p.toggle}
          aria-expanded={p['aria-expanded']}
          aria-haspopup="dialog"
          aria-label={`${t('topbar.notifications')}${unread ? ` (${unread})` : ''}`}
          title={t('topbar.notifications')}
        >
          <Icon name="bell" size={18} />
          {unread > 0 && <span className="badge-count">{unread > 99 ? '99+' : unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="notif-head">
            <h2>{t('notifications.title')}</h2>
            {list.length > 0 && (
              <button type="button" className="btn btn-small btn-link" onClick={markAll}>
                {t('actions.markAllRead')}
              </button>
            )}
          </div>
          <ul className="notif-list">
            {seedUpdate && (
              <li>
                <button
                  type="button"
                  className="notif-item unread"
                  onClick={() => {
                    store.applySeedUpdate()
                    toast(t('feedbackMsg.saved'))
                    close()
                  }}
                >
                  <Icon name="download" size={16} />
                  <span className="notif-title">{t('notifications.seedUpdate', { version: SEED_VERSION })}</span>
                </button>
              </li>
            )}
            {list.length === 0 && !seedUpdate && (
              <li className="empty">
                {t('notifications.empty')}
              </li>
            )}
            {list.map((n) => {
              const unreadItem = !read.has(n.id)
              const when = n.date ? fmt.relative(n.date, today) : ''
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif-item ${unreadItem ? 'unread' : ''}`}
                    onClick={() => {
                      updatePreferences((p) => ({ readNotifications: [...p.readNotifications, n.id] }))
                      edit({ collection: n.target.collection, id: n.target.id })
                      close()
                    }}
                  >
                    <span className={`tone-${n.tone}`} style={{ background: 'transparent' }}>
                      <Icon name={ICON[n.kind]} size={16} />
                    </span>
                    <span>
                      <span className="notif-title">{notificationText(n, when)}</span>
                      {n.date && (
                        <span className="meta-date">
                          {' '}
                          · {fmt.date(n.date)}
                        </span>
                      )}
                    </span>
                    {unreadItem && <span className="notif-dot" role="img" aria-label={t('notifications.unread')} />}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Popover>
  )
}
