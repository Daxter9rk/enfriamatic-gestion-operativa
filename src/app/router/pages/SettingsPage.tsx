import { Save, Settings2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { AppSettings } from '../../../domain/model';
import { decodeSettings } from '../../../domain/firestore-validation';
import { Card, Field, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { callBackend } from '../../../shared/services/callables';
import { useAuth } from '../../auth/AuthContext';

const defaults: AppSettings = {
  companyName: 'Enfriamatic · datos DEV',
  taxRate: 0.16,
  quoteValidityDays: 15,
  maxDiscountPercent: 20,
  quoteFolioPrefix: 'COT-DEV',
  requestFolioPrefix: 'SOL-DEV',
  commercialConditions: [],
  legalText: '',
  policyStatus: 'dev_provisional',
};

export function SettingsPage() {
  const auth = useAuth();
  const reauthenticate = (password: string) => auth.reauthenticate(password);
  const settings = useCollectionData<AppSettings & { id: string }>('settings', decodeSettings);
  const [form, setForm] = useState(defaults);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  useEffect(() => {
    const app = settings.data.find((item) => item.id === 'app');
    if (app) setForm(app);
  }, [settings.data]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      await reauthenticate(currentPassword);
      await callBackend('updateAppSettings', form);
      setFeedback('Configuración DEV guardada y auditada.');
      setCurrentPassword('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Configuración"
        description="Parámetros comerciales y operativos modificables."
        actions={<StatusBadge tone="orange">DEV provisional</StatusBadge>}
      />
      <Card title="Políticas configurables">
        <form className="form-grid" onSubmit={(event) => void save(event)}>
          <Field label="Nombre empresarial">
            <input
              required
              value={form.companyName}
              onChange={(event) => setForm({ ...form, companyName: event.target.value })}
            />
          </Field>
          <Field label="IVA decimal">
            <input
              required
              min="0"
              max="1"
              step="0.01"
              type="number"
              value={form.taxRate}
              onChange={(event) => setForm({ ...form, taxRate: Number(event.target.value) })}
            />
          </Field>
          <Field label="Vigencia de cotización (días)">
            <input
              required
              min="1"
              max="365"
              type="number"
              value={form.quoteValidityDays}
              onChange={(event) =>
                setForm({ ...form, quoteValidityDays: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Descuento máximo %">
            <input
              required
              min="0"
              max="100"
              type="number"
              value={form.maxDiscountPercent}
              onChange={(event) =>
                setForm({ ...form, maxDiscountPercent: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Prefijo de solicitudes">
            <input
              required
              value={form.requestFolioPrefix}
              onChange={(event) => setForm({ ...form, requestFolioPrefix: event.target.value })}
            />
          </Field>
          <Field label="Prefijo de cotizaciones">
            <input
              required
              value={form.quoteFolioPrefix}
              onChange={(event) => setForm({ ...form, quoteFolioPrefix: event.target.value })}
            />
          </Field>
          <Field label="Texto legal" hint="Déjalo vacío mientras no exista texto aprobado.">
            <textarea
              rows={4}
              value={form.legalText}
              onChange={(event) => setForm({ ...form, legalText: event.target.value })}
            />
          </Field>
          <Field label="Condiciones comerciales" hint="Una condición por línea.">
            <textarea
              rows={5}
              value={form.commercialConditions.join('\n')}
              onChange={(event) =>
                setForm({
                  ...form,
                  commercialConditions: event.target.value
                    .split('\n')
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field
            label="Contraseña actual"
            hint="Reautenticación obligatoria para configuración crítica."
          >
            <input
              required
              autoComplete="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <div className="notice">
            <Settings2 />
            <span>DEV provisional · requiere validación comercial antes de PROD.</span>
          </div>
          {feedback ? <div className="notice">{feedback}</div> : null}
          <button className="button button-primary" disabled={saving} type="submit">
            <Save size={18} /> Guardar configuración
          </button>
        </form>
      </Card>
    </div>
  );
}
