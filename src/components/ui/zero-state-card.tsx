import type { ReactNode } from "react";
import { SectionCard } from "./section-card";

export function ZeroStateCard({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <SectionCard title={title} tone="neutral" zeroState>
      <p className="text-sm text-[var(--muted)]">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </SectionCard>
  );
}
