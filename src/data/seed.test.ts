// Los datos iniciales no se inventan nada: cada fecha y cada fuente se cruzan con el
// historial de git importado (activity.json, generado con scripts/importar-historial-git.mjs).
import { describe, expect, it } from 'vitest'
import { validateStudioData } from '../domain/validate'
import { createSeedData } from './seed'

const data = createSeedData()
const IDT = 'indie-dev-tycoon'
const items = data.items.filter((i) => i.projectId === IDT)
const activity = data.activity.filter((a) => a.projectId === IDT)
const byRef = new Map(activity.map((a) => [a.ref, a]))
const commitDate = (ref: string) => byRef.get(ref.slice(0, 7))?.at.slice(0, 10)

describe('datos iniciales', () => {
  it('son válidos', () => {
    expect(validateStudioData(data)).toEqual([])
  })

  it('traen el historial completo de Indie Dev Tycoon', () => {
    expect(activity.filter((a) => a.type === 'commit').length).toBeGreaterThanOrEqual(130)
    expect(activity.filter((a) => a.type === 'merge').length).toBeGreaterThanOrEqual(39)
  })

  it('cada commit o PR citado existe en el historial, con su fecha', () => {
    const problems: string[] = []
    const check = (where: string, sources: { type: string; ref: string; date?: string }[] | undefined) => {
      for (const s of sources ?? []) {
        if (s.type === 'commit') {
          const d = commitDate(s.ref)
          if (!d) problems.push(`${where}: el commit ${s.ref} no está en el historial`)
          else if (s.date && s.date !== d) problems.push(`${where}: el commit ${s.ref} es del ${d}, no del ${s.date}`)
        }
        if (s.type === 'pr') {
          const n = s.ref.match(/\d+/)?.[0]
          if (!n || !byRef.has(`#${n}`)) problems.push(`${where}: la PR ${s.ref} no está en el historial`)
        }
      }
    }
    for (const i of items) check(i.id, i.sources)
    for (const b of data.builds) check(b.id, b.sources)
    for (const e of data.events) check(e.id, e.sources)
    for (const f of data.feedback) check(f.id, f.sources)
    for (const c of data.checklists) for (const s of c.items) check(`${c.id}/${s.id}`, s.sources)
    expect(problems).toEqual([])
  })

  it('lo terminado lleva la fecha de su último commit y lo empezado la del primero', () => {
    const problems: string[] = []
    for (const i of items) {
      const dates = i.sources
        .filter((s) => s.type === 'commit')
        .map((s) => commitDate(s.ref))
        .filter((d): d is string => !!d)
        .sort()
      if (!dates.length) continue
      if (i.status === 'done' && i.completedAt !== dates.at(-1)) problems.push(`${i.id}: completedAt ${i.completedAt}, último commit ${dates.at(-1)}`)
      if (i.startedAt && i.startedAt !== dates[0]) problems.push(`${i.id}: startedAt ${i.startedAt}, primer commit ${dates[0]}`)
    }
    expect(problems).toEqual([])
  })

  it('lo que solo está en una rama sin fusionar no sale como hecho (salvo decisiones)', () => {
    const unmerged = new Set(activity.filter((a) => a.note).map((a) => a.ref))
    const wrong = items.filter((i) => {
      const commits = i.sources.filter((s) => s.type === 'commit')
      return i.kind !== 'decision' && i.status === 'done' && commits.length > 0 && commits.every((s) => unmerged.has(s.ref.slice(0, 7)))
    })
    expect(wrong.map((i) => i.id)).toEqual([])
  })

  it('cada commit del juego acaba en algún elemento', () => {
    const cited = new Set(items.flatMap((i) => i.sources.filter((s) => s.type === 'commit').map((s) => s.ref.slice(0, 7))))
    const missing = activity.filter((a) => a.type === 'commit' && !cited.has(a.ref!)).map((a) => `${a.ref} ${a.title}`)
    expect(missing).toEqual([])
  })

  it('cubren todas las líneas de trabajo del estudio', () => {
    const areas = new Set(items.map((i) => i.areaId))
    for (const a of ['ui-ux', 'polish', 'camera-pacing', 'demo', 'events', 'release', 'steam', 'ranking-integrity', 'dlc', 'ideas'])
      expect(areas, `falta el área ${a}`).toContain(a)
  })

  it('lo que no tiene fuente comprobable no se da por verificado', () => {
    const wrong = items.filter((i) => i.confidence === 'verified' && i.sources.every((s) => s.type === 'manual'))
    expect(wrong.map((i) => i.id)).toEqual([])
  })

  it('ningún evento tiene una fecha confirmada sin fuente', () => {
    const wrong = data.events.filter((e) => e.dateConfirmed && e.sources.every((s) => s.type === 'manual'))
    expect(wrong.map((e) => e.id)).toEqual([])
  })
})
