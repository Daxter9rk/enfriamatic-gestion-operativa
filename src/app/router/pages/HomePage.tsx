const foundationItems = [
  ['Proyecto DEV', 'Firebase aislado y configuración pública validada.'],
  ['Acceso conservador', 'Firestore y Storage parten con denegación total.'],
  ['Calidad integrada', 'TypeScript estricto, pruebas y CI desde el inicio.'],
] as const;

export function HomePage() {
  return (
    <section className="page-stack" aria-labelledby="home-title">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Base técnica · Bloque 00</p>
          <h1 id="home-title">Fundamentos inicializados</h1>
          <p className="hero-copy">
            Un punto de partida limpio, seguro y preparado para construir la operación por bloques.
          </p>
        </div>
        <div className="status-orbit" aria-label="Estado del entorno: listo">
          <span aria-hidden="true" />
          Listo
        </div>
      </div>

      <div className="foundation-grid" aria-label="Resumen de fundamentos">
        {foundationItems.map(([title, description], index) => (
          <article className="foundation-card" key={title}>
            <span className="card-number" aria-hidden="true">
              0{index + 1}
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>

      <aside className="next-block" aria-label="Siguiente bloque">
        <div>
          <p className="eyebrow">Siguiente bloque recomendado</p>
          <h2>Identidad y acceso</h2>
        </div>
        <p>
          Autenticación, perfiles, roles y protección de rutas requieren una misión independiente.
        </p>
      </aside>
    </section>
  );
}
