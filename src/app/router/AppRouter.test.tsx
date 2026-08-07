import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from './AppRouter';

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe('AppRouter', () => {
  it('renderiza la pantalla provisional y el entorno DEV', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { name: 'Fundamentos inicializados' })).toBeVisible();
    expect(screen.getAllByText('Entorno DEV').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Enfriamatic').length).toBeGreaterThan(0);
  });

  it('navega desde el shell hacia Fundamentos', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getAllByRole('link', { name: 'Fundamentos' })[0]!);

    expect(screen.getByRole('heading', { name: 'Plataforma preparada' })).toBeVisible();
  });

  it('muestra una ruta 404 accesible', () => {
    renderAt('/ruta-inexistente');

    expect(screen.getByRole('heading', { name: 'Esta ruta aún no existe' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });

  it('incluye navegación móvil básica en el shell', () => {
    renderAt('/');

    expect(screen.getByRole('navigation', { name: 'Navegación móvil' })).toBeInTheDocument();
  });
});
