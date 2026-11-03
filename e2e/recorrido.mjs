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

await step('añadir una tarea para hoy (la ruta antigua /hoy lleva al plan de hoy)', async () => {
  await page.goto(`${base}/#/hoy`)
  await page.waitForURL(/tareas\?vista=hoy/)
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
  // Sale creada y completada: dos entradas de la misma tarea.
  await page.getByRole('region', { name: 'Actividad reciente' }).getByRole('button', { name: 'Probar Studio Hub' }).first().waitFor()
})

// ——— Dashboard (parte 4) ———
const region = (name) => page.getByRole('region', { name, exact: true })

await step('Dashboard: cabecera con saludo, estudio, periodo y Crear con lo de cada día', async () => {
  await page.goto(`${base}/#/`)
  await page.getByText(/Buen(os días|as tardes|as noches)/).first().waitFor()
  await page.getByRole('combobox', { name: 'Periodo' }).selectOption('30d')
  await page.waitForURL(/periodo=30d/)
  await page.getByRole('button', { name: /^Crear/ }).first().click()
  const options = await page.getByRole('menu').getByRole('menuitem').count()
  if (options !== 11) throw new Error(`Crear tiene ${options} opciones`)
  await page.keyboard.press('Escape')
})

await step('Dashboard: «Tareas completadas» lleva a Tareas con las mismas', async () => {
  await page.goto(`${base}/#/?periodo=30d`)
  const kpi = page.locator('[data-kpi="completed"]')
  const n = (await kpi.locator('.stat-value').innerText()).trim()
  await kpi.click()
  await page.waitForURL(/tareas\?.*estado=done.*desde=/)
  const count = await page.locator('.tareas-count').innerText()
  if (!count.includes(n)) throw new Error(`el indicador dice ${n} y Tareas «${count}»`)
})

await step('Dashboard: una prioridad se marca hecha sin salir, con Deshacer', async () => {
  await page.goto(`${base}/#/`)
  await page.getByRole('button', { name: 'Nueva tarea' }).first().click()
  await dialog().locator('[name="title"]').fill('Revisar el guardado')
  await dialog().locator('[name="priority"]').selectOption('critical')
  await dialog().getByRole('button', { name: 'Guardar' }).click()
  await dialog().waitFor({ state: 'detached' })
  const done = region('Prioridades de hoy').getByRole('button', { name: 'Marcar «Revisar el guardado» como hecho' })
  await done.click()
  await done.waitFor({ state: 'detached' })
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click()
  await done.waitFor()
})

await step('Dashboard: próximas fechas en lista o calendario, y se recuerda', async () => {
  await region('Próximas fechas').getByRole('button', { name: 'Calendario', exact: true }).click()
  await page.locator('table.agenda-grid').waitFor()
  await page.reload()
  await page.locator('table.agenda-grid').waitFor()
  await region('Próximas fechas').getByRole('button', { name: 'Lista', exact: true }).click()
  await page.locator('table.agenda-grid').waitFor({ state: 'detached' })
})

await step('Dashboard: proyectos por estado, con progreso y su método', async () => {
  await region('Proyectos').getByRole('button', { name: /En planificación/ }).click()
  await page.waitForURL(/estado=planificacion/)
  await region('Proyectos').getByRole('button', { name: /Activos/ }).click()
  const card = region('Proyectos').locator('.project-card').filter({ hasText: 'Indie Dev Tycoon' })
  const text = await card.innerText()
  if (!/\d+\s?%/.test(text) || !text.includes('por tareas')) throw new Error(`la tarjeta no dice su progreso y método: ${text.slice(0, 200)}`)
})

