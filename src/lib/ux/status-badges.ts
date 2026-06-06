import type { DeskStatusBadge } from "./types";

export const STATUS_BADGE_STYLES: Record<
  DeskStatusBadge,
  { label: string; className: string }
> = {
  SAFE: {
    label: "Safe",
    className: "border-emerald-800/50 bg-emerald-950/40 text-emerald-200",
  },
  CAUTION: {
    label: "Caution",
    className: "border-amber-800/50 bg-amber-950/40 text-amber-200",
  },
  BLOCKED: {
    label: "Blocked",
    className: "border-rose-800/50 bg-rose-950/40 text-rose-200",
  },
  EMERGENCY: {
    label: "Emergency",
    className: "border-rose-600/60 bg-rose-900/50 text-rose-100",
  },
  RUNNING: {
    label: "Running",
    className: "border-cyan-800/50 bg-cyan-950/40 text-cyan-200",
  },
  NEEDS_ACTION: {
    label: "Needs action",
    className: "border-indigo-800/50 bg-indigo-950/40 text-indigo-200",
  },
  PAPER: {
    label: "Paper",
    className: "border-teal-800/50 bg-teal-950/40 text-teal-200",
  },
  SHADOW: {
    label: "Shadow",
    className: "border-violet-800/50 bg-violet-950/40 text-violet-200",
  },
  TESTNET: {
    label: "Testnet",
    className: "border-cyan-800/50 bg-cyan-950/30 text-cyan-100",
  },
  LIVE_LOCKED: {
    label: "Live locked",
    className: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
  },
};

export function mapDeskStatusToBadge(status: string): DeskStatusBadge {
  const s = status.toUpperCase();
  if (s === "SAFE" || s === "COMPLETED") return "SAFE";
  if (s === "EMERGENCY") return "EMERGENCY";
  if (s === "CAUTION" || s === "WARNING") return "CAUTION";
  if (s === "BLOCKED" || s === "FAILED") return "BLOCKED";
  if (s === "RUNNING") return "RUNNING";
  if (s === "IDLE") return "CAUTION";
  return "CAUTION";
}

export function mapVerdictToBadge(verdict: string): DeskStatusBadge | null {
  const v = verdict.toUpperCase();
  if (v === "TRADE") return "NEEDS_ACTION";
  if (v === "WAIT" || v === "SKIP") return "CAUTION";
  return null;
}

export function mapLiveReadinessToBadge(status: string): DeskStatusBadge {
  const s = status.toUpperCase();
  if (s === "PASS") return "SAFE";
  if (s === "WARNING") return "CAUTION";
  return "BLOCKED";
}
