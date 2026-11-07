import { describe, expect, it } from 'vitest'
import { ACCENTS, ANYONE, contrast, dashboardOf, DEFAULT_DASHBOARD, DEFAULT_PREFERENCES, DEFAULT_WIDGET_ORDER, resolveAccent, sanitizePreferences } from './prefs'

describe('preferencias', () => {
  it('por defecto: tema oscuro, Madrid, español y todos los widgets', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('dark')
    expect(DEFAULT_PREFERENCES.timeZone).toBe('Europe/Madrid')
    expect(DEFAULT_PREFERENCES.locale).toBe('es')
    expect(dashboardOf(sanitizePreferences({}))).toEqual(DEFAULT_DASHBOARD)
    expect(DEFAULT_DASHBOARD.order).toEqual(DEFAULT_WIDGET_ORDER)
  })

  it('arregla preferencias raras o de otra versión sin romper', () => {
    const p = sanitizePreferences({
      theme: 'rosa',
      accent: 'javascript:alert(1)',
      density: 'compact',
      widgets: { order: ['today', 'no-existe', 'today'], hidden: ['kpis', 'otro'] },
      savedViews: [{ id: 'a', name: 'Bloqueado', path: '/trabajo?estado=blocked' }, { id: 'b', name: 'Fuera', path: 'https://ejemplo.com' }],
      weekStart: 7,
    })
    expect(p.theme).toBe('dark')
    expect(p.accent).toBe('violet')
    expect(p.density).toBe('compact')
    // La disposición de antes («widgets») pasa a ser la de cualquiera, con los bloques de ahora:
    // «Hoy» y «Bloqueado» están en «Prioridades».
    const layout = p.dashboards[ANYONE]
    expect(layout.order[0]).toBe('priorities')
    expect(new Set(layout.order).size).toBe(DEFAULT_WIDGET_ORDER.length)
    expect(layout.hidden).toEqual(['kpis'])
    expect(p.savedViews.map((v) => v.id)).toEqual(['a'])
    expect(p.weekStart).toBe(1)
  })

  it('cada persona tiene su disposición del Dashboard; sin la suya, ve la de cualquiera', () => {
    const p = sanitizePreferences({
      meId: 'ana',
      dashboards: {
        [ANYONE]: { hidden: ['builds'] },
        luis: { hidden: ['feedback'], sizes: { agenda: 'wide', kpis: 'enorme' }, kpis: { hidden: ['overdue', 'no-existe'] }, agendaView: 'calendar' },
      },
    })
    expect(dashboardOf(p).hidden).toEqual(['builds'])
    const luis = dashboardOf({ ...p, meId: 'luis' })
    expect(luis.hidden).toEqual(['feedback'])
    expect(luis.sizes.agenda).toBe('wide')
    expect(luis.kpis.hidden).toEqual(['overdue'])
    expect(luis.kpis.order).toHaveLength(DEFAULT_DASHBOARD.kpis.order.length)
    expect(luis.agendaView).toBe('calendar')
  })

  it('los acentos se leen bien sobre su fondo (AA para texto)', () => {
    for (const a of Object.values(ACCENTS)) {
      expect(contrast(a.dark, '#161a22')).toBeGreaterThanOrEqual(4.5)
      expect(contrast(a.light, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('el texto sobre el acento elige el color con más contraste', () => {
    expect(resolveAccent('violet', 'dark').onColor).toBe('#0b0d12')
    expect(resolveAccent('#1a1a6e', 'dark')).toEqual({ color: '#1a1a6e', onColor: '#ffffff' })
  })
})

describe('vistas guardadas de la versión anterior', () => {
  it('se reescriben a las rutas de ahora', () => {
    const p = sanitizePreferences({ savedViews: [{ id: 'v', name: 'Bloqueado', path: '/trabajo?estado=blocked' }] })
    expect(p.savedViews[0].path).toBe('/tareas?filtro=bloqueadas')
  })
})