await step('Dashboard: convertir un feedback en tarea lo enlaza y lo planifica', async () => {
  await page.goto(`${base}/#/feedback`)
  await page.getByRole('button', { name: 'Nuevo feedback' }).first().click()
  await dialog().locator('[name="title"]').fill('Poder rebobinar el día')
  await dialog().locator('[name="kind"]').selectOption('request')
  await dialog().locator('[name="impact"]').selectOption('high')
  await dialog().getByRole('button', { name: 'Guardar' }).click()
  await dialog().waitFor({ state: 'detached' })
  await page.goto(`${base}/#/`)
  await region('Feedback').getByRole('button', { name: 'Convertir en tarea: Poder rebobinar el día' }).click()
  if ((await dialog().locator('[name="kind"]').inputValue()) !== 'feature') throw new Error('no la abre como funcionalidad')
  await dialog().getByRole('button', { name: 'Guardar' }).click()
  await page.getByRole('status').getByText(/pasa a Planificado/).waitFor()
  if (await region('Feedback').getByRole('button', { name: 'Convertir en tarea: Poder rebobinar el día' }).count()) throw new Error('sigue por mirar')
})

await step('Dashboard: historial de actividad con filtros en la URL', async () => {
  await region('Actividad reciente').getByRole('link', { name: 'Historial', exact: true }).click()
  await page.waitForURL(/ver=actividad/)
  await page.getByLabel('Categoría').selectOption('codigo')
  await page.waitForURL(/cat=codigo/)
  await page.getByRole('button', { name: 'Quitar filtros' }).click()
})

await step('Dashboard: personalizar los indicadores y volver a la disposición de serie', async () => {
  await page.goto(`${base}/#/`)
  await page.getByRole('button', { name: 'Personalizar' }).click()
  await dialog().getByRole('checkbox', { name: /Tareas bloqueadas/ }).uncheck()
  await dialog().getByRole('button', { name: 'Cerrar' }).first().click()
  if (await page.locator('[data-kpi="blocked"]').count()) throw new Error('sigue la cifra de bloqueadas')
  await page.reload()
  if (await page.locator('[data-kpi="blocked"]').count()) throw new Error('no se ha recordado')
  await page.getByRole('button', { name: 'Personalizar' }).click()
  await dialog().getByRole('button', { name: 'Volver a la de serie' }).click()
  await dialog().getByRole('button', { name: 'Cerrar' }).first().click()
  await page.locator('[data-kpi="blocked"]').waitFor()
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
  await page.getByRole('navigation', { name: 'Secciones del proyecto' }).getByRole('link', { name: /^Tareas/ }).click()
  await page.waitForURL(/proyectos\/juego-de-prueba\/tareas/)
  await page.locator('nav.tabs-bar a[aria-current="page"]', { hasText: 'Tareas' }).waitFor()
  await page.getByLabel('Ver todo el estudio o un proyecto').selectOption({ label: 'Indie Dev Tycoon' })
  await page.waitForURL(/proyectos\/indie-dev-tycoon\/tareas/)
  // La ruta antigua /agenda lleva al Calendario conservando el ámbito.
  await page.goto(`${base}/#/agenda?p=indie-dev-tycoon`)
  await page.waitForURL(/calendario\?p=indie-dev-tycoon/)
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Builds y versiones', exact: true }).click()
  await page.waitForURL(/builds\?p=indie-dev-tycoon/)
})

await step('subsecciones que se combinan: «Mis tareas» en «Tablero Kanban»', async () => {
  await page.goto(`${base}/#/tareas?filtro=mias`)
  await page.getByRole('navigation', { name: /Subsecciones de Tareas/ }).getByRole('link', { name: 'Tablero Kanban', exact: true }).click()
  await page.waitForURL(/filtro=mias&vista=tablero|vista=tablero&filtro=mias/)
  const current = page.getByRole('navigation', { name: /Subsecciones de Tareas/ }).locator('[aria-current]')
  if ((await current.count()) !== 2) throw new Error(`activas: ${await current.count()}`)
})

