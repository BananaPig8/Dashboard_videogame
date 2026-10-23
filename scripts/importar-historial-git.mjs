#!/usr/bin/env node
// Convierte el historial de git de un proyecto en la «actividad» de Studio Hub:
// un registro por commit y otro por cada PR fusionada, con su fecha y su enlace.
//
//   node scripts/importar-historial-git.mjs \
//     --repo ../Indie-Dev-Tycoon --proyecto indie-dev-tycoon \
//     --url https://github.com/BananaPig8/Indie-Dev-Tycoon \
//     --rama origin/main [--rama origin/otra-rama] [--zona Europe/Madrid] \
//     --salida src/data/seed/indie-dev-tycoon/activity.json
//
// La primera rama es la principal; los commits que solo están en las demás salen con
// una nota («en la rama …, sin fusionar»). Las fechas van en la hora local del estudio
// (--zona, por defecto Europe/Madrid), no en la zona que guarda cada commit: los commits
// hechos desde la nube van en UTC y las fusiones de GitHub, en la hora del navegador.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

function args(argv) {
  const out = { rama: [], zona: 'Europe/Madrid' }
  for (let k = 2; k < argv.length; k += 2) {
    const key = argv[k].replace(/^--/, '')
    const value = argv[k + 1]
    if (value === undefined) throw new Error(`Falta el valor de --${key}`)
    if (key === 'rama') out.rama.push(value)
    else out[key] = value
  }
  for (const req of ['repo', 'proyecto', 'salida']) if (!out[req]) throw new Error(`Falta --${req}`)
  if (!out.rama.length) out.rama.push('HEAD')
  return out
}

const SEP = '\u001f'
const END = '\u001e'

function gitLog(repo, revs, zona) {
  const raw = execFileSync(
    'git',
    ['-C', repo, 'log', ...revs, '--date=format-local:%Y-%m-%dT%H:%M', `--format=%H${SEP}%P${SEP}%ad${SEP}%s${SEP}%b${END}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, TZ: zona } },
  )
  return raw
    .split(END)
    .map((r) => r.replace(/^\n/, ''))
    .filter(Boolean)
    .map((r) => {
      const [hash, parents, at, subject, body] = r.split(SEP)
      return { hash, merge: parents.trim().split(' ').length > 1, at, subject, body: body ?? '' }
    })
}

const opt = args(process.argv)
const [main, ...others] = opt.rama
const inMain = new Set(gitLog(opt.repo, [main], opt.zona).map((c) => c.hash))
const commits = gitLog(opt.repo, opt.rama, opt.zona)
const repoUrl = opt.url?.replace(/\/$/, '')

const activity = commits.map((c) => {
  const short = c.hash.slice(0, 7)
  const pr = c.subject.match(/^Merge pull request #(\d+)/)
  const entry = pr
    ? {
        id: `${opt.proyecto}-pr-${pr[1]}`,
        projectId: opt.proyecto,
        at: c.at,
        type: 'merge',
        // En las fusiones de GitHub, la primera línea del cuerpo es el título de la PR.
        title: `PR #${pr[1]} fusionada: ${c.body.split('\n')[0].trim() || c.subject}`,
        ref: `#${pr[1]}`,
        ...(repoUrl && { url: `${repoUrl}/pull/${pr[1]}` }),
      }
    : {
        id: `${opt.proyecto}-c-${short}`,
        projectId: opt.proyecto,
        at: c.at,
        type: c.merge ? 'merge' : 'commit',
        title: c.subject,
        ref: short,
        ...(repoUrl && { url: `${repoUrl}/commit/${c.hash}` }),
      }
  if (!inMain.has(c.hash) && others.length) entry.note = `En la rama ${others.join(', ').replace(/^origin\//, '')}, sin fusionar en ${main.replace(/^origin\//, '')}.`
  return entry
})
activity.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))

writeFileSync(opt.salida, JSON.stringify(activity, null, 2) + '\n')
const n = (t) => activity.filter((a) => a.type === t).length
console.log(`${opt.salida}: ${activity.length} registros (${n('commit')} commits, ${n('merge')} fusiones), del ${activity[0]?.at} al ${activity.at(-1)?.at}`)
