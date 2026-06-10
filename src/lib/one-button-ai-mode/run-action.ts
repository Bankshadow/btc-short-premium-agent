import { runCentralAnalysisOrchestrator } from "@/lib/analysis-engine/analysis-orchestrator";
import {
  pauseAutomation,
} from "@/lib/automation-control-plane/scheduler";
import { runDailySelfReview } from "@/lib/daily-self-review/run-daily-self-review";
import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import { runGoalStartAiCycle } from "@/lib/goal-engine/run-start-ai-cycle";
import {
  buildMissionFlowServerSnapshot,
  invalidateMissionSnapshotCache,
} from "@/lib/mission-flow/build-server-snapshot";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { runAnomalyDetectionSnapshot } from "@/lib/anomaly-detection";
import { buildOneButtonAiStatus } from "./build-status";
import { resolveOneButtonAiState } from "./resolve-next-action";
import type { OneButtonAiAction, OneButtonAiRunResult } from "./types";
import { ONE_BUTTON_AI_SAFETY_NOTICE } from "./types";

function clientConfirmResult(
  action: OneButtonAiAction,
  label: OneButtonAiRunResult["label"],
  summary: string,
  confirmMode: "execute" | "close",
  extras?: Partial<OneButtonAiRunResult>,
): OneButtonAiRunResult {
  return {
    ok: true,
    action,
    label,
    summary,
    requiresClientConfirm: true,
    confirmMode,
    navigateTo: null,
    safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
    cannotAutoExecuteLive: true,
    ...extras,
  };
}

export async function runOneButtonAiAction(
  workspaceId = "server-default",
  forcedAction?: OneButtonAiAction,
): Promise<OneButtonAiRunResult> {
  const liveBlock = blockBinanceProductionOrder();
  if (liveBlock) {
    return {
      ok: false,
      action: forcedAction ?? "RESOLVE_ISSUE",
      label: "Resolve blocker",
      summary: liveBlock,
      requiresClientConfirm: false,
      confirmMode: null,
      navigateTo: null,
      error: liveBlock,
      safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
      cannotAutoExecuteLive: true,
    };
  }

  const status = await buildOneButtonAiStatus(workspaceId);
  const action = forcedAction ?? status.state.action;
  const label = status.state.label;

  switch (action) {
    case "ASK_PERMISSION_EXECUTE":
      return clientConfirmResult(
        action,
        "Approve testnet order",
        status.state.detail,
        "execute",
        {
          previewId: (await buildMissionFlowServerSnapshot({ fresh: true })).snapshot
            .pendingTestnetPreview?.previewId ?? null,
          decisionLogId:
            (await buildMissionFlowServerSnapshot({ fresh: true })).snapshot
              .latestDecisionLogId ?? null,
        },
      );

    case "ASK_PERMISSION_CLOSE":
      return clientConfirmResult(
        action,
        "Close position",
        status.state.detail,
        "close",
      );

    case "RUN_FIRST_ANALYSIS": {
      const cycle = await runGoalStartAiCycle();
      invalidateMissionSnapshotCache();
      return {
        ok: true,
        action,
        label: "Start AI",
        summary: `Analysis complete · verdict ${cycle.journalEntry.finalVerdict}`,
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo: null,
        previewId: cycle.testnetPreview?.previewId ?? null,
        decisionLogId: cycle.journalEntry.id,
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };
    }

    case "RUN_ANALYSIS_CYCLE": {
      const cycle = await runCentralAnalysisOrchestrator({
        trigger: "manual",
        enrichMvp9: true,
        runAutopilot: true,
        createTestnetPreview: true,
      });
      invalidateMissionSnapshotCache();
      return {
        ok: cycle.ok,
        action,
        label,
        summary: `Analysis cycle · verdict ${cycle.result.finalVerdict}`,
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo: null,
        previewId: cycle.result.tradeCandidate?.previewId ?? null,
        decisionLogId: cycle.result.decisionLogId,
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };
    }

    case "CREATE_TESTNET_PREVIEW": {
      const cycle = await runGoalStartAiCycle();
      invalidateMissionSnapshotCache();
      if (cycle.testnetPreview && !cycle.testnetPreview.blocked) {
        return clientConfirmResult(
          "ASK_PERMISSION_EXECUTE",
          "Approve testnet order",
          `Preview ${cycle.testnetPreview.symbol} ${cycle.testnetPreview.side} ready for review.`,
          "execute",
          {
            previewId: cycle.testnetPreview.previewId,
            decisionLogId: cycle.journalEntry.id,
          },
        );
      }
      return {
        ok: true,
        action,
        label: "Approve testnet order",
        summary: cycle.testnetPreview?.blocked
          ? `Preview blocked: ${cycle.testnetPreview.blockReasons.join("; ")}`
          : `Verdict ${cycle.journalEntry.finalVerdict} — no testnet preview created.`,
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo: null,
        previewId: cycle.testnetPreview?.previewId ?? null,
        decisionLogId: cycle.journalEntry.id,
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };
    }

    case "MONITOR_POSITION": {
      await buildTestnetMonitorSnapshot();
      await runAnomalyDetectionSnapshot({ persist: true, useCache: false }).catch(
        () => null,
      );
      const { emitEngineEvent } = await import("@/lib/engine-event-bus/emit-engine-event");
      await emitEngineEvent({
        type: "POSITION_MONITORED",
        summary: "Open position monitored — testnet snapshot refreshed",
        meaningful: true,
      }).catch(() => undefined);
      invalidateMissionSnapshotCache();
      return {
        ok: true,
        action,
        label: "Monitor position",
        summary: "Testnet monitor refreshed — position and risk checked.",
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo: null,
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };
    }

    case "REVIEW_TRADE":
      return {
        ok: true,
        action,
        label: "Review preview",
        summary: "Open learning review for closed trades.",
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo: "/reports",
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };

    case "GENERATE_REPORT": {
      const review = await runDailySelfReview({
        workspaceId,
        trigger: "manual",
        force: true,
      });
      return {
        ok: review.ok && !review.skipped,
        action,
        label: "Generate report",
        summary: review.skipped
          ? (review.reason ?? "Daily review not due.")
          : "Daily AI self-review generated.",
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo: "/reports",
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };
    }

    case "PAUSE_IF_RISK": {
      await pauseAutomation(true, workspaceId);
      invalidateMissionSnapshotCache();
      return {
        ok: true,
        action,
        label: "Resolve blocker",
        summary: "Autopilot paused due to risk or loop guard.",
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo: "/ai-status",
        pausedAutomation: true,
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };
    }

    case "RESOLVE_ISSUE": {
      const { snapshot } = await buildMissionFlowServerSnapshot({ fresh: true });
      const { blockers } = resolveOneButtonAiState({ mission: snapshot });
      return {
        ok: true,
        action,
        label: "Resolve blocker",
        summary: blockers[0] ?? status.state.detail,
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo:
          snapshot.binanceTestnet.status !== "CONNECTED"
            ? "/binance-testnet"
            : "/ai-status",
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };
    }

    default:
      return {
        ok: false,
        action,
        label,
        summary: "Unknown action",
        requiresClientConfirm: false,
        confirmMode: null,
        navigateTo: null,
        error: `Unsupported action: ${action}`,
        safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
        cannotAutoExecuteLive: true,
      };
  }
}
