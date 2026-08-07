import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../../shared/components/AppShell';
import { AdminOnly } from '../auth/AdminOnly';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../auth/LoginPage';
import { SessionStatePage } from '../auth/SessionStatePage';
import { ActivityPage } from './pages/ActivityPage';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogPage, ClientsPage, EquipmentPage, SitesPage } from './pages/DirectoryPages';
import { EquipmentDetailPage } from './pages/EquipmentDetailPage';
import { HelpCenterPage } from './pages/HelpCenterPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { QuoteBuilderPage } from './pages/QuoteBuilderPage';
import { QuotesPage } from './pages/QuotesPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { RequestsPage } from './pages/RequestsPage';
import { RequestWizardPage } from './pages/RequestWizardPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { LoadingState } from '../../shared/components/Ui';

export function AppRouter() {
  const { user, profile, loading, problem } = useAuth();
  if (loading) return <LoadingState label="Restaurando sesión…" />;
  if (!user) return <LoginPage />;
  if (problem || !profile) return <SessionStatePage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="solicitudes" element={<RequestsPage />} />
        <Route path="solicitudes/nueva" element={<RequestWizardPage />} />
        <Route path="solicitudes/:requestId" element={<RequestDetailPage />} />
        <Route path="cotizaciones" element={<QuotesPage />} />
        <Route path="cotizaciones/nueva" element={<QuoteBuilderPage />} />
        <Route path="cotizaciones/:quoteId" element={<QuoteBuilderPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="instalaciones" element={<SitesPage />} />
        <Route path="equipos" element={<EquipmentPage />} />
        <Route path="equipos/:equipmentId" element={<EquipmentDetailPage />} />
        <Route path="catalogo" element={<CatalogPage />} />
        <Route path="actividad" element={<ActivityPage />} />
        <Route
          path="usuarios"
          element={
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          }
        />
        <Route
          path="configuracion"
          element={
            <AdminOnly>
              <SettingsPage />
            </AdminOnly>
          }
        />
        <Route path="ayuda" element={<HelpCenterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
