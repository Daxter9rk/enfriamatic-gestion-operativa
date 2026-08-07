import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';

const state = vi.hoisted(() => ({
  auth: {
    user: null as { uid: string } | null,
    profile: null as Record<string, unknown> | null,
    hasDirectReports: false,
    loading: false,
    problem: null as string | null,
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => state.auth,
  useOperationalProfile: () => {
    const profile = state.auth.profile;
    if (!profile) return null;
    if (profile.role === 'admin') {
      return profile.isPrimaryAdmin ? 'primary_admin' : 'promoted_admin';
    }
    return state.auth.hasDirectReports ? 'supervisor' : 'operator';
  },
}));

vi.mock('../../shared/hooks/useCollectionData', () => ({
  useCollectionData: () => ({ data: [], loading: false, error: null }),
}));

function activeProfile(role: 'admin' | 'operator', isPrimaryAdmin = false) {
  return {
    uid: 'user-1',
    email: 'user@example.test',
    displayName: 'Usuario DEV',
    role,
    status: 'active',
    supervisorId: null,
    teamId: null,
    isPrimaryAdmin,
  };
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe('AppRouter', () => {
  beforeEach(() => {
    state.auth.user = null;
    state.auth.profile = null;
    state.auth.hasDirectReports = false;
    state.auth.loading = false;
    state.auth.problem = null;
  });

  it('shows login when no authenticated session exists', () => {
    renderRoute('/');
    expect(screen.getByRole('heading', { name: /Inicia sesi/i })).toBeInTheDocument();
  });

  it('renders the administrator dashboard and navigation', () => {
    state.auth.user = { uid: 'admin-1' };
    state.auth.profile = activeProfile('admin', true);
    renderRoute('/');
    expect(screen.getByRole('heading', { name: /Panel de control/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Usuarios y estructura/i })).toBeInTheDocument();
  });

  it('blocks administrator routes for an operator', () => {
    state.auth.user = { uid: 'operator-1' };
    state.auth.profile = activeProfile('operator');
    renderRoute('/usuarios');
    expect(screen.getByRole('heading', { name: 'Permiso insuficiente' })).toBeInTheDocument();
  });

  it('renders the not found state for an unknown route', () => {
    state.auth.user = { uid: 'admin-1' };
    state.auth.profile = activeProfile('admin', true);
    renderRoute('/ruta-inexistente');
    expect(screen.getByText(/no existe/i)).toBeInTheDocument();
  });
});
