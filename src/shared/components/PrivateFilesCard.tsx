import { FileText, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../app/auth/AuthContext';
import { callBackend } from '../services/callables';
import { openPrivateDocument } from '../services/private-files';
import { Card, EmptyState } from './Ui';

export type UploadDocumentKind =
  'catalog_image' | 'request_evidence' | 'site_document' | 'equipment_document';

interface PrivateFile {
  documentId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

async function fileAsBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('No fue posible leer el archivo.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('El archivo no produjo una representación válida.'));
    };
    reader.readAsDataURL(file);
  });
  return dataUrl.split(',')[1] ?? '';
}

export function PrivateFilesCard({
  kind,
  resourceId,
  title,
  uploadLabel = 'Subir archivo',
}: {
  kind: UploadDocumentKind;
  resourceId: string;
  title: string;
  uploadLabel?: string;
}) {
  const { profile } = useAuth();
  const [files, setFiles] = useState<PrivateFile[]>([]);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const canUpload = kind === 'request_evidence' || profile?.role === 'admin';

  const load = useCallback(async () => {
    if (!resourceId) return;
    try {
      const response = await callBackend<
        { kind: UploadDocumentKind; resourceId: string },
        { files: PrivateFile[] }
      >('listPrivateFiles', { kind, resourceId });
      setFiles(response.files);
    } catch (error) {
      setFiles([]);
      setMessage(error instanceof Error ? error.message : 'No fue posible consultar archivos.');
    }
  }, [kind, resourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setWorking(true);
    setMessage('');
    try {
      await callBackend('uploadPrivateFile', {
        kind,
        resourceId,
        mimeType: file.type,
        fileName: file.name,
        base64: await fileAsBase64(file),
      });
      await load();
      setMessage('Archivo privado cargado y auditado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar el archivo.');
    } finally {
      setWorking(false);
    }
  }

  async function remove(documentId: string) {
    setWorking(true);
    setMessage('');
    try {
      await callBackend('removePrivateFile', { documentId });
      await load();
      setMessage('Archivo retirado y auditado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible retirar el archivo.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card
      title={title}
      action={
        canUpload ? (
          <label className="button button-secondary">
            <Upload size={17} /> {uploadLabel}
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
        ) : undefined
      }
    >
      {files.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin archivos"
          description="No hay documentos disponibles para este recurso."
        />
      ) : (
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
              {canUpload ? (
                <button
                  aria-label={`Retirar ${file.fileName}`}
                  className="icon-button danger"
                  disabled={working}
                  onClick={() => void remove(file.documentId)}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {message ? <div className="notice">{message}</div> : null}
    </Card>
  );
}
