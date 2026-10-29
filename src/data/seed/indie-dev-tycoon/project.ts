import type { Project } from '../../../domain/types'

// Ficha del primer proyecto del estudio. Todo sale del repositorio del juego
// (README, project.yaml, export_presets.cfg y la release «descargas») a 2026-10-29.
export const INDIE_DEV_TYCOON: Project = {
  id: 'indie-dev-tycoon',
  slug: 'indie-dev-tycoon',
  name: 'Indie Dev Tycoon',
  tagline: 'De tu cuarto en 1984 a una sede central en 2050.',
  description:
    'Tycoon de gestión de un estudio de videojuegos, inspirado en Game Dev Tycoon: crear juegos, contratar empleados, ' +
    'ingresos, gastos y salarios, mejoras del estudio y progresión por años. Hecho en Godot 4.7 en pixel art; ' +
    'la versión web en JavaScript es la referencia del motor y las dos tienen que dar lo mismo.',
  engine: 'Godot',
  engineVersion: '4.7',
  genre: 'Tycoon / gestión',
  platforms: ['Windows', 'Linux', 'macOS', 'Web'],
  stage: 'production',
  nextGoal: 'Llevar la Demo 1.4 a Steam: compilarla cuando Actions vuelva a arrancar, validar las traducciones con hablantes nativos y completar los pasos de Steamworks.',
  startedAt: '2026-09-27',
  color: '#f59e0b',
  repoUrl: 'https://github.com/BananaPig8/Indie-Dev-Tycoon',
  versions: [
    { label: 'Juego completo', version: '0.0.8' },
    { label: 'Demo', version: '1.3', note: 'La 1.4 está en main desde el 28-10 (PR #40), pero aún sin compilar en la release.' },
    { label: 'Demo V2', version: '1.3 V2', note: 'Con las barras de las fases de antes; la 1.4 la sustituye y deja de compilarse aparte.' },
    { label: 'Demo Valladolid', version: '1.0', note: 'La de la feria, con modo stand.' },
  ],
  tags: ['godot', 'pixel-art', 'tycoon', 'steam'],
  links: [
    { label: 'Repositorio', url: 'https://github.com/BananaPig8/Indie-Dev-Tycoon' },
    { label: 'Descargas (release)', url: 'https://github.com/BananaPig8/Indie-Dev-Tycoon/releases/tag/descargas' },
    { label: 'Discord', url: 'https://discord.gg/x37cnneKQu' },
  ],
}
