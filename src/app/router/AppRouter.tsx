import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../../shared/components/AppShell';
import { FoundationsPage } from './pages/FoundationsPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="fundamentos" element={<FoundationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
