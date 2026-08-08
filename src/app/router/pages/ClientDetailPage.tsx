import { Building2, FileText, MapPin } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Client, Site } from '../../../domain/model';
import { decodeClient, decodeSite } from '../../../domain/firestore-validation';
import {
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../shared/components/Ui';
import { useAuthorizedQuotes } from '../../../shared/hooks/useAuthorizedQuotes';
import { useAuthorizedRequests } from '../../../shared/hooks/useAuthorizedRequests';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';

export function ClientDetailPage() {
  const { clientId = '' } = useParams();
  const clientScope = useMemo(() => [where('id', '==', clientId)], [clientId]);
  const siteScope = useMemo(() => [where('clientId', '==', clientId)], [clientId]);
  const clients = useCollectionData<Client>('clients', decodeClient, clientScope);
  const sites = useCollectionData<Site>('sites', decodeSite, siteScope);
  const requests = useAuthorizedRequests(siteScope);
  const quotes = useAuthorizedQuotes(siteScope);
  const client = clients.data[0];

  if (clients.loading || sites.loading || requests.loading || quotes.loading)
    return <LoadingState />;
  if (!client)
    return (
      <div className="state-card">
        <h2>Cliente no encontrado</h2>
        <Link to="/clientes">Volver</Link>
      </div>
    );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Expediente del cliente"
        title={client.name}
        description={`${client.contactName} · ${client.email}`}
        actions={
          <StatusBadge tone={client.active ? 'green' : 'neutral'}>
            {client.active ? 'Activo' : 'Inactivo'}
          </StatusBadge>
        }
      />
      <section className="detail-grid">
        <Card title="Contacto y datos disponibles">
          <dl className="detail-list">
            <div>
              <dt>Contacto</dt>
              <dd>{client.contactName}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{client.email}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>{client.phone}</dd>
            </div>
            <div>
              <dt>Identificador fiscal</dt>
              <dd>{client.taxId || 'No registrado'}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Resumen operativo">
          <dl className="detail-list">
            <div>
              <dt>
                <MapPin /> Instalaciones
              </dt>
              <dd>{sites.data.length}</dd>
            </div>
            <div>
              <dt>
                <FileText /> Solicitudes autorizadas
              </dt>
              <dd>{requests.data.length}</dd>
            </div>
            <div>
              <dt>Cotizaciones autorizadas</dt>
              <dd>{quotes.data.length}</dd>
            </div>
          </dl>
        </Card>
      </section>
      <Card title="Instalaciones">
        {sites.data.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Sin instalaciones"
            description="Este cliente aún no tiene sitios registrados."
          />
        ) : (
          <ul className="activity-list">
            {sites.data.map((site) => (
              <li key={site.id}>
                <MapPin />
                <div>
                  <Link to={`/instalaciones/${site.id}`}>
                    <strong>{site.name}</strong>
                  </Link>
                  <small>{site.address}</small>
                </div>
                <StatusBadge tone={site.active ? 'green' : 'neutral'}>
                  {site.active ? 'Activo' : 'Inactivo'}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <section className="detail-grid">
        <Card title="Solicitudes e historial">
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
        <Card title="Cotizaciones">
          <ul className="activity-list">
            {quotes.data.slice(0, 20).map((quote) => (
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
      </section>
    </div>
  );
}
