// Datos de partida de la build para claude.ai: vacíos. Allí los datos viven en la base de
// la página (los escribe el estudio o Claude), así que la build no lleva los iniciales.
// vite.config.ts pone este fichero en lugar de seed/index.ts cuando VITE_DESTINO=artifact.
import { emptyCollections } from '../../domain/collections'
import type { StudioData } from '../../domain/types'
import { SCHEMA_VERSION } from '../../domain/types'

export const SEED_VERSION = 'base-de-datos'

export function createSeedData(): StudioData {
  return {
    schemaVersion: SCHEMA_VERSION,
    studio: { id: 'estudio', name: 'Mi estudio', tagline: 'Cámbialo en Ajustes.', createdAt: '2026-09-27' },
    ...emptyCollections(),
  }
}
