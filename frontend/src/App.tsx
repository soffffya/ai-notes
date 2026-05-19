import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NotificationsViewport from '@/components/NotificationsViewport';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { NotificationsProvider } from '@/hooks/use-notifications';

const AuthPage = lazy(() => import('@/pages/AuthPage'));
const HomePage = lazy(() => import('@/pages/HomePage'));

function FullscreenStatus({ message }: { message: string }) {
  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <div className="rounded-[28px] border border-border/70 bg-card/90 px-6 py-5 text-card-foreground shadow-soft backdrop-blur-xl">
        {message}
      </div>
    </main>
  );
}

function AppRoutes() {
  const auth = useAuth();
  const { t } = useTranslation();

  if (!auth.isReady) {
    return <FullscreenStatus message={t('app.checkingSession')} />;
  }

  return (
    <Suspense fallback={<FullscreenStatus message={t('app.loadingWorkspace')} />}>
      <Routes>
        <Route
          path="/auth"
          element={auth.isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route
          path="/"
          element={auth.isAuthenticated ? <HomePage /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="*"
          element={<Navigate to={auth.isAuthenticated ? '/' : '/auth'} replace />}
        />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <NotificationsViewport />
          <AppRoutes />
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
