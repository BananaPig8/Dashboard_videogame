import { describe, expect, it } from 'vitest'
import { emptyCollections } from '../collections'
import { SCHEMA_VERSION, type StudioData, type StudioEvent, type WorkItem } from '../types'
import { validateStudioData } from '../validate'
import {
  allCalendarEntries,
  calendarEntries,
  calendarForExport,
  calendarKindsFor,
  calendarMonthParam,
  calendarOverdue,
  calendarTentative,
  calendarUndated,
  calendarWithTag,
  foldIcsLine,
  icsText,
  toICS,
  upcomingEntries,
  type IcsEntry,
} from '../selectors'

const TODAY = '2026-10-19'
const src = [{ type: 'manual' as const, ref: 'prueba' }]
const project = (id: string) => ({
  id,
  slug: id,
  name: id,
  description: '',
  platforms: [],
  stage: 'production' as const,
  color: '#000',
  versions: [],
  tags: [],
  links: [],
})
const item = (id: string, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  projectId: 'p',
  kind: 'task',
  title: id,
  status: 'backlog',
  priority: 'medium',
  tags: [],
  sources: src,
  confidence: 'verified',
  ...over,
})
const event = (id: string, over: Partial<StudioEvent> = {}): StudioEvent => ({
  id,
  projectId: 'p',
  title: id,
  type: 'fair',
  status: 'planned',
  dateConfirmed: true,
  sources: src,
  confidence: 'verified',
  ...over,
})

function data(): StudioData {
  return {
    ...emptyCollections(),
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 's', name: 'Estudio', createdAt: '2026-01-01' },
    projects: [project('p'), project('q')],
    items: [
      item('vencida', { dueDate: '2026-10-10', tags: ['steam'] }),
      item('hecha', { dueDate: '2026-10-11', status: 'done', completedAt: '2026-10-11' }),
      item('proxima', { dueDate: '2026-10-25' }),
      item('hito-sin-fecha', { kind: 'milestone', status: 'planned' }),
      item('tarea-sin-fecha'),
      item('de-q', { projectId: 'q', dueDate: '2026-10-22' }),
    ],
    events: [
      event('reunion', { type: 'meeting', date: '2026-10-21', time: '10:30', endTime: '11:30' }),
      event('feria', { date: '2026-11-20', endDate: '2026-11-22', dateConfirmed: false, registrationStatus: 'open', registrationDeadline: '2026-10-15' }),
      event('festival-sin-fecha', { type: 'festival', dateConfirmed: false, registrationStatus: 'not_open' }),
      event('del-estudio', { projectId: undefined, type: 'delivery', date: '2026-10-30' }),
      event('cancelado', { date: '2026-10-28', status: 'cancelled' }),
      event('pasado', { date: '2026-10-01' }),
    ],
    releases: [
      { id: 'r-sin', projectId: 'p', kind: 'update', name: 'Actualización', status: 'planned', sources: src, confidence: 'to_confirm' },
      { id: 'r-tarde', projectId: 'p', kind: 'patch', name: 'Parche', status: 'planned', targetDate: '2026-10-05', sources: src, confidence: 'to_confirm' },
    ],
    builds: [
      {
        id: 'b',
        projectId: 'p',
        name: 'Demo',
        version: '1.4',
        channel: 'demo',
        platforms: [],
        status: 'in_progress',
        date: '2026-10-14',
        sources: src,
        confidence: 'verified',
      },
    ],
    reminders: [
      { id: 'rec', projectId: 'p', title: 'Revisar la build', date: '2026-10-18', done: false },
      { id: 'rec-hecho', title: 'Pagar la tasa', date: '2026-10-17', done: true },
    ],
  }
}

describe('calendario: las fechas del estudio', () => {
  it('los datos de prueba son válidos', () => {
    expect(validateStudioData(data())).toEqual([])
  })

  it('juntan todas las colecciones, en orden, sin lo cancelado; los eventos del estudio salen en cada proyecto', () => {
    const ids = allCalendarEntries(data(), 'p').map((e) => e.id)
    expect(ids).toContain('events:del-estudio:date')
    expect(ids).not.toContain('items:de-q:due')
    expect(ids).not.toContain('events:cancelado:date')
    expect(ids.indexOf('events:feria:registration')).toBeLessThan(ids.indexOf('reminders:rec:date'))
  })

  it('un periodo cuenta los eventos de varios días que se solapan y filtra por tipo', () => {
    const nov = calendarEntries(data(), { from: '2026-11-21', to: '2026-11-30', scope: 'p' })
    expect(nov.map((e) => e.id)).toEqual(['events:feria:date'])
    const meetings = calendarEntries(data(), { from: '2026-10-01', to: '2026-10-31', kinds: calendarKindsFor('reuniones') })
    expect(meetings.map((e) => e.id)).toEqual(['events:reunion:date'])
    expect(calendarKindsFor(null)).toBeUndefined()
  })

  it('lo próximo empieza hoy y deja fuera lo hecho', () => {
    const ids = upcomingEntries(data(), TODAY, 14, 'p').map((e) => e.id)
    expect(ids).toEqual(['events:reunion:date', 'items:proxima:due', 'events:del-estudio:date'])
  })
})

