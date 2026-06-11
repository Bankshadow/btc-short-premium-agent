import type { ReactNode } from "react";

export function RiskBanner({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warning" | "blocked";
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`ui-risk-banner ui-risk-banner-${variant}`} role="status">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-[var(--muted)]">{children}</div> : null}
    </div>
  );
}
