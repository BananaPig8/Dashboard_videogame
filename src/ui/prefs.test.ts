import { describe, expect, it } from 'vitest'
import { ACCENTS, contrast, DEFAULT_PREFERENCES, DEFAULT_WIDGET_ORDER, resolveAccent, sanitizePreferences } from './prefs'

describe('preferencias', () => {
  it('por defecto: tema oscuro, Madrid, español y todos los widgets', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('dark')
    expect(DEFAULT_PREFERENCES.timeZone).toBe('Europe/Madrid')
    expect(DEFAULT_PREFERENCES.locale).toBe('es')
    expect(sanitizePreferences({}).widgets.order).toEqual(DEFAULT_WIDGET_ORDER)
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
    expect(p.widgets.order[0]).toBe('today')
    expect(new Set(p.widgets.order).size).toBe(DEFAULT_WIDGET_ORDER.length)
    expect(p.widgets.hidden).toEqual(['kpis'])
    expect(p.savedViews.map((v) => v.id)).toEqual(['a'])
    expect(p.weekStart).toBe(1)
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
