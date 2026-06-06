import type { AiStatusCardState } from "@/lib/ai-status/types";
import type { MissionControllerResult } from "@/lib/mission-controller/types";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import type {
  OneButtonAiAction,
  OneButtonAiLabel,
  OneButtonAiState,
} from "./types";
import { ONE_BUTTON_AI_SAFETY_NOTICE } from "./types";

export interface ResolveOneButtonInput {
  mission: MissionFlowSnapshot;
  controller?: MissionControllerResult | null;
  aiCard?: AiStatusCardState | null;
  dailyReviewDue?: boolean;
}

function baseState(
  label: OneButtonAiLabel,
  action: OneButtonAiAction,
  reason: string,
  detail: string,
  extra?: Partial<Pick<OneButtonAiState, "requiresClientConfirm" | "confirmMode">>,
): OneButtonAiState {
  return {
    label,
    action,
    reason,
    detail,
    requiresClientConfirm: extra?.requiresClientConfirm ?? false,
    confirmMode: extra?.confirmMode ?? null,
    liveLocked: true,
    cannotAutoExecuteLive: true,
    safetyNotice: ONE_BUTTON_AI_SAFETY_NOTICE,
  };
}

function closeSuggested(mission: MissionFlowSnapshot): boolean {
  const next = mission.aiStatus.nextAction.toLowerCase();
  return next.includes("close") || next.includes("reduce");
}

export function resolveOneButtonAiState(
  input: ResolveOneButtonInput,
): { state: OneButtonAiState; blockers: string[] } {
  const m = input.mission;
  const blockers: string[] = [];
  const controller = input.controller;
  const loop = input.aiCard?.loopBlocker;

  if (controller?.inputs.loopGuardActive || loop?.active) {
    blockers.push(loop?.reason ?? controller?.modeReason ?? "Autopilot loop guard active.");
    return {
      blockers,
      state: baseState(
        "Resolve Issue",
        "PAUSE_IF_RISK",
        "Autopilot loop guard stopped the desk.",
        "Review the blocker, then resume when safe. Automation will pause to prevent blind retries.",
      ),
    };
  }

  if (
    controller?.inputs.riskStatus === "EMERGENCY" ||
    controller?.inputs.riskStatus === "BLOCKED" ||
    controller?.inputs.dailyLossLimitHit
  ) {
    const reason =
      controller.modeReason ||
      `Risk engine ${controller.inputs.riskStatus?.toLowerCase() ?? "blocked"}.`;
    blockers.push(reason);
    return {
      blockers,
      state: baseState(
        "Resolve Issue",
        "PAUSE_IF_RISK",
        "Risk limits block new trading.",
        "Autopilot will pause. Clear the risk blocker before continuing.",
      ),
    };
  }

  if (m.binanceTestnet.status === "BLOCKED") {
    blockers.push(m.binanceTestnet.reason);
    return {
      blockers,
      state: baseState(
        "Resolve Issue",
        "RESOLVE_ISSUE",
        "Binance testnet connection blocked.",
        m.binanceTestnet.reason,
      ),
    };
  }

  if (m.risk.blocker) {
    blockers.push(m.risk.blocker);
    return {
      blockers,
      state: baseState(
        "Resolve Issue",
        "RESOLVE_ISSUE",
        "Mission risk blocker active.",
        `Clear blocker: ${m.risk.blocker}`,
      ),
    };
  }

  const preview = m.pendingTestnetPreview;
  if (preview && !preview.blocked) {
    return {
      blockers,
      state: baseState(
        "Approve Testnet Order",
        "ASK_PERMISSION_EXECUTE",
        "Testnet preview ready — execution needs your approval.",
        `${preview.symbol} ${preview.side} · $${preview.notionalUsd} · double confirm required.`,
        { requiresClientConfirm: true, confirmMode: "execute" },
      ),
    };
  }

  if (preview?.blocked) {
    blockers.push(preview.blockReasons.join("; ") || "Preview blocked by risk checks.");
  }

  const pos = m.currentPosition;
  if (
    pos?.canCloseOnTestnet &&
    (m.aiStatus.humanActionRequired || closeSuggested(m)) &&
    (closeSuggested(m) || controller?.inputs.humanActionRequired)
  ) {
    return {
      blockers,
      state: baseState(
        "Close Position",
        "ASK_PERMISSION_CLOSE",
        "AI monitor recommends closing the open testnet position.",
        `${pos.symbol} ${pos.side} · reduce-only close requires double confirm.`,
        { requiresClientConfirm: true, confirmMode: "close" },
      ),
    };
  }

  if (m.pendingLearningReview > 0 && !m.automation.autoLearnEnabled) {
    return {
      blockers,
      state: baseState(
        "Review Trade",
        "REVIEW_TRADE",
        `${m.pendingLearningReview} closed trade(s) need learning review.`,
        "Mark trades as learned so AI can improve tomorrow's plan.",
      ),
    };
  }

  if (!m.lastCycleAt && m.binanceTestnet.status === "CONNECTED") {
    return {
      blockers,
      state: baseState(
        "Start AI",
        "RUN_FIRST_ANALYSIS",
        "No AI cycle has run yet.",
        "Run the first analysis — AI will create a decision and testnet preview if appropriate.",
      ),
    };
  }

  if (m.openTrades > 0 || pos) {
    return {
      blockers,
      state: baseState(
        "Continue Monitoring",
        "MONITOR_POSITION",
        "Open testnet position — monitor before taking new risk.",
        pos?.summary ?? `${m.openTrades} open trade(s) on testnet.`,
      ),
    };
  }

  if (
    m.lastVerdict === "TRADE" &&
    !preview &&
    m.binanceTestnet.status === "CONNECTED" &&
    !m.automation.autoExecuteEnabled
  ) {
    return {
      blockers,
      state: baseState(
        "Approve Testnet Order",
        "CREATE_TESTNET_PREVIEW",
        "TRADE verdict without preview — create testnet preview next.",
        "AI will build a testnet order preview for your review (no auto-execute).",
      ),
    };
  }

  if (
    input.dailyReviewDue &&
    m.closedTrades > 0 &&
    !m.aiStatus.humanActionRequired
  ) {
    return {
      blockers,
      state: baseState(
        "Generate Report",
        "GENERATE_REPORT",
        "Daily AI self-review is due.",
        "Summarize today's trades, lessons, and tomorrow's plan.",
      ),
    };
  }

  if (m.automation.enabled && !m.automation.paused && m.binanceTestnet.status === "CONNECTED") {
    return {
      blockers,
      state: baseState(
        "Continue Monitoring",
        "RUN_ANALYSIS_CYCLE",
        "Standing by for the next safe desk cycle.",
        m.nextRecommendation || m.aiStatus.nextAction,
      ),
    };
  }

  if (m.binanceTestnet.status !== "CONNECTED") {
    blockers.push(m.binanceTestnet.reason);
    return {
      blockers,
      state: baseState(
        "Resolve Issue",
        "RESOLVE_ISSUE",
        "Connect Binance testnet before AI can trade.",
        m.binanceTestnet.reason,
      ),
    };
  }

  return {
    blockers,
    state: baseState(
      "Start AI",
      "RUN_ANALYSIS_CYCLE",
      "Run the next AI analysis cycle.",
      m.nextRecommendation || "Analyze markets and create the next decision.",
    ),
  };
}