await step('teclado: saltar al contenido, el foco en las subsecciones y al cerrar el editor', async () => {
  const focused = () => page.evaluate(() => {
    const el = document.activeElement
    return el ? `${el.tagName}#${el.id}|${el.getAttribute('data-sub') ?? ''}|${el.textContent?.trim().slice(0, 40)}` : ''
  })
  // «Saltar al contenido» no cambia de pantalla (con HashRouter, «#contenido» sería una ruta).
  // Cambiar solo el «#» no recarga: se recarga para empezar como al abrir la página.
  await page.goto(`${base}/#/builds?canal=demos`)
  await page.reload()
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.keyboard.press('Tab')
  const first = await focused()
  if (!first.endsWith('|Saltar al contenido')) throw new Error(`lo primero con Tab no es el salto: ${first}`)
  await page.keyboard.press('Enter')
  if (!page.url().includes('/builds?canal=demos')) throw new Error(`el salto cambió la pantalla: ${page.url()}`)
  if (!(await focused()).startsWith('MAIN#contenido')) throw new Error(`foco tras el salto: ${await focused()}`)
  // Elegir con el teclado una subsección cuya vista pinta otra cabecera: el foco sigue en su pestaña.
  await page.goto(`${base}/#/publicacion`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  const tab = page.getByRole('navigation', { name: /Subsecciones de Publicación/ }).locator('[data-sub]').nth(2)
  const sub = await tab.getAttribute('data-sub')
  await tab.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction((id) => document.activeElement?.getAttribute('data-sub') === id, sub)
  // Al cerrar el editor con Esc, el foco vuelve al botón que lo abrió.
  await page.goto(`${base}/#/proyectos/juego-de-prueba`)
  await page.getByRole('button', { name: 'Editar el proyecto' }).click()
  await dialog().waitFor()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Editar el proyecto')
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
  await page.goto(`${base}/#/tareas?estado=todos&q=probar`)
  await page.getByRole('button', { name: 'Guardar vista' }).click()
  await dialog().locator('input').fill('Mis pruebas')
  await dialog().getByRole('button', { name: 'Guardar' }).click()
  await page.goto(`${base}/#/`)
  await page.getByRole('navigation').getByRole('link', { name: 'Mis pruebas', exact: true }).click()
  await page.waitForURL(/tareas\?estado=todos&q=probar/)
})

await step('notificaciones', async () => {
  await page.getByRole('button', { name: /^Notificaciones/ }).click()
  await page.getByRole('dialog', { name: 'Notificaciones' }).waitFor()
  await page.keyboard.press('Escape')
})

await step('personalizar el panel: ocultar y plegar', async () => {
  await page.goto(`${base}/#/`)
  await page.getByRole('button', { name: 'Personalizar' }).click()
  await dialog().getByRole('checkbox', { name: /Indicadores/ }).uncheck()
  await dialog().getByRole('button', { name: 'Cerrar' }).first().click()
  if (await page.getByRole('region', { name: 'Indicadores' }).count()) throw new Error('Indicadores sigue visible')
  await page.getByRole('region', { name: 'Evolución' }).getByRole('button', { name: 'Contraer' }).click()
  await page.reload()
  await page.getByRole('region', { name: 'Evolución' }).getByRole('button', { name: 'Desplegar' }).waitFor()
})

await step('tema claro, acento verde y densidad compacta', async () => {
  await page.goto(`${base}/#/ajustes?seccion=preferencias`)
  await page.getByRole('button', { name: 'Claro' }).click()
  await page.getByRole('button', { name: 'Verde' }).click()
  await page.getByRole('button', { name: 'Compacta' }).click()
  if ((await page.getAttribute('html', 'data-theme')) !== 'light') throw new Error('no cambió a claro')
  if ((await page.getAttribute('html', 'data-density')) !== 'compact') throw new Error('no cambió la densidad')
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
  if (accent !== '#127443') throw new Error(`acento ${accent}`)
  await page.goto(`${base}/#/`)
  await page.screenshot({ path: `${out}/panel-claro.png`, fullPage: true })
  await page.goto(`${base}/#/ajustes?seccion=preferencias`)
  await page.getByRole('button', { name: 'Oscuro' }).click()
  await page.getByRole('button', { name: 'Violeta' }).click()
  await page.getByRole('button', { name: 'Cómoda' }).click()
})

await step('zona horaria y formato de fecha', async () => {
  await page.getByLabel('Formato de fecha').selectOption('numeric')
  await page.getByLabel('Zona horaria').selectOption('America/New_York')
  await page.goto(`${base}/#/builds?vista=cambios`)
  await page.getByText(/\d{2}\/\d{2}\/\d{4}/).first().waitFor()
  await page.goto(`${base}/#/ajustes?seccion=preferencias`)
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
  await page.goto(`${base}/#/ajustes?seccion=datos`)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar copia/ }).click()])
  const json = JSON.parse(readFileSync(await download.path(), 'utf8'))
  if (!Array.isArray(json.items)) throw new Error('la copia no trae items')
})

