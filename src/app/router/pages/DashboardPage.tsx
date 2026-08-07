import { AlertTriangle, ClipboardCheck, Clock3, FileText, ListTodo, Users } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useOperationalProfile } from '../../auth/AuthProvider';
import type { Quote, ServiceRequest, UserProfile } from '../../../domain/model';
import { isOverdue } from '../../../domain/requests';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../../../shared/components/Ui';

const statusLabels = {
  pending: 'Nueva',
  assigned: 'Asignada',
  in_progress: 'En proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const statusTone = {
  pending: 'neutral',
  assigned: 'blue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'red',
};

export function DashboardPage() {
  const { profile } = useAuth();
  const operationalProfile = useOperationalProfile();
  const isAdmin = operationalProfile === 'primary_admin' || operationalProfile === 'promoted_admin';
  const requestScope = useMemo(
    () =>
      isAdmin
        ? []
        : operationalProfile === 'supervisor'
          ? [where('supervisorId', '==', profile?.uid ?? '')]
          : [where('assigneeId', '==', profile?.uid ?? '')],
    [isAdmin, operationalProfile, profile?.uid],
  );
  const ownScope = useMemo(
    () => (isAdmin ? [] : [where('createdBy', '==', profile?.uid ?? '')]),
    [isAdmin, profile?.uid],
  );
  const userScope = useMemo(
    () =>
      isAdmin
        ? []
        : operationalProfile === 'supervisor'
          ? [where('supervisorId', '==', profile?.uid ?? '')]
          : [where('uid', '==', profile?.uid ?? '')],
    [isAdmin, operationalProfile, profile?.uid],
  );
  const requests = useCollectionData<ServiceRequest>('requests', requestScope);
  const quotes = useCollectionData<Quote>('quotes', ownScope);
  const users = useCollectionData<UserProfile>('users', userScope);

  if (requests.loading || quotes.loading || users.loading) return <LoadingState />;
  if (requests.error) return <ErrorState message={requests.error} />;

  const visibleRequests =
    operationalProfile === 'operator'
      ? requests.data.filter((item) => item.assigneeId === profile?.uid)
      : operationalProfile === 'supervisor'
        ? requests.data.filter(
            (item) => item.assigneeId === profile?.uid || item.supervisorId === profile?.uid,
          )
        : requests.data;
  const open = visibleRequests.filter(
    (item) => item.status !== 'completed' && item.status !== 'cancelled',
  );
  const overdue = open.filter((item) => isOverdue(item.requestedDate, item.status));
  const issuedQuotes = quotes.data.filter((quote) => quote.status !== 'draft');
  const teamSize =
    operationalProfile === 'supervisor'
      ? users.data.filter((user) => user.supervisorId === profile?.uid).length
      : users.data.filter((user) => user.status === 'active').length;
  const title =
    operationalProfile === 'primary_admin' || operationalProfile === 'promoted_admin'
      ? 'Panel de control'
      : 'Mi operación';

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Resumen operativo"
        title={title}
        description="Información disponible en tiempo real según tu perfil y alcance autorizado."
        actions={
          <Link className="button button-primary" to="/solicitudes/nueva">
            Nueva solicitud
          </Link>
        }
      />
      <section className="stats-grid">
        <StatCard
          icon={ClipboardCheck}
          label="Solicitudes abiertas"
          value={open.length}
          detail="En tu alcance"
        />
        <StatCard
          icon={Clock3}
          label="En proceso"
          value={open.filter((item) => item.status === 'in_progress').length}
          detail="Trabajo activo"
          tone="orange"
        />
        <StatCard
          icon={AlertTriangle}
          label="Atrasadas"
          value={overdue.length}
          detail="Requieren atención"
          tone="red"
        />
        <StatCard
          icon={FileText}
          label="Cotizaciones emitidas"
          value={issuedQuotes.length}
          detail="No representan ingresos"
          tone="purple"
        />
        <StatCard
          icon={Users}
          label={operationalProfile === 'supervisor' ? 'Mi equipo' : 'Usuarios activos'}
          value={teamSize}
          detail="Perfiles autorizados"
          tone="green"
        />
      </section>
      <section className="dashboard-grid">
        <Card
          title="Solicitudes recientes"
          className="dashboard-main"
          action={<Link to="/solicitudes">Ver todas →</Link>}
        >
          {visibleRequests.length === 0 ? (
            <div className="empty-inline">
              <ListTodo />
              <span>No hay solicitudes disponibles.</span>
            </div>
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Servicio</th>
                    <th>Responsable</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRequests.slice(0, 7).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link to={`/solicitudes/${item.id}`}>{item.folio}</Link>
                      </td>
                      <td>{item.serviceType}</td>
                      <td>
                        {users.data.find((user) => user.uid === item.assigneeId)?.displayName ??
                          'Sin asignar'}
                      </td>
                      <td>
                        <StatusBadge tone={statusTone[item.status]}>
                          {statusLabels[item.status]}
                        </StatusBadge>
                      </td>
                      <td
                        className={isOverdue(item.requestedDate, item.status) ? 'text-danger' : ''}
                      >
                        {item.requestedDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Acciones rápidas">
          <div className="quick-actions">
            <Link to="/clientes">Clientes</Link>
            <Link to="/equipos">Equipos</Link>
            <Link to="/cotizaciones">Cotizaciones</Link>
            <Link to="/actividad">Actividad</Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