describe('calendario: la sección', () => {
  it('el mes de ?mes= y, si no vale, el de hoy', () => {
    expect(calendarMonthParam('2026-12', TODAY)).toBe('2026-12-01')
    expect(calendarMonthParam('2026-13', TODAY)).toBe('2026-10-01')
    expect(calendarMonthParam(null, TODAY)).toBe('2026-10-01')
  })

  it('lo atrasado: vencido y sin cerrar, sin builds ni lo hecho', () => {
    const ids = calendarOverdue(data(), TODAY, 'p').map((e) => e.id)
    expect(ids).toEqual(['events:pasado:date', 'releases:r-tarde:target', 'items:vencida:due', 'events:feria:registration', 'reminders:rec:date'])
    expect(calendarOverdue(data(), TODAY, 'p', calendarKindsFor('recordatorios')).map((e) => e.id)).toEqual(['reminders:rec:date'])
  })

  it('sin confirmar: lo que tiene fecha prevista de hoy en adelante', () => {
    expect(calendarTentative(data(), TODAY, 'p').map((e) => e.id)).toEqual(['events:feria:date'])
  })

  it('sin fecha: eventos, inscripciones sin plazo, versiones y hitos (no las tareas)', () => {
    const undated = calendarUndated(data(), 'p')
    expect(undated.map((u) => u.id).sort()).toEqual(
      ['events:festival-sin-fecha:date', 'events:festival-sin-fecha:registration', 'items:hito-sin-fecha:due', 'releases:r-sin:target'].sort(),
    )
    expect(undated.find((u) => u.id === 'events:festival-sin-fecha:date')!.kind).toBe('festival')
    expect(calendarUndated(data(), 'p', calendarKindsFor('publicacion')).map((u) => u.id)).toEqual(['releases:r-sin:target'])
  })

  it('con etiqueta, solo las fechas de lo que la lleva', () => {
    const d = data()
    expect(calendarWithTag(d, allCalendarEntries(d, 'p'), 'STEAM').map((e) => e.id)).toEqual(['items:vencida:due'])
    expect(calendarWithTag(d, allCalendarEntries(d, 'p'), null)).toHaveLength(allCalendarEntries(d, 'p').length)
  })

  it('se exporta lo pendiente de hoy en adelante de la vista', () => {
    const ids = calendarForExport(data(), TODAY, 'p', calendarKindsFor('reuniones')).map((e) => e.id)
    expect(ids).toEqual(['events:reunion:date'])
    expect(calendarForExport(data(), TODAY, 'p').some((e) => e.date < TODAY && (e.endDate ?? e.date) < TODAY)).toBe(false)
  })
})

