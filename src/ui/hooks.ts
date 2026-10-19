import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
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
