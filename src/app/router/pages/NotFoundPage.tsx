import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <p className="error-code">404</p>
      <h1 id="not-found-title">Esta ruta aún no existe</h1>
      <p>El módulo solicitado no forma parte de los fundamentos actuales.</p>
      <Link className="primary-link" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}
