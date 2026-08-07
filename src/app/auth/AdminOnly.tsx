import { ShieldX } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function AdminOnly({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  if (profile?.role !== 'admin') {
    return (
      <div className="state-card" role="alert">
        <ShieldX size={34} />
        <h2>Permiso insuficiente</h2>
        <p>Esta sección está reservada para administradores activos.</p>
        <Link className="button button-secondary" to="/">
          Volver a mi operación
        </Link>
      </div>
    );
  }
  return children;
}
