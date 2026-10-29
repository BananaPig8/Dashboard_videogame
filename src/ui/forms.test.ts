import { describe, expect, it } from 'vitest'
import { centsToText, dropForeign, normalizeDraft, SPECS, toEditable, validateDraft } from './forms'
import { emptyCollections } from '../domain/collections'
import { SCHEMA_VERSION, type StudioData } from '../domain/types'

const items = SPECS.items
const events = SPECS.events
const builds = SPECS.builds

describe('validación de formularios', () => {
  it('pide los campos obligatorios', () => {
    const errors = validateDraft(items, { title: '  ', projectId: 'p', kind: 'task', status: 'backlog', priority: 'medium', confidence: 'verified' })
    expect(Object.keys(errors)).toEqual(['title'])
  })

  it('no acepta enlaces a medias ni de otros protocolos', () => {
    const base = { name: 'Demo', projectId: 'p', version: '1.0', channel: 'demo', status: 'ready', confidence: 'verified' }
    expect(validateDraft(builds, { ...base, url: 'github.com/algo' }).url).toBeDefined()
    expect(validateDraft(builds, { ...base, url: 'javascript:alert(1)' }).url).toBeDefined()
    expect(validateDraft(builds, { ...base, url: 'https://github.com/algo' }).url).toBeUndefined()
  })

  it('no deja fechas al revés', () => {
    const e = { title: 'Feria', type: 'fair', status: 'planned', confidence: 'verified', date: '2026-11-10', endDate: '2026-11-08' }
    expect(validateDraft(events, e).endDate).toBe('No puede ser anterior a la fecha de inicio.')
    const i = { title: 'X', projectId: 'p', kind: 'task', status: 'done', priority: 'medium', confidence: 'verified', startedAt: '2026-10-10', completedAt: '2026-10-01' }
    expect(validateDraft(items, i).completedAt).toBeDefined()
  })

  it('al guardar quita textos vacíos y convierte las etiquetas en lista', () => {
    const out = normalizeDraft(items, { title: ' Algo ', description: '   ', tags: 'steam, feria ,, demo' })
    expect(out.title).toBe('Algo')
    expect('description' in out).toBe(false)
    expect(out.tags).toEqual(['steam', 'feria', 'demo'])
  })
})

describe('campos nuevos', () => {
  const tx = SPECS.transactions
  const base = { description: 'Stand', kind: 'expense', category: 'events', status: 'done', date: '2026-10-01', confidence: 'verified' }

  it('los importes se escriben con coma o punto y se guardan en céntimos', () => {
    expect(validateDraft(tx, { ...base, amount: '12,5' }).amount).toBeUndefined()
    expect(normalizeDraft(tx, { ...base, amount: '1.234,56' }).amount).toBe(123456)
    expect(normalizeDraft(tx, { ...base, amount: '120' }).amount).toBe(12000)
    expect(validateDraft(tx, { ...base, amount: 'doce' }).amount).toBeDefined()
    expect(validateDraft(tx, { ...base, amount: '-3' }).amount).toBeDefined()
    expect(centsToText(123456)).toBe('1234,56')
    expect(centsToText(12000)).toBe('120')
    expect(toEditable(tx, { amount: 1250 }).amount).toBe('12,50')
  })

  it('sí, no o sin decidir: la visibilidad de un logro no se da por «visible» si nadie la ha decidido', () => {
    const ach = SPECS.achievements
    const base = { name: 'Hola, mundo', projectId: 'p', status: 'implemented', confidence: 'verified' }
    expect(toEditable(ach, { ...base }).hidden).toBe('')
    expect(toEditable(ach, { ...base, hidden: false }).hidden).toBe('false')
    expect(toEditable(ach, { ...base, hidden: true }).hidden).toBe('true')
    expect('hidden' in normalizeDraft(ach, { ...base, hidden: '' })).toBe(false)
    expect(normalizeDraft(ach, { ...base, hidden: 'false' }).hidden).toBe(false)
    expect(normalizeDraft(ach, { ...base, hidden: 'true' }).hidden).toBe(true)
  })

  it('los números respetan mínimo, máximo y enteros', () => {
    const te = SPECS.timeEntries
    const ok = { projectId: 'p', date: '2026-10-01' }
    expect(validateDraft(te, { ...ok, minutes: '90' }).minutes).toBeUndefined()
    expect(validateDraft(te, { ...ok, minutes: '0' }).minutes).toBe('Como mínimo, 1.')
    expect(validateDraft(te, { ...ok, minutes: '1,5' }).minutes).toBe('Tiene que ser un número entero.')
    expect(normalizeDraft(te, { ...ok, minutes: ' 90 ' }).minutes).toBe(90)
  })

  it('las horas van en formato de 24 h y la de fin no puede ir antes', () => {
    const ev = SPECS.events
    const e = { title: 'Reunión', type: 'meeting', status: 'planned', confidence: 'verified', date: '2026-10-20' }
    expect(validateDraft(ev, { ...e, time: '25:00' }).time).toBeDefined()
    expect(validateDraft(ev, { ...e, time: '10:00', endTime: '09:00' }).endTime).toBeDefined()
    expect(validateDraft(ev, { ...e, time: '10:00', endTime: '11:30' })).toEqual({})
  })

  it('las listas piden sus columnas obligatorias e ignoran las filas vacías', () => {
    const pr = SPECS.projects
    const p = { name: 'Juego', stage: 'idea' }
    expect(validateDraft(pr, { ...p, links: [{ label: 'Web', url: 'web' }] }).links).toContain('Fila 1')
    expect(validateDraft(pr, { ...p, versions: [{ label: 'Demo' }] }).versions).toContain('Versión')
    expect(normalizeDraft(pr, { ...p, versions: [{ label: ' Demo ', version: '0.1', note: ' ' }, { label: '' }] }).versions).toEqual([{ label: 'Demo', version: '0.1' }])
  })

  it('al cambiar de proyecto se vacía lo que era del otro', () => {
    const data: StudioData = {
      ...emptyCollections(),
      schemaVersion: SCHEMA_VERSION,
      studio: { id: 's', name: 'E', createdAt: '2026-01-01' },
      builds: [{ id: 'b', projectId: 'p', name: 'Demo', version: '1', channel: 'demo', platforms: [], status: 'ready', sources: [], confidence: 'verified' }],
      events: [{ id: 'e', title: 'Feria', type: 'fair', status: 'planned', dateConfirmed: false, sources: [], confidence: 'verified' }],
    }
    const out = dropForeign(SPECS.feedback, { projectId: 'q', buildId: 'b', eventId: 'e', origin: 'event', linkedItemIds: ['x'] }, data)
    expect(out).not.toHaveProperty('buildId')
    // Los eventos de todo el estudio valen para cualquier proyecto.
    expect(out.eventId).toBe('e')
    expect(out.linkedItemIds).toEqual([])
  })
})
