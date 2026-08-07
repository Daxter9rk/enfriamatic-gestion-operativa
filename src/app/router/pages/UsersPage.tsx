import { Search, UserPlus, UsersRound } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { UserProfile } from '../../../domain/model';
import { callBackend } from '../../../shared/services/callables';
import { useCollectionData } from '../../../shared/hooks/useCollectionData';
import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../../shared/components/Ui';

export function UsersPage() {
  const users = useCollectionData<UserProfile>('users');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    role: 'operator',
    supervisorId: '',
    teamId: '',
    temporaryPassword: '',
  });

  const visible = useMemo(
    () =>
      users.data.filter((user) =>
        `${user.displayName} ${user.email} ${user.role} ${user.status}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search, users.data],
  );

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      await callBackend('createManagedUser', form);
      setCreating(false);
      setForm({
        displayName: '',
        email: '',
        role: 'operator',
        supervisorId: '',
        teamId: '',
        temporaryPassword: '',
      });
      setFeedback('Usuario creado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible crear.');
    } finally {
      setSaving(false);
    }
  }

  async function action(uid: string, value: string) {
    setFeedback('');
    try {
      await callBackend('updateManagedUser', { uid, action: value });
      setFeedback('Estado actualizado.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No fue posible actualizar.');
    }
  }

  if (users.loading) return <LoadingState />;
  if (users.error) return <ErrorState message={users.error} />;

  return (
    <div className="page-stack">
      <PageHeader
        title="Usuarios y estructura"
        description="Administra perfiles, estados y jerarquía directa. Supervisor es una capacidad, no un rol adicional."
        actions={
          <button className="button button-primary" onClick={() => setCreating(true)}>
            <UserPlus size={18} /> Nuevo usuario
          </button>
        }
      />
      {creating ? (
        <Card title="Alta de usuario">
          <form className="form-grid" onSubmit={(event) => void create(event)}>
            <Field label="Nombre">
              <input
                required
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              />
            </Field>
            <Field label="Correo DEV">
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Rol técnico">
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                <option value="operator">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </Field>
            <Field label="Supervisor directo">
              <select
                value={form.supervisorId}
                onChange={(event) => setForm({ ...form, supervisorId: event.target.value })}
              >
                <option value="">Sin supervisor</option>
                {users.data
                  .filter((user) => user.role === 'operator' && user.status === 'active')
                  .map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Equipo">
              <input
                value={form.teamId}
                onChange={(event) => setForm({ ...form, teamId: event.target.value })}
              />
            </Field>
            <Field label="Contraseña temporal" hint="Mínimo 14 caracteres; no se versiona.">
              <input
                required
                minLength={14}
                type="password"
                autoComplete="new-password"
                value={form.temporaryPassword}
                onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })}
              />
            </Field>
            <div className="form-actions">
              <button
                className="button button-secondary"
                onClick={() => setCreating(false)}
                type="button"
              >
                Cancelar
              </button>
              <button className="button button-primary" disabled={saving} type="submit">
                Crear usuario
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
              aria-label="Buscar usuarios"
              placeholder="Buscar nombre, correo o estado"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {feedback ? <div className="notice">{feedback}</div> : null}
        {visible.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="Sin usuarios"
            description="No hay perfiles disponibles."
          />
        ) : (
          <div className="responsive-table entity-table">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Perfil</th>
                  <th>Estado</th>
                  <th>Supervisor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => {
                  const reports = users.data.filter(
                    (candidate) =>
                      candidate.supervisorId === user.uid && candidate.status === 'active',
                  ).length;
                  const profile =
                    user.role === 'admin'
                      ? user.isPrimaryAdmin
                        ? 'Administrador principal'
                        : 'Administrador promovido'
                      : reports > 0
                        ? 'Operador supervisor'
                        : 'Operador';
                  return (
                    <tr key={user.uid}>
                      <td>
                        <strong>{user.displayName}</strong>
                        <small>{user.email}</small>
                      </td>
                      <td>{user.role}</td>
                      <td>{profile}</td>
                      <td>
                        <StatusBadge
                          tone={
                            user.status === 'active'
                              ? 'green'
                              : user.status === 'pending'
                                ? 'orange'
                                : 'red'
                          }
                        >
                          {user.status}
                        </StatusBadge>
                      </td>
                      <td>
                        {users.data.find((candidate) => candidate.uid === user.supervisorId)
                          ?.displayName ?? '—'}
                      </td>
                      <td>
                        <select
                          aria-label={`Acción para ${user.displayName}`}
                          disabled={user.isPrimaryAdmin}
                          defaultValue=""
                          onChange={(event) => {
                            if (event.target.value) void action(user.uid, event.target.value);
                            event.target.value = '';
                          }}
                        >
                          <option value="">Acciones</option>
                          <option value="activate">Activar</option>
                          <option value="suspend">Suspender</option>
                          <option value="deactivate">Desactivar</option>
                          {user.role === 'operator' ? (
                            <option value="promote">Promover a admin</option>
                          ) : null}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
