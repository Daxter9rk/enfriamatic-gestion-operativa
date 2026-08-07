import { Activity, CalendarDays, FileText, UserRound } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ServiceRequest } from '../../../domain/model';
import { Card, LoadingState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { getFirebaseServices } from '../../../shared/services/firebase';
import { useAuth, useOperationalProfile } from '../../auth/AuthProvider';

export function RequestDetailPage() {
  const { requestId = '' } = useParams();
  const { profile } = useAuth();
  const operational = useOperationalProfile();
  const requestScope = useMemo(
    () =>
      operational === 'primary_admin' || operational === 'promoted_admin'
        ? [where('id', '==', requestId)]
        : operational === 'supervisor'
          ? [where('id', '==', requestId), where('supervisorId', '==', profile?.uid ?? '')]
          : [where('id', '==', requestId), where('assigneeId', '==', profile?.uid ?? '')],
    [operational, profile?.uid, requestId],
  );
  const requests = useCollectionData<ServiceRequest>('requests', requestScope);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const item = requests.data.find((request) => request.id === requestId);

  if (requests.loading) return <LoadingState />;
  if (!item)
    return (
      <div className="state-card">
        <h2>Solicitud no encontrada</h2>
        <Link to="/solicitudes">Volver</Link>
      </div>
    );

  async function move(
    status: ServiceRequest['status'],
    operationalStage?: ServiceRequest['operationalStage'],
  ) {
    if (!item) return;
    setWorking(true);
    setMessage('');
    const nextStage = operationalStage ?? item.operationalStage;
    try {
      await updateDoc(doc(getFirebaseServices().firestore, 'requests', item.id), {
        status,
        operationalStage: nextStage,
        updatedAt: serverTimestamp(),
      });
      setMessage('Solicitud actualizada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible actualizar.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Detalle de solicitud"
        title={item.folio}
        description={item.description}
        actions={
          <StatusBadge tone={item.status === 'completed' ? 'green' : 'orange'}>
            {item.status}
          </StatusBadge>
        }
      />
      <Card title="Ciclo de vida">
        <div className="lifecycle">
          {['pending', 'assigned', 'in_progress', 'completed'].map((status, index) => {
            const current = ['pending', 'assigned', 'in_progress', 'completed'].indexOf(
              item.status,
            );
            return (
              <div className={index <= current ? 'complete' : ''} key={status}>
                <span>{index + 1}</span>
                <strong>{status}</strong>
              </div>
            );
          })}
        </div>
      </Card>
      <section className="detail-grid">
        <Card title="Información general">
          <dl className="detail-list">
            <div>
              <dt>
                <CalendarDays /> Fecha solicitada
              </dt>
              <dd>{item.requestedDate}</dd>
            </div>
            <div>
              <dt>
                <UserRound /> Responsable
              </dt>
              <dd>{item.assigneeId ?? 'Sin asignar'}</dd>
            </div>
            <div>
              <dt>
                <FileText /> Cotización
              </dt>
              <dd>{item.quoteRequirement}</dd>
            </div>
            <div>
              <dt>
                <Activity /> Etapa operativa
              </dt>
              <dd>{item.operationalStage}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Acciones de trabajo">
          <div className="action-stack">
            {item.status === 'assigned' ? (
              <button
                className="button button-primary"
                disabled={working}
                onClick={() => void move('in_progress', 'diagnosing')}
              >
                Iniciar diagnóstico
              </button>
            ) : null}
            {item.status === 'in_progress' ? (
              <>
                <button
                  className="button button-secondary"
                  disabled={working}
                  onClick={() => void move('in_progress', 'waiting_information')}
                >
                  Esperando información
                </button>
                <button
                  className="button button-primary"
                  disabled={working}
                  onClick={() => void move('completed', 'follow_up')}
                >
                  Completar solicitud
                </button>
              </>
            ) : null}
            {item.quoteRequirement !== 'no' ? (
              <Link
                className="button button-secondary"
                to={`/cotizaciones/nueva?requestId=${item.id}`}
              >
                Crear cotización
              </Link>
            ) : null}
            {message ? <div className="notice">{message}</div> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
