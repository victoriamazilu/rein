import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  meta,
  actions,
}: {
  breadcrumbs?: Crumb[];
  title: ReactNode;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="page-header-main">
        <div>
          <h1>{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
          {meta ? <div className="page-meta">{meta}</div> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="stat-pill">
      <strong>{value}</strong> {label}
    </span>
  );
}

export function VisibilityBadge({ visibility }: { visibility: "public" | "private" }) {
  return (
    <span className={`badge badge-${visibility}`}>
      {visibility === "public" ? "Public" : "Private"}
    </span>
  );
}

export function LanguageDot({ language }: { language: string }) {
  return (
    <span className="language-dot">
      <span aria-hidden="true" />
      {language}
    </span>
  );
}
