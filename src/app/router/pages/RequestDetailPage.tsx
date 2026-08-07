import { Activity, CalendarDays, FileText, Upload, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ServiceRequest } from '../../../domain/model';
import { Card, LoadingState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useAuthorizedRequests } from '../../../shared/hooks/useAuthorizedRequests';
import { callBackend } from '../../../shared/services/callables';
import { openPrivateDocument } from '../../../shared/services/private-files';

export function RequestDetailPage() {
  const { requestId = '' } = useParams();
  const requests = useAuthorizedRequests();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<
    { documentId: string; fileName: string; mimeType: string; size: number }[]
  >([]);
  const item = requests.data.find((request) => request.id === requestId);

  const loadFiles = useCallback(async () => {
    if (!requestId) return;
    try {
      const response = await callBackend<
        { kind: string; resourceId: string },
        { files: { documentId: string; fileName: string; mimeType: string; size: number }[] }
      >('listPrivateFiles', { kind: 'request_evidence', resourceId: requestId });
      setFiles(response.files);
    } catch {
      setFiles([]);
    }
  }, [requestId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

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
      await callBackend('updateRequestProgress', {
        requestId: item.id,
        status,
        operationalStage: nextStage,
      });
      setMessage('Solicitud actualizada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible actualizar.');
    } finally {
      setWorking(false);
    }
  }

  async function upload(file: File) {
    setWorking(true);
    setMessage('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('No fue posible leer el archivo.'));
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('El archivo no produjo una representación válida.'));
        };
        reader.readAsDataURL(file);
      });
      await callBackend('uploadPrivateFile', {
        kind: 'request_evidence',
        resourceId: requestId,
        mimeType: file.type,
        fileName: file.name,
        base64: dataUrl.split(',')[1] ?? '',
      });
      await loadFiles();
      setMessage('Evidencia privada cargada y auditada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar evidencia.');
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
      <Card title="Evidencias privadas">
        <label className="button button-secondary">
          <Upload size={17} /> Subir evidencia
          <input
            hidden
            accept="image/jpeg,image/png,application/pdf"
            disabled={working}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
        </label>
        <ul className="activity-list">
          {files.map((file) => (
            <li key={file.documentId}>
              <FileText />
              <div>
                <strong>{file.fileName}</strong>
                <small>
                  {Math.ceil(file.size / 1024)} KB · {file.mimeType}
                </small>
              </div>
              <button
                className="button button-secondary"
                onClick={() => void openPrivateDocument(file.documentId)}
              >
                Abrir
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
