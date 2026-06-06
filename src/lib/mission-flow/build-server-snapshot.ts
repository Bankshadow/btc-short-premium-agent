import { loadAutomationHistory } from "@/lib/automation-control-plane/state-store";
import {
  buildGoalDashboardServerPayload,
  buildGoalTradeListServer,
} from "@/lib/goal-engine/build-server-context";
import { findPendingTestnetPreview } from "@/lib/exchange/binance";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { loadGoalNotificationPrefs } from "@/lib/mission-notifications/goal-notification-store";
import { buildStrategyHealthSignal } from "@/lib/strategy-health";
import { buildMissionActivityFromRuns } from "./build-mission-activity";
import { buildMissionLearningInsights } from "./build-mission-learning-insights";
import { buildMissionFlowSnapshot } from "./build-mission-flow-snapshot";
import { loadServerEvaluationResults } from "@/lib/self-learning/evaluation-server-store";
import { resolvePrimaryStrategyHealth } from "./resolve-primary-strategy-health";
import { emptyMissionFlowSnapshot } from "./empty-snapshot";
import {
  clearMissionSnapshotCache,
  readMissionSnapshotCache,
  writeMissionSnapshotCache,
} from "./snapshot-cache";
import { toMissionFlowPendingPreview } from "./to-pending-preview";
import type { MissionFlowBuildResult } from "./types";

export interface BuildMissionSnapshotOptions {
  fresh?: boolean;
}

export async function buildMissionFlowServerSnapshot(
  options: BuildMissionSnapshotOptions = {},
): Promise<MissionFlowBuildResult> {
  if (!options.fresh) {
    const cached = readMissionSnapshotCache();
    if (cached) {
      return {
        snapshot: cached.snapshot,
        degraded: false,
        warnings: [],
        cached: true,
      };
    }
  }

  const warnings: string[] = [];

  try {
    const [payload, trades, entriesRaw, notificationPrefs, automationHistory] =
      await Promise.all([
        buildGoalDashboardServerPayload().catch((err) => {
          warnings.push(
            err instanceof Error ? err.message : "Goal payload failed",
          );
          return null;
        }),
        buildGoalTradeListServer().catch(() => []),
        loadServerAnalysisJournal().catch(() => []),
        loadGoalNotificationPrefs().catch(() => ({
          notifyOnTrade: true,
          notifyOnBlocker: true,
          lastAlertAt: null,
        })),
        loadAutomationHistory().catch(() => []),
      ]);

    if (!payload) {
      return {
        snapshot: emptyMissionFlowSnapshot(),
        degraded: true,
        warnings,
        cached: false,
      };
    }

    const entries = filterProductionEntries(entriesRaw);
    const latestDecisionLogId = entries[0]?.id ?? null;
    const openTrades = trades.filter(
      (t) => t.result === "OPEN" && t.environment !== "LIVE",
    ).length;

    const pendingRaw = await findPendingTestnetPreview(latestDecisionLogId).catch(
      () => null,
    );
    const pendingTestnetPreview = pendingRaw
      ? toMissionFlowPendingPreview(pendingRaw)
      : null;

    const strategySignal = buildStrategyHealthSignal(payload.strategyHealth);
    const strategyHealth = resolvePrimaryStrategyHealth(payload.strategyHealth);
    if (strategyHealth) {
      strategyHealth.healthScorePct = strategySignal.healthScorePct;
    }

    const serverEvals = await loadServerEvaluationResults().catch(() => []);
    const agentHits = new Map<string, number>();
    for (const r of serverEvals) {
      for (const a of r.agentEvaluations) {
        if (a.helpingScore >= 0.5) {
          agentHits.set(a.agentName, (agentHits.get(a.agentName) ?? 0) + 1);
        }
      }
    }
    const lastTopAgent =
      [...agentHits.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const snapshot = buildMissionFlowSnapshot(
      payload,
      latestDecisionLogId,
      openTrades,
      pendingTestnetPreview,
      notificationPrefs,
      {
        recentActivity: buildMissionActivityFromRuns(automationHistory),
        learningInsights: buildMissionLearningInsights(payload.learningRecords),
        strategyHealth,
        selfLearning: {
          serverEvaluated: serverEvals.length,
          lastTopAgent,
          lastEvaluatedAt: serverEvals[0]?.generatedAt ?? null,
        },
      },
    );

    writeMissionSnapshotCache(snapshot);
    return {
      snapshot,
      degraded: warnings.length > 0,
      warnings,
      cached: false,
    };
  } catch (error) {
    warnings.push(
      error instanceof Error ? error.message : "Mission snapshot build failed",
    );
    return {
      snapshot: emptyMissionFlowSnapshot(),
      degraded: true,
      warnings,
      cached: false,
    };
  }
}

export function invalidateMissionSnapshotCache(): void {
  clearMissionSnapshotCache();
}
