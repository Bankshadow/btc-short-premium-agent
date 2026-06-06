import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { ConsciousMemorySnapshot } from "./types";

export function buildConsciousMemory(input: {
  openPositionLabels?: string[];
  currentStrategy?: string | null;
  riskState?: string | null;
  latestEntry?: DecisionLogEntry | null;
  blockers?: string[];
}): ConsciousMemorySnapshot {
  const latest = input.latestEntry;
  return {
    updatedAt: new Date().toISOString(),
    openPositions: input.openPositionLabels ?? [],
    currentStrategy: input.currentStrategy ?? null,
    riskState: input.riskState ?? "Within limits",
    latestAiDecision:
      latest?.finalVerdict != null
        ? `${latest.finalVerdict} · ${new Date(latest.timestamp).toLocaleString()}`
        : null,
    blockers: (input.blockers ?? []).filter(Boolean).slice(0, 5),
  };
}

export function consciousToHighlights(conscious: ConsciousMemorySnapshot): string[] {
  const lines: string[] = [];
  if (conscious.openPositions.length > 0) {
    lines.push(`Open: ${conscious.openPositions.join(", ")}`);
  } else {
    lines.push("No open positions");
  }
  if (conscious.currentStrategy) lines.push(`Strategy: ${conscious.currentStrategy}`);
  lines.push(`Risk: ${conscious.riskState}`);
  if (conscious.latestAiDecision) {
    lines.push(`Latest decision: ${conscious.latestAiDecision}`);
  }
  if (conscious.blockers.length > 0) {
    lines.push(`Blocker: ${conscious.blockers[0]}`);
  }
  return lines;
}
