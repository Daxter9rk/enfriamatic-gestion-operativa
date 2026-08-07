import { Save, Settings2 } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState, type FormEvent } from 'react';
import type { AppSettings } from '../../../domain/model';
import { useAuth } from '../../auth/AuthProvider';
import { Card, Field, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { getFirebaseServices } from '../../../shared/services/firebase';

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
  const { profile } = useAuth();
  const settings = useCollectionData<AppSettings & { id: string }>('settings');
  const [form, setForm] = useState(defaults);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const app = settings.data.find((item) => item.id === 'app');
    if (app) setForm(app);
  }, [settings.data]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setFeedback('');
    try {
      await setDoc(
        doc(getFirebaseServices().firestore, 'settings', 'app'),
        {
          ...form,
          updatedAt: serverTimestamp(),
          updatedBy: profile.uid,
          schemaVersion: 1,
        },
        { merge: true },
      );
      setFeedback('Configuración DEV guardada.');
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
