import { Activity, Bell, CheckCheck } from 'lucide-react';
import { doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { AuditLog, Notification } from '../../../domain/model';
import { useAuth } from '../../auth/AuthProvider';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { getFirebaseServices } from '../../../shared/services/firebase';

export function ActivityPage() {
  const { profile } = useAuth();
  const logScope = useMemo(
    () => (profile?.role === 'admin' ? [] : [where('actorId', '==', profile?.uid ?? '')]),
    [profile?.role, profile?.uid],
  );
  const notificationScope = useMemo(
    () => [where('userId', '==', profile?.uid ?? '')],
    [profile?.uid],
  );
  const logs = useCollectionData<AuditLog & { id: string }>('auditLogs', logScope);
  const notifications = useCollectionData<Notification>('notifications', notificationScope);
  if (logs.loading || notifications.loading) return <LoadingState />;
  if (logs.error) return <ErrorState message={logs.error} />;
  const myNotifications = notifications.data.filter((item) => item.userId === profile?.uid);
  async function mark(id: string) {
    await updateDoc(doc(getFirebaseServices().firestore, 'notifications', id), {
      readAt: serverTimestamp(),
    });
  }
  return (
    <div className="page-stack">
      <PageHeader
        title={profile?.role === 'admin' ? 'Actividad y auditoría' : 'Mi actividad'}
        description="Trazabilidad visible según tu alcance. Los registros críticos son append-only y se crean en backend."
      />
      <section className="detail-grid">
        <Card title="Notificaciones">
          {myNotifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Sin notificaciones"
              description="No tienes acciones pendientes."
            />
          ) : (
            <ul className="activity-list">
              {myNotifications.map((item) => (
                <li key={item.id}>
                  <Bell />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </div>
                  {item.readAt ? (
                    <StatusBadge tone="neutral">Leída</StatusBadge>
                  ) : (
                    <button
                      className="icon-button"
                      aria-label="Marcar como leída"
                      onClick={() => void mark(item.id)}
                    >
                      <CheckCheck size={17} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Registro de actividad">
          {logs.data.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Sin actividad"
              description="Los eventos autorizados aparecerán aquí."
            />
          ) : (
            <ul className="activity-list">
              {logs.data.slice(0, 30).map((item) => (
                <li key={item.id}>
                  <Activity />
                  <div>
                    <strong>{item.action}</strong>
                    <small>
                      {item.resource} · {item.resourceId}
                    </small>
                  </div>
                  <span>{String(item.createdAt ?? '')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
