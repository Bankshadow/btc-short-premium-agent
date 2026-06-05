import type { AdaptiveWeightingAuditEntry } from "./types";
import type { WeightedCommitteeVerdict } from "./types";

export const ADAPTIVE_WEIGHTING_AUDIT_KEY = "btc-desk:adaptive-weighting-audit";

export function loadAdaptiveWeightingAudit(): AdaptiveWeightingAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ADAPTIVE_WEIGHTING_AUDIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AdaptiveWeightingAuditEntry[];
  } catch {
    return [];
  }
}

export function appendAdaptiveWeightingAudit(
  weighted: WeightedCommitteeVerdict,
  marketRegime: string,
): AdaptiveWeightingAuditEntry[] {
  const topTrusted =
    weighted.weightProfile.entries.find((e) => e.trustedReasons.length > 0)
      ?.agentName ?? null;
  const topDown =
    weighted.weightProfile.entries.find((e) => e.downweightedReasons.length > 0)
      ?.agentName ?? null;

  const entry: AdaptiveWeightingAuditEntry = {
    id: `aw-audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    marketRegime,
    originalVerdict: weighted.originalVerdict,
    weightedVerdict: weighted.weightedVerdict,
    verdictDiffers: weighted.verdictDiffers,
    disagreementScore: weighted.disagreementScore,
    hardGatesApplied: weighted.hardGatesApplied,
    topTrustedAgent: topTrusted,
    topDownweightedAgent: topDown,
  };

  const next = [entry, ...loadAdaptiveWeightingAudit()].slice(0, 80);
  if (typeof window !== "undefined") {
    localStorage.setItem(ADAPTIVE_WEIGHTING_AUDIT_KEY, JSON.stringify(next));
  }
  return next;
}
