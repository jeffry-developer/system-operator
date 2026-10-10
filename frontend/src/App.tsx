import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PerfilesPage } from './pages/PerfilesPage';
import { PlanDeTrabajoPage } from './pages/PlanDeTrabajoPage';
import { NewFeedPage } from './pages/NewFeedPage';
import { CartasYDinamicasPage } from './pages/CartasYDinamicasPage';
import { PagadorasYHistoriasPage } from './pages/PagadorasYHistoriasPage';
import { ImagenesPage } from './pages/ImagenesPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { useServerStatus } from './hooks/useServerStatus';
import { ServerWakeUp } from './components/ServerWakeUp';

function PrivateRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function PublicRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/perfiles" replace />;
  }

  return <Outlet />;
}

export function App() {
  const { status, elapsedSeconds, retry } = useServerStatus();

  // Mostrar pantalla de carga animada solo cuando el servidor está despertando o falló
  if (status === 'waking' || status === 'error') {
    return (
      <ServerWakeUp
        status={status}
        elapsedSeconds={elapsedSeconds}
        onRetry={retry}
      />
    );
  }

  // status === 'checking' → carga silenciosa (sin bloquear UI)
  // status === 'online'   → app normal
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<PublicRoutes />}>
          <Route index element={<LoginPage />} />
        </Route>
        <Route path="/register" element={<PublicRoutes />}>
          <Route index element={<RegisterPage />} />
        </Route>
        <Route element={<PrivateRoutes />}>
          <Route element={<Layout />}>
            <Route path="/perfiles" element={<PerfilesPage />} />
            <Route path="/plan-trabajo" element={<PlanDeTrabajoPage />} />
            <Route path="/new-feed" element={<NewFeedPage />} />
            <Route path="/cartas-dinamicas" element={<CartasYDinamicasPage />} />
            <Route path="/pagadoras-historias" element={<PagadorasYHistoriasPage />} />
            <Route path="/imagenes" element={<ImagenesPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
            <Route path="/" element={<Navigate to="/perfiles" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/perfiles" replace />} />
      </Routes>
    </ToastProvider>
  );
}

export default App;