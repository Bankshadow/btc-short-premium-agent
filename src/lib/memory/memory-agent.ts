import type { AgentOutput } from "@/lib/agents/types";
import { buildAgentOutput, type TradingDeskContext } from "@/lib/agents/shared";
import { prepareDeskMemoryGraph } from "@/lib/memory-graph/prepare-desk-memory";
import {
  buildDeskMemoryBuckets,
  countLogs,
  recentVerdictBias,
} from "./build-desk-memory";
import type { DeskMemoryClientPayload, DeskMemorySnapshot } from "./types";

export function runDeskMemoryAgent(
  ctx: TradingDeskContext,
  payload: DeskMemoryClientPayload | undefined,
): DeskMemorySnapshot {
  const currentRegime = ctx.deskMemoryRegime ?? "Unknown";
  const buckets = buildDeskMemoryBuckets(payload, currentRegime);
  const graphPrep =
    ctx.deskMemoryGraphSnapshot && ctx.deskMemoryRelevant
      ? {
          snapshot: ctx.deskMemoryGraphSnapshot,
          relevant: ctx.deskMemoryRelevant,
          bullets: ctx.deskMemoryBullets ?? [],
        }
      : prepareDeskMemoryGraph(payload, currentRegime, ctx.input.deskRiskProfile);
  const bullets = graphPrep.bullets;
  const counts = countLogs(payload);
  const bias = recentVerdictBias(payload?.recentLogs ?? []);

  const reasons: string[] = [];
  if (bullets.length > 0) {
    reasons.push(...bullets.slice(0, 4));
  } else {
    reasons.push(
      "No desk memory yet — resolve outcomes and approve rules to build learning context.",
    );
  }

  if (counts.pending > 0) {
    reasons.push(`${counts.pending} decision(s) still PENDING resolution.`);
  }

  if (bias) {
    reasons.push(`Recent resolved bias: committee leaned ${bias} (paper history).`);
  }

  const hasApproved = buckets.approvedPlaybookHints.length > 0;
  const recommendation =
    bullets.length === 0
      ? "WAIT"
      : hasApproved
        ? "WAIT"
        : bias ?? "WAIT";

  const agent: AgentOutput = buildAgentOutput(
    {
      agentName: "Desk Memory Agent",
      strategyType: "MEMORY",
      marketView: `Memory context · ${currentRegime}`,
      recommendation,
      confidence: bullets.length >= 3 ? 75 : 45,
      reasons,
      risks: [
        "Memory graph is advisory — cannot place trades or bypass governance or risk veto.",
        "Approved rules are hints only until explicitly integrated into engine.",
      ],
      proposedAction:
        "Inject prior learnings into bull/bear/strategy debate — human approval still required.",
    },
    ctx,
  );

  return {
    generatedAt: new Date().toISOString(),
    currentRegime,
    bullets,
    buckets,
    approvedRuleCount: buckets.approvedPlaybookHints.length,
    resolvedCount: counts.resolved,
    pendingCount: counts.pending,
    agent,
    graphSnapshot: graphPrep.snapshot,
    relevantMemory: graphPrep.relevant,
  };
}
