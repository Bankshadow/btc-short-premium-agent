import { newStrategistMvpId } from "@/lib/project-strategist/ids";
import type { MVPProposal } from "@/lib/project-strategist/types";
import type { AuditDiagnosis, MvpPlanningResult, StrategistAgentInput } from "./types";

function createMvp(base: Omit<MVPProposal, "mvpId" | "createdAt" | "updatedAt">): MVPProposal {
  const now = new Date().toISOString();
  return {
    ...base,
    mvpId: newStrategistMvpId(),
    createdAt: now,
    updatedAt: now,
  };
}

function existingTitleSet(previous: MVPProposal[]): Set<string> {
  return new Set(previous.map((p) => p.title.toLowerCase()));
}

export function runMvpPlannerAgent(input: {
  agentInput: StrategistAgentInput;
  audit: AuditDiagnosis;
  uxRecommendations: string[];
}): MvpPlanningResult {
  const ctx = input.agentInput.context;
  const used = existingTitleSet(input.agentInput.previousMvpProposals);
  const monitor = ctx.latestTestnetMonitor;
  const automation = ctx.latestAutomationStatus;

  const candidates: MVPProposal[] = [];

  candidates.push(
    createMvp({
      title: "Primary Cockpit Simplification",
      problem: "Too many modules are visible, making daily execution flow unclear.",
      whyNow: "Operator focus and adoption improve immediately with cleaner primary navigation.",
      expectedImpact: "Faster daily workflow and fewer missed core actions.",
      implementationScope: "Reorder primary nav, fold advanced links, and simplify high-priority panels.",
      affectedPages: ["/", "/automation-control", "/testnet-monitor"],
      affectedAPIs: ["/api/automation/status", "/api/testnet-monitor/snapshot"],
      affectedModules: ["ops-theme", "cockpit", "testnet-monitor"],
      estimatedComplexity: "SMALL",
      oneDayPlan: [
        "Define Primary vs Advanced module groups in ops navigation.",
        "Reduce cockpit visible links to daily essentials.",
        "Add explicit jump links for testnet monitor and automation status.",
        "Ship with a small operator checklist banner.",
      ],
      risks: ["Potential operator confusion if muscle memory depends on current nav order."],
      acceptanceCriteria: [
        "Primary navigation shows only daily-critical routes.",
        "Advanced modules remain reachable but visually de-emphasized.",
        "Operator can reach testnet monitor and automation control in one click from cockpit.",
      ],
      cursorPrompt:
        "Refactor cockpit navigation into Primary and Advanced groups, keep testnet-monitor and automation-control as primary shortcuts, and reduce visual noise without removing any modules.",
      status: "PROPOSED",
    }),
  );

  candidates.push(
    createMvp({
      title: "Testnet Monitor Reliability Tightening",
      problem: "Execution readiness can degrade silently when monitor mismatch/disconnect occurs.",
      whyNow: "Trading decisions are only as good as monitor reliability; stabilize before adding scope.",
      expectedImpact: "Higher confidence in testnet PnL feedback and safer execution loop.",
      implementationScope: "Strengthen monitor mismatch diagnostics and surface blockers in one place.",
      affectedPages: ["/testnet-monitor", "/binance-testnet"],
      affectedAPIs: ["/api/testnet-monitor/snapshot", "/api/exchange/binance/status"],
      affectedModules: ["testnet-monitor", "binance-execution", "journal-linkage"],
      estimatedComplexity: "SMALL",
      oneDayPlan: [
        "Improve mismatch labels and recommended operator actions.",
        "Add monitor health badge to Binance testnet dashboard.",
        "Persist last known healthy snapshot for quick regression detection.",
      ],
      risks: ["May expose latent journal data quality issues that need follow-up."],
      acceptanceCriteria: [
        "Monitor shows explicit SAFE/CAUTION/BLOCKED reason.",
        "Binance dashboard reflects monitor health and mismatch count.",
        "Operator can identify root-cause path in under 1 minute.",
      ],
      cursorPrompt:
        "Improve testnet monitor diagnostics by surfacing mismatch causes, health reasons, and corrective actions in /testnet-monitor and /binance-testnet.",
      status: "PROPOSED",
    }),
  );

  candidates.push(
    createMvp({
      title: "Automation Noise Reduction Pass",
      problem: "Automation queues and failed jobs create noisy operator backlog.",
      whyNow: "Without noise reduction, automation trust and adoption stagnate.",
      expectedImpact: "Cleaner automation signal with fewer manual retries.",
      implementationScope: "Improve failure grouping, stale action cleanup, and digest clarity.",
      affectedPages: ["/automation-control", "/actions", "/worker"],
      affectedAPIs: ["/api/automation/jobs", "/api/automation/status", "/api/worker/status"],
      affectedModules: ["automation-control-plane", "operator-action-queue", "worker"],
      estimatedComplexity: "MEDIUM",
      oneDayPlan: [
        "Group failures by root cause and hide duplicates.",
        "Auto-expire stale pending actions older than configured TTL.",
        "Enhance digest summary with only top 3 actionable items.",
      ],
      risks: ["Over-filtering could hide a rare critical failure."],
      acceptanceCriteria: [
        "Failed jobs list collapses duplicate errors.",
        "Pending actions are capped to actionable, recent items.",
        "Daily digest includes concise prioritized actions.",
      ],
      cursorPrompt:
        "Reduce automation control noise by deduplicating failure rows, expiring stale actions, and producing concise top-action summaries.",
      status: "PROPOSED",
    }),
  );

  const filtered = candidates.filter((c) => !used.has(c.title.toLowerCase()));
  const ranked = filtered.sort((a, b) => {
    const score = (m: MVPProposal): number => {
      let s = 0;
      if (m.title.includes("Testnet") && (!monitor?.connected || (monitor?.mismatches.length ?? 0) > 0)) s += 5;
      if (m.title.includes("Automation") && (!automation?.state.lastRun || (automation.failedJobs.length ?? 0) > 0)) s += 4;
      if (m.title.includes("Cockpit") && ctx.routeList.length > 40) s += 3;
      if (m.estimatedComplexity === "SMALL") s += 2;
      return s;
    };
    return score(b) - score(a);
  });

  const recommended = ranked[0] ?? candidates[0];
  const rejected = ranked.slice(1, 3).map((m) => ({ ...m, status: "REJECTED" as const }));

  return {
    recommendedMVP: recommended,
    rejectedMVPs: rejected,
    oneDayImplementationPlan: recommended.oneDayPlan,
    acceptanceCriteria: recommended.acceptanceCriteria,
  };
}
