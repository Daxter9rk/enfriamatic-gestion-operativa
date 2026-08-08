import { FileText, MapPin, Snowflake } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Equipment, Site } from '../../../domain/model';
import { decodeEquipment, decodeSite } from '../../../domain/firestore-validation';
import {
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../shared/components/Ui';
import { PrivateFilesCard } from '../../../shared/components/PrivateFilesCard';
import { useAuthorizedQuotes } from '../../../shared/hooks/useAuthorizedQuotes';
import { useAuthorizedRequests } from '../../../shared/hooks/useAuthorizedRequests';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';

export function SiteDetailPage() {
  const { siteId = '' } = useParams();
  const siteScope = useMemo(() => [where('id', '==', siteId)], [siteId]);
  const relatedScope = useMemo(() => [where('siteId', '==', siteId)], [siteId]);
  const sites = useCollectionData<Site>('sites', decodeSite, siteScope);
  const equipment = useCollectionData<Equipment>('equipment', decodeEquipment, relatedScope);
  const requests = useAuthorizedRequests(relatedScope);
  const quotes = useAuthorizedQuotes(relatedScope);
  const site = sites.data[0];

  if (sites.loading || equipment.loading || requests.loading || quotes.loading)
    return <LoadingState />;
  if (!site)
    return (
      <div className="state-card">
        <h2>Instalación no encontrada</h2>
        <Link to="/instalaciones">Volver</Link>
      </div>
    );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Expediente de instalación"
        title={site.name}
        description={`${site.type} · ${site.address}`}
        actions={
          <StatusBadge tone={site.active ? 'green' : 'neutral'}>
            {site.active ? 'Activa' : 'Inactiva'}
          </StatusBadge>
        }
      />
      <section className="detail-grid">
        <Card title="Información del sitio">
          <dl className="detail-list">
            <div>
              <dt>
                <MapPin /> Dirección
              </dt>
              <dd>{site.address}</dd>
            </div>
            <div>
              <dt>Contacto</dt>
              <dd>{site.contactName}</dd>
            </div>
            <div>
              <dt>Referencias de acceso</dt>
              <dd>{site.accessNotes || 'No registradas'}</dd>
            </div>
            <div>
              <dt>Mapa</dt>
              <dd>
                {site.mapUrl ? (
                  <a href={site.mapUrl} target="_blank" rel="noreferrer">
                    Abrir ubicación
                  </a>
                ) : (
                  'No registrado'
                )}
              </dd>
            </div>
          </dl>
        </Card>
        <Card title="Resumen operativo">
          <dl className="detail-list">
            <div>
              <dt>Equipos</dt>
              <dd>{equipment.data.length}</dd>
            </div>
            <div>
              <dt>Solicitudes</dt>
              <dd>{requests.data.length}</dd>
            </div>
            <div>
              <dt>Cotizaciones</dt>
              <dd>{quotes.data.length}</dd>
            </div>
          </dl>
        </Card>
      </section>
      <PrivateFilesCard
        kind="site_document"
        resourceId={siteId}
        title="Croquis, fotografías y documentos privados"
      />
      <section className="detail-grid">
        <Card title="Equipos">
          {equipment.data.length === 0 ? (
            <EmptyState
              icon={Snowflake}
              title="Sin equipos"
              description="No hay equipos registrados en esta instalación."
            />
          ) : (
            <ul className="activity-list">
              {equipment.data.map((item) => (
                <li key={item.id}>
                  <Snowflake />
                  <div>
                    <Link to={`/equipos/${item.id}`}>
                      <strong>{item.name}</strong>
                    </Link>
                    <small>
                      {item.brand} · {item.model}
                    </small>
                  </div>
                  <StatusBadge tone={item.status === 'operating' ? 'green' : 'orange'}>
                    {item.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Historial de solicitudes">
          <ul className="activity-list">
            {requests.data.slice(0, 20).map((request) => (
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
        </Card>
      </section>
    </div>
  );
}
