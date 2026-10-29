// Idiomas de la interfaz. Hoy solo castellano; la estructura está lista para el inglés:
// basta un diccionario con el tipo Messages y su entrada en LOCALES.
import { es, type Messages } from './es'

export type Locale = 'es'

export const LOCALES: Record<Locale, { name: string; intl: string; messages: Messages }> = {
  es: { name: 'Español', intl: 'es-ES', messages: es },
}

export const DEFAULT_LOCALE: Locale = 'es'

let current: Locale = DEFAULT_LOCALE

export function setLocale(locale: Locale): void {
  current = locale in LOCALES ? locale : DEFAULT_LOCALE
}

/** Etiqueta BCP 47 para Intl (fechas, números, orden alfabético). */
export function intlLocale(): string {
  return LOCALES[current].intl
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Messages>

function lookup(messages: unknown, key: string): string | undefined {
  let node = messages
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = (node as Record<string, unknown>)[part]
    else return undefined
  }
  return typeof node === 'string' ? node : undefined
}

/**
 * Texto en el idioma actual, con huecos «{nombre}». Si falta en ese idioma, sale en
 * castellano; si tampoco existe, sale la clave (así se ve en pantalla que falta).
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return tr(key, vars)
}

/** Como t(), con la clave sin comprobar (para tablas que se construyen por nombre). */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const text = lookup(LOCALES[current].messages, key) ?? lookup(es, key) ?? key
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text
}
