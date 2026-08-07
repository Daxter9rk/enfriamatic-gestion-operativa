import { ArchiveRestore, Edit3, Plus, Search, Snowflake, Trash2 } from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../shared/components/Ui';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import { getFirebaseServices } from '../../../shared/services/firebase';

interface DirectoryItem {
  id: string;
  name: string;
  active: boolean;
  [key: string]: unknown;
}

interface Option {
  value: string;
  label: string;
}
interface FieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'select' | 'textarea';
  required?: boolean;
  options?: Option[];
  placeholder?: string;
}
interface ColumnDefinition {
  key: string;
  label: string;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '-';
}

function DirectoryPage({
  title,
  description,
  collectionName,
  fields,
  columns,
  detailsPath,
}: {
  title: string;
  description: string;
  collectionName: string;
  fields: FieldDefinition[];
  columns: ColumnDefinition[];
  detailsPath?: string;
}) {
  const { profile } = useAuth();
  const state = useCollectionData<DirectoryItem>(collectionName);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<DirectoryItem | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const visible = useMemo(
    () =>
      state.data.filter(
        (item) =>
          (showInactive || item.active) &&
          Object.values(item).some((value) =>
            String(value).toLowerCase().includes(search.toLowerCase()),
          ),
      ),
    [search, showInactive, state.data],
  );

  function begin(item?: DirectoryItem) {
    setEditing(item ?? { id: '', name: '', active: true });
    setForm(
      item
        ? Object.fromEntries(fields.map((field) => [field.key, displayValue(item[field.key])]))
        : {},
    );
    setFeedback('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setFeedback('');
    const payload = Object.fromEntries(
      fields.map((field) => [
        field.key,
        field.type === 'number' ? Number(form[field.key] ?? 0) : (form[field.key] ?? '').trim(),
      ]),
    );
    try {
      const { firestore } = getFirebaseServices();
      if (editing?.id) {
        await updateDoc(doc(firestore, collectionName, editing.id), {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedBy: profile.uid,
        });
      } else {
        await addDoc(collection(firestore, collectionName), {
          ...payload,
          active: true,
          createdAt: serverTimestamp(),
          createdBy: profile.uid,
          updatedAt: serverTimestamp(),
          updatedBy: profile.uid,
          schemaVersion: 1,
        });
      }
      setEditing(null);
      setForm({});
      setFeedback('Cambios guardados correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: DirectoryItem) {
    if (!profile) return;
    try {
      await updateDoc(doc(getFirebaseServices().firestore, collectionName, item.id), {
        active: !item.active,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible actualizar.');
    }
  }

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState message={state.error} />;

  return (
    <div className="page-stack">
      <PageHeader
        title={title}
        description={description}
        actions={
          <button className="button button-primary" onClick={() => begin()}>
            <Plus size={18} /> Nuevo registro
          </button>
        }
      />
      {editing ? (
        <Card title={editing.id ? 'Editar registro' : 'Nuevo registro'}>
          <form className="form-grid" onSubmit={(event) => void save(event)}>
            {fields.map((field) => (
              <Field key={field.key} label={field.label}>
                {field.type === 'select' ? (
                  <select
                    required={field.required}
                    value={form[field.key] ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  >
                    <option value="">Selecciona una opción</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    required={field.required}
                    rows={3}
                    value={form[field.key] ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                ) : (
                  <input
                    required={field.required}
                    type={field.type ?? 'text'}
                    placeholder={field.placeholder}
                    value={form[field.key] ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                )}
              </Field>
            ))}
            <div className="form-actions">
              <button
                className="button button-secondary"
                onClick={() => setEditing(null)}
                type="button"
              >
                Cancelar
              </button>
              <button className="button button-primary" disabled={saving} type="submit">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card>
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label={`Buscar en ${title}`}
              placeholder="Buscar…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="check-field">
            <input
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              type="checkbox"
            />{' '}
            Mostrar inactivos
          </label>
        </div>
        {feedback ? <div className="notice">{feedback}</div> : null}
        {visible.length === 0 ? (
          <EmptyState
            icon={Snowflake}
            title="Sin registros"
            description="Crea el primer registro o ajusta los filtros."
          />
        ) : (
          <div className="responsive-table entity-table">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    {columns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'name' && detailsPath ? (
                          <Link to={`${detailsPath}/${item.id}`}>
                            <strong>{displayValue(item[column.key])}</strong>
                          </Link>
                        ) : (
                          displayValue(item[column.key])
                        )}
                      </td>
                    ))}
                    <td>
                      <StatusBadge tone={item.active ? 'green' : 'neutral'}>
                        {item.active ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          aria-label="Editar"
                          className="icon-button"
                          onClick={() => begin(item)}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          aria-label={item.active ? 'Dar de baja' : 'Reactivar'}
                          className="icon-button"
                          onClick={() => void toggle(item)}
                        >
                          {item.active ? <Trash2 size={16} /> : <ArchiveRestore size={16} />}
                        </button>
                      </div>
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

export function ClientsPage() {
  return (
    <DirectoryPage
      title="Clientes"
      description="Contactos, datos disponibles e historial operativo."
      collectionName="clients"
      columns={[
        { key: 'name', label: 'Cliente' },
        { key: 'contactName', label: 'Contacto' },
        { key: 'email', label: 'Correo' },
        { key: 'phone', label: 'Teléfono' },
      ]}
      fields={[
        { key: 'name', label: 'Nombre', required: true },
        { key: 'contactName', label: 'Contacto principal', required: true },
        { key: 'email', label: 'Correo', type: 'email', required: true },
        { key: 'phone', label: 'Teléfono', required: true },
        { key: 'taxId', label: 'Identificador fiscal disponible' },
      ]}
    />
  );
}

export function SitesPage() {
  const clients = useCollectionData<DirectoryItem>('clients');
  return (
    <DirectoryPage
      title="Instalaciones"
      description="Ubicaciones, contactos, acceso y equipos relacionados."
      collectionName="sites"
      columns={[
        { key: 'name', label: 'Instalación' },
        { key: 'type', label: 'Tipo' },
        { key: 'address', label: 'Dirección' },
        { key: 'contactName', label: 'Contacto' },
      ]}
      fields={[
        {
          key: 'clientId',
          label: 'Cliente',
          type: 'select',
          required: true,
          options: clients.data
            .filter((item) => item.active)
            .map((item) => ({ value: item.id, label: item.name })),
        },
        { key: 'name', label: 'Nombre', required: true },
        { key: 'type', label: 'Tipo', required: true },
        { key: 'address', label: 'Dirección', required: true },
        { key: 'contactName', label: 'Contacto', required: true },
        { key: 'accessNotes', label: 'Referencias de acceso', type: 'textarea' },
        { key: 'mapUrl', label: 'Enlace seguro a mapa' },
      ]}
    />
  );
}

export function EquipmentPage() {
  const clients = useCollectionData<DirectoryItem>('clients');
  const sites = useCollectionData<DirectoryItem>('sites');
  return (
    <DirectoryPage
      title="Equipos"
      description="Expedientes técnicos vinculados a clientes e instalaciones."
      collectionName="equipment"
      detailsPath="/equipos"
      columns={[
        { key: 'name', label: 'Equipo' },
        { key: 'category', label: 'Categoría' },
        { key: 'brand', label: 'Marca' },
        { key: 'model', label: 'Modelo' },
        { key: 'status', label: 'Condición' },
      ]}
      fields={[
        {
          key: 'clientId',
          label: 'Cliente',
          type: 'select',
          required: true,
          options: clients.data
            .filter((item) => item.active)
            .map((item) => ({ value: item.id, label: item.name })),
        },
        {
          key: 'siteId',
          label: 'Instalación',
          type: 'select',
          required: true,
          options: sites.data
            .filter((item) => item.active)
            .map((item) => ({ value: item.id, label: item.name })),
        },
        { key: 'name', label: 'Nombre del equipo', required: true },
        { key: 'category', label: 'Categoría', required: true },
        { key: 'brand', label: 'Marca', required: true },
        { key: 'model', label: 'Modelo', required: true },
        { key: 'serialNumber', label: 'Número de serie', required: true },
        { key: 'capacity', label: 'Capacidad' },
        { key: 'refrigerant', label: 'Refrigerante' },
        {
          key: 'status',
          label: 'Condición',
          type: 'select',
          required: true,
          options: [
            { value: 'operating', label: 'Operando' },
            { value: 'maintenance', label: 'En mantenimiento' },
            { value: 'inactive', label: 'Inactivo' },
          ],
        },
      ]}
    />
  );
}

export function CatalogPage() {
  return (
    <DirectoryPage
      title="Catálogo comercial"
      description="Productos y servicios disponibles para cotizar. Sin inventario ni compras."
      collectionName="catalogItems"
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Concepto' },
        { key: 'category', label: 'Categoría' },
        { key: 'unit', label: 'Unidad' },
        { key: 'basePrice', label: 'Precio base' },
      ]}
      fields={[
        { key: 'code', label: 'Código', required: true },
        { key: 'name', label: 'Nombre', required: true },
        {
          key: 'type',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { value: 'product', label: 'Producto' },
            { value: 'service', label: 'Servicio' },
          ],
        },
        { key: 'category', label: 'Categoría', required: true },
        { key: 'unit', label: 'Unidad', required: true },
        { key: 'brand', label: 'Marca' },
        { key: 'model', label: 'Modelo' },
        { key: 'basePrice', label: 'Precio base', type: 'number', required: true },
        { key: 'taxRate', label: 'IVA decimal', type: 'number', required: true },
      ]}
    />
  );
}
