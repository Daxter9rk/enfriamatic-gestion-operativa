import { FileText, MapPin, Snowflake, Wrench } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Equipment } from '../../../domain/model';
import { decodeEquipment } from '../../../domain/firestore-validation';
import { Card, LoadingState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { useAuthorizedRequests } from '../../../shared/hooks/useAuthorizedRequests';

export function EquipmentDetailPage() {
  const { equipmentId = '' } = useParams();
  const requestScope = useMemo(() => [where('equipmentId', '==', equipmentId)], [equipmentId]);
  const equipment = useCollectionData<Equipment>('equipment', decodeEquipment);
  const requests = useAuthorizedRequests(requestScope);
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
