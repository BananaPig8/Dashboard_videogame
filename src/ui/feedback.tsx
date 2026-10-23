// Avisos y confirmaciones de toda la aplicación: avisos breves abajo a la derecha (con
// «Deshacer» cuando se puede), ventanas de confirmación propias en vez de window.confirm,
// y una pantalla de error que no deja al estudio sin salida.
import { Component, createContext, useCallback, useContext, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n'
import { store } from '../data/store'
import { todayISO } from '../domain/dates'
import { Modal } from './components/Common'
import { saveFile } from './files'
import { Icon, type IconName } from './components/Icon'

type ToastTone = 'success' | 'danger' | 'info' | 'warning'

export interface ToastOptions {
  message: string
  tone?: ToastTone
  action?: { label: string; onClick: () => void }
  /** Milisegundos; con acción dura más. */
  duration?: number
}

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

interface FeedbackApi {
  toast: (o: ToastOptions | string) => void
  confirm: (o: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

export function useNotify(): FeedbackApi {
  const api = useContext(FeedbackContext)
  if (!api) throw new Error('useNotify fuera de FeedbackProvider')
  return api
}

const TOAST_ICON: Record<ToastTone, IconName> = { success: 'check', danger: 'alert', info: 'info', warning: 'alert' }

interface ToastState extends ToastOptions {
  id: number
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (o: ToastOptions | string) => {
      const opts = typeof o === 'string' ? { message: o } : o
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { tone: 'success', ...opts, id }])
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 7000 : 3500))
    },
    [dismiss],
  )

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), [])

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm])

  const close = (ok: boolean) => {
    confirmState?.resolve(ok)
    setConfirmState(null)
  }

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.tone}`}>
            <Icon name={TOAST_ICON[x.tone ?? 'success']} size={16} />
            <span className="toast-text">{x.message}</span>
            {x.action && (
              <button
                type="button"
                className="btn btn-small btn-link"
                onClick={() => {
                  x.action!.onClick()
                  dismiss(x.id)
                }}
              >
                {x.action.label}
              </button>
            )}
            <button type="button" className="icon-btn small" aria-label={t('actions.close')} onClick={() => dismiss(x.id)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
      <Modal
        open={!!confirmState}
        small
        title={confirmState?.title ?? ''}
        onClose={() => close(false)}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => close(false)}>
              {t('actions.cancel')}
            </button>
            <button type="button" className={confirmState?.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => close(true)} autoFocus>
              {confirmState?.confirmLabel ?? t('actions.confirm')}
            </button>
          </>
        }
      >
        {confirmState?.message && <div className="muted">{confirmState.message}</div>}
      </Modal>
    </FeedbackContext.Provider>
  )
}

/**
 * Hace un cambio y avisa con «Deshacer». Deshacer vuelve al estado de antes solo si no
 * ha habido otros cambios entretanto (si no, lo dice en vez de pisarlos).
 */
export function useUndoable() {
  const { toast } = useNotify()
  return useCallback(
    (message: string, change: () => void) => {
      const before = store.snapshot()
      change()
      const after = store.getData()
      toast({
        message,
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
    },
    [toast],
  )
}

// ——— Pantalla de error ———————————————————————————————————————————————————————

interface BoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Studio Hub:', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Al cambiar de pantalla se vuelve a intentar.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const backup = () => void saveFile(`studio-hub-copia-${todayISO()}.json`, store.exportJSON())
    return (
      <div className="error-box" role="alert">
        <h1>
          <Icon name="alert" size={20} /> {t('errors.title')}
        </h1>
        <p className="muted">{t('errors.body')}</p>
        <div className="button-row">
          <a className="btn btn-primary" href="#/" onClick={() => this.setState({ error: null })}>
            {t('errors.backHome')}
          </a>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            {t('actions.reload')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={backup}>
            <Icon name="download" size={16} /> {t('errors.exportBackup')}
          </button>
        </div>
        <details>
          <summary className="small muted">{t('errors.details')}</summary>
          <pre>{error.message}</pre>
        </details>
      </div>
    )
  }
}

/** Esqueleto mientras se carga una pantalla. */
export function PageSkeleton() {
  return (
    <div className="page skeleton" aria-busy="true" aria-label={t('app.loading')}>
      <div className="skeleton-block" style={{ height: 44, width: '40%' }} />
      <div className="grid grid-2">
        <div className="skeleton-block" style={{ height: 180 }} />
        <div className="skeleton-block" style={{ height: 180 }} />
      </div>
      <div className="skeleton-block" style={{ height: 240 }} />
    </div>
  )
}
