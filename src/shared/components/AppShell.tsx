import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Settings,
  Snowflake,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo, useState, type ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, useOperationalProfile } from '../../app/auth/AuthProvider';
import type { OperationalProfile } from '../../domain/model';
import { useCollectionData } from '../hooks/useCollectionData';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  profiles: OperationalProfile[];
}

const allProfiles: OperationalProfile[] = [
  'primary_admin',
  'promoted_admin',
  'supervisor',
  'operator',
];
const adminProfiles: OperationalProfile[] = ['primary_admin', 'promoted_admin'];

const navItems: NavItem[] = [
  { to: '/', label: 'Mi operación', icon: LayoutDashboard, profiles: allProfiles },
  { to: '/solicitudes', label: 'Solicitudes', icon: ClipboardList, profiles: allProfiles },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: FileText, profiles: allProfiles },
  { to: '/clientes', label: 'Clientes', icon: Users, profiles: allProfiles },
  { to: '/instalaciones', label: 'Instalaciones', icon: Building2, profiles: allProfiles },
  { to: '/equipos', label: 'Equipos', icon: Wrench, profiles: allProfiles },
  { to: '/catalogo', label: 'Catálogo comercial', icon: PackageSearch, profiles: allProfiles },
  { to: '/actividad', label: 'Actividad', icon: Activity, profiles: allProfiles },
  { to: '/usuarios', label: 'Usuarios y estructura', icon: Users, profiles: adminProfiles },
  { to: '/configuracion', label: 'Configuración', icon: Settings, profiles: adminProfiles },
  { to: '/ayuda', label: 'Centro de ayuda', icon: BookOpen, profiles: allProfiles },
];

function Brand() {
  return (
    <div className="brand" aria-label="Enfriamatic Gestión Operativa">
      <span className="brand-mark" aria-hidden="true">
        <Snowflake />
      </span>
      <span>
        <strong>ENFRIAMATIC</strong>
        <small>Gestión Operativa</small>
      </span>
    </div>
  );
}

function Navigation({
  profile,
  onNavigate,
}: {
  profile: OperationalProfile;
  onNavigate?: () => void;
}) {
  return (
    <nav className="desktop-nav" aria-label="Navegación principal">
      {navItems
        .filter((item) => item.profiles.includes(profile))
        .map((item) => {
          const Icon = item.icon;
          return (
            <NavLink end={item.to === '/'} key={item.to} onClick={onNavigate} to={item.to}>
              <Icon size={19} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
    </nav>
  );
}

export function AppShell() {
  const auth = useAuth();
  const { profile } = auth;
  const operational = useOperationalProfile();
  const notificationScope = useMemo(
    () => [where('userId', '==', profile?.uid ?? '')],
    [profile?.uid],
  );
  const notifications = useCollectionData<{ id: string; userId: string; readAt: string | null }>(
    'notifications',
    notificationScope,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  if (!profile || !operational) return null;
  const unread = notifications.data.filter(
    (item) => item.userId === profile.uid && !item.readAt,
  ).length;
  const roleLabel =
    operational === 'primary_admin'
      ? 'Administrador principal'
      : operational === 'promoted_admin'
        ? 'Administrador'
        : operational === 'supervisor'
          ? 'Operador supervisor'
          : 'Operador';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <Navigation profile={operational} />
        <div className="sidebar-user">
          <span>{profile.displayName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{profile.displayName}</strong>
            <small>{roleLabel}</small>
            <em>• En línea</em>
          </div>
        </div>
        <button className="sidebar-logout" onClick={() => void auth.logout()}>
          <LogOut size={17} /> Cerrar sesión
        </button>
      </aside>

      {menuOpen ? (
        <div className="mobile-drawer" role="dialog" aria-label="Menú principal">
          <div className="drawer-header">
            <Brand />
            <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}>
              <X />
            </button>
          </div>
          <Navigation profile={operational} onNavigate={() => setMenuOpen(false)} />
        </div>
      ) : null}

      <div className="workspace">
        <header className="topbar">
          <button className="menu-button" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>
            <Menu />
          </button>
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="topbar-context">
            <span className="environment-badge">DEV</span>
            <strong>Enfriamatic S.A. de C.V.</strong>
            <small>Datos ficticios · Planta DEV</small>
          </div>
          <NavLink
            className="notification-button"
            aria-label={`${unread} notificaciones sin leer`}
            to="/actividad"
          >
            <Bell />
            {unread > 0 ? <span>{unread}</span> : null}
          </NavLink>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <nav className="mobile-nav" aria-label="Navegación móvil">
          {navItems
            .filter((item) => item.profiles.includes(operational))
            .slice(0, 4)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink end={item.to === '/'} key={item.to} to={item.to}>
                  <Icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>
      </div>
    </div>
  );
}
