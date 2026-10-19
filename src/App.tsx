import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { t } from './i18n'
import { store, useStoreMeta, useStoreStatus } from './data/store'
import { SEED_VERSION } from './data/seed'
import { AppShell } from './ui/AppShell'
import { allSections, migratePath, OLD_PATHS } from './ui/navigation'
import { SECTION_PAGES } from './ui/sections/registry'
import { UIProvider } from './ui/context'
import { ErrorBoundary, FeedbackProvider, PageSkeleton } from './ui/feedback'
import { Icon } from './ui/components/Icon'

// Cada sección se carga cuando se abre (sections/registry.tsx): el arranque es más rápido.
const ProjectPage = lazy(() => import('./ui/pages/Projects').then((m) => ({ default: m.ProjectPage })))
const EtiquetasPage = lazy(() => import('./ui/sections/etiquetas/EtiquetasPage'))

/** Lleva una ruta de la versión anterior a la de ahora (con su consulta). */
function MigrateRedirect() {
  const location = useLocation()
  return <Navigate to={migratePath(location.pathname + location.search)} replace />
}

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
          {allSections().map((section) => {
            const Page = SECTION_PAGES[section.id]
            return <Route key={section.id} path={section.to} element={<Page />} />
          })}
          <Route path="/etiquetas/:tag" element={<EtiquetasPage />} />
          <Route path="/proyectos/:slug" element={<ProjectPage />} />
          <Route path="/proyectos/:slug/:tab" element={<ProjectPage />} />
          {OLD_PATHS.map((from) => (
            <Route key={from} path={from} element={<MigrateRedirect />} />
          ))}
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
