import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Tone } from '../../domain/catalog'
import { t } from '../../i18n'
import { Icon, type IconName } from './Icon'

export function Card({
  title,
  icon,
  subtitle,
  action,
  children,
  className,
  id,
  collapsed,
  onToggle,
}: {
  title?: ReactNode
  icon?: IconName
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  /** Si se pasa onToggle, la tarjeta se puede plegar. */
  collapsed?: boolean
  onToggle?: () => void
}) {
  const bodyId = useId()
  return (
    <section
      className={`card ${collapsed ? 'collapsed' : ''} ${className ?? ''}`}
      id={id}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      {(title || action || onToggle) && (
        <header className="card-head">
          <div className="card-title">
            {icon && <Icon name={icon} size={16} />}
            <h2>{title}</h2>
            {subtitle && !collapsed && <span className="card-subtitle">{subtitle}</span>}
          </div>
          <div className="card-action">
            {!collapsed && action}
            {onToggle && (
              <button
                type="button"
                className="icon-btn small"
                aria-expanded={!collapsed}
                aria-controls={bodyId}
                aria-label={collapsed ? t('actions.expand') : t('actions.collapse')}
                title={collapsed ? t('actions.expand') : t('actions.collapse')}
                onClick={onToggle}
              >
                <Icon name={collapsed ? 'chevronDown' : 'chevronUp'} size={16} />
              </button>
            )}
          </div>
        </header>
      )}
      <div className="card-body" id={bodyId}>
        {children}
      </div>
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  to,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: Tone
  to?: string
  icon?: IconName
}) {
  const body = (
    <>
      <span className="stat-value">
        {icon && <Icon name={icon} size={16} />}
        {value}
      </span>
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

/** Estado vacío: qué pasa y, si se puede, un botón para empezar. */
export function Empty({
  children,
  icon = 'check',
  action,
}: {
  children: ReactNode
  icon?: IconName
  action?: { label: string; onClick: () => void; icon?: IconName }
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={18} />
      <span>{children}</span>
      {action && (
        <button type="button" className="btn btn-small" onClick={action.onClick}>
          <Icon name={action.icon ?? 'plus'} size={14} /> {action.label}
        </button>
      )}
    </div>
  )
}

export function Progress({ ratio, label, tone = 'success' }: { ratio: number; label?: string; tone?: 'success' | 'info' | 'warning' }) {
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

/** Botón que enseña que está trabajando (y no se puede pulsar dos veces). */
export function Button({ loading, children, className = 'btn', disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button type="button" className={className} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
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
  small,
  className,
  hideHeader,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** Panel lateral en vez de ventana centrada. */
  side?: boolean
  small?: boolean
  className?: string
  hideHeader?: boolean
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
  const classes = ['modal', wide && 'modal-wide', side && 'modal-side', small && 'modal-small', className].filter(Boolean).join(' ')
  return (
    <dialog
      ref={ref}
      className={classes}
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
        <header className={hideHeader ? 'visually-hidden' : 'modal-head'}>
          <h2 id={titleId}>{title}</h2>
          {!hideHeader && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t('actions.close')}>
              <Icon name="close" />
            </button>
          )}
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
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          className={tab.id === active ? 'tab active' : 'tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint, error, id }: { label: string; children: ReactNode; hint?: string; error?: string; id?: string }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" id={id ? `${id}-error` : undefined}>
          <Icon name="alert" size={12} /> {error}
        </span>
      )}
    </label>
  )
}

/** Como Field, pero para grupos de botones: un <label> no puede envolver botones (les robaría el nombre). */
export function FieldGroup({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId()
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span className="field-label" id={id}>
        {label}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
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
