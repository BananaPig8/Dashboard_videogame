// Recorrido de Studio Hub en un navegador de verdad (Playwright + Chromium).
//   npm run build && npx vite preview --port 4173 &
//   PW_PATH=$(npm root -g)/playwright node e2e/recorrido.mjs http://localhost:4173 carpeta-de-capturas
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_PATH ?? 'playwright')
const [base = 'http://localhost:4173', out = '.'] = process.argv.slice(2)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
let failed = 0
const step = async (name, fn) => {
  try {
    await fn()
    console.log('ok   ', name)
  } catch (e) {
    failed++
    console.log('FALLA', name, '→', e.message.split('\n')[0])
    await page.screenshot({ path: `${out}/fallo-${name.replace(/[^a-z0-9]+/gi, '_')}.png` }).catch(() => {})
  }
}
const dialog = () => page.locator('dialog[open]')
const noOverflow = async (where) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (over > 1) throw new Error(`${where}: desborde horizontal de ${over}px`)
}

await page.goto(`${base}/#/`)
await page.evaluate(() => localStorage.clear())
await page.reload()

await step('arranca en tema oscuro con Europe/Madrid', async () => {
  if ((await page.getAttribute('html', 'data-theme')) !== 'dark') throw new Error('no es oscuro')
  await page.getByRole('heading', { name: 'Panel del estudio' }).waitFor()
})

await step('añadir una tarea para hoy', async () => {
  await page.goto(`${base}/#/hoy`)
  await page.getByLabel('Nueva tarea para hoy').fill('Probar Studio Hub')
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  await page.getByRole('button', { name: 'Probar Studio Hub' }).first().waitFor()
})

await step('marcar hecha y deshacer desde el aviso', async () => {
  await page.getByRole('button', { name: 'Marcar «Probar Studio Hub» como hecho' }).click()
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click()
  await page.getByRole('button', { name: 'Marcar «Probar Studio Hub» como hecho' }).waitFor()
})

await step('el formulario explica los errores', async () => {
  await page.getByRole('button', { name: 'Probar Studio Hub' }).first().click()
  await dialog().locator('input[name="title"]').fill('')
  await dialog().getByRole('button', { name: 'Guardar' }).click()
  await dialog().getByText('Este campo es obligatorio.').waitFor()
  await page.screenshot({ path: `${out}/editor-error.png` })
  await dialog().locator('input[name="title"]').fill('Probar Studio Hub')
  await dialog().locator('select[name="status"]').selectOption('done')
  await dialog().getByRole('button', { name: 'Guardar' }).click()
  await dialog().waitFor({ state: 'detached' })
})

await step('se conserva al recargar', async () => {
  await page.goto(`${base}/#/`)
  await page.reload()
  await page.getByRole('region', { name: 'Últimos avances' }).getByRole('button', { name: 'Probar Studio Hub' }).waitFor()
})

await step('paleta de órdenes con Ctrl+K: buscar y abrir', async () => {
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Buscar o ir a' }).fill('probar')
  await page.screenshot({ path: `${out}/paleta.png` })
  await page.keyboard.press('Enter')
  await dialog().locator('input[name="title"]').waitFor()
  await page.keyboard.press('Escape')
  await dialog().waitFor({ state: 'detached' })
})

