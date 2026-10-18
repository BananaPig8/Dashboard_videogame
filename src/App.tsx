import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { store, useStoreMeta } from './data/store'
import { SEED_VERSION } from './data/seed'
import { AppShell } from './ui/AppShell'
import { UIProvider } from './ui/context'
import { Icon } from './ui/components/Icon'
import { HistoryPage } from './ui/pages/History'
import { DashboardPage } from './ui/pages/Overview'
import { AgendaPage, BuildsPage, DecisionsPage, FeedbackPage, PublishPage, ResourcesPage } from './ui/pages/Production'
import { ProjectPage, ProjectsPage } from './ui/pages/Projects'
import { SettingsPage } from './ui/pages/Settings'
import { TodayPage } from './ui/pages/Today'
import { WorkPage } from './ui/pages/Work'

function SeedBanner() {
  const meta = useStoreMeta()
  if (meta.seedVersion === SEED_VERSION) return null
  return (
    <div className="banner" role="status">
      <Icon name="download" size={16} />
      <span>Hay datos iniciales nuevos (versión {SEED_VERSION}).</span>
      <button type="button" className="btn btn-small" onClick={() => store.applySeedUpdate()}>
        Traerlos
      </button>
      <Link to="/ajustes" className="small">
        Qué significa
      </Link>
    </div>
  )
}

function LoadErrors() {
  if (!store.loadErrors.length) return null
  return (
    <div className="banner banner-danger" role="alert">
      <Icon name="alert" size={16} />
      <span>Los datos guardados en este navegador no eran válidos y se ha arrancado con los iniciales. Si tenías una copia exportada, impórtala en Ajustes.</span>
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <UIProvider>
        <AppShell>
          <LoadErrors />
          <SeedBanner />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/hoy" element={<TodayPage />} />
            <Route path="/trabajo" element={<WorkPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/builds" element={<BuildsPage />} />
            <Route path="/publicacion" element={<PublishPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/decisiones" element={<DecisionsPage />} />
            <Route path="/recursos" element={<ResourcesPage />} />
            <Route path="/historial" element={<HistoryPage />} />
            <Route path="/proyectos" element={<ProjectsPage />} />
            <Route path="/proyectos/:slug" element={<ProjectPage />} />
            <Route path="/proyectos/:slug/:tab" element={<ProjectPage />} />
            <Route path="/ajustes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </UIProvider>
    </HashRouter>
  )
}
