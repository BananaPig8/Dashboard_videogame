import { describe, expect, it } from 'vitest'
import { makeFormatter, parseAmount } from './format'
import { setLocale, t, tr } from './index'

const fmt = (dateFormat: 'short' | 'numeric' | 'long' | 'iso' = 'short', hourCycle: 'h23' | 'h12' = 'h23') =>
  makeFormatter({ locale: 'es-ES', dateFormat, hourCycle, noDate: 'Sin fecha' })

describe('formato de fechas', () => {
  it('escribe la fecha en el formato elegido', () => {
    expect(fmt('short').date('2026-10-14', 2026)).toBe('14 oct')
    expect(fmt('short').date('2025-10-14', 2026)).toMatch(/^14 oct 2025$/)
    expect(fmt('numeric').date('2026-10-14')).toBe('14/10/2026')
    expect(fmt('long').date('2026-10-14')).toBe('14 de octubre de 2026')
    expect(fmt('iso').date('2026-10-14')).toBe('2026-10-14')
    expect(fmt().date(undefined)).toBe('Sin fecha')
  })

  it('no cambia de día por la zona horaria del navegador', () => {
    expect(fmt('long').date('2026-01-01')).toBe('1 de enero de 2026')
    expect(fmt('long').date('2026-12-31')).toBe('31 de diciembre de 2026')
  })

  it('escribe el día de la semana, la hora y el mes', () => {
    expect(fmt().longDate('2026-10-18')).toBe('domingo, 18 de octubre de 2026')
    expect(fmt().time('2026-10-18T17:05')).toBe('17:05')
    expect(fmt('short', 'h12').time('2026-10-18T17:05')).toMatch(/^5:05\s?p\.\s?m\.$/)
    expect(fmt().monthYear('2026-10')).toBe('octubre de 2026')
  })

  it('dice las fechas relativas como se dicen', () => {
    const f = fmt()
    expect(f.relative('2026-10-18', '2026-10-18')).toBe('hoy')
    expect(f.relative('2026-10-17', '2026-10-18')).toBe('ayer')
    expect(f.relative('2026-10-19', '2026-10-18')).toBe('mañana')
    expect(f.relative('2026-10-14', '2026-10-18')).toBe('hace 4 días')
    expect(f.relative('2026-10-21', '2026-10-18')).toBe('dentro de 3 días')
    expect(f.relative('2026-09-27', '2026-10-18')).toBe('hace 3 semanas')
  })
})

describe('textos', () => {
  it('rellena los huecos y avisa de lo que falta', () => {
    setLocale('es')
    expect(t('palette.searchAll', { q: 'feria' })).toBe('Buscar «feria» en todo el trabajo')
    expect(tr('no.existe')).toBe('no.existe')
  })
})

describe('importes', () => {
  it('lee importes escritos a mano en céntimos', () => {
    expect(parseAmount('12,50')).toBe(1250)
    expect(parseAmount('12.50')).toBe(1250)
    expect(parseAmount('1.234,56')).toBe(123456)
    expect(parseAmount('1,234.56')).toBe(123456)
    expect(parseAmount('100')).toBe(10000)
    expect(parseAmount('1.000')).toBe(100000)
    expect(parseAmount('100 €')).toBe(10000)
    expect(parseAmount('-3,5')).toBe(-350)
    expect(parseAmount('doce')).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('1,2,3')).toBeNull()
  })

  it('escribe importes y duraciones', () => {
    const f = makeFormatter({ locale: 'es-ES', dateFormat: 'short', hourCycle: 'h23', noDate: '—' })
    expect(f.money(123450, 'EUR').replace(/\s/g, ' ')).toBe('1234,50 €')
    expect(f.duration(150)).toBe('2 h 30 min')
    expect(f.duration(45)).toBe('45 min')
    expect(f.duration(120)).toBe('2 h')
  })
})