await step('acciones rápidas: nuevo proyecto y su ficha', async () => {
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Proyecto' }).click()
  await dialog().locator('input[name="name"]').fill('Juego de Prueba')
  await dialog().getByRole('button', { name: 'Guardar' }).click()
  await page.waitForURL(/#\/proyectos\/juego-de-prueba/)
  await page.getByRole('heading', { name: 'Juego de Prueba' }).waitFor()
})

await step('el ámbito se mantiene al navegar', async () => {
  await page.getByRole('link', { name: 'Tareas y funcionalidades' }).click()
  await page.waitForURL(/proyectos\/juego-de-prueba\/trabajo/)
  await page.getByLabel('Ver todo el estudio o un proyecto').selectOption({ label: 'Indie Dev Tycoon' })
  await page.waitForURL(/proyectos\/indie-dev-tycoon\/trabajo/)
  await page.goto(`${base}/#/agenda?p=indie-dev-tycoon`)
  await page.getByRole('link', { name: 'Builds y versiones' }).click()
  await page.waitForURL(/builds\?p=indie-dev-tycoon/)
})

await step('borrar con confirmación propia y deshacer', async () => {
  await page.goto(`${base}/#/proyectos/juego-de-prueba`)
  await page.getByRole('button', { name: 'Editar el proyecto' }).click()
  await dialog().getByRole('button', { name: 'Borrar' }).click()
  await page.getByRole('dialog', { name: '¿Borrar el proyecto «Juego de Prueba»?' }).getByRole('button', { name: 'Borrar' }).click()
  await page.waitForURL(/#\/proyectos$/)
  if (await page.getByRole('navigation').getByRole('link', { name: 'Juego de Prueba' }).count()) throw new Error('no se ha borrado')
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Juego de Prueba' }).waitFor()
})

await step('guardar una vista con filtros', async () => {
  await page.goto(`${base}/#/trabajo?estado=todos&q=probar`)
  await page.getByRole('button', { name: 'Guardar vista' }).click()
  await dialog().locator('input').fill('Pruebas')
  await dialog().getByRole('button', { name: 'Guardar' }).click()
  await page.goto(`${base}/#/`)
  await page.getByRole('navigation').getByRole('link', { name: 'Pruebas' }).click()
  await page.waitForURL(/trabajo\?estado=todos&q=probar/)
})

await step('notificaciones', async () => {
  await page.getByRole('button', { name: /^Notificaciones/ }).click()
  await page.getByRole('menu', { name: 'Notificaciones' }).waitFor()
  await page.keyboard.press('Escape')
})

await step('personalizar el panel: ocultar y plegar', async () => {
  await page.goto(`${base}/#/`)
  await page.getByRole('button', { name: 'Personalizar' }).click()
  await dialog().getByRole('checkbox', { name: /Cifras/ }).uncheck()
  await dialog().getByRole('button', { name: 'Cerrar' }).first().click()
  if (await page.getByRole('region', { name: 'Cifras' }).count()) throw new Error('Cifras sigue visible')
  await page.getByRole('region', { name: 'Evolución' }).getByRole('button', { name: 'Contraer' }).click()
  await page.reload()
  await page.getByRole('region', { name: 'Evolución' }).getByRole('button', { name: 'Desplegar' }).waitFor()
})

await step('tema claro, acento verde y densidad compacta', async () => {
  await page.goto(`${base}/#/ajustes`)
  await page.getByRole('button', { name: 'Claro' }).click()
  await page.getByRole('button', { name: 'Verde' }).click()
  await page.getByRole('button', { name: 'Compacta' }).click()
  if ((await page.getAttribute('html', 'data-theme')) !== 'light') throw new Error('no cambió a claro')
  if ((await page.getAttribute('html', 'data-density')) !== 'compact') throw new Error('no cambió la densidad')
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
  if (accent !== '#127443') throw new Error(`acento ${accent}`)
  await page.goto(`${base}/#/`)
  await page.screenshot({ path: `${out}/panel-claro.png`, fullPage: true })
  await page.goto(`${base}/#/ajustes`)
  await page.getByRole('button', { name: 'Oscuro' }).click()
  await page.getByRole('button', { name: 'Violeta' }).click()
  await page.getByRole('button', { name: 'Cómoda' }).click()
})

await step('zona horaria y formato de fecha', async () => {
  await page.getByLabel('Formato de fecha').selectOption('numeric')
  await page.getByLabel('Zona horaria').selectOption('America/New_York')
  await page.goto(`${base}/#/historial`)
  await page.getByText(/\d{2}\/\d{2}\/\d{4}/).first().waitFor()
  await page.goto(`${base}/#/ajustes`)
  await page.getByLabel('Formato de fecha').selectOption('short')
  await page.getByLabel('Zona horaria').selectOption('Europe/Madrid')
})

await step('barra lateral contraída', async () => {
  await page.goto(`${base}/#/`)
  await page.getByRole('button', { name: 'Contraer la barra lateral' }).click()
  if ((await page.locator('.app').getAttribute('data-sidebar')) !== 'collapsed') throw new Error('no se contrajo')
  await page.screenshot({ path: `${out}/contraida.png` })
  await page.getByRole('button', { name: 'Expandir la barra lateral' }).click()
})

await step('exportar copia', async () => {
  await page.goto(`${base}/#/ajustes`)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar copia/ }).click()])
  const json = JSON.parse(readFileSync(await download.path(), 'utf8'))
  if (!Array.isArray(json.items)) throw new Error('la copia no trae items')
})

for (const [w, h, name] of [
  [820, 1180, 'tableta'],
  [390, 844, 'movil'],
]) {
  await step(`${name}: menú, panel, tablero y builds sin desbordar`, async () => {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${base}/#/`)
    await noOverflow('panel')
    await page.screenshot({ path: `${out}/${name}-panel.png`, fullPage: true })
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.getByRole('link', { name: 'Builds y versiones' }).click()
    await page.waitForURL(/builds/)
    await noOverflow('builds')
    await page.screenshot({ path: `${out}/${name}-builds.png`, fullPage: true })
    await page.goto(`${base}/#/ajustes`)
    await noOverflow('ajustes')
    await page.goto(`${base}/#/proyectos/indie-dev-tycoon`)
    await noOverflow('ficha')
  })
}

console.log(errors.length ? `\nERRORES DE LA PÁGINA:\n${errors.join('\n')}` : '\nsin errores en la página')
await browser.close()
process.exit(failed || errors.length ? 1 : 0)
