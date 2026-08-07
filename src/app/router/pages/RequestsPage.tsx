import { ClipboardList, Plus, Search } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ServiceRequest } from '../../../domain/model';
import { useAuth, useOperationalProfile } from '../../auth/AuthProvider';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';

export function RequestsPage() {
  const { profile } = useAuth();
  const operational = useOperationalProfile();
  const requestScope = useMemo(
    () =>
      operational === 'primary_admin' || operational === 'promoted_admin'
        ? []
        : operational === 'supervisor'
          ? [where('supervisorId', '==', profile?.uid ?? '')]
          : [where('assigneeId', '==', profile?.uid ?? '')],
    [operational, profile?.uid],
  );
  const requests = useCollectionData<ServiceRequest>('requests', requestScope);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('open');

  const visible = useMemo(() => {
    const scoped =
      operational === 'operator'
        ? requests.data.filter(
            (item) => item.assigneeId === profile?.uid || item.createdBy === profile?.uid,
          )
        : operational === 'supervisor'
          ? requests.data.filter(
              (item) =>
                item.assigneeId === profile?.uid ||
                item.supervisorId === profile?.uid ||
                item.createdBy === profile?.uid,
            )
          : requests.data;
    return scoped.filter((item) => {
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
  }, [operational, profile?.uid, requests.data, search, status]);

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
