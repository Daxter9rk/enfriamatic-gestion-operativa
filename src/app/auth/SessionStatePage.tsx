import { AlertTriangle, LogOut, ShieldX } from 'lucide-react';
import { useAuth } from './AuthProvider';

const messages = {
  profile_missing: [
    'Perfil no configurado',
    'Tu cuenta existe, pero todavía no tiene un perfil operativo.',
  ],
  pending: ['Acceso pendiente', 'Un administrador debe activar tu perfil antes de continuar.'],
  inactive: ['Cuenta inactiva', 'Tu acceso fue desactivado. Contacta a un administrador.'],
  suspended: ['Cuenta suspendida', 'La sesión no tiene autorización para usar la plataforma.'],
  invalid_role: ['Rol inválido', 'El perfil tiene una configuración de permisos no reconocida.'],
  revoked: ['Sesión no disponible', 'Vuelve a iniciar sesión para renovar tus credenciales.'],
} as const;

export function SessionStatePage() {
  const auth = useAuth();
  const { problem } = auth;
  const [title, description] = problem ? messages[problem] : ['Permiso insuficiente', ''];
  return (
    <main className="blocked-layout">
      <section className="blocked-card">
        <span className="blocked-icon">
          {problem === 'revoked' ? <AlertTriangle /> : <ShieldX />}
        </span>
        <p className="eyebrow">Acceso protegido</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <button className="button button-secondary" onClick={() => void auth.logout()}>
          <LogOut size={18} /> Cerrar sesión
        </button>
      </section>
    </main>
  );
}
