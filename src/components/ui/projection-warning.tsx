"use client";

export function ProjectionWarning({
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
    <div className="ui-risk-banner ui-risk-banner-warning" role="alert">
      <p className="font-semibold">Projection unavailable. Showing safe zero-state.</p>
      <ul className="mt-2 list-inside list-disc text-sm text-[var(--muted)]">
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

/** @deprecated Use ProjectionWarning */
export const ProjectionWarningPanel = ProjectionWarning;
