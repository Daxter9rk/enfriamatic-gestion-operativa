import { FilePlus2, FileText, Search } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Quote } from '../../../domain/model';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { useAuth, useOperationalProfile } from '../../auth/AuthProvider';

export function QuotesPage() {
  const { profile } = useAuth();
  const operational = useOperationalProfile();
  const quoteScope = useMemo(
    () =>
      operational === 'primary_admin' || operational === 'promoted_admin'
        ? []
        : [where('createdBy', '==', profile?.uid ?? '')],
    [operational, profile?.uid],
  );
  const quotes = useCollectionData<Quote>('quotes', quoteScope);
  const [search, setSearch] = useState('');
  const visible = useMemo(
    () =>
      quotes.data.filter((quote) =>
        `${quote.folio ?? 'borrador'} ${quote.status} ${quote.requestId}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [quotes.data, search],
  );
  if (quotes.loading) return <LoadingState />;
  if (quotes.error) return <ErrorState message={quotes.error} />;
  return (
    <div className="page-stack">
      <PageHeader
        title="Cotizaciones"
        description="Borradores, emisiones y revisiones con ciclos independientes de las solicitudes."
        actions={
          <Link className="button button-primary" to="/cotizaciones/nueva">
            <FilePlus2 size={18} /> Nueva cotización
          </Link>
        }
      />
      <Card>
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar cotizaciones"
              placeholder="Buscar folio, solicitud o estado"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin cotizaciones"
            description="Crea un borrador para comenzar."
          />
        ) : (
          <div className="responsive-table entity-table">
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Solicitud</th>
                  <th>Revisión</th>
                  <th>Estado</th>
                  <th>Total MXN</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <strong>{quote.folio ?? 'Borrador sin folio'}</strong>
                    </td>
                    <td>{quote.requestId}</td>
                    <td>{quote.revision}</td>
                    <td>
                      <StatusBadge
                        tone={
                          quote.status === 'draft'
                            ? 'neutral'
                            : quote.status === 'accepted'
                              ? 'green'
                              : 'blue'
                        }
                      >
                        {quote.status}
                      </StatusBadge>
                    </td>
                    <td>
                      {Number(quote.totals?.total ?? 0).toLocaleString('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                      })}
                    </td>
                    <td>
                      <Link className="icon-button" to={`/cotizaciones/${quote.id}`}>
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
