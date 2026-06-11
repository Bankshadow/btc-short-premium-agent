import { StatusBadge, type StatusTone } from "./status-badge";

export interface ProgressCardProps {
  title: string;
  current: number;
  required: number;
  statusLabel?: string;
  tone?: StatusTone;
  message?: string;
  zeroState?: boolean;
}

export function ProgressCard({
  title,
  current,
  required,
  statusLabel,
  tone = "neutral",
  message,
  zeroState,
}: ProgressCardProps) {
  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;

  return (
    <div className={`ui-section-card ${zeroState ? "ui-zero-state" : ""}`.trim()}>
      <div className="ui-section-card-header">
        <span className="ui-bullet" aria-hidden />
        <h3 className="ui-section-title">{title}</h3>
        {statusLabel ? <StatusBadge label={statusLabel} tone={tone} /> : null}
      </div>
      <div className="ui-section-card-body space-y-3">
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl font-bold tracking-tight">
            {current}/{required}
          </span>
          <span className="text-sm text-[var(--muted)]">{pct}%</span>
        </div>
        <div className="ui-progress-track">
          <div className="ui-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
      </div>
    </div>
  );
}
