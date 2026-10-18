import { describe, expect, it } from 'vitest'
import { normalizeDraft, SPECS, validateDraft } from './forms'

const items = SPECS.items!
const events = SPECS.events!
const builds = SPECS.builds!

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
