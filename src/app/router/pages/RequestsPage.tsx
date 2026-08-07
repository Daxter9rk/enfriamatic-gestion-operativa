import { ClipboardList, Plus, Search } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOperationalProfile } from '../../auth/AuthContext';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../shared/components/Ui';
import { useAuthorizedRequests } from '../../../shared/hooks/useAuthorizedRequests';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { decodeUserProfile } from '../../../domain/firestore-validation';
import type { UserProfile } from '../../../domain/model';
import { callBackend } from '../../../shared/services/callables';
import { useAuth } from '../../auth/AuthContext';

export function RequestsPage() {
  const { profile } = useAuth();
  const operational = useOperationalProfile();
  const requests = useAuthorizedRequests();
  const userScope = useMemo(
    () =>
      operational === 'primary_admin' || operational === 'promoted_admin'
        ? []
        : [where('supervisorId', '==', profile?.uid ?? '')],
    [operational, profile?.uid],
  );
  const users = useCollectionData<UserProfile>('users', decodeUserProfile, userScope);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('open');
  const [feedback, setFeedback] = useState('');
  const assignees = [
    ...new Map(
      [profile, ...users.data]
        .filter((user): user is UserProfile => Boolean(user))
        .filter((user) => user.role === 'operator' && user.status === 'active')
        .map((user) => [user.uid, user]),
    ).values(),
  ];

  async function assign(requestId: string, recipientId: string) {
    if (!recipientId) return;
    setFeedback('');
    try {
      await callBackend('assignServiceRequest', {
        requestId,
        recipientId,
        idempotencyKey: crypto.randomUUID(),
      });
      setFeedback('Solicitud asignada y auditada.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible asignar.');
    }
  }

  const visible = useMemo(() => {
    return requests.data.filter((item) => {
      const matchesText = `${item.folio} ${item.description} ${item.serviceType}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus =
        status === 'all'
          ? true
          : status === 'open'
            ? !['completed', 'cancelled'].includes(item.status)
            : item.status === status;
      return matchesText && matchesStatus;
    });
  }, [requests.data, search, status]);

  if (requests.loading) return <LoadingState />;
  if (requests.error) return <ErrorState message={requests.error} />;

  return (
    <div className="page-stack">
      <PageHeader
        title={operational === 'operator' ? 'Mis solicitudes' : 'Solicitudes'}
        description="Crea, asigna y da seguimiento al trabajo operativo dentro de tu alcance."
        actions={
          <Link className="button button-primary" to="/solicitudes/nueva">
            <Plus size={18} /> Nueva solicitud
          </Link>
        }
      />
      <Card>
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar solicitudes"
              placeholder="Buscar por folio, descripción o servicio"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="open">Activas</option>
            <option value="all">Todas</option>
            <option value="pending">Nuevas</option>
            <option value="assigned">Asignadas</option>
            <option value="in_progress">En proceso</option>
            <option value="completed">Completadas</option>
          </select>
        </div>
        {feedback ? <div className="notice">{feedback}</div> : null}
        {visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin solicitudes"
            description="No hay resultados para los filtros actuales."
          />
        ) : (
          <div className="responsive-table entity-table">
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Servicio</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Fecha solicitada</th>
                  <th>Responsable</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.folio}</strong>
                      <small>{item.description}</small>
                    </td>
                    <td>{item.serviceType}</td>
                    <td>
                      <StatusBadge
                        tone={
                          item.priority === 'critical' || item.priority === 'high'
                            ? 'red'
                            : item.priority === 'medium'
                              ? 'orange'
                              : 'green'
                        }
                      >
                        {item.priority}
                      </StatusBadge>
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          item.status === 'completed'
                            ? 'green'
                            : item.status === 'in_progress'
                              ? 'orange'
                              : 'blue'
                        }
                      >
                        {item.status}
                      </StatusBadge>
                    </td>
                    <td>{item.requestedDate}</td>
                    <td>
                      {operational === 'primary_admin' ||
                      operational === 'promoted_admin' ||
                      operational === 'supervisor' ? (
                        <select
                          aria-label={`Asignar ${item.folio}`}
                          value={item.assigneeId ?? ''}
                          onChange={(event) => void assign(item.id, event.target.value)}
                        >
                          <option value="">Sin asignar</option>
                          {assignees.map((user) => (
                            <option key={user.uid} value={user.uid}>
                              {user.displayName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (assignees.find((user) => user.uid === item.assigneeId)?.displayName ?? '—')
                      )}
                    </td>
                    <td>
                      <Link
                        className="icon-button"
                        aria-label={`Abrir ${item.folio}`}
                        to={`/solicitudes/${item.id}`}
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
