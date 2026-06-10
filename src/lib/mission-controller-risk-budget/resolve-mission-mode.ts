import type { TestnetClosedTrade } from "@/lib/testnet-monitor/types";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type { MissionMode } from "./types";

export function computeLosingStreakFromClosedTrades(
  closedTrades: TestnetClosedTrade[],
): number {
  const sorted = [...closedTrades].sort(
    (a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt),
  );
  let streak = 0;
  for (const trade of sorted) {
    if (trade.result === "LOSS") streak += 1;
    else break;
  }
  return streak;
}

export function resolveMissionMode(input: {
  dailyLossLimitHit: boolean;
  automationPaused: boolean;
  criticalIncidentOpen: boolean;
  losingStreak: number;
  dailyPnlStressed: boolean;
  strategyStatus: string | null;
  blocksNewTestnetEntries: boolean;
  riskBudgetMode: MissionMode | "COOLDOWN";
  drawdownPct: number;
  overconfidence: boolean;
  avgQuality: number | null;
  evidenceReady: boolean;
  readinessBlocked: boolean;
}): { mode: MissionMode; reason: string } {
  if (input.dailyLossLimitHit) {
    return {
      mode: "PAUSED",
      reason: "Daily loss limit hit — mission paused until next session.",
    };
  }
  if (input.automationPaused) {
    return {
      mode: "PAUSED",
      reason: "Autopilot paused by operator.",
    };
  }
  if (input.criticalIncidentOpen) {
    return {
      mode: "PAUSED",
      reason: "Critical incident open — resolve before new risk.",
    };
  }
  if (
    input.losingStreak >= VALIDATION_THRESHOLDS.lossStreakCooldown ||
    input.dailyPnlStressed ||
    input.blocksNewTestnetEntries ||
    input.strategyStatus === "PAUSE" ||
    input.strategyStatus === "REJECT" ||
    input.readinessBlocked ||
    input.riskBudgetMode === "COOLDOWN"
  ) {
    const parts: string[] = [];
    if (input.losingStreak >= VALIDATION_THRESHOLDS.lossStreakCooldown) {
      parts.push(`${input.losingStreak}-trade losing streak`);
    }
    if (input.dailyPnlStressed) parts.push("daily PnL stressed");
    if (input.strategyStatus === "PAUSE" || input.strategyStatus === "REJECT") {
      parts.push(`strategy health ${input.strategyStatus}`);
    }
    return {
      mode: "COOLDOWN",
      reason: parts.length
        ? `Cooldown — ${parts.join(", ")}.`
        : "Cooldown — reduce activity until metrics recover.",
    };
  }
  if (
    input.drawdownPct >= VALIDATION_THRESHOLDS.maxDrawdownWatchPct ||
    input.overconfidence ||
    input.strategyStatus === "REDUCE_RISK" ||
    (input.avgQuality != null && input.avgQuality < 55) ||
    !input.evidenceReady
  ) {
    return {
      mode: "DEFENSIVE",
      reason: "Defensive posture — drawdown, quality, or calibration warrants smaller size.",
    };
  }
  if (
    input.evidenceReady &&
    input.strategyStatus === "CONTINUE" &&
    !input.overconfidence &&
    (input.avgQuality == null || input.avgQuality >= 68)
  ) {
    return {
      mode: "OPPORTUNITY",
      reason: "Evidence and strategy health support opportunity sizing on testnet.",
    };
  }
  return {
    mode: "NORMAL",
    reason: "Standard mission mode — progress toward $10k with governed testnet risk.",
  };
}

export function deriveMissionNextAction(input: {
  missionMode: MissionMode;
  progressPct: number;
  modeReason: string;
}): string {
  switch (input.missionMode) {
    case "PAUSED":
      return "Clear daily loss or incident blocker — do not add new testnet exposure.";
    case "COOLDOWN":
      return "Wait for losing streak reset or strategy health recovery before sizing up.";
    case "DEFENSIVE":
      return "Use recommended reduced limits only — monitor drawdown and trade quality.";
    case "OPPORTUNITY":
      return `Continue testnet cycles toward target (${input.progressPct.toFixed(0)}% to $10k) within recommended caps.`;
    default:
      return "Follow recommended risk limits and review Reports after each close batch.";
  }
}

export function dailyLossLimitHit(
  dailyPnlPct: number,
  limitPct = VALIDATION_THRESHOLDS.dailyLossLimitPct,
): boolean {
  return dailyPnlPct <= limitPct;
}

export function dailyPnlStressed(
  dailyPnlPct: number,
  limitPct = VALIDATION_THRESHOLDS.dailyLossLimitPct,
): boolean {
  return dailyPnlPct <= limitPct * 0.7;
}