// Todas las secciones y subsecciones de la barra lateral, en el estudio y en la ficha de un
// proyecto: cada una abre su página, sin errores ni desbordamiento.
let allPages = []
await step('recorrer las 15 secciones y todas sus subsecciones', async () => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${base}/#/`)
  const nav = page.getByRole('complementary', { name: 'Navegación' })
  // Despliega todas las secciones.
  const closed = nav.locator('button.nav-toggle[aria-expanded="false"]')
  while (await closed.count()) await closed.first().click()
  const hrefs = [...new Set(await nav.locator('a.nav-sublink').evaluateAll((as) => as.map((a) => a.getAttribute('href'))))]
  if (hrefs.length < 90) throw new Error(`solo ${hrefs.length} subsecciones en la barra`)
  const before = errors.length
  for (const href of hrefs) {
    await page.goto(`${base}/${href}`)
    await page.locator('main h1').first().waitFor()
    await noOverflow(href)
  }
  // Las mismas secciones dentro de la ficha de un proyecto.
  await page.goto(`${base}/#/proyectos/indie-dev-tycoon`)
  await page.locator('nav.tabs-bar a').first().waitFor()
  const tabs = await page.locator('nav.tabs-bar a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  const more = page.getByRole('button', { name: 'Más', exact: true })
  if (await more.count()) {
    await more.click()
    tabs.push(...(await page.getByRole('menuitem').evaluateAll((as) => as.map((a) => a.getAttribute('href')))))
    await page.keyboard.press('Escape')
  }
  if (tabs.length < 13) throw new Error(`solo ${tabs.length} pestañas en la ficha`)
  for (const href of tabs) {
    await page.goto(`${base}/${href}`)
    await page.locator('main h1').first().waitFor()
    await noOverflow(href)
  }
  allPages = [...hrefs, ...tabs]
  if (errors.length > before) throw new Error(`errores al recorrer: ${errors.slice(before).join(' | ')}`)
  console.log(`      ${hrefs.length} subsecciones y ${tabs.length} pestañas de la ficha`)
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
    await page.getByRole('link', { name: 'Builds y versiones', exact: true }).click()
    await page.waitForURL(/builds/)
    // Elegir algo en el menú lo cierra (también una subsección, que solo cambia la consulta).
    await page.locator('.app.menu-open').waitFor({ state: 'detached', timeout: 2000 })
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.getByRole('complementary', { name: 'Navegación' }).getByRole('link', { name: 'Demos', exact: true }).click()
    await page.waitForURL(/canal=demos/)
    await page.locator('.app.menu-open').waitFor({ state: 'detached', timeout: 2000 })
    await noOverflow('builds')
    await page.screenshot({ path: `${out}/${name}-builds.png`, fullPage: true })
    await page.goto(`${base}/#/ajustes`)
    await noOverflow('ajustes')
    await page.goto(`${base}/#/proyectos/indie-dev-tycoon`)
    await noOverflow('ficha')
    // Y cada sección y subsección a este ancho.
    for (const href of allPages) {
      await page.goto(`${base}/${href}`)
      await page.locator('main h1').first().waitFor()
      await noOverflow(`${name} ${href}`)
    }
  })
}

console.log(errors.length ? `\nERRORES DE LA PÁGINA:\n${errors.join('\n')}` : '\nsin errores en la página')
await browser.close()
process.exit(failed || errors.length ? 1 : 0)
