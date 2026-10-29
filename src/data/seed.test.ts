// Los datos iniciales no se inventan nada: cada fecha y cada fuente se cruzan con el
// historial de git importado (activity.json, generado con scripts/importar-historial-git.mjs).
import { describe, expect, it } from 'vitest'
import { validateStudioData } from '../domain/validate'
import type { Activity, WorkItem } from '../domain/types'
import { createSeedData, withAreas } from './seed'

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
    for (const r of data.releases) check(r.id, r.sources)
    for (const l of data.storeListings) check(l.id, l.sources)
    for (const a of data.achievements) check(a.id, a.sources)
    for (const p of data.playtests) check(p.id, p.sources)
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

  it('el área de cada commit es la de lo que lo cita, no la del primero que sale en items.json', () => {
    const area = (ref: string) => activity.find((a) => a.ref === ref)?.areaId
    // Las traducciones las cita también la tarea de abrir la PR (área de lanzamientos).
    for (const ref of ['3665de9', '33a3632', '912976f']) expect(area(ref), ref).toBe('localization')
    expect(area('7e53a92')).toBe('tech')
  })

  it('withAreas: gana el área de más elementos; si empatan, la del más concreto', () => {
    const item = (id: string, areaId: string, refs: string[]): WorkItem => ({
      id,
      projectId: 'p',
      kind: 'task',
      title: id,
      status: 'done',
      priority: 'medium',
      areaId,
      completedAt: '2026-10-01',
      tags: [],
      sources: refs.map((ref) => ({ type: 'commit' as const, ref })),
      confidence: 'verified',
    })
    const act = (ref: string): Activity => ({ id: ref, projectId: 'p', at: '2026-10-01T10:00', type: 'commit', title: ref, ref })
    const out = withAreas(
      [act('aaa'), act('bbb'), act('ccc')],
      [item('pr', 'release', ['aaa', 'bbb', 'ccc']), item('trad', 'localization', ['aaa']), item('mas', 'localization', ['aaa', 'bbb']), item('ui', 'ui-ux', ['bbb', 'ccc'])],
    )
    expect(out.map((a) => a.areaId)).toEqual(['localization', 'localization', 'ui-ux'])
  })

  it('cubren todas las líneas de trabajo del estudio', () => {
    const areas = new Set(items.map((i) => i.areaId))
    for (const a of ['ui-ux', 'polish', 'camera-pacing', 'demo', 'events', 'release', 'steam', 'ranking-integrity', 'dlc', 'ideas'])
      expect(areas, `falta el área ${a}`).toContain(a)
  })

  it('lo que no tiene fuente comprobable no se da por verificado', () => {
    const all = [...items, ...data.builds, ...data.events, ...data.feedback, ...data.releases, ...data.storeListings, ...data.achievements, ...data.playtests]
    const wrong = all.filter((i) => i.confidence === 'verified' && i.sources.every((s) => s.type === 'manual'))
    expect(wrong.map((i) => i.id)).toEqual([])
  })

  it('ningún evento tiene una fecha confirmada sin fuente', () => {
    const wrong = data.events.filter((e) => e.dateConfirmed && e.sources.every((s) => s.type === 'manual'))
    expect(wrong.map((e) => e.id)).toEqual([])
  })

  it('el historial dice quién hizo cada commit y cada PR, sin inventar personas', () => {
    expect(activity.filter((a) => !a.author?.trim()).map((a) => a.id)).toEqual([])
    expect(data.members).toEqual([])
  })

  it('no traen eventos de la versión 1 de Steam ni de lanzamientos', () => {
    // Las fechas de publicación son de las versiones y el estado de la tienda, de sus fichas.
    expect(data.events.filter((e) => e.type === 'steam' || e.type === 'release').map((e) => e.id)).toEqual([])
  })

  it('cada versión publicada tiene su build publicada y su fecha', () => {
    const problems: string[] = []
    for (const r of data.releases.filter((r) => r.status === 'released')) {
      const dates = data.builds
        .filter((b) => b.releaseId === r.id && (b.status === 'published' || b.status === 'superseded'))
        .map((b) => b.date)
        .filter((d): d is string => !!d)
        .sort()
      if (!dates.length) problems.push(`${r.id}: publicada sin ninguna build publicada con fecha`)
      else if (r.releasedAt !== dates[0]) problems.push(`${r.id}: releasedAt ${r.releasedAt}, primera build del ${dates[0]}`)
    }
    for (const b of data.builds)
      if (b.status === 'published' && (b.channel === 'demo' || b.channel === 'event') && !b.releaseId) problems.push(`${b.id}: demo publicada sin versión`)
    expect(problems).toEqual([])
  })

  it('las fichas de tienda y los logros no dan por hecho lo que no se puede comprobar', () => {
    // No hay conexión con Steamworks: lo que pasa de borrador, un App ID o un logro dado de alta
    // en la tienda necesita una fuente comprobable.
    const wrong = [
      ...data.storeListings.filter((l) => (!['not_started', 'draft'].includes(l.status) || l.appId) && l.confidence !== 'verified').map((l) => l.id),
      ...data.achievements.filter((a) => a.status === 'in_store' && a.confidence !== 'verified').map((a) => a.id),
    ]
    expect(wrong).toEqual([])
  })

  it('los logros tienen un nombre de API válido para Steam y sin repetir', () => {
    // desktop/main.js del juego solo activa en Steam los nombres con letras minúsculas, cifras y «_».
    const names = data.achievements.map((a) => a.apiName ?? '')
    expect(names.filter((n) => !/^[a-z0-9_]{1,40}$/.test(n))).toEqual([])
    expect(names.length).toBe(new Set(names).size)
  })

  it('el feedback de un evento o de una prueba dice de cuál', () => {
    const wrong = data.feedback.filter((f) => (f.origin === 'event' && !f.eventId) || (f.origin === 'playtest' && !f.playtestId))
    expect(wrong.map((f) => f.id)).toEqual([])
  })
})
