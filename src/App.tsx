import { lazy, Suspense } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { t } from './i18n'
import { store, useStoreMeta } from './data/store'
import { SEED_VERSION } from './data/seed'
import { AppShell } from './ui/AppShell'
import { UIProvider } from './ui/context'
import { ErrorBoundary, FeedbackProvider, PageSkeleton } from './ui/feedback'
import { Icon } from './ui/components/Icon'

// Cada pantalla se carga cuando se abre: el arranque es más rápido.
const DashboardPage = lazy(() => import('./ui/pages/Overview').then((m) => ({ default: m.DashboardPage })))
const TodayPage = lazy(() => import('./ui/pages/Today').then((m) => ({ default: m.TodayPage })))
const WorkPage = lazy(() => import('./ui/pages/Work').then((m) => ({ default: m.WorkPage })))
const HistoryPage = lazy(() => import('./ui/pages/History').then((m) => ({ default: m.HistoryPage })))
const ProjectsPage = lazy(() => import('./ui/pages/Projects').then((m) => ({ default: m.ProjectsPage })))
const ProjectPage = lazy(() => import('./ui/pages/Projects').then((m) => ({ default: m.ProjectPage })))
const SettingsPage = lazy(() => import('./ui/pages/Settings').then((m) => ({ default: m.SettingsPage })))
const AgendaPage = lazy(() => import('./ui/pages/Production').then((m) => ({ default: m.AgendaPage })))
const BuildsPage = lazy(() => import('./ui/pages/Production').then((m) => ({ default: m.BuildsPage })))
const PublishPage = lazy(() => import('./ui/pages/Production').then((m) => ({ default: m.PublishPage })))
const FeedbackPage = lazy(() => import('./ui/pages/Production').then((m) => ({ default: m.FeedbackPage })))
const DecisionsPage = lazy(() => import('./ui/pages/Production').then((m) => ({ default: m.DecisionsPage })))
const ResourcesPage = lazy(() => import('./ui/pages/Production').then((m) => ({ default: m.ResourcesPage })))

function SeedBanner() {
  const meta = useStoreMeta()
  if (meta.seedVersion === SEED_VERSION) return null
  return (
    <div className="banner" role="status">
      <Icon name="download" size={16} />
      <span>{t('notifications.seedUpdate', { version: SEED_VERSION })}</span>
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

function Screens() {
  const location = useLocation()
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageSkeleton />}>
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
      </Suspense>
    </ErrorBoundary>
  )
}

export function App() {
  return (
    <HashRouter>
      <FeedbackProvider>
        <UIProvider>
          <AppShell>
            <LoadErrors />
            <SeedBanner />
            <Screens />
          </AppShell>
        </UIProvider>
      </FeedbackProvider>
    </HashRouter>
  )
}
