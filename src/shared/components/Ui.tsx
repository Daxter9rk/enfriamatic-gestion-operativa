import type { LucideIcon } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'blue',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}) {
  return (
    <article className="stat-card">
      <span className={`icon-box tone-${tone}`} aria-hidden="true">
        <Icon size={22} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
}: PropsWithChildren<{ title?: string; action?: ReactNode; className?: string }>) {
  return (
    <section className={`panel-card ${className}`}>
      {title ? (
        <header className="card-header">
          <h2>{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatusBadge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: string }>) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

export function LoadingState({ label = 'Cargando información…' }: { label?: string }) {
  return (
    <div className="state-card" role="status">
      <span className="spinner" aria-hidden="true" />
      <h2>{label}</h2>
      <p>Estamos validando los datos y tus permisos.</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon size={28} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="notice notice-error" role="alert">
      <strong>No fue posible cargar esta sección.</strong>
      <span>{message}</span>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
