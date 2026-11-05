// Avisos y confirmaciones de toda la aplicación: avisos breves abajo a la derecha (con
// «Deshacer» cuando se puede), ventanas de confirmación propias en vez de window.confirm,
// y una pantalla de error que no deja al estudio sin salida.
//
// Los avisos con «Deshacer»:
// - duran más (UNDO_MS) y no se van mientras tienen el ratón encima o el foco dentro;
// - se deshacen también con Ctrl+Z (⌘Z en Mac) mientras se ven, fuera de los campos de texto
//   (ahí Ctrl+Z deshace lo escrito);
// - tras deshacer, el foco vuelve a donde estaba o, si ya no está, a lo que diga `returnFocus`;
// - los que salen con una ventana modal abierta (Personalizar, el editor…) se pintan dentro de
//   ella mientras siga abierta: si no, quedarían detrás y no se podrían pulsar. En pantallas
//   anchas van abajo a la izquierda, sobre el fondo, para no tapar los botones de la ventana.
import { Component, Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  /** Milisegundos; con acción dura más (UNDO_MS). Con el ratón encima o el foco dentro, no se va. */
  duration?: number
  /** La acción es «Deshacer» (Ctrl/Cmd+Z la pulsa). Si no se dice, lo es si se llama «Deshacer». */
  undo?: boolean
  /**
   * Adónde va el foco después de la acción si lo que lo tenía ya no está (un selector CSS: p. ej.
   * la fila que vuelve al deshacer). Si tampoco está, a quien lo tenía al salir el aviso o al contenido.
   */
  returnFocus?: string
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

/** Cuánto dura un aviso sin acción y uno con acción («Deshacer»). */
export const TOAST_MS = 4000
export const UNDO_MS = 12000
/** Lo que le queda, como poco, a un aviso al quitarle el ratón o el foco. */
const RESUME_MS = 3000

interface ToastState extends ToastOptions {
  id: number
  /** Quien tenía el foco cuando salió el aviso (para devolvérselo tras la acción). */
  opener: HTMLElement | null
  /** La ventana modal abierta cuando salió (se pinta dentro mientras siga abierta). */
  host: HTMLElement | null
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

const isUndo = (x: ToastOptions) => !!x.action && (x.undo ?? x.action.label === t('actions.undo'))

/** ¿Se usa con teclado y ratón (y no solo con el dedo)? Entonces se enseña el atajo. */
const finePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** La ventana modal abierta de más arriba (o ninguna). */
function topModal(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const open = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].filter((d) => {
    try {
      return d.matches(':modal')
    } catch {
      return true
    }
  })
  return open[open.length - 1] ?? null
}

const isOpenModal = (h: HTMLElement | null): h is HTMLDialogElement => h instanceof HTMLDialogElement && h.isConnected && h.open

/**
 * Un <dialog> modal deja inerte todo lo de fuera: los avisos que salen con él abierto tienen
 * que pintarse dentro. Esto vuelve a pintar los avisos cuando se abre o se cierra una ventana
 * (al cerrarse, los suyos vuelven a su sitio de siempre).
 */
function useModalChanges(): void {
  const [, setTop] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const find = () => setTop(topModal())
    find()
    const mo = new MutationObserver(find)
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    return () => mo.disconnect()
  }, [])
}

/** Una clave estable para la región de avisos de cada ventana. */
const hostKeys = new WeakMap<HTMLElement, number>()
let lastHostKey = 0
const hostKey = (h: HTMLElement) => {
  if (!hostKeys.has(h)) hostKeys.set(h, ++lastHostKey)
  return `ventana-${hostKeys.get(h)}`
}

/** Dentro de una ventana, en pantallas anchas: abajo a la izquierda (sobre el fondo, sin tapar sus botones). */
const IN_MODAL_STYLE = { left: 'var(--space-4)', right: 'auto' } as const

