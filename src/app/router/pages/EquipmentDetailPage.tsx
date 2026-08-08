import { FileText, MapPin, Snowflake, Wrench } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Client, Equipment, Site } from '../../../domain/model';
import { decodeClient, decodeEquipment, decodeSite } from '../../../domain/firestore-validation';
import { Card, LoadingState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { PrivateFilesCard } from '../../../shared/components/PrivateFilesCard';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { useAuthorizedRequests } from '../../../shared/hooks/useAuthorizedRequests';
import { useAuthorizedQuotes } from '../../../shared/hooks/useAuthorizedQuotes';

export function EquipmentDetailPage() {
  const { equipmentId = '' } = useParams();
  const equipmentScope = useMemo(() => [where('id', '==', equipmentId)], [equipmentId]);
  const requestScope = useMemo(() => [where('equipmentId', '==', equipmentId)], [equipmentId]);
  const equipment = useCollectionData<Equipment>('equipment', decodeEquipment, equipmentScope);
  const requests = useAuthorizedRequests(requestScope);
  const quotes = useAuthorizedQuotes(requestScope);
  const item = equipment.data.find((candidate) => candidate.id === equipmentId);
  const clientScope = useMemo(
    () => [where('id', '==', item?.clientId ?? '__none__')],
    [item?.clientId],
  );
  const siteScope = useMemo(() => [where('id', '==', item?.siteId ?? '__none__')], [item?.siteId]);
  const clients = useCollectionData<Client>('clients', decodeClient, clientScope);
  const sites = useCollectionData<Site>('sites', decodeSite, siteScope);
  if (equipment.loading || requests.loading || quotes.loading || clients.loading || sites.loading)
    return <LoadingState />;
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
        title={item.name}
        description={`${item.category} · ${item.brand} · ${item.model}`}
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
              <dt>Cliente</dt>
              <dd>{clients.data[0]?.name ?? item.clientId}</dd>
            </div>
            <div>
              <dt>
                <MapPin /> Instalación
              </dt>
              <dd>{sites.data[0]?.name ?? item.siteId}</dd>
            </div>
            {Object.entries(item.specifications).map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
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
      <PrivateFilesCard
        kind="equipment_document"
        resourceId={equipmentId}
        title="Evidencias y documentos técnicos privados"
      />
      <Card title="Cotizaciones relacionadas">
        <ul className="activity-list">
          {quotes.data.map((quote) => (
            <li key={quote.id}>
              <FileText />
              <div>
                <Link to={`/cotizaciones/${quote.id}`}>
                  <strong>{quote.folio ?? 'Borrador sin folio'}</strong>
                </Link>
                <small>Revisión {quote.revisionNumber}</small>
              </div>
              <StatusBadge tone={quote.locked ? 'green' : 'neutral'}>{quote.status}</StatusBadge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
