import type { Project, SourceRef } from '../domain/types'

/** Enlace a la fuente: el suyo propio o, para commits y PR, el del repositorio del proyecto. */
export function sourceHref(s: SourceRef, project?: Project): string | undefined {
  if (s.url) return s.url
  const repo = project?.repoUrl?.replace(/\/$/, '')
  if (!repo) return undefined
  if (s.type === 'commit' && /^[0-9a-f]{7,40}$/i.test(s.ref)) return `${repo}/commit/${s.ref}`
  if (s.type === 'pr') {
    const n = s.ref.match(/\d+/)?.[0]
    if (n) return `${repo}/pull/${n}`
  }
  if (s.type === 'readme') {
    const anchor = s.ref.includes('#') ? s.ref.slice(s.ref.indexOf('#')) : ''
    return `${repo}/blob/main/README.md${anchor}`
  }
  return undefined
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