describe('calendario: exportar a .ics', () => {
  const NOW = new Date(Date.UTC(2026, 9, 19, 8, 5, 9))
  const base: IcsEntry = {
    id: 'items:x:due',
    kind: 'deadline',
    date: '2026-10-20',
    title: 'Entregar la demo',
    confirmed: true,
    done: false,
    target: { collection: 'items', id: 'x' },
  }
  const ics = (entries: IcsEntry[]) => toICS(entries, { calName: 'Studio Hub · Prueba', timeZone: 'Europe/Madrid', now: NOW })
  const unfold = (s: string) => s.replace(/\r\n /g, '')

  it('es un VCALENDAR con CRLF y nada más', () => {
    const out = ics([base])
    expect(out.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(true)
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(out.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(out).toContain('X-WR-CALNAME:Studio Hub · Prueba\r\n')
  })

  it('un día completo va con VALUE=DATE y DTEND exclusivo; varios días, hasta el día siguiente al último', () => {
    const out = ics([base, { ...base, id: 'events:f:date', date: '2026-11-20', endDate: '2026-11-22', kind: 'event' }])
    expect(out).toContain(
      'BEGIN:VEVENT\r\nUID:items:x:due@studio-hub\r\nDTSTAMP:20261019T080509Z\r\nDTSTART;VALUE=DATE:20261020\r\nDTEND;VALUE=DATE:20261021\r\n',
    )
    expect(out).toContain('DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261123\r\n')
    // Sin horas, no hace falta zona horaria.
    expect(out).not.toContain('VTIMEZONE')
  })

  it('con hora, en la zona del estudio (TZID) con su VTIMEZONE y los cambios de hora reales', () => {
    const out = ics([{ ...base, id: 'events:r:date', kind: 'meeting', time: '10:30', endTime: '11:30', title: 'Reunión' }])
    expect(out).toContain('DTSTART;TZID=Europe/Madrid:20261020T103000\r\nDTEND;TZID=Europe/Madrid:20261020T113000\r\n')
    expect(out).toContain('BEGIN:VTIMEZONE\r\nTZID:Europe/Madrid\r\nBEGIN:STANDARD\r\nDTSTART:20260101T000000\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0100\r\n')
    // Verano: 29-3-2026 a las 2:00 (+01 → +02); invierno: 25-10-2026 a las 3:00 (+02 → +01).
    expect(out).toContain('BEGIN:DAYLIGHT\r\nDTSTART:20260329T020000\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nEND:DAYLIGHT')
    expect(out).toContain('BEGIN:STANDARD\r\nDTSTART:20261025T030000\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nEND:STANDARD')
    expect(out.indexOf('END:VTIMEZONE')).toBeLessThan(out.indexOf('BEGIN:VEVENT'))
  })

  it('una zona sin cambio de hora lleva una sola observancia; una zona que no existe vuelve a la del estudio', () => {
    const timed = [{ ...base, time: '09:00' }]
    const tokyo = toICS(timed, { calName: 'x', timeZone: 'Asia/Tokyo', now: NOW })
    expect(tokyo).toContain(
      'TZID:Asia/Tokyo\r\nBEGIN:STANDARD\r\nDTSTART:20260101T000000\r\nTZOFFSETFROM:+0900\r\nTZOFFSETTO:+0900\r\nEND:STANDARD\r\nEND:VTIMEZONE',
    )
    expect(tokyo).not.toContain('DAYLIGHT')
    expect(toICS(timed, { calName: 'x', timeZone: 'Marte/Olympus', now: NOW })).toContain('DTSTART;TZID=Europe/Madrid:20261020T090000')
  })

  it('con hora y sin hora de fin no se inventa el final; varios días sin hora de fin, como días completos', () => {
    const out = ics([
      { ...base, id: 'a', time: '09:00' },
      { ...base, id: 'b', time: '09:00', date: '2026-11-20', endDate: '2026-11-22' },
    ])
    expect(out).toContain('UID:a@studio-hub\r\nDTSTAMP:20261019T080509Z\r\nDTSTART;TZID=Europe/Madrid:20261020T090000\r\nSUMMARY:')
    expect(out).toContain('UID:b@studio-hub\r\nDTSTAMP:20261019T080509Z\r\nDTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261123\r\n')
  })

  it('escapa los textos y marca lo no confirmado como TENTATIVE', () => {
    const out = ics([{ ...base, title: 'Feria; stand, mesa\\silla', confirmed: false, description: 'Línea 1\nLínea 2', location: 'Valladolid, España' }])
    expect(out).toContain('SUMMARY:Feria\\; stand\\, mesa\\\\silla\r\n')
    expect(out).toContain('DESCRIPTION:Línea 1\\nLínea 2\r\n')
    expect(out).toContain('LOCATION:Valladolid\\, España\r\n')
    expect(out).toContain('STATUS:TENTATIVE\r\n')
    expect(ics([base])).toContain('STATUS:CONFIRMED\r\n')
    expect(icsText('a,b;c')).toBe('a\\,b\\;c')
  })

  it('pliega las líneas a 75 octetos sin partir los caracteres', () => {
    const title = 'Presentación en el festival de videojuegos independientes de Castilla y León, edición de otoño ñññ'
    const out = ics([{ ...base, title }])
    for (const line of out.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(unfold(out)).toContain(`SUMMARY:${icsText(title)}\r\n`)
    const folded = foldIcsLine(`SUMMARY:${'é'.repeat(60)}`)
    expect(folded.split('\r\n ').join('')).toBe(`SUMMARY:${'é'.repeat(60)}`)
    expect(foldIcsLine('corta')).toBe('corta')
  })
})
