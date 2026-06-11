export type StatusTone = "ok" | "warning" | "blocked" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  ok: "ui-badge ui-badge-ok",
  warning: "ui-badge ui-badge-warning",
  blocked: "ui-badge ui-badge-blocked",
  neutral: "ui-badge ui-badge-neutral",
};

export function statusFromHealth(status?: string): StatusTone {
  if (status === "OK" || status === "SAFE" || status === "CONNECTED") return "ok";
  if (status === "WARNING" || status === "DEFENSIVE" || status === "COLLECTING") return "warning";
  if (status === "BLOCKED" || status === "MISSING_ENV") return "blocked";
  return "neutral";
}

export function StatusBadge({
  label,
  tone = "neutral",
  className = "",
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return <span className={`${TONE_CLASS[tone]} ${className}`.trim()}>{label}</span>;
}
