import { BookOpen, Download, Eye, HelpCircle, ShieldCheck, Workflow } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { Card, EmptyState, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { callBackend } from '../../../shared/services/callables';

interface Manual {
  id: string;
  title: string;
  description: string;
  audience: 'all' | 'operator' | 'admin';
  version: string;
  publishedAt: string;
  pages: number;
  documentId: string;
  active: boolean;
}

const guides = [
  ['Flujo operativo', 'De la solicitud al seguimiento', Workflow],
  ['Estados de solicitudes', 'Diferencia estado y etapa', HelpCircle],
  ['Estados de cotizaciones', 'Borrador, emisión y seguimiento', BookOpen],
  ['Roles y permisos', 'Alcances por perfil', ShieldCheck],
  ['Relaciones operativas', 'Cliente, instalación y equipo', Workflow],
  ['Errores frecuentes', 'Sesión, permisos y validaciones', HelpCircle],
] as const;

export function HelpCenterPage() {
  const { profile } = useAuth();
  const manualScope = useMemo(
    () => (profile?.role === 'admin' ? [] : [where('audience', 'in', ['all', 'operator'])]),
    [profile?.role],
  );
  const manuals = useCollectionData<Manual>('manuals', manualScope);
  const [feedback, setFeedback] = useState('');
  const visible = manuals.data.filter(
    (manual) => manual.active && (manual.audience !== 'admin' || profile?.role === 'admin'),
  );
  async function open(documentId: string) {
    setFeedback('');
    try {
      const response = await callBackend<{ documentId: string }, { url: string }>(
        'getPrivateDownloadUrl',
        { documentId },
      );
      window.open(response.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible abrir.');
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        title="Centro de ayuda"
        description="Documentación y guías disponibles según tu rol y permisos."
      />
      <div className="notice notice-info">
        <ShieldCheck />
        <span>El backend valida el acceso a cada manual, incluso si se conoce su ID o ruta.</span>
      </div>
      <Card title="Manuales principales">
        {visible.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Manuales DEV pendientes"
            description="Los documentos finales son un entregable externo. Los fixtures DEV se incorporan con el seed."
          />
        ) : (
          <div className="manual-grid">
            {visible.map((manual) => (
              <article className="manual-card" key={manual.id}>
                <span className="manual-cover">
                  <BookOpen />
                </span>
                <div>
                  <StatusBadge tone={manual.audience === 'admin' ? 'purple' : 'blue'}>
                    {manual.audience}
                  </StatusBadge>
                  <h3>{manual.title}</h3>
                  <p>{manual.description}</p>
                  <dl>
                    <div>
                      <dt>Versión</dt>
                      <dd>{manual.version}</dd>
                    </div>
                    <div>
                      <dt>Fecha</dt>
                      <dd>{manual.publishedAt}</dd>
                    </div>
                    <div>
                      <dt>Páginas</dt>
                      <dd>{manual.pages}</dd>
                    </div>
                  </dl>
                  <div className="row-actions">
                    <button
                      className="button button-secondary"
                      onClick={() => void open(manual.documentId)}
                    >
                      <Eye size={17} /> Vista previa
                    </button>
                    <button
                      className="button button-primary"
                      onClick={() => void open(manual.documentId)}
                    >
                      <Download size={17} /> Descargar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {feedback ? <div className="notice notice-error">{feedback}</div> : null}
      </Card>
      <Card title="Guías rápidas">
        <div className="guide-grid">
          {guides.map(([title, description, Icon]) => (
            <article key={title}>
              <span className="icon-box tone-blue">
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
