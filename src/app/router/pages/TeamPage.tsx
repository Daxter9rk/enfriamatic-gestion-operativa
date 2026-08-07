import { UsersRound } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { decodeUserProfile } from '../../../domain/firestore-validation';
import type { UserProfile } from '../../../domain/model';
import { Card, EmptyState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useAuthorizedRequests } from '../../../shared/hooks/useAuthorizedRequests';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { useAuth, useOperationalProfile } from '../../auth/AuthContext';

export function TeamPage() {
  const { profile } = useAuth();
  const operational = useOperationalProfile();
  const scope = useMemo(() => [where('supervisorId', '==', profile?.uid ?? '')], [profile?.uid]);
  const users = useCollectionData<UserProfile>('users', decodeUserProfile, scope);
  const requests = useAuthorizedRequests();
  if (operational !== 'supervisor') {
    return (
      <EmptyState
        icon={UsersRound}
        title="Sin equipo directo"
        description="Esta vista sólo aparece al tener subordinados activos."
      />
    );
  }
  return (
    <div className="page-stack">
      <PageHeader
        title="Mi equipo"
        description="Carga y solicitudes de subordinados directos autorizados."
      />
      <Card>
        <div className="team-grid">
          {users.data.map((user) => {
            const assigned = requests.data.filter(
              (item) =>
                item.assigneeId === user.uid && !['completed', 'cancelled'].includes(item.status),
            );
            return (
              <article className="team-card" key={user.uid}>
                <span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                  <StatusBadge tone={user.status === 'active' ? 'green' : 'red'}>
                    {user.status}
                  </StatusBadge>
                </div>
                <strong>{assigned.length} activas</strong>
              </article>
            );
          })}
        </div>
        <Link className="button button-primary" to="/solicitudes">
          Asignar solicitudes
        </Link>
      </Card>
    </div>
  );
}
