import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import { App } from './App'
import { initPreferences } from './ui/prefs'
import './styles.css'

// Antes de pintar: zona horaria, idioma, tema, acento y densidad.
initPreferences()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
