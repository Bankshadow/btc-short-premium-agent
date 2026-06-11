import type { ReactNode } from "react";
import { StatusBadge, type StatusTone } from "./status-badge";

export function SectionCard({
  title,
  addon,
  tone,
  children,
  className = "",
  zeroState,
}: {
  title: string;
  addon?: ReactNode;
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
  zeroState?: boolean;
}) {
  return (
    <section className={`ui-section-card ${zeroState ? "ui-zero-state" : ""} ${className}`.trim()}>
      <div className="ui-section-card-header">
        <span className={`ui-bullet ${tone ? `ui-bullet-${tone}` : ""}`.trim()} aria-hidden />
        <h3 className="ui-section-title">{title}</h3>
        {typeof addon === "string" ? <StatusBadge label={addon} tone={tone ?? "neutral"} /> : addon}
      </div>
      <div className="ui-section-card-body">{children}</div>
    </section>
  );
}
