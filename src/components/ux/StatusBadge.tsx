import type { DeskStatusBadge } from "@/lib/ux/types";
import { STATUS_BADGE_STYLES } from "@/lib/ux/status-badges";

export default function StatusBadge({
  status,
  className = "",
}: {
  status: DeskStatusBadge;
  className?: string;
}) {
  const style = STATUS_BADGE_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.className} ${className}`}
    >
      {style.label}
    </span>
  );
}
