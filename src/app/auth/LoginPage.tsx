import { LockKeyhole, ShieldCheck, Snowflake } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

function authMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code.includes('invalid-credential')) return 'El correo o la contraseña no son correctos.';
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos.';
  if (code.includes('user-disabled')) return 'La cuenta está deshabilitada.';
  return 'No fue posible iniciar sesión. Verifica tus datos e inténtalo de nuevo.';
}

export function LoginPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await auth.login(email, password);
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-brand">
        <div className="login-logo">
          <Snowflake size={38} />
          <span>
            <strong>ENFRIAMATIC</strong>
            <small>Gestión Operativa</small>
          </span>
        </div>
        <div>
          <p className="eyebrow">Entorno DEV</p>
          <h1>La operación técnica, clara y conectada.</h1>
          <p>Solicitudes, equipos y cotizaciones en un espacio seguro para el trabajo diario.</p>
        </div>
        <ul>
          <li>
            <ShieldCheck /> Acceso protegido por perfil y estado
          </li>
          <li>
            <LockKeyhole /> Archivos y documentos privados
          </li>
        </ul>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <span className="login-mark" aria-hidden="true">
            <Snowflake />
          </span>
          <p className="eyebrow">Bienvenido</p>
          <h2>Inicia sesión</h2>
          <p>Usa las credenciales ficticias asignadas para el entorno DEV.</p>
          <label>
            <span>Correo electrónico</span>
            <input
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Contraseña</span>
            <input
              autoComplete="current-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <div className="notice notice-error">{error}</div> : null}
          <button className="button button-primary" disabled={submitting} type="submit">
            {submitting ? 'Validando…' : 'Entrar a Gestión Operativa'}
          </button>
          <small>Este entorno contiene únicamente datos ficticios.</small>
        </form>
      </section>
    </main>
  );
}
