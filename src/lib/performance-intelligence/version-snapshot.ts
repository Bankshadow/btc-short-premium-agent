import type { AdaptiveWeightingSettings } from "@/lib/adaptive-agent-weighting/types";
import type { AutoDiscoveredRuleProposal } from "@/lib/rule-discovery/types";
import type { PersistedStrategyRegistry } from "@/lib/strategy-registry/strategy-registry-store";
import type { AiVersionSnapshot } from "./types";

function stamp(count: number, latest: string | null, prefix: string): string {
  return `${prefix}-v${count}${latest ? `@${latest.slice(0, 10)}` : ""}`;
}

export function buildAiVersionSnapshot(input: {
  riskProfile?: string;
  adaptiveSettings?: AdaptiveWeightingSettings | null;
  adaptiveAuditCount?: number;
  persistedRegistry?: PersistedStrategyRegistry;
  ruleProposals?: AutoDiscoveredRuleProposal[];
  governanceAuditCount?: number;
  governanceLastChangeAt?: string | null;
}): AiVersionSnapshot {
  const registry = input.persistedRegistry;
  const historyCount = registry
    ? Object.values(registry.versionHistory).reduce(
        (sum, rows) => sum + (rows?.length ?? 0),
        0,
      )
    : 0;
  const latestRegistryChange = registry
    ? Object.values(registry.versionHistory)
        .flat()
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))[0]
        ?.changedAt ?? null
    : null;

  const activeRules = (input.ruleProposals ?? []).filter((r) =>
    ["approved", "active"].includes(r.lifecycle),
  );
  const latestRuleReview = (input.ruleProposals ?? [])
    .map((r) => r.reviewedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0] as string | undefined;

  const weightEnabled = input.adaptiveSettings?.adaptiveWeightingEnabled
    ? "on"
    : "off";

  return {
    aiPolicyVersion: stamp(
      input.riskProfile === "aggressive" ? 2 : 1,
      new Date().toISOString(),
      `policy-${input.riskProfile ?? "balanced"}`,
    ),
    strategyRegistryVersion: stamp(historyCount, latestRegistryChange, "registry"),
    ruleSetVersion: stamp(
      activeRules.length,
      latestRuleReview ?? null,
      "rules",
    ),
    agentWeightVersion: stamp(
      input.adaptiveAuditCount ?? 0,
      null,
      `weights-${weightEnabled}`,
    ),
    governanceVersion: stamp(
      input.governanceAuditCount ?? 0,
      input.governanceLastChangeAt ?? null,
      "gov",
    ),
    capturedAt: new Date().toISOString(),
  };
}
