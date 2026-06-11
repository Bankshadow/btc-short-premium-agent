import type { ReactNode } from "react";

export interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  tag?: string;
  icon?: ReactNode;
  intent?: "positive" | "negative" | "neutral";
  zeroState?: boolean;
}

export function MetricCard({
  label,
  value,
  description,
  tag,
  icon,
  intent = "neutral",
  zeroState,
}: MetricCardProps) {
  const intentClass =
    intent === "positive"
      ? "text-[var(--success)]"
      : intent === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--text)]";

  return (
    <div className={`ui-metric-card ${zeroState ? "ui-zero-state" : ""}`.trim()}>
      <div className="ui-metric-card-header">
        <span className="ui-bullet" aria-hidden />
        <span className="ui-metric-label">{label}</span>
        {icon ? <span className="ui-metric-icon">{icon}</span> : null}
      </div>
      <div className="ui-metric-card-body">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`ui-metric-value ${intentClass}`}>{value}</span>
          {tag ? <span className="ui-badge ui-badge-neutral">{tag}</span> : null}
        </div>
        {description ? <p className="ui-metric-desc">{description}</p> : null}
      </div>
    </div>
  );
}
