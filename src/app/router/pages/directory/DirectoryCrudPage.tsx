import { ArchiveRestore, Edit3, ImageUp, Plus, Search, Snowflake, Trash2 } from 'lucide-react';
import { where } from 'firebase/firestore';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../../shared/components/Ui';
import { useCollectionData } from '../../../../shared/hooks/useCollectionData';
import { callBackend } from '../../../../shared/services/callables';
import { decodeDirectoryRecord } from '../../../../domain/firestore-validation';
import { openPrivateDocument } from '../../../../shared/services/private-files';

export type ResourceCollection = 'clients' | 'sites' | 'equipment' | 'catalogItems';

export interface DirectoryItem {
  id: string;
  name: string;
  active: boolean;
  [key: string]: unknown;
}

export interface Option {
  value: string;
  label: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'select' | 'textarea';
  required?: boolean;
  options?: Option[];
  placeholder?: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '—';
}

export function DirectoryCrudPage({
  title,
  description,
  collectionName,
  fields,
  columns,
  detailsPath,
}: {
  title: string;
  description: string;
  collectionName: ResourceCollection;
  fields: FieldDefinition[];
  columns: ColumnDefinition[];
  detailsPath?: string;
}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const constraints = useMemo(() => (isAdmin ? [] : [where('active', '==', true)]), [isAdmin]);
  const state = useCollectionData<DirectoryItem>(
    collectionName,
    decodeDirectoryRecord,
    constraints,
  );
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
          (!isAdmin || showInactive || item.active) &&
          Object.values(item).some((value) =>
            String(value).toLowerCase().includes(search.toLowerCase()),
          ),
      ),
    [isAdmin, search, showInactive, state.data],
  );

  function begin(item?: DirectoryItem) {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setSaving(true);
    setFeedback('');
    const payload = Object.fromEntries(
      fields.map((field) => [
        field.key,
        field.type === 'number' ? Number(form[field.key] ?? 0) : (form[field.key] ?? '').trim(),
      ]),
    );
    try {
      await callBackend('saveOperationalResource', {
        collection: collectionName,
        resourceId: editing?.id || null,
        payload,
      });
      setEditing(null);
      setForm({});
      setFeedback('Cambios guardados y auditados correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: DirectoryItem) {
    if (!isAdmin) return;
    try {
      await callBackend('setOperationalResourceActive', {
        collection: collectionName,
        resourceId: item.id,
        active: !item.active,
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible actualizar.');
    }
  }

  async function uploadCatalogImage(item: DirectoryItem, file: File) {
    setFeedback('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('No fue posible leer la imagen.'));
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('La imagen no produjo una representación válida.'));
        };
        reader.readAsDataURL(file);
      });
      await callBackend('uploadPrivateFile', {
        kind: 'catalog_image',
        resourceId: item.id,
        mimeType: file.type,
        fileName: file.name,
        base64: dataUrl.split(',')[1] ?? '',
      });
      setFeedback('Imagen privada reemplazada y auditada.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible subir la imagen.');
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
          isAdmin ? (
            <button className="button button-primary" onClick={() => begin()}>
              <Plus size={18} /> Nuevo registro
            </button>
          ) : undefined
        }
      />
      {editing && isAdmin ? (
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
          {isAdmin ? (
            <label className="check-field">
              <input
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                type="checkbox"
              />{' '}
              Mostrar inactivos
            </label>
          ) : null}
        </div>
        {feedback ? <div className="notice">{feedback}</div> : null}
        {visible.length === 0 ? (
          <EmptyState
            icon={Snowflake}
            title="Sin registros"
            description="Ajusta los filtros disponibles."
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
                  {isAdmin ? <th>Acciones</th> : null}
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
                    {isAdmin ? (
                      <td>
                        <div className="row-actions">
                          <button
                            aria-label="Editar"
                            className="icon-button"
                            onClick={() => begin(item)}
                          >
                            <Edit3 size={16} />
                          </button>
                          {collectionName === 'catalogItems' ? (
                            <>
                              <label className="icon-button" aria-label="Subir imagen privada">
                                <ImageUp size={16} />
                                <input
                                  hidden
                                  accept="image/jpeg,image/png"
                                  type="file"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) void uploadCatalogImage(item, file);
                                    event.target.value = '';
                                  }}
                                />
                              </label>
                              {typeof item.imageDocumentId === 'string' ? (
                                <button
                                  className="icon-button"
                                  aria-label="Abrir imagen"
                                  onClick={() =>
                                    void openPrivateDocument(String(item.imageDocumentId))
                                  }
                                >
                                  <Search size={16} />
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          <button
                            aria-label={item.active ? 'Dar de baja' : 'Reactivar'}
                            className="icon-button"
                            onClick={() => void toggle(item)}
                          >
                            {item.active ? <Trash2 size={16} /> : <ArchiveRestore size={16} />}
                          </button>
                        </div>
                      </td>
                    ) : null}
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
