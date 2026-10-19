import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { t } from './i18n'
import { store, useStoreMeta, useStoreStatus } from './data/store'
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
  const status = useStoreStatus()
  if (!status.loadErrors.length) return null
  if (status.remote)
    return (
      <div className="banner banner-danger" role="alert">
        <Icon name="alert" size={16} />
        <div>
          <strong>{t('remote.invalidTitle')}</strong> {t('remote.invalidBody')}
          <ul className="small">
            {status.loadErrors.slice(0, 5).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  return (
    <div className="banner banner-danger" role="alert">
      <Icon name="alert" size={16} />
      <span>Los datos guardados en este navegador no eran válidos y se ha arrancado con los iniciales. Si tenías una copia exportada, impórtala en Ajustes.</span>
    </div>
  )
}

/** En la página de claude.ai: el estado de la base de datos y los permisos. */
function RemoteStatusBanners() {
  const status = useStoreStatus()
  if (!status.remote || status.state !== 'ready') return null
  return (
    <>
      {!status.canWrite && (
        <div className="banner" role="status">
          <Icon name="eye" size={16} />
          <span>{t('remote.readOnly')}</span>
        </div>
      )}
      {status.saveError && (
        <div className="banner banner-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{status.saveError}</span>
        </div>
      )}
    </>
  )
}

/** Hasta que llegan los datos de la base no se enseña nada que pueda engañar (un panel vacío). */
function RemoteGate({ children }: { children: ReactNode }) {
  const status = useStoreStatus()
  if (status.state === 'connecting')
    return (
      <div aria-busy="true">
        <p className="muted small connecting" role="status">
          {t('remote.connecting')}
        </p>
        <PageSkeleton />
      </div>
    )
  if (status.state === 'unavailable')
    return (
      <div className="error-box" role="alert">
        <h1>
          <Icon name="alert" size={20} /> {t('remote.unavailableTitle')}
        </h1>
        <p className="muted">{t('remote.unavailableBody')}</p>
      </div>
    )
  return children
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
            <RemoteStatusBanners />
            <RemoteGate>
              <Screens />
            </RemoteGate>
          </AppShell>
        </UIProvider>
      </FeedbackProvider>
    </HashRouter>
  )
}
