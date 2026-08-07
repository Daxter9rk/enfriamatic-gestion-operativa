export function FoundationsPage() {
  return (
    <section className="page-stack" aria-labelledby="foundations-title">
      <div className="section-heading">
        <p className="eyebrow">Fundamentos</p>
        <h1 id="foundations-title">Plataforma preparada</h1>
        <p>
          Este espacio documenta exclusivamente capacidades técnicas. No contiene módulos ni datos
          de negocio.
        </p>
      </div>
      <dl className="technical-list">
        <div>
          <dt>Frontend</dt>
          <dd>React 19, TypeScript estricto y Vite</dd>
        </div>
        <div>
          <dt>Backend</dt>
          <dd>Firebase DEV y Functions Gen 2 en us-central1</dd>
        </div>
        <div>
          <dt>Seguridad</dt>
          <dd>Acceso remoto denegado mientras el dominio no exista</dd>
        </div>
      </dl>
    </section>
  );
}
