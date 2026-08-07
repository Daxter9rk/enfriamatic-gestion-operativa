import { FileText, MapPin, Snowflake, Wrench } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Equipment, ServiceRequest } from '../../../domain/model';
import { useAuth, useOperationalProfile } from '../../auth/AuthProvider';
import { Card, LoadingState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';

export function EquipmentDetailPage() {
  const { equipmentId = '' } = useParams();
  const { profile } = useAuth();
  const operational = useOperationalProfile();
  const requestScope = useMemo(
    () =>
      operational === 'primary_admin' || operational === 'promoted_admin'
        ? [where('equipmentId', '==', equipmentId)]
        : operational === 'supervisor'
          ? [
              where('equipmentId', '==', equipmentId),
              where('supervisorId', '==', profile?.uid ?? ''),
            ]
          : [
              where('equipmentId', '==', equipmentId),
              where('assigneeId', '==', profile?.uid ?? ''),
            ],
    [equipmentId, operational, profile?.uid],
  );
  const equipment = useCollectionData<Equipment>('equipment');
  const requests = useCollectionData<ServiceRequest>('requests', requestScope);
  const item = equipment.data.find((candidate) => candidate.id === equipmentId);
  if (equipment.loading) return <LoadingState />;
  if (!item)
    return (
      <div className="state-card">
        <h2>Equipo no encontrado</h2>
        <Link to="/equipos">Volver</Link>
      </div>
    );
  const linked = requests.data.filter((request) => request.equipmentId === item.id);
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Expediente técnico"
        title={item.category}
        description={`${item.brand} · ${item.model}`}
        actions={
          <StatusBadge tone={item.status === 'operating' ? 'green' : 'orange'}>
            {item.status}
          </StatusBadge>
        }
      />
      <section className="detail-grid detail-grid-wide">
        <Card title="Identificación">
          <dl className="detail-list">
            <div>
              <dt>
                <Snowflake /> Marca
              </dt>
              <dd>{item.brand}</dd>
            </div>
            <div>
              <dt>Modelo</dt>
              <dd>{item.model}</dd>
            </div>
            <div>
              <dt>Número de serie</dt>
              <dd>{item.serialNumber}</dd>
            </div>
            <div>
              <dt>Capacidad</dt>
              <dd>{item.capacity || 'No registrada'}</dd>
            </div>
            <div>
              <dt>Refrigerante</dt>
              <dd>{item.refrigerant || 'No registrado'}</dd>
            </div>
            <div>
              <dt>
                <MapPin /> Instalación
              </dt>
              <dd>{item.siteId}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Historial operativo">
          {linked.length === 0 ? (
            <div className="empty-inline">
              <Wrench />
              <span>Sin intervenciones registradas.</span>
            </div>
          ) : (
            <ul className="activity-list">
              {linked.map((request) => (
                <li key={request.id}>
                  <FileText />
                  <div>
                    <Link to={`/solicitudes/${request.id}`}>
                      <strong>{request.folio}</strong>
                    </Link>
                    <small>{request.description}</small>
                  </div>
                  <StatusBadge tone={request.status === 'completed' ? 'green' : 'blue'}>
                    {request.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
