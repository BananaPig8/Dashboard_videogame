// Abrir el buscador global (la paleta de órdenes) desde cualquier botón, no solo con Ctrl K.
// AppShell lo escucha.
export const OPEN_SEARCH = 'studio-hub:buscar'

export function openSearch(query?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_SEARCH, { detail: query }))
}
