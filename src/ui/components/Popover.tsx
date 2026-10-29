import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Botón con un panel desplegable: se cierra al pulsar fuera, con Esc (devolviendo el foco
 * al botón) y al elegir algo. Como menú (por defecto), el foco entra en la primera opción
 * y se recorre con las flechas, Inicio y Fin; Tab lo cierra. Como diálogo (un panel con
 * contenido variado, como los avisos), el foco entra en lo primero que se puede pulsar.
 */
export function Popover({
  trigger,
  children,
  label,
  className,
  kind = 'menu',
}: {
  trigger: (props: { open: boolean; toggle: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' | 'dialog' }) => ReactNode
  children: (close: () => void) => ReactNode
  label: string
  className?: string
  kind?: 'menu' | 'dialog'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const triggerEl = () => ref.current?.querySelector<HTMLElement>('[aria-expanded]')
  // Al elegir algo, el foco vuelve al botón (si no, se quedaría en <body> al desaparecer el menú).
  const close = () => {
    setOpen(false)
    triggerEl()?.focus()
  }
  useEffect(() => {
    if (!open) return
    const items = () => [...(panel.current?.querySelectorAll<HTMLElement>(kind === 'menu' ? '[role="menuitem"]' : 'button, a[href]') ?? [])]
    items()[0]?.focus()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerEl()?.focus()
        return
      }
      if (kind !== 'menu' || !panel.current?.contains(document.activeElement)) return
      if (e.key === 'Tab') {
        setOpen(false)
        return
      }
      const list = items()
      const at = list.indexOf(document.activeElement as HTMLElement)
      const next =
        e.key === 'ArrowDown' ? (at + 1) % list.length
        : e.key === 'ArrowUp' ? (at - 1 + list.length) % list.length
        : e.key === 'Home' ? 0
        : e.key === 'End' ? list.length - 1
        : -1
      if (next < 0) return
      e.preventDefault()
      list[next]?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, kind])
  return (
    <div className="popover" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': kind })}
      {open && (
        <div ref={panel} className={`menu ${className ?? ''}`} role={kind} aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  )
}
