"use client";

export function ProjectionWarningPanel({
  warnings,
  errors,
  onRetry,
}: {
  warnings?: string[];
  errors?: string[];
  onRetry?: () => void;
}) {
  const items = [...(warnings ?? []), ...(errors ?? [])].filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="panel border border-[var(--warning)]/40 bg-[var(--warning)]/5 text-sm">
      <p className="font-semibold text-[var(--warning)]">
        Projection unavailable. Showing safe zero-state.
      </p>
      <ul className="mt-2 list-inside list-disc text-[var(--muted)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {onRetry ? (
        <button type="button" className="btn mt-3" onClick={onRetry}>
          Retry projections
        </button>
      ) : null}
    </div>
  );
}
