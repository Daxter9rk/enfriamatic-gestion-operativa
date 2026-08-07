import { NavLink, Outlet } from 'react-router-dom';

const disabledItems = ['Operación', 'Clientes', 'Solicitudes'] as const;

function Brand() {
  return (
    <div className="brand" aria-label="Enfriamatic Gestión Operativa">
      <span className="brand-mark" aria-hidden="true">
        E
      </span>
      <span>
        <strong>Enfriamatic</strong>
        <small>Gestión Operativa</small>
      </span>
    </div>
  );
}

function EnvironmentBadge() {
  return <span className="environment-badge">Entorno DEV</span>;
}

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="desktop-nav" aria-label="Navegación principal">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/fundamentos">Fundamentos</NavLink>
          {disabledItems.map((item) => (
            <span className="disabled-nav-item" aria-disabled="true" key={item}>
              {item}
              <small>Próximamente</small>
            </span>
          ))}
        </nav>
        <div className="sidebar-footer">
          <EnvironmentBadge />
          <p>Bootstrap técnico</p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div>
            <p className="topbar-kicker">Enfriamatic Gestión Operativa</p>
            <p className="topbar-context">Fundamentos técnicos</p>
          </div>
          <EnvironmentBadge />
        </header>
        <main className="content">
          <Outlet />
        </main>
        <nav className="mobile-nav" aria-label="Navegación móvil">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/fundamentos">Fundamentos</NavLink>
          <span aria-disabled="true">Módulos</span>
        </nav>
      </div>
    </div>
  );
}