/** Un aviso: se va solo cuando le toca, salvo mientras tiene el ratón encima o el foco dentro. */
function ToastItem({
  toast: x,
  onDismiss,
  onClose,
  onAction,
}: {
  toast: ToastState
  /** Se acaba su tiempo. */
  onDismiss: () => void
  /** Se cierra con su botón (¿tenía el foco?). */
  onClose: (hadFocus: boolean) => void
  onAction: () => void
}) {
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false)
  const left = useRef(x.duration ?? (x.action ? UNDO_MS : TOAST_MS))
  const paused = hover || focused
  useEffect(() => {
    if (paused) return
    const start = Date.now()
    const id = window.setTimeout(onDismiss, left.current)
    return () => {
      window.clearTimeout(id)
      left.current = Math.max(RESUME_MS, left.current - (Date.now() - start))
    }
    // onDismiss cambia en cada render del proveedor: el temporizador solo depende de la pausa.
  }, [paused])
  const undo = isUndo(x)
  const keys = isMac() ? t('feedbackMsg.undoShortcutMac') : t('feedbackMsg.undoShortcut')
  return (
    <div
      className={`toast toast-${x.tone}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <Icon name={TOAST_ICON[x.tone ?? 'success']} size={16} />
      <span className="toast-text">{x.message}</span>
      {x.action && (
        <button
          type="button"
          className="btn btn-small btn-link"
          onClick={onAction}
          aria-keyshortcuts={undo ? 'Control+Z Meta+Z' : undefined}
          title={undo ? t('feedbackMsg.undoTitle', { keys }) : undefined}
        >
          {x.action.label}
          {undo && finePointer() && (
            <>
              {' '}
              <kbd aria-hidden="true">{keys}</kbd>
            </>
          )}
        </button>
      )}
      <button
        type="button"
        className="icon-btn small"
        aria-label={t('feedbackMsg.closeToast')}
        title={t('feedbackMsg.closeToast')}
        onClick={(e) => onClose(e.currentTarget.closest('.toast')?.contains(document.activeElement) ?? false)}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const nextId = useRef(1)
  const live = useRef<ToastState[]>([])
  live.current = toasts
  useModalChanges()

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), [])

  const toast = useCallback((o: ToastOptions | string) => {
    const opts = typeof o === 'string' ? { message: o } : o
    const id = nextId.current++
    const active = document.activeElement
    const opener = active instanceof HTMLElement && active !== document.body && !active.closest('.toast-region') ? active : null
    setToasts((list) => [...list.slice(-3), { tone: 'success', ...opts, id, opener, host: topModal() }])
  }, [])

  /** Tras quitar un aviso que tenía el foco: a lo restaurado, a quien lo tenía o al contenido (nunca a <body>). */
  const refocus = useCallback((x: ToastState) => {
    // Dos fotogramas: el de quitar el aviso y el de pintar lo restaurado.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const a = document.activeElement
        if (a instanceof HTMLElement && a !== document.body && a.isConnected && !a.closest('.toast-region')) return
        const target =
          (x.returnFocus ? document.querySelector<HTMLElement>(x.returnFocus) : null) ??
          (x.opener?.isConnected ? x.opener : null) ??
          document.getElementById('contenido')
        target?.focus()
      }),
    )
  }, [])

  /** Pulsa la acción de un aviso, lo quita y deja el foco en un sitio con sentido. */
  const runAction = useCallback(
    (x: ToastState) => {
      x.action?.onClick()
      dismiss(x.id)
      refocus(x)
    },
    [dismiss, refocus],
  )

  /** Cerrar un aviso con su botón: si tenía el foco, el foco vuelve a su sitio. */
  const close = useCallback(
    (x: ToastState, hadFocus: boolean) => {
      dismiss(x.id)
      if (hadFocus) refocus(x)
    },
    [dismiss, refocus],
  )

  // Ctrl/Cmd+Z: deshace lo del último aviso con «Deshacer» que se ve y se puede pulsar (fuera de
  // los campos de texto): con una ventana abierta, solo los que salieron en ella.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z' || isTyping(e.target)) return
      const here = topModal()
      const last = [...live.current].reverse().find((x) => isUndo(x) && (isOpenModal(x.host) ? x.host : null) === here)
      if (!last) return
      e.preventDefault()
      runAction(last)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runAction])

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), [])

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm])

  const closeConfirm = (ok: boolean) => {
    confirmState?.resolve(ok)
    setConfirmState(null)
  }

  // Los avisos, por dónde se pintan: fuera, o dentro de la ventana en la que salieron si sigue abierta.
  const groups = new Map<HTMLElement | null, ToastState[]>([[null, []]])
  for (const x of toasts) {
    const where = isOpenModal(x.host) ? x.host : null
    groups.set(where, [...(groups.get(where) ?? []), x])
  }
  const wide = typeof window !== 'undefined' && !window.matchMedia?.('(max-width: 640px)').matches
  const regionOf = (list: ToastState[], inModal: boolean) => (
    <div className="toast-region" role="status" aria-live="polite" style={inModal && wide ? IN_MODAL_STYLE : undefined}>
      {list.map((x) => (
        <ToastItem key={x.id} toast={x} onDismiss={() => dismiss(x.id)} onClose={(hadFocus) => close(x, hadFocus)} onAction={() => runAction(x)} />
      ))}
    </div>
  )

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {[...groups].map(([where, list]) => (where ? createPortal(regionOf(list, true), where, hostKey(where)) : <Fragment key="fuera">{regionOf(list, false)}</Fragment>))}
      <Modal
        open={!!confirmState}
        small
        title={confirmState?.title ?? ''}
        onClose={() => closeConfirm(false)}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => closeConfirm(false)}>
              {t('actions.cancel')}
            </button>
            <button type="button" className={confirmState?.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => closeConfirm(true)} autoFocus>
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

export interface UndoableOptions {
  /**
   * La foto de antes (store.snapshot()), si el cambio empezó antes de llamar aquí: p. ej. el
   * editor ya ha creado la tarea y aquí se enlaza el feedback. Deshacer vuelve a esa foto.
   */
  before?: ReturnType<typeof store.snapshot>
  /** Adónde va el foco al deshacer, si lo que lo tenía ya no está (ver ToastOptions.returnFocus). */
  returnFocus?: string
}

/**
 * Hace un cambio y avisa con «Deshacer». Deshacer vuelve al estado de antes solo si no
 * ha habido otros cambios entretanto (si no, lo dice en vez de pisarlos).
 */
export function useUndoable() {
  const { toast } = useNotify()
  return useCallback(
    (message: string, change: () => void, opts: UndoableOptions = {}) => {
      const before = opts.before ?? store.snapshot()
      change()
      const after = store.getData()
      toast({
        message,
        undo: true,
        returnFocus: opts.returnFocus,
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
