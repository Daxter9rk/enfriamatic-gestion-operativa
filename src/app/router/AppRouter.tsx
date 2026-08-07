import { lazy, Suspense, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../../shared/components/AppShell';
import { AdminOnly } from '../auth/AdminOnly';
import { useAuth } from '../auth/AuthContext';
import { LoginPage } from '../auth/LoginPage';
import { SessionStatePage } from '../auth/SessionStatePage';
import { LoadingState } from '../../shared/components/Ui';

const route = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({ default: (await loader())[name] as ComponentType }));

const ActivityPage = route(() => import('./pages/ActivityPage'), 'ActivityPage');
const DashboardPage = route(() => import('./pages/DashboardPage'), 'DashboardPage');
const ClientsPage = route(() => import('./pages/DirectoryPages'), 'ClientsPage');
const SitesPage = route(() => import('./pages/DirectoryPages'), 'SitesPage');
const EquipmentPage = route(() => import('./pages/DirectoryPages'), 'EquipmentPage');
const CatalogPage = route(() => import('./pages/DirectoryPages'), 'CatalogPage');
const EquipmentDetailPage = route(
  () => import('./pages/EquipmentDetailPage'),
  'EquipmentDetailPage',
);
const HelpCenterPage = route(() => import('./pages/HelpCenterPage'), 'HelpCenterPage');
const NotFoundPage = route(() => import('./pages/NotFoundPage'), 'NotFoundPage');
const QuoteBuilderPage = route(() => import('./pages/QuoteBuilderPage'), 'QuoteBuilderPage');
const QuotesPage = route(() => import('./pages/QuotesPage'), 'QuotesPage');
const RequestDetailPage = route(() => import('./pages/RequestDetailPage'), 'RequestDetailPage');
const RequestsPage = route(() => import('./pages/RequestsPage'), 'RequestsPage');
const RequestWizardPage = route(() => import('./pages/RequestWizardPage'), 'RequestWizardPage');
const SettingsPage = route(() => import('./pages/SettingsPage'), 'SettingsPage');
const UsersPage = route(() => import('./pages/UsersPage'), 'UsersPage');
const TeamPage = route(() => import('./pages/TeamPage'), 'TeamPage');

export function AppRouter() {
  const { user, profile, loading, problem } = useAuth();
  if (loading) return <LoadingState label="Restaurando sesión…" />;
  if (!user) return <LoginPage />;
  if (problem || !profile) return <SessionStatePage />;

  return (
    <Suspense fallback={<LoadingState label="Cargando módulo…" />}>
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
          <Route path="equipo" element={<TeamPage />} />
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
    </Suspense>
  );
}
