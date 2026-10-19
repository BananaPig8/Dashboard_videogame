/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const SEED = fileURLToPath(new URL('./src/data/seed/index.ts', import.meta.url))
const SEED_VACIO = fileURLToPath(new URL('./src/data/seed/vacio.ts', import.meta.url))

/** En la build para claude.ai los datos están en la base de la página: fuera los iniciales. */
function sinDatosIniciales(): Plugin {
  return {
    name: 'studio-hub:sin-datos-iniciales',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !/seed$/.test(source)) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved?.id === SEED ? SEED_VACIO : null
    },
  }
}

// base relativa: la misma build vale en GitHub Pages (/Dashboard_videogame/), en local y en
// la página de claude.ai (VITE_DESTINO=artifact, ver docs/ARQUITECTURA.md).
export default defineConfig(({ mode }) => {
  const enClaude = process.env.VITE_DESTINO === 'artifact' || mode === 'artifact'
  return {
    plugins: [react(), ...(enClaude ? [sinDatosIniciales()] : [])],
    base: './',
    define: enClaude ? { 'import.meta.env.VITE_DESTINO': JSON.stringify('artifact') } : undefined,
    build: enClaude ? { outDir: 'dist-claude' } : undefined,
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
