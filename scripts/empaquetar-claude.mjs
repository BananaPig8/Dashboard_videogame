// Prepara la build de claude.ai (dist-claude/, de `vite build --mode artifact`) para
// publicarla como página: claude.ai pone él mismo <html>, <head> y <body>, así que la
// página es el contenido de esas etiquetas, con el <title> arriba del todo. El resto de
// ficheros (JS, CSS, fuentes, icono) se publican junto a ella con la lista que se escribe
// en dist-claude/ficheros.json (ruta publicada → fichero).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const dist = process.argv[2] ?? 'dist-claude'
const PAGINA = 'studio-hub.html'
const LISTA = 'ficheros.json'

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const head = html.match(/<head>([\s\S]*)<\/head>/)?.[1]
const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1]
if (head === undefined || body === undefined) throw new Error('index.html sin <head> o <body>')

let cabeza = head.replace(/\s*<meta charset[^>]*>/i, '').replace(/\s*<meta name="viewport"[^>]*>/i, '')
const title = cabeza.match(/<title>[\s\S]*?<\/title>/)?.[0]
if (!title) throw new Error('index.html sin <title>')
cabeza = cabeza.replace(title, '')
writeFileSync(join(dist, PAGINA), `${title}\n${cabeza.trim()}\n${body.trim()}\n`)

const ficheros = {}
const recorrer = (dir) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) recorrer(ruta)
    else {
      const publicada = relative(dist, ruta).split('\\').join('/')
      // _headers es de Cloudflare Pages: en claude.ai no se publica.
      if (![`index.html`, PAGINA, LISTA, '_headers'].includes(publicada)) ficheros[publicada] = ruta
    }
  }
}
recorrer(dist)
writeFileSync(join(dist, LISTA), JSON.stringify(ficheros, null, 2))
const kb = Object.values(ficheros).reduce((n, f) => n + statSync(f).size, 0) / 1024
console.log(`${join(dist, PAGINA)} y ${Object.keys(ficheros).length} ficheros (${Math.round(kb)} KB)`)
