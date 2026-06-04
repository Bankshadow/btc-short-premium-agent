import type {
  CouncilAgentDebateRow,
  CouncilCommitteeDecision,
  CouncilProposalStatus,
} from "@/lib/council/types";

export function agentInitials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 2 && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase() || "AI";
}

export function stanceStyles(stance: CouncilAgentDebateRow["stance"]): {
  border: string;
  badge: string;
  label: string;
} {
  if (stance === "support") {
    return {
      border: "border-emerald-900/50",
      badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
      label: "Support",
    };
  }
  if (stance === "challenge") {
    return {
      border: "border-rose-900/50",
      badge: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
      label: "Challenge",
    };
  }
  return {
    border: "border-zinc-800",
    badge: "bg-zinc-700/30 text-zinc-400 ring-zinc-600/30",
    label: "Neutral",
  };
}

export function committeeDecisionStyles(decision: CouncilCommitteeDecision): {
  verdict: string;
  label: string;
} {
  if (decision.includes("APPROVE") || decision === "PROMOTE_TO_ACTIVE") {
    return {
      verdict: "ops-verdict border-emerald-800/60 bg-emerald-950/25",
      label: "text-emerald-300",
    };
  }
  if (decision === "REJECT" || decision === "DISABLE_STRATEGY") {
    return {
      verdict: "ops-verdict border-rose-800/60 bg-rose-950/25",
      label: "text-rose-300",
    };
  }
  if (decision === "DEMOTE_TO_PAPER_ONLY") {
    return {
      verdict: "ops-verdict border-amber-800/60 bg-amber-950/25",
      label: "text-amber-300",
    };
  }
  return {
    verdict: "ops-verdict border-amber-800/50 bg-amber-950/20",
    label: "text-amber-200",
  };
}

export function proposalStatusStyles(status: CouncilProposalStatus): string {
  const map: Record<CouncilProposalStatus, string> = {
    DRAFT: "bg-zinc-700/40 text-zinc-300 ring-zinc-600/40",
    APPROVED_FOR_PAPER: "bg-sky-500/20 text-sky-200 ring-sky-500/30",
    REJECTED: "bg-rose-500/20 text-rose-300 ring-rose-500/30",
    NEED_MORE_DATA: "bg-amber-500/20 text-amber-200 ring-amber-500/30",
    PROMOTED: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
    DISABLED: "bg-zinc-800/80 text-zinc-500 ring-zinc-700/40",
  };
  return `inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${map[status]}`;
}

export const COUNCIL_CAPABILITIES = [
  "Playbook engine",
  "Multi-agent desk",
  "Investment committee",
  "Paper trading",
  "Strategy registry",
  "Capital milestones",
  "Governance locks",
  "Validation & replay",
] as const;
