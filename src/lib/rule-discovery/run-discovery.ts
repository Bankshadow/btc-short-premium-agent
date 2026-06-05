import { buildMemoryGraph } from "@/lib/memory-graph/build-graph";
import { buildUnifiedPortfolioSnapshot } from "@/lib/portfolio/build-unified-portfolio";
import type { RuleDiscoveryInput, RuleDiscoveryReport } from "./types";
import { buildRuleDiscoveryReport } from "./build-report";
import { mergeDiscoveredProposals } from "./proposal-store";
import { generateProposalsFromPatterns } from "./generate-proposals";
import { discoverPatterns } from "./discover-patterns";

export function runRuleDiscovery(
  input: RuleDiscoveryInput,
  storedProposals: RuleDiscoveryReport["proposals"] = [],
  persist = false,
): RuleDiscoveryReport {
  const memoryGraph =
    input.memoryGraph ??
    buildMemoryGraph({
      entries: input.entries,
      orders: input.orders,
      registryStrategies: input.registryStrategies,
    });

  void buildUnifiedPortfolioSnapshot({
    entries: input.entries,
    orders: input.orders,
    perpPositions: input.perpPositions,
    riskProfile: input.riskProfile,
  });

  const enriched: RuleDiscoveryInput = {
    ...input,
    memoryGraph,
  };

  const patterns = discoverPatterns(enriched);
  const fresh = generateProposalsFromPatterns(
    patterns,
    input.entries,
    input.orders,
  );

  const merged = persist
    ? mergeDiscoveredProposals(fresh)
    : [...storedProposals];

  for (const p of fresh) {
    if (!merged.some((m) => m.patternId === p.patternId)) {
      merged.push(p);
    }
  }

  return buildRuleDiscoveryReport(enriched, merged);
}
