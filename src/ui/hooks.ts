import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { todayISO } from '../domain/dates'
import type { ISODate } from '../domain/types'
import { LOCALES, t } from '../i18n'
import { makeFormatter, type Formatter } from '../i18n/format'
import { usePreferences } from './prefs'

/** Fechas y números con el idioma y el formato elegidos en Ajustes. */
export function useFormat(): Formatter {
  const p = usePreferences()
  return useMemo(
    () => makeFormatter({ locale: LOCALES[p.locale].intl, dateFormat: p.dateFormat, hourCycle: p.hourCycle, noDate: t('dates.none') }),
    [p.locale, p.dateFormat, p.hourCycle],
  )
}

/** «Hoy» en la zona horaria del estudio; cambia solo al pasar la medianoche. */
export function useToday(): ISODate {
  const { timeZone } = usePreferences()
  const [today, setToday] = useState(() => todayISO(timeZone))
  useEffect(() => {
    setToday(todayISO(timeZone))
    const id = window.setInterval(() => setToday(todayISO(timeZone)), 60_000)
    return () => window.clearInterval(id)
  }, [timeZone])
  return today
}

/** ¿Se cumple una consulta de medios? (p. ej. la anchura del móvil). Se actualiza al cambiar. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * El ancho real de un elemento (para dibujar gráficas a escala 1:1 y que los textos se lean
 * igual en una tarjeta ancha que en un móvil). `fallback` hasta que se mide.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/**
 * Lleva a la vista el elemento activo de una tira de pestañas con desplazamiento lateral
 * (sin mover la página). La tira tiene que ser su contenedor posicionado.
 */
export function scrollIntoStrip(strip: HTMLElement | null, item: HTMLElement | null) {
  if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return
  strip.scrollLeft = item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2
}
