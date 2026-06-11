import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  updatedAt,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  updatedAt?: string;
}) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header-icon" aria-hidden>
        ◈
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="ui-page-title">{title}</h2>
        {description ? <p className="ui-page-desc">{description}</p> : null}
      </div>
      {updatedAt ? (
        <span className="ui-page-updated">Updated {updatedAt}</span>
      ) : null}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
