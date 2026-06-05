import { mergeEvaluationResults } from "@/lib/self-learning/evaluation-store";
import { mergeDiscoveredProposals } from "@/lib/rule-discovery/proposal-store";
import { mergeAdaptationProposals } from "@/lib/strategy-adaptation/proposal-store";
import { saveMemoryGraphSnapshot } from "@/lib/memory-graph/graph-store";
import type { DeskManagerRunResult } from "./types";
import { mergeActionQueue } from "./action-queue-store";
import {
  saveDeskManagerSettings,
  loadDeskManagerSettings,
} from "./settings";

export function persistDeskManagerResult(
  result: DeskManagerRunResult,
): void {
  if (typeof window === "undefined") return;
  const persist = result.clientMustPersist;
  if (persist?.evaluations?.length) {
    mergeEvaluationResults(persist.evaluations);
  }
  if (persist?.ruleProposals?.length) {
    mergeDiscoveredProposals(persist.ruleProposals);
  }
  if (persist?.adaptationProposals?.length) {
    mergeAdaptationProposals(persist.adaptationProposals);
  }
  if (persist?.memoryGraph) {
    saveMemoryGraphSnapshot(persist.memoryGraph);
  }
  if (result.actionQueue.length) {
    mergeActionQueue(result.actionQueue);
  }

  const settings = loadDeskManagerSettings();
  const patch: Partial<typeof settings> = {};
  if (result.cycleType === "operational") {
    patch.lastOperationalRunAt = result.timestamp;
  } else if (result.cycleType === "daily_learning") {
    patch.lastDailyLearningRunAt = result.timestamp;
  } else if (result.cycleType === "weekly_strategy_review") {
    patch.lastWeeklyReviewRunAt = result.timestamp;
  }
  saveDeskManagerSettings(patch);

  localStorage.setItem(
    "btc-desk:desk-manager-last-run",
    JSON.stringify(result),
  );
}

export function loadLastDeskManagerRun(): DeskManagerRunResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("btc-desk:desk-manager-last-run");
    if (!raw) return null;
    return JSON.parse(raw) as DeskManagerRunResult;
  } catch {
    return null;
  }
}
