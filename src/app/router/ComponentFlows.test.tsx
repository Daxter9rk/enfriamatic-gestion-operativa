import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpCenterPage } from './pages/HelpCenterPage';
import { QuoteBuilderPage } from './pages/QuoteBuilderPage';
import { RequestWizardPage } from './pages/RequestWizardPage';

const mocks: {
  role: 'admin' | 'operator';
  collections: Map<string, unknown[]>;
  callBackend: ReturnType<typeof vi.fn<(name: string, payload: unknown) => Promise<unknown>>>;
} = vi.hoisted(() => ({
  role: 'admin',
  collections: new Map<string, unknown[]>(),
  callBackend: vi.fn<(name: string, payload: unknown) => Promise<unknown>>(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1' },
    profile: {
      uid: 'user-1',
      email: 'user@example.test',
      displayName: 'Usuario DEV',
      role: mocks.role,
      status: 'active',
      supervisorId: null,
      teamId: null,
      isPrimaryAdmin: mocks.role === 'admin',
    },
    hasDirectReports: false,
    loading: false,
    problem: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  useOperationalProfile: () => (mocks.role === 'admin' ? 'primary_admin' : 'operator'),
}));

vi.mock('../../shared/hooks/useCollectionData', () => ({
  useCollectionData: (path: string) => ({
    data: mocks.collections.get(path) ?? [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../shared/hooks/useAuthorizedQuotes', () => ({
  useAuthorizedQuotes: () => ({
    data: mocks.collections.get('quotes') ?? [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../shared/services/callables', () => ({
  callBackend: (name: string, payload: unknown) => mocks.callBackend(name, payload),
}));

describe('critical component flows', () => {
  beforeEach(() => {
    mocks.role = 'admin';
    mocks.collections.clear();
    mocks.callBackend.mockReset();
  });

  it('completes the six-step request wizard', async () => {
    const user = userEvent.setup();
    mocks.collections.set('clients', [
      { id: 'client-1', name: 'Cliente DEV', contactName: 'Contacto', active: true },
    ]);
    mocks.collections.set('sites', [
      {
        id: 'site-1',
        clientId: 'client-1',
        name: 'Planta DEV',
        address: 'Calle DEV',
        active: true,
      },
    ]);
    mocks.collections.set('equipment', []);
    mocks.collections.set('users', []);
    mocks.callBackend.mockResolvedValue({ requestId: 'request-1' });

    render(
      <MemoryRouter>
        <RequestWizardPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /Cliente DEV/i }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: /Planta DEV/i }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.type(screen.getByLabelText('Fecha solicitada'), '2026-08-10');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.type(screen.getByRole('textbox'), 'Diagnostico preventivo del equipo DEV.');
    await user.click(screen.getByRole('button', { name: 'Crear solicitud' }));

    expect(mocks.callBackend).toHaveBeenCalledWith(
      'createServiceRequest',
      expect.objectContaining({ clientId: 'client-1', siteId: 'site-1' }),
    );
  });

  it('recalculates and issues a draft quote', async () => {
    const user = userEvent.setup();
    mocks.collections.set('quotes', [
      {
        id: 'quote-1',
        folio: null,
        status: 'draft',
        locked: false,
        discountDisplayMode: 'detailed',
        notes: '',
        conditions: [],
        validityDays: 15,
        documentId: null,
      },
    ]);
    mocks.collections.set('quotes/quote-1/items', [
      {
        id: 'item-1',
        code: 'SERV-1',
        description: 'Servicio DEV',
        unit: 'servicio',
        quantity: 1,
        originalUnitPrice: 100,
        discountPercent: 0,
        taxRate: 0.16,
      },
    ]);
    mocks.collections.set('catalogItems', []);
    mocks.callBackend.mockResolvedValue({ folio: 'COT-2026-0001', status: 'issued' });

    render(
      <MemoryRouter initialEntries={['/cotizaciones/quote-1']}>
        <Routes>
          <Route path="/cotizaciones/:quoteId" element={<QuoteBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText('116.00').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Emitir y generar PDF' }));
    expect(mocks.callBackend).toHaveBeenCalledWith(
      'issueQuote',
      expect.objectContaining({ quoteId: 'quote-1' }),
    );
  });

  it('hides administrator-only manuals from operators', () => {
    mocks.role = 'operator';
    mocks.collections.set('manuals', [
      {
        id: 'all',
        title: 'Manual general',
        accessScope: 'all_active',
        active: true,
        description: '',
        version: '1',
        publishedAt: '2026',
        pages: 10,
        documentId: 'doc-1',
      },
      {
        id: 'admin',
        title: 'Manual administrador',
        accessScope: 'admin_only',
        active: true,
        description: '',
        version: '1',
        publishedAt: '2026',
        pages: 10,
        documentId: 'doc-2',
      },
    ]);
    render(
      <MemoryRouter>
        <HelpCenterPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Manual general')).toBeInTheDocument();
    expect(screen.queryByText('Manual administrador')).not.toBeInTheDocument();
  });
});
