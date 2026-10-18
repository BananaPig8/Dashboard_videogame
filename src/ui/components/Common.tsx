import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Tone } from '../../domain/catalog'
import { Icon, type IconName } from './Icon'

export function Card({
  title,
  icon,
  subtitle,
  action,
  children,
  className,
  id,
}: {
  title?: ReactNode
  icon?: IconName
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section className={`card ${className ?? ''}`} id={id} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || action) && (
        <header className="card-head">
          <div className="card-title">
            {icon && <Icon name={icon} size={16} />}
            <h2>{title}</h2>
            {subtitle && <span className="card-subtitle">{subtitle}</span>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  to,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: Tone
  to?: string
}) {
  const body = (
    <>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  )
  return to ? (
    <Link className={`stat stat-${tone}`} to={to}>
      {body}
    </Link>
  ) : (
    <div className={`stat stat-${tone}`}>{body}</div>
  )
}

export function Empty({ children, icon = 'check' }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </div>
  )
}

export function Progress({ ratio, label, tone = 'success' }: { ratio: number; label?: string; tone?: Tone }) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100)
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`progress-fill tone-fill-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

/** Ventana modal accesible (con <dialog>): Esc y el fondo la cierran. */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
  side,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** Panel lateral en vez de ventana centrada. */
  side?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  if (!open) return null
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''} ${side ? 'modal-side' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-inner">
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </dialog>
  )
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[]
  active: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          className={t.id === active ? 'tab active' : 'tab'}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="ext-link">
      {children}
      <Icon name="external" size={12} />
    </a>
  )
}
