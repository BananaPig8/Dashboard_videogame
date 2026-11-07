import { describe, expect, it } from 'vitest'
import { appendChange, changeFor } from './cambios'
import type { ChangeEntry } from './types'

const ctx = (at = '2026-11-02T10:00', memberId?: string) => ({ id: `c-${at}`, at, memberId })
const task = { id: 't1', projectId: 'p', kind: 'task', title: 'Arreglar el guardado', status: 'todo', priority: 'medium' }

describe('registro de cambios', () => {
  it('distingue crear, cambiar, cambiar de estado, terminar y borrar', () => {
    expect(changeFor('items', undefined, task, ctx())).toMatchObject({ action: 'created', title: 'Arreglar el guardado', projectId: 'p', entityKind: 'task' })
    expect(changeFor('items', task, { ...task, title: 'Arreglar el guardado ya' }, ctx())).toMatchObject({ action: 'updated', fields: ['title'] })
    expect(changeFor('items', task, { ...task, status: 'blocked' }, ctx())).toMatchObject({ action: 'status', from: 'todo', to: 'blocked' })
    expect(changeFor('items', task, { ...task, status: 'done', completedAt: '2026-11-02' }, ctx())).toMatchObject({ action: 'completed', from: 'todo', to: 'done' })
    expect(changeFor('items', task, undefined, ctx())).toMatchObject({ action: 'deleted', entityId: 't1' })
  })

  it('no apunta lo que no cambia, ni el historial de git ni el propio registro', () => {
    expect(changeFor('items', task, { ...task }, ctx())).toBeNull()
    expect(changeFor('activity', undefined, { id: 'a' }, ctx())).toBeNull()
    expect(changeFor('changes', undefined, { id: 'c' }, ctx())).toBeNull()
  })

  it('no apunta lo privado (gastos, ingresos y presupuestos): el registro lo lee cualquiera', () => {
    expect(changeFor('transactions', undefined, { id: 'm', title: 'Licencia' }, ctx())).toBeNull()
    expect(changeFor('budgets', undefined, { id: 'b', name: 'Feria' }, ctx())).toBeNull()
  })

  it('un proyecto es de sí mismo y un recordatorio se termina con «done»', () => {
    expect(changeFor('projects', undefined, { id: 'p', name: 'Juego' }, ctx())).toMatchObject({ projectId: 'p', title: 'Juego' })
    const r = { id: 'r', title: 'Llamar', date: '2026-11-02', done: false }
    expect(changeFor('reminders', r, { ...r, done: true }, ctx())).toMatchObject({ action: 'completed' })
  })

  it('apunta quién lo hizo si se sabe', () => {
    expect(changeFor('items', undefined, task, ctx('2026-11-02T10:00', 'ana'))?.memberId).toBe('ana')
    expect(changeFor('items', undefined, task, ctx())?.memberId).toBeUndefined()
  })

  it('junta los cambios seguidos de lo mismo y de la misma persona', () => {
    const a = changeFor('items', task, { ...task, title: 'A' }, ctx('2026-11-02T10:00', 'ana'))
    const b = changeFor('items', task, { ...task, priority: 'high' }, ctx('2026-11-02T10:05', 'ana'))
    const c = changeFor('items', task, { ...task, priority: 'low' }, ctx('2026-11-02T10:30', 'ana'))
    let list: ChangeEntry[] = appendChange([], a)
    list = appendChange(list, b)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ fields: ['priority', 'title'], at: '2026-11-02T10:05' })
    list = appendChange(list, c)
    expect(list).toHaveLength(2)
  })

  it('se queda con los más recientes', () => {
    let list: ChangeEntry[] = []
    for (let n = 0; n < 5; n++) list = appendChange(list, changeFor('items', undefined, { ...task, id: `t${n}` }, ctx(`2026-11-02T1${n}:00`)), 3)
    expect(list.map((c) => c.entityId)).toEqual(['t2', 't3', 't4'])
  })
})

describe('registro de cambios: lo que añade el formulario', () => {
  it('guardar sin cambiar nada no apunta nada aunque el formulario añada campos vacíos', () => {
    expect(changeFor('items', task, { ...task, dependsOnIds: [], description: '' }, ctx())).toBeNull()
    const ev = { id: 'e', title: 'Feria', dateConfirmed: false }
    expect(changeFor('events', ev, { ...ev, memberIds: [], registrationDeadlineConfirmed: false }, ctx())).toBeNull()
  })
})
