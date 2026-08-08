import {
  Building2,
  Check,
  ClipboardCheck,
  MapPin,
  Snowflake,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Client, Equipment, Site, UserProfile } from '../../../domain/model';
import {
  decodeClient,
  decodeEquipment,
  decodeSite,
  decodeUserProfile,
} from '../../../domain/firestore-validation';
import { callBackend } from '../../../shared/services/callables';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { Card, Field, PageHeader } from '../../../shared/components/Ui';
import { useAuth, useOperationalProfile } from '../../auth/AuthContext';

const steps = ['Cliente', 'Instalación', 'Alcance', 'Servicio', 'Asignación', 'Resumen'];

interface Draft {
  clientId: string;
  siteId: string;
  equipmentId: string;
  serviceType: string;
  priority: string;
  requestedDate: string;
  assigneeId: string;
  description: string;
  quoteRequirement: string;
}

const initialDraft: Draft = {
  clientId: '',
  siteId: '',
  equipmentId: '',
  serviceType: 'diagnostic',
  priority: 'medium',
  requestedDate: '',
  assigneeId: '',
  description: '',
  quoteRequirement: 'undetermined',
};

export function RequestWizardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const operational = useOperationalProfile();
  const userScope = useMemo(
    () =>
      operational === 'primary_admin' || operational === 'promoted_admin'
        ? []
        : operational === 'supervisor'
          ? [where('supervisorId', '==', profile?.uid ?? '')]
          : [where('uid', '==', profile?.uid ?? '')],
    [operational, profile?.uid],
  );
  const clients = useCollectionData<Client>('clients', decodeClient);
  const sites = useCollectionData<Site>('sites', decodeSite);
  const equipment = useCollectionData<Equipment>('equipment', decodeEquipment);
  const users = useCollectionData<UserProfile>('users', decodeUserProfile, userScope);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  const availableSites = useMemo(
    () => sites.data.filter((site) => site.clientId === draft.clientId && site.active),
    [draft.clientId, sites.data],
  );
  const availableEquipment = useMemo(
    () => equipment.data.filter((item) => item.siteId === draft.siteId && item.active),
    [draft.siteId, equipment.data],
  );
  const operators = [
    ...new Map(
      [profile, ...users.data]
        .filter((user): user is UserProfile => Boolean(user))
        .filter((user) => user.role === 'operator' && user.status === 'active')
        .map((user) => [user.uid, user]),
    ).values(),
  ];

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function canContinue() {
    if (step === 0) return Boolean(draft.clientId);
    if (step === 1) return Boolean(draft.siteId);
    if (step === 2) return true;
    if (step === 3) return Boolean(draft.serviceType && draft.requestedDate);
    if (step === 4) return true;
    return Boolean(draft.description);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await callBackend<Draft & { idempotencyKey: string }, { requestId: string }>(
        'createServiceRequest',
        { ...draft, idempotencyKey: idempotencyKey.current },
      );
      await navigate(`/solicitudes/${response.requestId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear la solicitud.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="page-stack" onSubmit={(event) => void submit(event)}>
      <PageHeader
        title="Nueva solicitud operativa"
        description="Completa el flujo en seis pasos. Podrás revisar todo antes de crearla."
      />
      <ol className="stepper" aria-label="Progreso de la solicitud">
        {steps.map((label, index) => (
          <li className={index < step ? 'done' : index === step ? 'active' : ''} key={label}>
            <span>{index < step ? <Check size={16} /> : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>
      <Card className="wizard-card">
        {step === 0 ? (
          <section>
            <h2>1. Selecciona el cliente</h2>
            <div className="selection-grid">
              {clients.data
                .filter((client) => client.active)
                .map((client) => (
                  <button
                    className={
                      draft.clientId === client.id ? 'selection-card selected' : 'selection-card'
                    }
                    key={client.id}
                    onClick={() => update('clientId', client.id)}
                    type="button"
                  >
                    <Building2 />
                    <strong>{client.name}</strong>
                    <small>{client.contactName}</small>
                  </button>
                ))}
            </div>
          </section>
        ) : null}
        {step === 1 ? (
          <section>
            <h2>2. Selecciona la instalación</h2>
            <div className="selection-grid">
              {availableSites.map((site) => (
                <button
                  className={
                    draft.siteId === site.id ? 'selection-card selected' : 'selection-card'
                  }
                  key={site.id}
                  onClick={() => update('siteId', site.id)}
                  type="button"
                >
                  <MapPin />
                  <strong>{site.name}</strong>
                  <small>{site.address}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {step === 2 ? (
          <section>
            <h2>3. Define el alcance</h2>
            <p>La solicitud puede abarcar la instalación o un equipo específico.</p>
            <div className="selection-grid">
              <button
                className={draft.equipmentId === '' ? 'selection-card selected' : 'selection-card'}
                onClick={() => update('equipmentId', '')}
                type="button"
              >
                <Building2 />
                <strong>Alcance general</strong>
                <small>Instalación completa</small>
              </button>
              {availableEquipment.map((item) => (
                <button
                  className={
                    draft.equipmentId === item.id ? 'selection-card selected' : 'selection-card'
                  }
                  key={item.id}
                  onClick={() => update('equipmentId', item.id)}
                  type="button"
                >
                  <Snowflake />
                  <strong>{item.category}</strong>
                  <small>
                    {item.brand} · {item.model}
                  </small>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {step === 3 ? (
          <section>
            <h2>4. Servicio</h2>
            <div className="service-grid">
              {[
                ['diagnostic', 'Diagnóstico', Stethoscope],
                ['preventive', 'Mantenimiento preventivo', ClipboardCheck],
                ['corrective', 'Mantenimiento correctivo', Snowflake],
                ['installation', 'Instalación', Building2],
              ].map(([value, label, Icon]) => {
                const ServiceIcon = Icon as typeof Stethoscope;
                return (
                  <button
                    className={
                      draft.serviceType === value ? 'selection-card selected' : 'selection-card'
                    }
                    key={String(value)}
                    onClick={() => update('serviceType', String(value))}
                    type="button"
                  >
                    <ServiceIcon />
                    <strong>{String(label)}</strong>
                  </button>
                );
              })}
            </div>
            <div className="form-grid">
              <Field label="Prioridad">
                <select
                  value={draft.priority}
                  onChange={(event) => update('priority', event.target.value)}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </Field>
              <Field label="Fecha solicitada">
                <input
                  required
                  type="date"
                  value={draft.requestedDate}
                  onChange={(event) => update('requestedDate', event.target.value)}
                />
              </Field>
              <Field label="¿Requiere cotización?">
                <select
                  value={draft.quoteRequirement}
                  onChange={(event) => update('quoteRequirement', event.target.value)}
                >
                  <option value="undetermined">Por determinar</option>
                  <option value="yes">Sí</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>
          </section>
        ) : null}
        {step === 4 ? (
          <section>
            <h2>5. Asignación</h2>
            <div className="selection-grid">
              <button
                className={draft.assigneeId === '' ? 'selection-card selected' : 'selection-card'}
                onClick={() => update('assigneeId', '')}
                type="button"
              >
                <UserRound />
                <strong>{profile?.role === 'admin' ? 'Sin asignar' : 'Para mí'}</strong>
                <small>
                  {profile?.role === 'admin' ? 'Asignar más tarde' : profile?.displayName}
                </small>
              </button>
              {operators.map((operator) => (
                <button
                  className={
                    draft.assigneeId === operator.uid ? 'selection-card selected' : 'selection-card'
                  }
                  key={operator.uid}
                  onClick={() => update('assigneeId', operator.uid)}
                  type="button"
                >
                  <UserRound />
                  <strong>{operator.displayName}</strong>
                  <small>Operador activo</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {step === 5 ? (
          <section>
            <h2>6. Revisa y describe</h2>
            <div className="summary-grid">
              <dl>
                <div>
                  <dt>Cliente</dt>
                  <dd>{clients.data.find((item) => item.id === draft.clientId)?.name}</dd>
                </div>
                <div>
                  <dt>Instalación</dt>
                  <dd>{sites.data.find((item) => item.id === draft.siteId)?.name}</dd>
                </div>
                <div>
                  <dt>Servicio</dt>
                  <dd>{draft.serviceType}</dd>
                </div>
                <div>
                  <dt>Prioridad</dt>
                  <dd>{draft.priority}</dd>
                </div>
              </dl>
              <Field label="Descripción del trabajo">
                <textarea
                  required
                  rows={6}
                  value={draft.description}
                  onChange={(event) => update('description', event.target.value)}
                />
              </Field>
            </div>
          </section>
        ) : null}
        {error ? <div className="notice notice-error">{error}</div> : null}
      </Card>
      <footer className="wizard-actions">
        <button
          className="button button-secondary"
          disabled={step === 0 || submitting}
          onClick={() => setStep((value) => value - 1)}
          type="button"
        >
          Anterior
        </button>
        {step < steps.length - 1 ? (
          <button
            className="button button-primary"
            disabled={!canContinue()}
            onClick={() => setStep((value) => value + 1)}
            type="button"
          >
            Continuar
          </button>
        ) : (
          <button
            className="button button-primary"
            disabled={!canContinue() || submitting}
            type="submit"
          >
            {submitting ? 'Creando…' : 'Crear solicitud'}
          </button>
        )}
      </footer>
    </form>
  );
}
