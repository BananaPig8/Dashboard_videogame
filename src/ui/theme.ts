// Tema claro u oscuro: por defecto el del sistema; la elección se recuerda en este navegador.
export type Theme = 'auto' | 'light' | 'dark'
const KEY = 'studio-hub:tema'

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function applyTheme(theme: Theme = getTheme()): void {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    /* sin almacenamiento: solo para esta visita */
  }
  applyTheme(theme)
}
